/**
 * Track I — Tasks extension over the wire.
 *
 * `task-store_test.ts` covers the store in isolation. This file covers the part
 * that only exists once the store is wired into the transport: the `resultType`
 * asymmetry, the capability guard on all four entry points, and the routing
 * header. A correct store reached through a wrong dispatch passes those unit
 * tests and fails here.
 *
 * @module lib/server/tasks/tasks-integration_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { McpApp } from "../mcp-app.ts";
import type { ToolHandler } from "../types.ts";
import { createTask } from "./mod.ts";

const PROTO_KEY = "io.modelcontextprotocol/protocolVersion";
const CAPS_KEY = "io.modelcontextprotocol/clientCapabilities";
const TASKS_ID = "io.modelcontextprotocol/tasks";
const V = "2026-07-28";

/** Client capabilities declaring the Tasks extension. */
const WITH_TASKS = { extensions: { [TASKS_ID]: {} } };

function buildServer(opts: { declareExtension: boolean }) {
  const server = new McpApp({
    name: "tasks-integration",
    version: "1.0.0",
    logger: () => {},
    transport: "stateless",
    ...(opts.declareExtension ? { extensions: { [TASKS_ID]: {} } } : {}),
  });

  server.registerTools(
    [
      {
        name: "slow_scan",
        description: "Long scan",
        inputSchema: { type: "object" },
      },
      {
        name: "quick",
        description: "Immediate",
        inputSchema: { type: "object" },
      },
    ],
    new Map<string, ToolHandler>([
      // Resolves on the next microtask, so the task is created and observable
      // without the test having to sleep.
      ["slow_scan", () =>
        createTask({ pollIntervalMs: 10 }, async () => {
          await Promise.resolve();
          return { rows: 42 };
        })],
      ["quick", () => "done"],
    ]),
  );
  return server;
}

async function start(server: McpApp) {
  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  const http = await server.startHttp({ port, onListen: () => {} });
  return { http, url: `http://localhost:${port}/mcp` };
}

/** POST as a conforming client; `caps` controls what the client declares. */
function post(
  url: string,
  method: string,
  params: Record<string, unknown>,
  caps: Record<string, unknown> = WITH_TASKS,
) {
  const mcpName = method === "tools/call"
    ? params.name
    : method.startsWith("tasks/")
    ? params.taskId
    : undefined;

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "MCP-Protocol-Version": V,
      "Mcp-Method": method,
      ...(typeof mcpName === "string" ? { "Mcp-Name": mcpName } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: { ...params, _meta: { [PROTO_KEY]: V, [CAPS_KEY]: caps } },
    }),
  });
}

Deno.test("tasks - a descriptor-returning tool yields resultType 'task', not 'complete'", async () => {
  const { http, url } = await start(buildServer({ declareExtension: true }));
  try {
    const res = await post(url, "tools/call", {
      name: "slow_scan",
      arguments: {},
    });
    const data = await res.json();

    assertEquals(res.status, 200);
    // The single most likely implementation error: stampResult() would have
    // written "complete" here.
    assertEquals(data.result.resultType, "task");
    assertExists(data.result.taskId, "taskId must be flat on the result");
    assertEquals(typeof data.result.status, "string");
  } finally {
    await http.shutdown();
  }
});

Deno.test("tasks - tasks/get carries resultType 'complete', unlike task creation", async () => {
  const { http, url } = await start(buildServer({ declareExtension: true }));
  try {
    const created = await (await post(url, "tools/call", {
      name: "slow_scan",
      arguments: {},
    })).json();
    const taskId = created.result.taskId as string;

    const got = await (await post(url, "tasks/get", { taskId })).json();
    // The asymmetry the spec states three times: creation is "task", a
    // subsequent tasks/get is an ordinary RPC response and so is "complete".
    assertEquals(got.result.resultType, "complete");
    assertEquals(got.result.taskId, taskId);
  } finally {
    await http.shutdown();
  }
});

Deno.test("tasks - a task created earlier is immediately resolvable", async () => {
  // Spec: a server MUST NOT return a task handle before the task is durably
  // created — a tasks/get for the returned id must resolve straight away.
  const { http, url } = await start(buildServer({ declareExtension: true }));
  try {
    const created = await (await post(url, "tools/call", {
      name: "slow_scan",
      arguments: {},
    })).json();
    const res = await post(url, "tasks/get", {
      taskId: created.result.taskId,
    });
    assertEquals(res.status, 200);
    await res.text();
  } finally {
    await http.shutdown();
  }
});

