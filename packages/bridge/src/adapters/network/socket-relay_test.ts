import { assertEquals, assertRejects } from "@std/assert";
import type { NetworkMessage } from "./types.ts";
import { NetworkRelay } from "./relay.ts";
import {
  allowInsecureNetworkAgentHelloForTests,
  attachNetworkTunnelSocket,
  type NetworkTunnelSocket,
} from "./socket-relay.ts";

class FakeTunnelSocket implements NetworkTunnelSocket {
  sent: NetworkMessage[] = [];
  closeCalls: Array<{ code?: number; reason?: string }> = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  send(data: string): void {
    this.sent.push(JSON.parse(data) as NetworkMessage);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this.onclose?.();
  }

  receive(message: NetworkMessage): void {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

Deno.test("attachNetworkTunnelSocket registers agent and routes tool calls", async () => {
  const relay = new NetworkRelay();
  const socket = new FakeTunnelSocket();
  attachNetworkTunnelSocket({
    relay,
    socket,
    tenantId: "tenant_route_1",
    authorizeAgentHello: allowInsecureNetworkAgentHelloForTests,
  });

  socket.receive({
    type: "agent.hello",
    tenantId: "tenant_route_1",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
  });
  await Promise.resolve();

  assertEquals(socket.sent.at(-1), {
    type: "agent.ready",
    tenantId: "tenant_route_1",
    targetType: "erpnext",
    agentId: "agent_1",
  });

  const resultPromise = relay.callTool({
    tenantId: "tenant_route_1",
    targetType: "erpnext",
    toolName: "erpnext.customer_list",
    arguments: { limit: 1 },
    actorSubject: "user_123",
  });
  await Promise.resolve();

  const toolCall = socket.sent.at(-1);
  assertEquals(toolCall?.type, "tool.call");
  if (toolCall?.type !== "tool.call") {
    throw new Error("expected tool.call");
  }

  socket.receive({
    type: "tool.result",
    requestId: toolCall.requestId,
    result: { ok: true },
  });

  assertEquals(await resultPromise, { ok: true });
});

Deno.test("attachNetworkTunnelSocket rejects cross-tenant hello", async () => {
  const relay = new NetworkRelay();
  const socket = new FakeTunnelSocket();
  attachNetworkTunnelSocket({
    relay,
    socket,
    tenantId: "tenant_route_2",
  });

  socket.receive({
    type: "agent.hello",
    tenantId: "other_tenant",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
  });

  assertEquals(socket.closeCalls, [{
    code: 4003,
    reason: "tenant mismatch",
  }]);
  await assertRejects(
    () =>
      relay.callTool({
        tenantId: "tenant_route_2",
        targetType: "erpnext",
        toolName: "erpnext.customer_list",
        arguments: {},
        actorSubject: null,
      }),
    Error,
    "NO_TUNNEL_AGENT",
  );
});

Deno.test("attachNetworkTunnelSocket rejects malformed hello before registration", async () => {
  const relay = new NetworkRelay();
  const socket = new FakeTunnelSocket();
  attachNetworkTunnelSocket({
    relay,
    socket,
    tenantId: "tenant_route_bad",
  });

  socket.onmessage?.({
    data: JSON.stringify({
      type: "agent.hello",
      tenantId: "tenant_route_bad",
    }),
  });
  await Promise.resolve();

  assertEquals(socket.closeCalls, [{
    code: 4002,
    reason: "invalid agent hello",
  }]);
  await assertRejects(
    () =>
      relay.callTool({
        tenantId: "tenant_route_bad",
        targetType: "erpnext",
        toolName: "erpnext.customer_list",
        arguments: {},
        actorSubject: null,
      }),
    Error,
    "NO_TUNNEL_AGENT",
  );
});

Deno.test("attachNetworkTunnelSocket rejects hello when no authorizer is configured", async () => {
  const relay = new NetworkRelay();
  const socket = new FakeTunnelSocket();
  attachNetworkTunnelSocket({
    relay,
    socket,
    tenantId: "tenant_route_no_auth",
  });

  socket.receive({
    type: "agent.hello",
    tenantId: "tenant_route_no_auth",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
  });
  await Promise.resolve();

  assertEquals(socket.closeCalls, [{
    code: 4001,
    reason: "agent authorization required",
  }]);
  await assertRejects(
    () =>
      relay.callTool({
        tenantId: "tenant_route_no_auth",
        targetType: "erpnext",
        toolName: "erpnext.customer_list",
        arguments: {},
        actorSubject: null,
      }),
    Error,
    "NO_TUNNEL_AGENT",
  );
});

Deno.test("attachNetworkTunnelSocket closes when hello authorizer throws", async () => {
  const relay = new NetworkRelay();
  const socket = new FakeTunnelSocket();
  attachNetworkTunnelSocket({
    relay,
    socket,
    tenantId: "tenant_route_auth_error",
    authorizeAgentHello: () => {
      throw new Error("authorizer offline");
    },
  });

  socket.receive({
    type: "agent.hello",
    tenantId: "tenant_route_auth_error",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
  });
  await Promise.resolve();

  assertEquals(socket.closeCalls, [{
    code: 4001,
    reason: "agent authorization failed",
  }]);
});

Deno.test("attachNetworkTunnelSocket keeps replacement agent after stale close", async () => {
  const relay = new NetworkRelay();
  const oldSocket = new FakeTunnelSocket();
  const newSocket = new FakeTunnelSocket();
  attachNetworkTunnelSocket({
    relay,
    socket: oldSocket,
    tenantId: "tenant_route_3",
    authorizeAgentHello: allowInsecureNetworkAgentHelloForTests,
  });
  attachNetworkTunnelSocket({
    relay,
    socket: newSocket,
    tenantId: "tenant_route_3",
    authorizeAgentHello: allowInsecureNetworkAgentHelloForTests,
  });

  oldSocket.receive({
    type: "agent.hello",
    tenantId: "tenant_route_3",
    targetType: "erpnext",
    agentId: "agent_old",
    keyVersion: 1,
  });
  await Promise.resolve();
  newSocket.receive({
    type: "agent.hello",
    tenantId: "tenant_route_3",
    targetType: "erpnext",
    agentId: "agent_new",
    keyVersion: 1,
  });
  await Promise.resolve();

  oldSocket.close();
  const resultPromise = relay.callTool({
    tenantId: "tenant_route_3",
    targetType: "erpnext",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: null,
  });
  await Promise.resolve();

  const toolCall = newSocket.sent.at(-1);
  assertEquals(toolCall?.type, "tool.call");
  if (toolCall?.type !== "tool.call") {
    throw new Error("expected tool.call");
  }

  newSocket.receive({
    type: "tool.result",
    requestId: toolCall.requestId,
    result: { agent: "new" },
  });

  assertEquals(await resultPromise, { agent: "new" });
});

Deno.test("attachNetworkTunnelSocket keeps reconnect with same agent id after stale close", async () => {
  const relay = new NetworkRelay();
  const oldSocket = new FakeTunnelSocket();
  const newSocket = new FakeTunnelSocket();
  attachNetworkTunnelSocket({
    relay,
    socket: oldSocket,
    tenantId: "tenant_route_reconnect",
    authorizeAgentHello: allowInsecureNetworkAgentHelloForTests,
  });
  attachNetworkTunnelSocket({
    relay,
    socket: newSocket,
    tenantId: "tenant_route_reconnect",
    authorizeAgentHello: allowInsecureNetworkAgentHelloForTests,
  });

  oldSocket.receive({
    type: "agent.hello",
    tenantId: "tenant_route_reconnect",
    targetType: "erpnext",
    agentId: "agent_same",
    keyVersion: 1,
  });
  await Promise.resolve();
  newSocket.receive({
    type: "agent.hello",
    tenantId: "tenant_route_reconnect",
    targetType: "erpnext",
    agentId: "agent_same",
    keyVersion: 1,
  });
  await Promise.resolve();

  oldSocket.close();
  const resultPromise = relay.callTool({
    tenantId: "tenant_route_reconnect",
    targetType: "erpnext",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: null,
  });
  await Promise.resolve();

  const toolCall = newSocket.sent.at(-1);
  assertEquals(toolCall?.type, "tool.call");
  if (toolCall?.type !== "tool.call") {
    throw new Error("expected tool.call");
  }

  newSocket.receive({
    type: "tool.result",
    requestId: toolCall.requestId,
    result: { agent: "new" },
  });

  assertEquals(await resultPromise, { agent: "new" });
});

Deno.test("attachNetworkTunnelSocket closes idle sockets that never send hello", async () => {
  const relay = new NetworkRelay();
  const socket = new FakeTunnelSocket();
  attachNetworkTunnelSocket({
    relay,
    socket,
    tenantId: "tenant_route_idle",
    helloTimeoutMs: 1,
    authorizeAgentHello: allowInsecureNetworkAgentHelloForTests,
  });

  await new Promise((resolve) => setTimeout(resolve, 5));

  assertEquals(socket.closeCalls, [{
    code: 4002,
    reason: "agent hello timeout",
  }]);
});
