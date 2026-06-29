/**
 * Tests for HTTP server support (startHttp)
 *
 * @module lib/server/http-server_test
 */

import {
  assertEquals,
  assertExists,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { McpApp } from "./mcp-app.ts";
import { MCP_APP_MIME_TYPE } from "./types.ts";

// ── Track A — Stateless transport (transport: "stateless") ──────────────────
// Spec 2026-07-28: protocolVersion is carried via the namespaced key
// "io.modelcontextprotocol/protocolVersion" in params._meta (not at the top level
// of JSON-RPC params). The server echoes the negotiated version in the
// MCP-Protocol-Version response header.

const PROTO_KEY = "io.modelcontextprotocol/protocolVersion";

Deno.test(
  "transport stateless - initialize responds without Mcp-Session-Id and negotiates protocolVersion",
  async () => {
    const server = new McpApp({
      name: "stateless-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });

    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();

    const http = await server.startHttp({ port, onListen: () => {} });

    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: { _meta: { [PROTO_KEY]: "2026-07-28" } },
        }),
      });

      assertEquals(res.status, 200);
      // Stateless mode: no session header emitted
      assertEquals(res.headers.get("mcp-session-id"), null);
      // Spec: negotiated version echoed in MCP-Protocol-Version header
      assertEquals(res.headers.get("mcp-protocol-version"), "2026-07-28");
      const data = await res.json();
      // protocolVersion echoes client's requested version (negotiated)
      assertEquals(data.result.protocolVersion, "2026-07-28");
      assertEquals(data.result.serverInfo.name, "stateless-test");
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - tools/list works without prior handshake",
  async () => {
    const server = new McpApp({
      name: "stateless-tools-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });

    server.registerTool(
      { name: "ping", description: "Ping", inputSchema: { type: "object" } },
      () => "pong",
    );

    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();

    const http = await server.startHttp({ port, onListen: () => {} });

    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: { _meta: { [PROTO_KEY]: "2026-07-28" } },
        }),
      });

      assertEquals(res.status, 200);
      assertEquals(res.headers.get("mcp-session-id"), null);
      assertEquals(res.headers.get("mcp-protocol-version"), "2026-07-28");
      const data = await res.json();
      assertEquals(data.result.tools.length, 1);
      assertEquals(data.result.tools[0].name, "ping");
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - GET /mcp returns 405 even with SSE Accept header",
  async () => {
    const server = new McpApp({
      name: "stateless-sse-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });

    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();

    const http = await server.startHttp({ port, onListen: () => {} });

    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        headers: { "Accept": "text/event-stream" },
      });

      assertEquals(res.status, 405);
      await res.text(); // Consume body to avoid leak
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - missing protocolVersion key returns -32020",
  async () => {
    const server = new McpApp({
      name: "stateless-noversion-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });

    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();

    const http = await server.startHttp({ port, onListen: () => {} });

    try {
      // tools/list without protocolVersion key → must fail, not 200
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      });

      // Machine-readable error, not a spurious 200
      assertEquals(res.status, 400);
      const data = await res.json();
      assertEquals(data.error.code, -32020);
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - _meta present but without version key returns -32020",
  async () => {
    const server = new McpApp({
      name: "stateless-meta-nokey-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });
    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const http = await server.startHttp({ port, onListen: () => {} });
    try {
      // _meta object present but the namespaced key is absent → must fail -32020
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: { _meta: {} }, // _meta exists but key missing
        }),
      });
      assertEquals(res.status, 400);
      const data = await res.json();
      assertEquals(data.error.code, -32020);
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - unsupported protocolVersion returns -32022",
  async () => {
    const server = new McpApp({
      name: "stateless-badversion-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });

    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();

    const http = await server.startHttp({ port, onListen: () => {} });

    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            _meta: { [PROTO_KEY]: "1999-01-01" }, // unknown version
            name: "anything",
            arguments: {},
          },
        }),
      });

      assertEquals(res.status, 400);
      const data = await res.json();
      assertEquals(data.error.code, -32022);
      assertEquals(data.id, 2);
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - Mcp-Session-Id request header is ignored (no session bypass)",
  async () => {
    const server = new McpApp({
      name: "stateless-nossid-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });

    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();

    const http = await server.startHttp({ port, onListen: () => {} });

    try {
      // Sending a fake Mcp-Session-Id must not cause a 404 or session lookup
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Mcp-Session-Id": "fake-session-id-that-does-not-exist",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: { _meta: { [PROTO_KEY]: "2026-07-28" } },
        }),
      });

      // Must succeed — session header is silently ignored in stateless mode
      assertEquals(res.status, 200);
      // And must NOT echo a Mcp-Session-Id in the response
      assertEquals(res.headers.get("mcp-session-id"), null);
      const data = await res.json();
      assertExists(data.result.tools);
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateful (default) - stateful mode unchanged (initialize emits Mcp-Session-Id)",
  async () => {
    const server = new McpApp({
      name: "stateful-regression-test",
      version: "1.0.0",
      logger: () => {},
      // transport not set — default "stateful"
    });

    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();

    const http = await server.startHttp({ port, onListen: () => {} });

    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {},
        }),
      });

      assertEquals(res.status, 200);
      // Stateful mode: Mcp-Session-Id IS emitted
      assertExists(res.headers.get("mcp-session-id"));
      // Stateful mode: MCP-Protocol-Version header NOT emitted
      assertEquals(res.headers.get("mcp-protocol-version"), null);
      const data = await res.json();
      assertEquals(data.result.protocolVersion, "2025-06-18");
    } finally {
      await http.shutdown();
    }
  },
);

