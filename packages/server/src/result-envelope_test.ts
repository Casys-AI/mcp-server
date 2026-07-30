/**
 * Track H — spec 2026-07-28 result envelope.
 *
 * SEP-2322 makes `resultType` required on every result, and SEP-2575 asks the
 * server to identify itself in each result's `_meta`. Both are transverse: they
 * apply to every response path, which is exactly why they are easy to half-ship.
 *
 * These tests walk the method table rather than asserting one endpoint, so a new
 * handler that forgets `stampResult()` fails here instead of in a consumer.
 *
 * @module lib/server/result-envelope_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { McpApp } from "./mcp-app.ts";

const PROTO_KEY = "io.modelcontextprotocol/protocolVersion";
// Required on every request in the final spec, unlike clientInfo.
const CAPS_KEY = "io.modelcontextprotocol/clientCapabilities";
const SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo";
const LOG_LEVEL_KEY = "io.modelcontextprotocol/logLevel";

async function startOnFreePort(server: McpApp) {
  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  const http = await server.startHttp({ port, onListen: () => {} });
  return { http, url: `http://localhost:${port}/mcp` };
}

/**
 * POST as a conforming 2026-07-28 client: the request-metadata headers
 * (`MCP-Protocol-Version`, `Mcp-Method`, and `Mcp-Name` where the spec requires
 * it) are mandatory, and the server rejects their absence with `-32020`.
 */
function rpc(
  url: string,
  method: string,
  params: Record<string, unknown> = {},
) {
  const name = method === "resources/read"
    ? params.uri
    : method === "tools/call" || method === "prompts/get"
    ? params.name
    : undefined;

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "MCP-Protocol-Version": "2026-07-28",
      "Mcp-Method": method,
      ...(typeof name === "string" ? { "Mcp-Name": name } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: { [PROTO_KEY]: "2026-07-28", [CAPS_KEY]: {} },
      },
    }),
  });
}

Deno.test("envelope - every stateless result carries resultType and serverInfo", async () => {
  const server = new McpApp({
    name: "envelope-test",
    version: "3.1.4",
    logger: () => {},
    transport: "stateless",
  });
  server.registerTools(
    [{ name: "echo", description: "Echo", inputSchema: { type: "object" } }],
    new Map([["echo", () => "pong"]]),
  );
  server.registerResource(
    {
      uri: "ui://envelope/probe",
      name: "probe",
      mimeType: "text/plain",
    },
    () => ({
      uri: "ui://envelope/probe",
      mimeType: "text/plain",
      text: "hello",
    }),
  );

  const { http, url } = await startOnFreePort(server);

  // Each entry is a method that returns a result (not an error) on this server.
  const methods: Array<[string, Record<string, unknown>]> = [
    ["server/discover", {}],
    ["initialize", {}],
    ["tools/list", {}],
    ["tools/call", { name: "echo", arguments: {} }],
    ["resources/list", {}],
    ["resources/read", { uri: "ui://envelope/probe" }],
    ["prompts/list", {}],
    ["completion/complete", {}],
  ];

  try {
    for (const [method, params] of methods) {
      const res = await rpc(url, method, params);
      const data = await res.json();

      assertEquals(res.status, 200, `${method} should return 200`);
      assertExists(data.result, `${method} should return a result`);
      assertEquals(
        data.result.resultType,
        "complete",
        `${method} is missing resultType — did the handler skip stampResult()?`,
      );
      assertEquals(
        data.result._meta?.[SERVER_INFO_KEY],
        { name: "envelope-test", version: "3.1.4" },
        `${method} is missing _meta serverInfo`,
      );
    }
  } finally {
    await http.shutdown();
  }
});

Deno.test("envelope - a failing tool call is still a completed result", async () => {
  // `isError: true` describes the tool's outcome, not the JSON-RPC call's. Only
  // MRTR interim results (Track B) may carry "input_required".
  const server = new McpApp({
    name: "envelope-toolerror-test",
    version: "1.0.0",
    logger: () => {},
    transport: "stateless",
    // The mapper returns the user-facing message; the framework wraps it into
    // an `isError: true` result.
    toolErrorMapper: (error) =>
      error instanceof Error ? error.message : "failed",
  });
  server.registerTools(
    [{ name: "boom", description: "Throws", inputSchema: { type: "object" } }],
    new Map([["boom", () => {
      throw new Error("kaboom");
    }]]),
  );

  const { http, url } = await startOnFreePort(server);

  try {
    const res = await rpc(url, "tools/call", { name: "boom", arguments: {} });
    const data = await res.json();

    assertEquals(res.status, 200);
    assertEquals(data.result.isError, true);
    assertEquals(data.result.resultType, "complete");
  } finally {
    await http.shutdown();
  }
});

Deno.test("envelope - a tool's own _meta survives stamping", async () => {
  // Regression guard: MCP Apps viewers ship UI hints in the tool's `_meta`.
  // Replacing `_meta` instead of merging it would silently break every viewer,
  // and no protocol-level test would notice.
  const server = new McpApp({
    name: "envelope-meta-merge-test",
    version: "1.0.0",
    logger: () => {},
    transport: "stateless",
  });
  server.registerTools(
    [{
      name: "with_ui",
      description: "Has UI meta",
      inputSchema: { type: "object" },
      _meta: { ui: { resourceUri: "ui://test/viewer" } },
    }],
    new Map([["with_ui", () => "rendered"]]),
  );

  const { http, url } = await startOnFreePort(server);

  try {
    const res = await rpc(url, "tools/call", {
      name: "with_ui",
      arguments: {},
    });
    const data = await res.json();

    assertEquals(data.result.resultType, "complete");
    // Both the tool's key and the server's key coexist.
    assertEquals(data.result._meta.ui, { resourceUri: "ui://test/viewer" });
    assertExists(data.result._meta[SERVER_INFO_KEY]);
  } finally {
    await http.shutdown();
  }
});

