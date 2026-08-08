/**
 * `server/discover` over the SDK-routed transport (spec 2026-07-28, SEP-2575).
 *
 * The spec makes the RPC a MUST for every server and names stdio as a primary
 * use — a client probes it for backward compatibility. Before this was wired,
 * a stdio peer got `-32601`, so the probe reported "not a 2026 server" for a
 * server that speaks 2026-07-28 over HTTP.
 *
 * These tests drive the same `Server` instance `start()` connects to stdio,
 * over an in-memory transport instead: spawning a subprocess would need
 * `--allow-run` in the test task and would only add coverage of
 * `StdioServerTransport`, which is SDK code. The reach into the private field
 * is deliberate — the alternative is widening the public API for a test.
 */

import { assertEquals, assertExists } from "@std/assert";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { McpApp } from "./mcp-app.ts";

const PROTOCOL_VERSION = "2026-07-28";
const SERVER_INFO_KEY = "io.modelcontextprotocol/serverInfo";

/** Speak raw JSON-RPC: the SDK client has no `server/discover` in its surface. */
class Peer {
  #transport: InMemoryTransport;
  #pending = new Map<number, (msg: Record<string, unknown>) => void>();

  constructor(transport: InMemoryTransport) {
    this.#transport = transport;
    this.#transport.onmessage = (message: JSONRPCMessage) => {
      const msg = message as unknown as Record<string, unknown>;
      const id = msg.id;
      if (typeof id === "number") this.#pending.get(id)?.(msg);
    };
  }

  request(id: number, method: string, params: Record<string, unknown> = {}) {
    const settled = new Promise<Record<string, unknown>>((resolve) => {
      this.#pending.set(id, resolve);
    });
    // deno-lint-ignore no-explicit-any
    this.#transport.send({ jsonrpc: "2.0", id, method, params } as any);
    return settled;
  }

  notify(method: string) {
    // deno-lint-ignore no-explicit-any
    return this.#transport.send({ jsonrpc: "2.0", method } as any);
  }
}

async function connectedPeer(app: McpApp) {
  const [clientTransport, serverTransport] = InMemoryTransport
    .createLinkedPair();

  const inner = (app as unknown as { mcpServer: McpServer }).mcpServer.server;
  await inner.connect(serverTransport);

  const peer = new Peer(clientTransport);
  await clientTransport.start();

  await peer.request(1, "initialize", {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: "probe", version: "1.0.0" },
  });
  await peer.notify("notifications/initialized");

  return { peer, close: () => inner.close() };
}

function buildApp(instructions?: string): McpApp {
  const app = new McpApp({
    name: "discover-probe",
    version: "1.2.3",
    logger: () => {},
    ...(instructions ? { instructions } : {}),
  });
  app.registerTool(
    { name: "noop", description: "noop", inputSchema: { type: "object" } },
    () => "ok",
  );
  return app;
}

Deno.test("stdio - server/discover answers with the 2026-07-28 envelope", async () => {
  const { peer, close } = await connectedPeer(buildApp());
  try {
    const response = await peer.request(2, "server/discover");
    const result = response.result as Record<string, unknown>;

    assertExists(result, "server/discover must not be MethodNotFound on stdio");
    assertEquals(result.supportedVersions, [PROTOCOL_VERSION]);
    assertEquals(result.serverInfo, {
      name: "discover-probe",
      version: "1.2.3",
    });

    // The method exists only in 2026-07-28, so its result carries that
    // revision's envelope even though `initialize` negotiated an older one.
    assertEquals(result.resultType, "complete");
    assertEquals(result.cacheScope, "private");
    assertEquals(result.ttlMs, 0);
    assertEquals(
      (result._meta as Record<string, unknown>)[SERVER_INFO_KEY],
      { name: "discover-probe", version: "1.2.3" },
    );
  } finally {
    await close();
  }
});

Deno.test("stdio - server/discover carries instructions when configured", async () => {
  const { peer, close } = await connectedPeer(buildApp("Use noop sparingly."));
  try {
    const response = await peer.request(2, "server/discover");
    assertEquals(
      (response.result as Record<string, unknown>).instructions,
      "Use noop sparingly.",
    );
  } finally {
    await close();
  }
});

Deno.test("stdio - an unknown method is still MethodNotFound", async () => {
  // The fallback handler catches every unrouted method, so the guard inside it
  // is the only thing keeping `-32601` for everything that is not discover.
  const { peer, close } = await connectedPeer(buildApp());
  try {
    const response = await peer.request(2, "server/undiscover");
    const error = response.error as Record<string, unknown>;

    assertExists(error);
    assertEquals(error.code, -32601);
    // Pinned because the message DID change with this handler. The SDK's own
    // unrouted-method path answered a bare "Method not found"; an error raised
    // from a handler travels as `McpError`, whose constructor prefixes
    // "MCP error <code>: ". There is no way to raise the code from a handler
    // without the prefix, so the string is what it is — pinned here so the next
    // change to it is a decision rather than a surprise. The code, which is
    // what a peer switches on, is unchanged.
    assertEquals(error.message, "MCP error -32601: Method not found");
  } finally {
    await close();
  }
});

Deno.test("stdio and HTTP report the same discover result", async () => {
  // Two transports built the payload independently once; that is how
  // `instructions` or a new capability ends up on one path only.
  const app = buildApp("shared");
  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  const http = await app.startHttp({ port, onListen: () => {} });

  const { peer, close } = await connectedPeer(buildApp("shared"));
  try {
    const overHttp = await (await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "MCP-Protocol-Version": PROTOCOL_VERSION,
        "Mcp-Method": "server/discover",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 9,
        method: "server/discover",
        params: {
          _meta: {
            "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
            "io.modelcontextprotocol/clientCapabilities": {},
          },
        },
      }),
    })).json();

    const overStdio = await peer.request(2, "server/discover");

    // Round-trip the in-memory result through JSON, as a real stdio transport
    // does. `buildServerCapabilities()` sets `resources: undefined` when none
    // are registered; serialising drops the key on both paths, so comparing
    // the live object against a parsed one would fail on an artefact of the
    // test harness rather than on a difference between the transports.
    assertEquals(JSON.parse(JSON.stringify(overStdio.result)), overHttp.result);
  } finally {
    await close();
    await http.shutdown();
  }
});