// ── Track A corrections (post-Codex review) ─────────────────────────────────

Deno.test(
  "transport stateless - -32022 error carries MCP-Protocol-Version header",
  async () => {
    const server = new McpApp({
      name: "stateless-errheader-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });
    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const http = await server.startHttp({ port, onListen: () => {} });
    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: { _meta: { [PROTO_KEY]: "9999-99-99" } }, // unsupported
        }),
      });
      assertEquals(res.status, 400);
      // Error responses must ALSO carry the header (server's fallback version)
      assertExists(res.headers.get("mcp-protocol-version"));
      const data = await res.json();
      assertEquals(data.error.code, -32022);
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - -32020 error carries MCP-Protocol-Version header",
  async () => {
    const server = new McpApp({
      name: "stateless-errheader2-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });
    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const http = await server.startHttp({ port, onListen: () => {} });
    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {}, // missing protocolVersion
        }),
      });
      assertEquals(res.status, 400);
      assertExists(res.headers.get("mcp-protocol-version"));
      const data = await res.json();
      assertEquals(data.error.code, -32020);
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - -32022 error body carries data.supported and data.requested (AX)",
  async () => {
    const server = new McpApp({
      name: "stateless-errdata-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });
    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const http = await server.startHttp({ port, onListen: () => {} });
    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 3,
          method: "tools/list",
          params: { _meta: { [PROTO_KEY]: "0000-01-01" } },
        }),
      });
      assertEquals(res.status, 400);
      const data = await res.json();
      assertEquals(data.error.code, -32022);
      assertEquals(data.id, 3);
      // Machine-readable: client knows what's supported and what it sent
      assertExists(data.error.data);
      assertEquals(data.error.data.requested, "0000-01-01");
      assertExists(data.error.data.supported);
      assertEquals(Array.isArray(data.error.data.supported), true);
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - rate-limit keyExtractor cannot see Mcp-Session-Id header",
  async () => {
    // Scenario: a keyExtractor tries to use Mcp-Session-Id as the rate-limit key.
    // If the header reaches the context, rotating session IDs bypasses the limit.
    // In stateless mode the header must be stripped from the rate-limit context.
    const server = new McpApp({
      name: "stateless-rl-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });

    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();

    const http = await server.startHttp({
      port,
      onListen: () => {},
      ipRateLimit: {
        maxRequests: 1,
        windowMs: 60_000,
        // Attacker's keyExtractor: keyed on session header, bypasses IP limit if header leaks
        keyExtractor: (ctx) => ctx.headers.get("mcp-session-id") ?? ctx.ip,
      },
    });

    try {
      // First request with session-A
      const r1 = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Mcp-Session-Id": "session-A",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: { _meta: { [PROTO_KEY]: "2026-07-28" } },
        }),
      });
      await r1.json(); // consume

      // Second request with a DIFFERENT session-B
      // Without the fix: different key → 200 (bypass!)
      // With the fix: mcp-session-id stripped → same IP key → 429
      const r2 = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Mcp-Session-Id": "session-B",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/list",
          params: { _meta: { [PROTO_KEY]: "2026-07-28" } },
        }),
      });
      const d2 = await r2.json();
      // Must be rate-limited (header was stripped → both requests keyed on IP)
      assertEquals(r2.status, 429);
      assertEquals(d2.error.code, -32000);
    } finally {
      await http.shutdown();
    }
  },
);