Deno.test("envelope - a legacy version negotiated over the stateless transport gets no envelope", async () => {
  // The gate is the negotiated version, NOT the transport. `stateless` also
  // accepts 2025-06-18 and 2025-11-25 (STATELESS_SUPPORTED_VERSIONS), and a peer
  // on one of those never asked for `resultType`. An earlier draft gated on the
  // transport and stamped a 2026 envelope onto their responses.
  const server = new McpApp({
    name: "envelope-legacy-version-test",
    version: "1.0.0",
    logger: () => {},
    transport: "stateless",
  });

  const { http, url } = await startOnFreePort(server);

  try {
    for (const version of ["2025-06-18", "2025-11-25"]) {
      // No `Mcp-Method` on purpose: that header is 2026-only, so the server must
      // not demand it of a legacy peer. `MCP-Protocol-Version` is different — it
      // exists since 2025-06-18 and stays required.
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "MCP-Protocol-Version": version,
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: { _meta: { [PROTO_KEY]: version } },
        }),
      });
      const data = await res.json();

      assertEquals(res.status, 200);
      assertEquals(
        data.result.resultType,
        undefined,
        `${version} peer must not receive a 2026-07-28 envelope`,
      );
      assertEquals(data.result._meta, undefined);
    }

    // Same server, same transport — the 2026 peer does get it.
    const modern = await (await rpc(url, "tools/list")).json();
    assertEquals(modern.result.resultType, "complete");
  } finally {
    await http.shutdown();
  }
});

Deno.test("envelope - any unimplemented stateless RPC returns 404 / -32601", async () => {
  // The spec requires 404 for an unimplemented method, and the status is
  // load-bearing: it is how a client tells a modern endpoint from a legacy
  // HTTP+SSE server. Not yet implemented here: `subscriptions/listen` (Track G).
  const server = new McpApp({
    name: "envelope-404-test",
    version: "1.0.0",
    logger: () => {},
    transport: "stateless",
  });

  const { http, url } = await startOnFreePort(server);

  try {
    for (
      const method of ["subscriptions/listen", "tasks/get", "nonsense/rpc"]
    ) {
      const res = await rpc(url, method);
      const data = await res.json();
      assertEquals(res.status, 404, `${method} should be 404`);
      assertEquals(data.error.code, -32601, `${method} should be -32601`);
    }
  } finally {
    await http.shutdown();
  }
});

Deno.test("envelope - the stateful path stays on the legacy shape", async () => {
  // The envelope is gated on the transport, not bolted on unconditionally: a
  // 2025-11-25 peer never asked for these fields.
  const server = new McpApp({
    name: "envelope-stateful-test",
    version: "1.0.0",
    logger: () => {},
    // default transport: "stateful"
  });

  const { http, url } = await startOnFreePort(server);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    const data = await res.json();

    assertEquals(res.status, 200);
    assertEquals(data.result.resultType, undefined);
    assertEquals(data.result._meta, undefined);
  } finally {
    await http.shutdown();
  }
});

Deno.test("envelope - extensions are advertised only when declared", async () => {
  const bare = new McpApp({
    name: "ext-absent-test",
    version: "1.0.0",
    logger: () => {},
    transport: "stateless",
  });
  const declared = new McpApp({
    name: "ext-present-test",
    version: "1.0.0",
    logger: () => {},
    transport: "stateless",
    extensions: { "io.modelcontextprotocol/tasks": {} },
  });

  const a = await startOnFreePort(bare);
  try {
    const data = await (await rpc(a.url, "server/discover")).json();
    // Not `{}`: an empty object would assert "no extensions supported", a
    // stronger claim than the framework can make for a consumer.
    assertEquals(data.result.capabilities.extensions, undefined);
  } finally {
    await a.http.shutdown();
  }

  const b = await startOnFreePort(declared);
  try {
    const data = await (await rpc(b.url, "server/discover")).json();
    assertEquals(data.result.capabilities.extensions, {
      "io.modelcontextprotocol/tasks": {},
    });
  } finally {
    await b.http.shutdown();
  }
});

Deno.test("envelope - per-request logLevel reaches the tool handler", async () => {
  // `logging/setLevel` is gone; the level now travels with the request that
  // wants it. Absent means the client opted out of logging entirely.
  const seen: Array<string | undefined> = [];
  const server = new McpApp({
    name: "loglevel-test",
    version: "1.0.0",
    logger: () => {},
    transport: "stateless",
  });
  server.registerTools(
    [{ name: "probe", description: "Probe", inputSchema: { type: "object" } }],
    new Map([["probe", (_args, ctx) => {
      seen.push(ctx?.logLevel);
      return "ok";
    }]]),
  );

  const { http, url } = await startOnFreePort(server);

  try {
    const call = (meta: Record<string, unknown>) =>
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "MCP-Protocol-Version": "2026-07-28",
          "Mcp-Method": "tools/call",
          "Mcp-Name": "probe",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name: "probe",
            arguments: {},
            _meta: { [PROTO_KEY]: "2026-07-28", [CAPS_KEY]: {}, ...meta },
          },
        }),
      });

    await (await call({ [LOG_LEVEL_KEY]: "debug" })).json();
    await (await call({})).json();
    // Not a syslog severity — dropped rather than failing the whole call.
    await (await call({ [LOG_LEVEL_KEY]: "verbose" })).json();

    assertEquals(seen, ["debug", undefined, undefined]);
  } finally {
    await http.shutdown();
  }
});
