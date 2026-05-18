import {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
} from "@std/assert";
import {
  type NetworkWebSocketFactoryOptions,
  WebSocketNetworkTransport,
} from "./websocket-transport.ts";
import type { NetworkMessage } from "./types.ts";

class FakeWebSocket {
  static readonly OPEN = 1;
  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;

  constructor(readonly url: string) {}

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }
}

Deno.test("websocket network transport connects and sends JSON messages", async () => {
  const sockets: FakeWebSocket[] = [];
  const transport = new WebSocketNetworkTransport({
    webSocketFactory: (url) => {
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket;
    },
  });
  const connected = transport.connect("wss://relay.example.test/mcp/_tunnel");
  const socket = sockets[0];
  assertExists(socket);
  socket.onopen?.();
  await connected;

  transport.send({
    type: "agent.hello",
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
  });

  assertEquals(socket?.url, "wss://relay.example.test/mcp/_tunnel");
  assertEquals(JSON.parse(socket?.sent[0] ?? ""), {
    type: "agent.hello",
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
  });
});

Deno.test("websocket network transport sends bearer auth in handshake headers", async () => {
  const sockets: FakeWebSocket[] = [];
  let handshakeOptions: NetworkWebSocketFactoryOptions | undefined;
  const transport = new WebSocketNetworkTransport({
    auth: { type: "bearer", token: "oauth-access-token" },
    webSocketFactory: (url, options) => {
      handshakeOptions = options;
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket;
    },
  });

  const connected = transport.connect("wss://relay.example.test/mcp/_tunnel");
  const socket = sockets[0];
  assertExists(socket);
  socket.onopen?.();
  await connected;

  assertEquals(socket.url, "wss://relay.example.test/mcp/_tunnel");
  assertEquals(handshakeOptions, {
    headers: { authorization: "Bearer oauth-access-token" },
  });
});

Deno.test("websocket network transport sends custom auth headers", async () => {
  const sockets: FakeWebSocket[] = [];
  let handshakeOptions: NetworkWebSocketFactoryOptions | undefined;
  const transport = new WebSocketNetworkTransport({
    auth: {
      type: "headers",
      headers: {
        authorization: "Bearer oauth-access-token",
        "x-agent-id": "agent_1",
      },
    },
    webSocketFactory: (url, options) => {
      handshakeOptions = options;
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket;
    },
  });

  const connected = transport.connect("wss://relay.example.test/mcp/_tunnel");
  const socket = sockets[0];
  assertExists(socket);
  socket.onopen?.();
  await connected;

  assertEquals(handshakeOptions, {
    headers: {
      authorization: "Bearer oauth-access-token",
      "x-agent-id": "agent_1",
    },
  });
});

Deno.test("websocket network transport resolves async auth once per connection", async () => {
  const sockets: FakeWebSocket[] = [];
  let calls = 0;
  let handshakeOptions: NetworkWebSocketFactoryOptions | undefined;
  const transport = new WebSocketNetworkTransport({
    auth: {
      type: "bearer",
      token: () => {
        calls++;
        return Promise.resolve("fresh-oauth-token");
      },
    },
    webSocketFactory: (url, options) => {
      handshakeOptions = options;
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket;
    },
  });

  const connected = transport.connect("wss://relay.example.test/mcp/_tunnel");
  await new Promise((resolve) => setTimeout(resolve, 0));
  const socket = sockets[0];
  assertExists(socket);
  socket.onopen?.();
  await connected;

  assertEquals(calls, 1);
  assertEquals(handshakeOptions, {
    headers: { authorization: "Bearer fresh-oauth-token" },
  });
});

Deno.test("websocket network transport can put auth in the URL explicitly", async () => {
  const sockets: FakeWebSocket[] = [];
  let handshakeOptions: NetworkWebSocketFactoryOptions | undefined;
  const transport = new WebSocketNetworkTransport({
    auth: {
      type: "bearer",
      token: "oauth token",
      via: "query",
      queryParam: "access_token",
    },
    webSocketFactory: (url, options) => {
      handshakeOptions = options;
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket;
    },
  });

  const connected = transport.connect(
    "wss://relay.example.test/mcp/_tunnel?tenant=acme",
  );
  const socket = sockets[0];
  assertExists(socket);
  socket.onopen?.();
  await connected;

  assertEquals(
    socket.url,
    "wss://relay.example.test/mcp/_tunnel?tenant=acme&access_token=oauth+token",
  );
  assertEquals(handshakeOptions, undefined);
});

Deno.test("websocket network transport rejects empty bearer tokens before opening a socket", async () => {
  let opened = false;
  const transport = new WebSocketNetworkTransport({
    auth: { type: "bearer", token: " " },
    webSocketFactory: (url) => {
      opened = true;
      return new FakeWebSocket(url);
    },
  });

  await assertRejects(
    () => transport.connect("wss://relay.example.test/mcp/_tunnel"),
    Error,
    "auth token",
  );
  assertEquals(opened, false);
});

Deno.test("websocket network transport receives JSON messages", async () => {
  const sockets: FakeWebSocket[] = [];
  const received: NetworkMessage[] = [];
  const transport = new WebSocketNetworkTransport({
    webSocketFactory: (url) => {
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket;
    },
  });
  transport.onMessage((message) => received.push(message));
  const connected = transport.connect("wss://relay.example.test/mcp/_tunnel");
  const socket = sockets[0];
  assertExists(socket);
  socket.onopen?.();
  await connected;

  socket.onmessage?.({
    data: JSON.stringify({
      type: "tool.call",
      requestId: "req_1",
      toolName: "erpnext.customer_list",
      arguments: {},
      actorSubject: null,
    }),
  });

  assertEquals(received, [{
    type: "tool.call",
    requestId: "req_1",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: null,
  }]);
});

Deno.test("websocket network transport rejects send before connect", () => {
  const transport = new WebSocketNetworkTransport({
    webSocketFactory: (url) => new FakeWebSocket(url),
  });

  assertThrows(
    () =>
      transport.send({
        type: "heartbeat",
        at: "2026-05-15T00:00:00.000Z",
      }),
    Error,
    "not connected",
  );
});

Deno.test("websocket network transport rejects close before open", async () => {
  const sockets: FakeWebSocket[] = [];
  const transport = new WebSocketNetworkTransport({
    webSocketFactory: (url) => {
      const socket = new FakeWebSocket(url);
      sockets.push(socket);
      return socket;
    },
  });

  const connected = transport.connect("wss://relay.example.test/mcp/_tunnel");
  const socket = sockets[0];
  assertExists(socket);
  socket.onclose?.();

  await assertRejects(
    () => connected,
    Error,
    "closed before it connected",
  );
});