// ── Track A coverage: version validation is not bypassable ────────────────────

Deno.test(
  "transport stateless - resources/read validates version per-request",
  async () => {
    const server = new McpApp({
      name: "stateless-res-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });

    server.registerResource(
      { uri: "ui://test/page", name: "Page" },
      () => ({
        uri: "ui://test/page",
        mimeType: MCP_APP_MIME_TYPE,
        text: "<h1>ok</h1>",
      }),
    );

    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const http = await server.startHttp({ port, onListen: () => {} });

    try {
      // Scenario A: with valid version key → 200, MCP-Protocol-Version header present
      const r1 = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "resources/read",
          params: {
            _meta: { [PROTO_KEY]: "2026-07-28" },
            uri: "ui://test/page",
          },
        }),
      });
      const d1 = await r1.json(); // consume body first
      assertEquals(r1.status, 200);
      assertEquals(r1.headers.get("mcp-protocol-version"), "2026-07-28");
      assertExists(d1.result.contents);

      // Scenario B: without version key → -32020 (no bypass)
      const r2 = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "resources/read",
          params: { uri: "ui://test/page" }, // NO protocolVersion
        }),
      });
      const d2 = await r2.json(); // consume body first
      assertEquals(r2.status, 400);
      assertEquals(d2.error.code, -32020);
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - notification (no id) with version accepted as 202",
  async () => {
    const server = new McpApp({
      name: "stateless-notif-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });
    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const http = await server.startHttp({ port, onListen: () => {} });
    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          // no "id" — this is a notification
          method: "notifications/initialized",
          params: { _meta: { [PROTO_KEY]: "2026-07-28" } },
        }),
      });
      assertEquals(res.status, 202);
      await res.text(); // consume body
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - notification without version returns -32020 (no bypass)",
  async () => {
    const server = new McpApp({
      name: "stateless-notif-noversion-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });
    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const http = await server.startHttp({ port, onListen: () => {} });
    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: {}, // missing version
        }),
      });
      assertEquals(res.status, 400);
      const data = await res.json();
      assertEquals(data.error.code, -32020);
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - batch (array body) blocked by version validation",
  async () => {
    const server = new McpApp({
      name: "stateless-batch-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });
    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const http = await server.startHttp({ port, onListen: () => {} });
    try {
      // Batch body = array — params would be undefined → -32020
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([
          {
            jsonrpc: "2.0",
            id: 1,
            method: "tools/list",
            params: { _meta: { [PROTO_KEY]: "2026-07-28" } },
          },
          {
            jsonrpc: "2.0",
            id: 2,
            method: "tools/list",
            params: { _meta: { [PROTO_KEY]: "2026-07-28" } },
          },
        ]),
      });
      // Batch lands in version validation path (params = undefined → -32020) or parse error
      // Key assertion: does NOT return a spurious 200 bypass
      assertStringIncludes(String(res.status), "4"); // 4xx
      await res.text();
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - ping with version succeeds and carries MCP-Protocol-Version",
  async () => {
    const server = new McpApp({
      name: "stateless-ping-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });
    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const http = await server.startHttp({ port, onListen: () => {} });
    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 99,
          method: "ping",
          params: { _meta: { [PROTO_KEY]: "2026-07-28" } },
        }),
      });
      const data = await res.json(); // consume first
      assertEquals(res.status, 200);
      // ping passes through per-request version validation → header is echoed
      assertEquals(res.headers.get("mcp-protocol-version"), "2026-07-28");
      assertEquals(data.result, {});
    } finally {
      await http.shutdown();
    }
  },
);

