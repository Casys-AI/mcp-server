import { assertEquals } from "@std/assert";
import {
  NETWORK_PROTOCOL_VERSION,
  type NetworkAgentHello,
  type NetworkAgentReady,
  type NetworkToolCallRequest,
} from "./types.ts";

Deno.test("network tunnel type examples stay stable", () => {
  const hello: NetworkAgentHello = {
    type: "agent.hello",
    protocolVersion: NETWORK_PROTOCOL_VERSION,
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
  const ready: NetworkAgentReady = {
    type: "agent.ready",
    protocolVersion: NETWORK_PROTOCOL_VERSION,
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_local_1",
  };

  assertEquals(hello.type, "agent.hello");
  assertEquals(ready.protocolVersion, NETWORK_PROTOCOL_VERSION);
  assertEquals(call.toolName, "erpnext.customer_list");
});
