import { assertEquals, assertRejects } from "@std/assert";
import { NetworkRelay, NetworkRelayError } from "./relay.ts";

Deno.test("relay routes one tool call to registered agent", async () => {
  const relay = new NetworkRelay();
  relay.registerAgent({
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    send: (message) => {
      assertEquals(message.type, "tool.call");
      return Promise.resolve({
        type: "tool.result",
        requestId: message.requestId,
        result: { ok: true },
      });
    },
  });

  const result = await relay.callTool({
    tenantId: "tenant_123",
    targetType: "erpnext",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: "user_123",
  });

  assertEquals(result, { ok: true });
});

Deno.test("relay rejects when no agent is connected", async () => {
  const relay = new NetworkRelay();
  const error = await assertRejects(
    () =>
      relay.callTool({
        tenantId: "tenant_123",
        targetType: "erpnext",
        toolName: "erpnext.customer_list",
        arguments: {},
        actorSubject: null,
      }),
    NetworkRelayError,
    "NO_TUNNEL_AGENT",
  );
  assertEquals(error.code, "NO_TUNNEL_AGENT");
  assertEquals(error.context, {
    tenantId: "tenant_123",
    targetType: "erpnext",
  });
});

Deno.test("relay unregister rejects in-flight calls with a cancellation error", async () => {
  const relay = new NetworkRelay();
  relay.registerAgent({
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    send: () => new Promise(() => {}),
  });

  const call = relay.callTool({
    tenantId: "tenant_123",
    targetType: "erpnext",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: null,
  });
  const rejection = withTimeout(
    assertRejects(
      () => call,
      NetworkRelayError,
      "TUNNEL_REQUEST_CANCELLED",
    ),
    "in-flight call was not cancelled",
  );

  relay.unregisterAgent("tenant_123", "erpnext", "agent_1");

  const error = await rejection;
  assertEquals(error.code, "TUNNEL_REQUEST_CANCELLED");
  assertEquals(error.context.tenantId, "tenant_123");
  assertEquals(error.context.targetType, "erpnext");
  assertEquals(error.context.agentId, "agent_1");
});

Deno.test("relay keying does not collide when identifiers contain separators", async () => {
  const relay = new NetworkRelay();
  relay.registerAgent({
    tenantId: "tenant:a",
    targetType: "erpnext",
    agentId: "agent_colon_tenant",
    send: (message) =>
      Promise.resolve({
        type: "tool.result",
        requestId: message.requestId,
        result: { agent: "colon-tenant" },
      }),
  });
  relay.registerAgent({
    tenantId: "tenant",
    targetType: "a:erpnext",
    agentId: "agent_colon_target",
    send: (message) =>
      Promise.resolve({
        type: "tool.result",
        requestId: message.requestId,
        result: { agent: "colon-target" },
      }),
  });

  assertEquals(
    await relay.callTool({
      tenantId: "tenant:a",
      targetType: "erpnext",
      toolName: "erpnext.customer_list",
      arguments: {},
      actorSubject: null,
    }),
    { agent: "colon-tenant" },
  );
  assertEquals(
    await relay.callTool({
      tenantId: "tenant",
      targetType: "a:erpnext",
      toolName: "erpnext.customer_list",
      arguments: {},
      actorSubject: null,
    }),
    { agent: "colon-target" },
  );
});

Deno.test("relay rejects concurrent calls to the same agent by default", async () => {
  const relay = new NetworkRelay();
  let resolveFirst!: (value: void) => void;
  const firstSendComplete = new Promise<void>((resolve) => {
    resolveFirst = resolve;
  });

  relay.registerAgent({
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    send: async (message) => {
      await firstSendComplete;
      return {
        type: "tool.result",
        requestId: message.requestId,
        result: { ok: true },
      };
    },
  });

  const firstCall = relay.callTool({
    tenantId: "tenant_123",
    targetType: "erpnext",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: null,
  });

  let secondCall: Promise<unknown> | undefined;
  try {
    const error = await withTimeout(
      assertRejects(
        () => {
          secondCall = relay.callTool({
            tenantId: "tenant_123",
            targetType: "erpnext",
            toolName: "erpnext.customer_get",
            arguments: {},
            actorSubject: null,
          });
          return secondCall;
        },
        NetworkRelayError,
        "TUNNEL_AGENT_BUSY",
      ),
      "second concurrent call was accepted",
    );
    assertEquals(error.code, "TUNNEL_AGENT_BUSY");
  } finally {
    resolveFirst();
    await Promise.allSettled([firstCall, secondCall]);
  }

  assertEquals(await firstCall, { ok: true });
});

Deno.test("relay parallel strategy runs concurrent calls to the same agent", async () => {
  const relay = new NetworkRelay({ concurrencyStrategy: "parallel" });
  const calls: string[] = [];

  relay.registerAgent({
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    send: (message) => {
      calls.push(message.requestId);
      return Promise.resolve({
        type: "tool.result",
        requestId: message.requestId,
        result: { requestId: message.requestId },
      });
    },
  });

  const [first, second] = await Promise.all([
    relay.callTool({
      tenantId: "tenant_123",
      targetType: "erpnext",
      toolName: "erpnext.customer_list",
      arguments: {},
      actorSubject: null,
    }),
    relay.callTool({
      tenantId: "tenant_123",
      targetType: "erpnext",
      toolName: "erpnext.customer_get",
      arguments: {},
      actorSubject: null,
    }),
  ]);

  assertEquals(calls, ["net_1", "net_2"]);
  assertEquals(first, { requestId: "net_1" });
  assertEquals(second, { requestId: "net_2" });
});