Deno.test("tasks - the capability guard covers all four entry points", async () => {
  // Guarding creation alone would still let a non-declaring client poll and
  // cancel tasks it could never have been handed, which the spec forbids
  // explicitly for tasks/get, tasks/update and tasks/cancel.
  const { http, url } = await start(buildServer({ declareExtension: true }));
  try {
    // First obtain a real task id as a declaring client.
    const created = await (await post(url, "tools/call", {
      name: "slow_scan",
      arguments: {},
    })).json();
    const taskId = created.result.taskId as string;

    const noCaps = {};
    const cases: Array<[string, Record<string, unknown>]> = [
      ["tools/call", { name: "slow_scan", arguments: {} }],
      ["tasks/get", { taskId }],
      ["tasks/update", { taskId, inputResponses: {} }],
      ["tasks/cancel", { taskId }],
    ];

    for (const [method, params] of cases) {
      const res = await post(url, method, params, noCaps);
      const data = await res.json();
      assertEquals(res.status, 400, `${method} must be refused`);
      assertEquals(data.error.code, -32021, `${method} code`);
      // The client needs to know WHICH capability to add.
      assertEquals(data.error.data.requiredCapabilities, [TASKS_ID]);
    }
  } finally {
    await http.shutdown();
  }
});

Deno.test("tasks - tasks/* is method-not-found when the server did not declare the extension", async () => {
  // Advertising drives behaviour: with no declaration there is no store, and the
  // method genuinely does not exist here.
  const { http, url } = await start(buildServer({ declareExtension: false }));
  try {
    const res = await post(url, "tasks/get", { taskId: "whatever" });
    const data = await res.json();
    assertEquals(res.status, 404);
    assertEquals(data.error.code, -32601);
  } finally {
    await http.shutdown();
  }
});

Deno.test("tasks - server/discover advertises the extension only when declared", async () => {
  const declared = await start(buildServer({ declareExtension: true }));
  try {
    const data = await (await post(declared.url, "server/discover", {})).json();
    assertEquals(data.result.capabilities.extensions, { [TASKS_ID]: {} });
  } finally {
    await declared.http.shutdown();
  }

  const bare = await start(buildServer({ declareExtension: false }));
  try {
    const data = await (await post(bare.url, "server/discover", {})).json();
    assertEquals(data.result.capabilities.extensions, undefined);
  } finally {
    await bare.http.shutdown();
  }
});

Deno.test("tasks - Mcp-Name must mirror params.taskId on tasks/* requests", async () => {
  const { http, url } = await start(buildServer({ declareExtension: true }));
  try {
    const created = await (await post(url, "tools/call", {
      name: "slow_scan",
      arguments: {},
    })).json();
    const taskId = created.result.taskId as string;

    // Header omitted.
    const missing = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": V,
        "Mcp-Method": "tasks/get",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tasks/get",
        params: { taskId, _meta: { [PROTO_KEY]: V, [CAPS_KEY]: WITH_TASKS } },
      }),
    });
    assertEquals(missing.status, 400);
    assertEquals((await missing.json()).error.code, -32020);

    // Header present but pointing at a different task.
    const wrong = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": V,
        "Mcp-Method": "tasks/get",
        "Mcp-Name": "some-other-task",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tasks/get",
        params: { taskId, _meta: { [PROTO_KEY]: V, [CAPS_KEY]: WITH_TASKS } },
      }),
    });
    assertEquals(wrong.status, 400);
    assertEquals((await wrong.json()).error.code, -32020);
  } finally {
    await http.shutdown();
  }
});

Deno.test("tasks - an ordinary tool result is unaffected by the extension", async () => {
  const { http, url } = await start(buildServer({ declareExtension: true }));
  try {
    const data = await (await post(url, "tools/call", {
      name: "quick",
      arguments: {},
    })).json();
    assertEquals(data.result.resultType, "complete");
    assertEquals(data.result.content[0].text, "done");
  } finally {
    await http.shutdown();
  }
});

Deno.test("tasks - cancel reports through and the task reaches a terminal state", async () => {
  const server = new McpApp({
    name: "tasks-cancel",
    version: "1.0.0",
    logger: () => {},
    transport: "stateless",
    extensions: { [TASKS_ID]: {} },
  });
  server.registerTool(
    {
      name: "forever",
      description: "Never finishes",
      inputSchema: { type: "object" },
    },
    () =>
      createTask({}, (ctrl) =>
        new Promise((_, reject) => {
          ctrl.signal.addEventListener(
            "abort",
            () => reject(ctrl.signal.reason),
          );
        })),
  );
  const { http, url } = await start(server);
  try {
    const created = await (await post(url, "tools/call", {
      name: "forever",
      arguments: {},
    })).json();
    const taskId = created.result.taskId as string;

    const cancelled = await (await post(url, "tasks/cancel", { taskId }))
      .json();
    assertEquals(cancelled.result.cancelled, true);

    const after = await (await post(url, "tasks/get", { taskId })).json();
    assertEquals(after.result.status, "cancelled");
  } finally {
    await http.shutdown();
  }
});
