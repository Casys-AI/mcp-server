import { assertEquals } from "@std/assert";
import type { NetworkAgentHello, NetworkToolCallRequest } from "./types.ts";

Deno.test("network tunnel type examples stay stable", () => {
  const hello: NetworkAgentHello = {
    type: "agent.hello",
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_local_1",
    keyVersion: 1,
  };
  const call: NetworkToolCallRequest = {
    type: "tool.call",
    requestId: "req_1",
    toolName: "erpnext.customer_list",
    arguments: { limit: 10 },
    actorSubject: "user_123",
  };

  assertEquals(hello.type, "agent.hello");
  assertEquals(call.toolName, "erpnext.customer_list");
});