Deno.test(
  "transport stateless - ping without version key returns -32020 (no bypass)",
  async () => {
    const server = new McpApp({
      name: "stateless-ping-noversion-test",
      version: "1.0.0",
      logger: () => {},
      transport: "stateless",
    });
    const listener = Deno.listen({ port: 0 });
    const port = (listener.addr as Deno.NetAddr).port;
    listener.close();
    const http = await server.startHttp({ port, onListen: () => {} });
    try {
      const res = await fetch(`http://localhost:${port}/mcp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 100,
          method: "ping",
          params: {}, // NO protocolVersion key — must not bypass validation
        }),
      });
      const data = await res.json(); // consume first
      assertEquals(res.status, 400);
      assertEquals(data.error.code, -32020);
    } finally {
      await http.shutdown();
    }
  },
);

// ── End Track A corrections ──────────────────────────────────────────────────

Deno.test("startHttp - starts server and handles initialize", async () => {
  const server = new McpApp({
    name: "test-server",
    version: "1.0.0",
    logger: () => {}, // Silence logs
  });

  // Find a free port
  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      }),
    });

    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.jsonrpc, "2.0");
    assertEquals(data.id, 1);
    assertEquals(data.result.serverInfo.name, "test-server");
    assertEquals(data.result.serverInfo.version, "1.0.0");
    assertExists(data.result.capabilities);
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - requires auth when configured", async () => {
  const server = new McpApp({
    name: "auth-required-test",
    version: "1.0.0",
    logger: () => {},
  });

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  await assertRejects(
    () => server.startHttp({ port, onListen: () => {}, requireAuth: true }),
    Error,
    "HTTP auth is required",
  );
});

Deno.test("startHttp - enforces maxBodyBytes", async () => {
  const server = new McpApp({
    name: "body-limit-test",
    version: "1.0.0",
    logger: () => {},
  });

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({
    port,
    onListen: () => {},
    maxBodyBytes: 20,
  });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: { padding: "this-payload-is-too-large" },
      }),
    });

    assertEquals(res.status, 413);
    const data = await res.json();
    assertEquals(data.error.code, -32000);
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - handles tools/list", async () => {
  const server = new McpApp({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  server.registerTool(
    {
      name: "greet",
      description: "Greet someone",
      inputSchema: { type: "object" },
    },
    () => "Hello!",
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    const data = await res.json();
    assertEquals(data.result.tools.length, 1);
    assertEquals(data.result.tools[0].name, "greet");
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - handles tools/call", async () => {
  const server = new McpApp({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  server.registerTool(
    {
      name: "add",
      description: "Add numbers",
      inputSchema: { type: "object" },
    },
    (args) => ({ sum: (args.a as number) + (args.b as number) }),
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "add", arguments: { a: 2, b: 3 } },
      }),
    });

    const data = await res.json();
    assertEquals(data.result.content[0].type, "text");
    const result = JSON.parse(data.result.content[0].text);
    assertEquals(result.sum, 5);
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - passes execution context to tool handlers", async () => {
  const seen: Array<{ toolName?: string; hasRequest: boolean }> = [];
  const server = new McpApp({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  server.registerTool(
    {
      name: "context_echo",
      description: "Echo handler context",
      inputSchema: { type: "object" },
    },
    (_args, ctx) => {
      seen.push({
        toolName: ctx?.toolName,
        hasRequest: ctx?.request instanceof Request,
      });
      return { ok: true };
    },
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "context_echo", arguments: {} },
      }),
    });

    await res.json();
    assertEquals(seen, [{ toolName: "context_echo", hasRequest: true }]);
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - handles resources/list", async () => {
  const server = new McpApp({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  server.registerResource(
    {
      uri: "ui://test/viewer",
      name: "Test Viewer",
      description: "A test viewer",
    },
    () => ({
      uri: "ui://test/viewer",
      mimeType: MCP_APP_MIME_TYPE,
      text: "<html></html>",
    }),
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "resources/list" }),
    });

    const data = await res.json();
    assertEquals(data.result.resources.length, 1);
    assertEquals(data.result.resources[0].uri, "ui://test/viewer");
    assertEquals(data.result.resources[0].mimeType, MCP_APP_MIME_TYPE);
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - handles resources/read", async () => {
  const server = new McpApp({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  const htmlContent = "<html><body>Hello World</body></html>";
  server.registerResource(
    { uri: "ui://test/page", name: "Test Page" },
    () => ({
      uri: "ui://test/page",
      mimeType: MCP_APP_MIME_TYPE,
      text: htmlContent,
    }),
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: { uri: "ui://test/page" },
      }),
    });

    const data = await res.json();
    assertEquals(data.result.contents.length, 1);
    assertEquals(data.result.contents[0].text, htmlContent);
    assertEquals(data.result.contents[0].mimeType, MCP_APP_MIME_TYPE);
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - returns error for unknown resource", async () => {
  const server = new McpApp({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: { uri: "ui://unknown/resource" },
      }),
    });

    const data = await res.json();
    assertEquals(data.error.code, -32602);
    assertEquals(
      data.error.message,
      "Resource not found: ui://unknown/resource",
    );
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - health endpoint works", async () => {
  const server = new McpApp({
    name: "health-test",
    version: "2.0.0",
    logger: () => {},
  });

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/health`);
    const data = await res.json();
    assertEquals(data.status, "ok");
    assertEquals(data.server, "health-test");
    assertEquals(data.version, "2.0.0");
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - GET returns 405", async () => {
  const server = new McpApp({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`);
    assertEquals(res.status, 405);
    await res.text(); // Consume body to avoid leak
  } finally {
    await http.shutdown();
  }
});

// ── CSP meta tag injection (resourceCsp) ────────────────────────

Deno.test("startHttp - resources/read injects CSP meta tag when resourceCsp is set", async () => {
  const server = new McpApp({
    name: "csp-test",
    version: "1.0.0",
    logger: () => {},
    resourceCsp: { allowInline: true },
  });

  const htmlContent =
    "<html><head><title>App</title></head><body>Hello</body></html>";
  server.registerResource(
    { uri: "ui://test/csp-app", name: "CSP App" },
    () => ({
      uri: "ui://test/csp-app",
      mimeType: MCP_APP_MIME_TYPE,
      text: htmlContent,
    }),
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: { uri: "ui://test/csp-app" },
      }),
    });

    const data = await res.json();
    const returnedHtml = data.result.contents[0].text;

    // CSP meta tag should be injected after <head>
    assertStringIncludes(
      returnedHtml,
      '<meta http-equiv="Content-Security-Policy"',
    );
    assertStringIncludes(returnedHtml, "default-src 'none'");
    assertStringIncludes(returnedHtml, "script-src 'self' 'unsafe-inline'");
    // Original content should still be present
    assertStringIncludes(returnedHtml, "<title>App</title>");
    assertStringIncludes(returnedHtml, "<body>Hello</body>");
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - resources/read does NOT inject CSP when resourceCsp is not set", async () => {
  const server = new McpApp({
    name: "no-csp-test",
    version: "1.0.0",
    logger: () => {},
    // No resourceCsp option
  });

  const htmlContent =
    "<html><head><title>Plain</title></head><body>No CSP</body></html>";
  server.registerResource(
    { uri: "ui://test/plain", name: "Plain App" },
    () => ({
      uri: "ui://test/plain",
      mimeType: MCP_APP_MIME_TYPE,
      text: htmlContent,
    }),
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: { uri: "ui://test/plain" },
      }),
    });

    const data = await res.json();
    // HTML should be returned unchanged (no CSP injection)
    assertEquals(data.result.contents[0].text, htmlContent);
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - resources/read skips CSP injection for non-HTML resources", async () => {
  const server = new McpApp({
    name: "json-csp-test",
    version: "1.0.0",
    logger: () => {},
    resourceCsp: { allowInline: true }, // CSP enabled
  });

  const jsonContent = '{"data": "test"}';
  server.registerResource(
    {
      uri: "ui://test/json",
      name: "JSON Resource",
      mimeType: "application/json",
    },
    () => ({
      uri: "ui://test/json",
      mimeType: "application/json",
      text: jsonContent,
    }),
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: { uri: "ui://test/json" },
      }),
    });

    const data = await res.json();
    // JSON content should NOT have CSP meta tag
    assertEquals(data.result.contents[0].text, jsonContent);
  } finally {
    await http.shutdown();
  }
});
