import { assertEquals } from "@std/assert";
import { NetworkTunnelClient, type NetworkTunnelTransport } from "./client.ts";
import type { NetworkMessage } from "./types.ts";

class FakeTransport implements NetworkTunnelTransport {
  sent: NetworkMessage[] = [];
  private handler: ((message: NetworkMessage) => void) | null = null;

  connect(): Promise<void> {
    return Promise.resolve();
  }

  send(message: NetworkMessage): void {
    this.sent.push(message);
  }

  onMessage(handler: (message: NetworkMessage) => void): void {
    this.handler = handler;
  }

  disconnect(): void {}

  receive(message: NetworkMessage): void {
    this.handler?.(message);
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
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    keyVersion: 1,
  }]);
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
