import { assertEquals } from "@std/assert";
import { NetworkTunnelClient, type NetworkTunnelTransport } from "./client.ts";
import { NetworkRelayError } from "./relay.ts";
import { NETWORK_PROTOCOL_VERSION, type NetworkMessage } from "./types.ts";

class FakeTransport implements NetworkTunnelTransport {
  sent: NetworkMessage[] = [];
  connectCalls: string[] = [];
  private handler: ((message: NetworkMessage) => void) | null = null;
  private openHandler: (() => void) | null = null;
  private closeHandler:
    | ((reason: { code?: number; reason?: string }) => void)
    | null = null;
  private errorHandler: ((error: unknown) => void) | null = null;

  connect(url: string): Promise<void> {
    this.connectCalls.push(url);
    this.openHandler?.();
    return Promise.resolve();
  }

  send(message: NetworkMessage): void {
    this.sent.push(message);
  }

  onMessage(handler: (message: NetworkMessage) => void): void {
    this.handler = handler;
  }

  onOpen(handler: () => void): void {
    this.openHandler = handler;
  }

  onClose(handler: (reason: { code?: number; reason?: string }) => void): void {
    this.closeHandler = handler;
  }

  onError(handler: (error: unknown) => void): void {
    this.errorHandler = handler;
  }

  disconnect(): void {}

  receive(message: NetworkMessage): void {
    this.handler?.(message);
  }

  close(reason: { code?: number; reason?: string } = {}): void {
    this.closeHandler?.(reason);
  }

  fail(error: unknown): void {
    this.errorHandler?.(error);
  }
}

class ResultSendFailingTransport extends FakeTransport {
  attemptedTypes: string[] = [];

  override send(message: NetworkMessage): void {
    this.attemptedTypes.push(message.type);
    if (message.type === "tool.result") {
      throw new Error("transport send failed");
    }
    super.send(message);
  }
}

Deno.test("network tunnel client sends hello on start", async () => {
  const transport = new FakeTransport();
  const client = new NetworkTunnelClient({
    transport,
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
    handleToolCall: () => Promise.resolve({ ok: true }),
  });

  await client.start("wss://relay.example.test/mcp/_tunnel");

  assertEquals(transport.sent, [{
    type: "agent.hello",
    protocolVersion: NETWORK_PROTOCOL_VERSION,
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
  }]);
});

Deno.test("network tunnel client reconnects and sends fresh hello after recoverable close", async () => {
  const transport = new FakeTransport();
  const client = new NetworkTunnelClient({
    transport,
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
    reconnect: { initialDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 },
    handleToolCall: () => Promise.resolve({ ok: true }),
  });

  await client.start("wss://relay.example.test/mcp/_tunnel");
  transport.close({ code: 1006, reason: "abnormal closure" });
  await waitFor(() => transport.connectCalls.length === 2, "reconnect");

  assertEquals(transport.connectCalls, [
    "wss://relay.example.test/mcp/_tunnel",
    "wss://relay.example.test/mcp/_tunnel",
  ]);
  assertEquals(
    transport.sent.filter((message) => message.type === "agent.hello"),
    [
      {
        type: "agent.hello",
        protocolVersion: NETWORK_PROTOCOL_VERSION,
        tenantId: "tenant_123",
        targetType: "erpnext",
        agentId: "agent_1",
        keyVersion: 1,
      },
      {
        type: "agent.hello",
        protocolVersion: NETWORK_PROTOCOL_VERSION,
        tenantId: "tenant_123",
        targetType: "erpnext",
        agentId: "agent_1",
        keyVersion: 1,
      },
    ],
  );

  client.stop();
});