Deno.test("relay reject strategy rejects concurrent calls to the same agent", async () => {
  const relay = new NetworkRelay({ concurrencyStrategy: "reject" });
  let resolveFirst!: (value: void) => void;
  const firstSendComplete = new Promise<void>((resolve) => {
    resolveFirst = resolve;
  });

  relay.registerAgent({
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    send: async (message) => {
      await firstSendComplete;
      return {
        type: "tool.result",
        requestId: message.requestId,
        result: { ok: true },
      };
    },
  });

  const firstCall = relay.callTool({
    tenantId: "tenant_123",
    targetType: "erpnext",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: null,
  });

  const error = await assertRejects(
    () =>
      relay.callTool({
        tenantId: "tenant_123",
        targetType: "erpnext",
        toolName: "erpnext.customer_list",
        arguments: {},
        actorSubject: null,
      }),
    NetworkRelayError,
    "TUNNEL_AGENT_BUSY",
  );
  assertEquals(error.code, "TUNNEL_AGENT_BUSY");

  resolveFirst();
  assertEquals(await firstCall, { ok: true });
});

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), 20);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

Deno.test("relay keeps agent busy after timeout until send settles", async () => {
  const relay = new NetworkRelay({ requestTimeoutMs: 1 });
  let finishFirst!: () => void;
  let firstSignal: AbortSignal | undefined;
  let calls = 0;

  relay.registerAgent({
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    send: (message, options) => {
      calls++;
      if (calls === 1) {
        firstSignal = options?.signal;
        return new Promise((resolve) => {
          finishFirst = () =>
            resolve({
              type: "tool.result",
              requestId: message.requestId,
              result: { late: true },
            });
        });
      }
      return Promise.resolve({
        type: "tool.result",
        requestId: message.requestId,
        result: { ok: true },
      });
    },
  });

  try {
    const timeout = await assertRejects(
      () =>
        relay.callTool({
          tenantId: "tenant_123",
          targetType: "erpnext",
          toolName: "erpnext.customer_list",
          arguments: {},
          actorSubject: null,
        }),
      NetworkRelayError,
      "TUNNEL_REQUEST_TIMEOUT",
    );
    assertEquals(timeout.code, "TUNNEL_REQUEST_TIMEOUT");
    assertEquals(firstSignal?.aborted, true);

    const busy = await assertRejects(
      () =>
        relay.callTool({
          tenantId: "tenant_123",
          targetType: "erpnext",
          toolName: "erpnext.customer_list",
          arguments: {},
          actorSubject: null,
        }),
      NetworkRelayError,
      "TUNNEL_AGENT_BUSY",
    );
    assertEquals(busy.code, "TUNNEL_AGENT_BUSY");
  } finally {
    finishFirst?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const result = await relay.callTool({
    tenantId: "tenant_123",
    targetType: "erpnext",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: null,
  });

  assertEquals(result, { ok: true });
});

Deno.test("relay clears busy state after timeout when agent is dropped", async () => {
  const relay = new NetworkRelay({ requestTimeoutMs: 1 });

  relay.registerAgent({
    tenantId: "tenant_drop",
    targetType: "erpnext",
    agentId: "agent_1",
    send: () => new Promise(() => {}),
  });

  await assertRejects(
    () =>
      relay.callTool({
        tenantId: "tenant_drop",
        targetType: "erpnext",
        toolName: "erpnext.customer_list",
        arguments: {},
        actorSubject: null,
      }),
    NetworkRelayError,
    "TUNNEL_REQUEST_TIMEOUT",
  );

  relay.unregisterAgent("tenant_drop", "erpnext", "agent_1");

  await assertRejects(
    () =>
      relay.callTool({
        tenantId: "tenant_drop",
        targetType: "erpnext",
        toolName: "erpnext.customer_list",
        arguments: {},
        actorSubject: null,
      }),
    NetworkRelayError,
    "NO_TUNNEL_AGENT",
  );
});

Deno.test("relay ignores stale unregister from replaced agent", async () => {
  const relay = new NetworkRelay();
  relay.registerAgent({
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_old",
    send: (message) =>
      Promise.resolve({
        type: "tool.result",
        requestId: message.requestId,
        result: { agent: "old" },
      }),
  });
  relay.registerAgent({
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_new",
    send: (message) =>
      Promise.resolve({
        type: "tool.result",
        requestId: message.requestId,
        result: { agent: "new" },
      }),
  });

  relay.unregisterAgent("tenant_123", "erpnext", "agent_old");

  const result = await relay.callTool({
    tenantId: "tenant_123",
    targetType: "erpnext",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: null,
  });

  assertEquals(result, { agent: "new" });
});

Deno.test("relay ignores stale unregister when replaced agent reuses same id", async () => {
  const relay = new NetworkRelay();
  relay.registerAgent({
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    registrationId: "old",
    send: (message) =>
      Promise.resolve({
        type: "tool.result",
        requestId: message.requestId,
        result: { agent: "old" },
      }),
  });
  relay.registerAgent({
    tenantId: "tenant_123",
    targetType: "erpnext",
    agentId: "agent_1",
    registrationId: "new",
    send: (message) =>
      Promise.resolve({
        type: "tool.result",
        requestId: message.requestId,
        result: { agent: "new" },
      }),
  });

  relay.unregisterAgent("tenant_123", "erpnext", "agent_1", "old");

  const result = await relay.callTool({
    tenantId: "tenant_123",
    targetType: "erpnext",
    toolName: "erpnext.customer_list",
    arguments: {},
    actorSubject: null,
  });

  assertEquals(result, { agent: "new" });
});