Deno.test("network tunnel client stops reconnect loop on terminal close", async () => {
  const transport = new FakeTransport();
  let terminalError: NetworkRelayError | undefined;
  const client = new NetworkTunnelClient({
    transport,
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
    reconnect: { initialDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 },
    onTerminalError: (error) => {
      terminalError = error;
    },
    handleToolCall: () => Promise.resolve({ ok: true }),
  });

  await client.start("wss://relay.example.test/mcp/_tunnel");
  transport.close({ code: 4002, reason: "protocol version mismatch" });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assertEquals(terminalError instanceof NetworkRelayError, true);
  assertEquals(terminalError?.code, "TUNNEL_AGENT_DISCONNECTED");
  assertEquals(terminalError?.context, {
    closeCode: 4002,
    reason: "protocol version mismatch",
  });
  assertEquals(
    terminalError?.recovery,
    "Fix tunnel authentication or protocol configuration before reconnecting.",
  );
  assertEquals(transport.connectCalls.length, 1);
});

Deno.test("network tunnel client handles tool calls", async () => {
  const transport = new FakeTransport();
  const client = new NetworkTunnelClient({
    transport,
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
    handleToolCall: (call) =>
      Promise.resolve({
        toolName: call.toolName,
        limit: call.arguments.limit,
      }),
  });
  await client.start("wss://relay.example.test/mcp/_tunnel");

  transport.receive({
    type: "tool.call",
    requestId: "req_1",
    toolName: "erpnext.customer_list",
    arguments: { limit: 2 },
    actorSubject: "user_123",
  });
  await Promise.resolve();

  assertEquals(transport.sent.at(-1), {
    type: "tool.result",
    requestId: "req_1",
    result: { toolName: "erpnext.customer_list", limit: 2 },
  });
});

Deno.test("network tunnel client returns structured error when tool handler fails", async () => {
  const transport = new FakeTransport();
  const client = new NetworkTunnelClient({
    transport,
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
    handleToolCall: () => Promise.reject(new Error("ERP unreachable")),
  });
  await client.start("wss://relay.example.test/mcp/_tunnel");

  transport.receive({
    type: "tool.call",
    requestId: "req_1",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: null,
  });
  await Promise.resolve();

  assertEquals(transport.sent.at(-1), {
    type: "error",
    requestId: "req_1",
    code: "TOOL_CALL_FAILED",
    message: "ERP unreachable",
    context: { toolName: "erpnext.customer_list" },
  });
});

Deno.test("network tunnel client aborts local handler when relay cancels request", async () => {
  const transport = new FakeTransport();
  let observedSignal: AbortSignal | undefined;
  let handlerRejected = false;
  const client = new NetworkTunnelClient({
    transport,
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
    handleToolCall: (_call, options) => {
      observedSignal = options?.signal;
      return new Promise((_resolve, reject) => {
        options?.signal.addEventListener("abort", () => {
          handlerRejected = true;
          reject(new Error("aborted"));
        }, { once: true });
      });
    },
  });
  await client.start("wss://relay.example.test/mcp/_tunnel");

  transport.receive({
    type: "tool.call",
    requestId: "req_1",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: null,
  });
  await Promise.resolve();

  assertEquals(observedSignal?.aborted, false);
  transport.receive({
    type: "error",
    requestId: "req_1",
    code: "TUNNEL_REQUEST_TIMEOUT",
    message: "timed out",
    context: {},
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assertEquals(observedSignal?.aborted, true);
  assertEquals(handlerRejected, true);
  assertEquals(transport.sent.length, 1);
});

Deno.test("network tunnel client does not misreport transport send failures as tool failures", async () => {
  const transport = new ResultSendFailingTransport();
  let toolCalls = 0;
  const client = new NetworkTunnelClient({
    transport,
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
    handleToolCall: () => {
      toolCalls++;
      return Promise.resolve({ ok: true });
    },
  });
  await client.start("wss://relay.example.test/mcp/_tunnel");

  transport.receive({
    type: "tool.call",
    requestId: "req_1",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: null,
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  assertEquals(toolCalls, 1);
  assertEquals(transport.attemptedTypes, ["agent.hello", "tool.result"]);
});

async function waitFor(
  predicate: () => boolean,
  label: string,
): Promise<void> {
  for (let attempt = 0; attempt < 20; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error(`timed out waiting for ${label}`);
}
