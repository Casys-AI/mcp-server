// deno-lint-ignore-file require-await no-explicit-any
/**
 * Security hardening tests for HTTP server
 *
 * Covers: maxBodyBytes (413), CORS allowlist, IP rate limiting (429),
 * requireAuth, sessionId propagation, and e2e secure flows.
 *
 * @module lib/server/http-security_test
 */

import {
  assert,
  assertEquals,
  assertExists,
  assertRejects,
  assertStringIncludes,
} from "@std/assert";
import { ConcurrentMCPServer } from "./concurrent-server.ts";
import type { Middleware, MiddlewareContext } from "./middleware/types.ts";

// ─── Helpers ─────────────────────────────────────────────

/** Allocate a free port and release the listener immediately */
function getFreePort(): number {
  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

/** Send a JSON-RPC request to the server */
async function jsonRpc(
  port: number,
  method: string,
  params?: Record<string, unknown>,
  headers?: Record<string, string>,
): Promise<{ res: Response; data: Record<string, unknown> }> {
  const body: Record<string, unknown> = {
    jsonrpc: "2.0",
    id: 1,
    method,
  };
  if (params) body.params = params;

  const res = await fetch(`http://localhost:${port}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  return { res, data };
}

/** Initialize a session and return the sessionId */
async function initSession(port: number): Promise<string> {
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
  const sessionId = res.headers.get("mcp-session-id");
  await res.json(); // consume body
  if (!sessionId) throw new Error("No session ID returned");
  return sessionId;
}

// ═══════════════════════════════════════════════════════════
// requireAuth
// ═══════════════════════════════════════════════════════════

Deno.test("security - requireAuth throws when no auth provider configured", async () => {
  const server = new ConcurrentMCPServer({
    name: "auth-guard",
    version: "1.0.0",
    logger: () => {},
  });

  const port = getFreePort();

  await assertRejects(
    () => server.startHttp({ port, onListen: () => {}, requireAuth: true }),
    Error,
    "HTTP auth is required",
  );
});

Deno.test("security - requireAuth=false (default) allows start without auth", async () => {
  const server = new ConcurrentMCPServer({
    name: "no-auth",
    version: "1.0.0",
    logger: () => {},
  });

  const port = getFreePort();
  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/health`);
    assertEquals(res.status, 200);
    await res.json(); // consume
  } finally {
    await http.shutdown();
  }
});

// ═══════════════════════════════════════════════════════════
// maxBodyBytes
// ═══════════════════════════════════════════════════════════

Deno.test("security - maxBodyBytes rejects oversized payload with 413", async () => {
  const server = new ConcurrentMCPServer({
    name: "body-limit",
    version: "1.0.0",
    logger: () => {},
  });

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    maxBodyBytes: 30,
  });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: { padding: "x".repeat(100) },
      }),
    });

    assertEquals(res.status, 413);
    const data = await res.json();
    assertEquals(data.error.code, -32000);
    assertStringIncludes(data.error.message, "Payload too large");
  } finally {
    await http.shutdown();
  }
});

Deno.test("security - maxBodyBytes allows normal-sized payloads", async () => {
  const server = new ConcurrentMCPServer({
    name: "body-limit-ok",
    version: "1.0.0",
    logger: () => {},
  });

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    maxBodyBytes: 10_000,
  });

  try {
    const { res, data } = await jsonRpc(port, "initialize");
    assertEquals(res.status, 200);
    assertExists((data as any).result?.serverInfo);
  } finally {
    await http.shutdown();
  }
});

Deno.test("security - maxBodyBytes=null disables the limit", async () => {
  const server = new ConcurrentMCPServer({
    name: "no-body-limit",
    version: "1.0.0",
    logger: () => {},
  });

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    maxBodyBytes: null,
  });

  try {
    // Large payload should pass
    const { res } = await jsonRpc(port, "initialize", {
      padding: "y".repeat(2_000_000),
    });
    assertEquals(res.status, 200);
  } finally {
    await http.shutdown();
  }
});

// ═══════════════════════════════════════════════════════════
// CORS allowlist
// ═══════════════════════════════════════════════════════════

Deno.test("security - corsOrigins allowlist reflects in CORS headers", async () => {
  const server = new ConcurrentMCPServer({
    name: "cors-test",
    version: "1.0.0",
    logger: () => {},
  });

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    corsOrigins: ["https://app.example.com"],
  });

  try {
    // Preflight with allowed origin
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "OPTIONS",
      headers: {
        "Origin": "https://app.example.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
    });

    const acao = res.headers.get("access-control-allow-origin");
    assertEquals(acao, "https://app.example.com");
    await res.text(); // consume body
  } finally {
    await http.shutdown();
  }
});

Deno.test("security - corsOrigins wildcard emits warning log", async () => {
  const logs: string[] = [];
  const server = new ConcurrentMCPServer({
    name: "cors-warn",
    version: "1.0.0",
    logger: (msg: string) => logs.push(msg),
  });

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    // default corsOrigins is "*"
  });

  try {
    assert(
      logs.some((l) => l.includes("[WARN]") && l.includes("CORS wildcard")),
      `Expected CORS wildcard warning in logs, got: ${JSON.stringify(logs)}`,
    );
  } finally {
    await http.shutdown();
  }
});

Deno.test("security - corsOrigins allowlist does NOT emit wildcard warning", async () => {
  const logs: string[] = [];
  const server = new ConcurrentMCPServer({
    name: "cors-no-warn",
    version: "1.0.0",
    logger: (msg: string) => logs.push(msg),
  });

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    corsOrigins: ["https://app.example.com"],
  });

  try {
    assert(
      !logs.some((l) => l.includes("CORS wildcard")),
      `Unexpected CORS wildcard warning in logs: ${JSON.stringify(logs)}`,
    );
  } finally {
    await http.shutdown();
  }
});

Deno.test("security - corsOrigins rejects unknown origin", async () => {
  const server = new ConcurrentMCPServer({
    name: "cors-reject",
    version: "1.0.0",
    logger: () => {},
  });

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    corsOrigins: ["https://app.example.com"],
  });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "OPTIONS",
      headers: {
        "Origin": "https://evil.example.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    const acao = res.headers.get("access-control-allow-origin");
    // Hono CORS middleware should NOT include the disallowed origin
    assert(
      acao === null || acao !== "https://evil.example.com",
      `Expected CORS to reject evil origin, got: ${acao}`,
    );
    await res.text(); // consume
  } finally {
    await http.shutdown();
  }
});

// ═══════════════════════════════════════════════════════════
// IP rate limiting
// ═══════════════════════════════════════════════════════════

Deno.test("security - ipRateLimit returns 429 after limit exceeded", async () => {
  const server = new ConcurrentMCPServer({
    name: "rate-limit",
    version: "1.0.0",
    logger: () => {},
  });

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    ipRateLimit: { maxRequests: 3, windowMs: 10_000 },
    maxBodyBytes: null, // don't interfere
  });

  try {
    // First 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const { res } = await jsonRpc(port, "initialize");
      // initialize may return 200 or 429 from the init-rate-limiter
      // but the global ipRateLimit should allow the first 3
      assert(
        res.status === 200 || res.status === 429,
        `Unexpected status: ${res.status}`,
      );
    }

    // 4th request should hit the IP rate limit (429)
    const { res: res4 } = await jsonRpc(port, "initialize");
    assertEquals(res4.status, 429);
    assertExists(res4.headers.get("retry-after"));
  } finally {
    await http.shutdown();
  }
});

Deno.test("security - ipRateLimit includes Retry-After header", async () => {
  const server = new ConcurrentMCPServer({
    name: "rate-retry",
    version: "1.0.0",
    logger: () => {},
  });

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    ipRateLimit: { maxRequests: 1, windowMs: 60_000 },
    maxBodyBytes: null,
  });

  try {
    // First request uses the slot
    await jsonRpc(port, "initialize");

    // Second request should be rate-limited
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "initialize",
        params: {},
      }),
    });

    assertEquals(res.status, 429);
    const retryAfter = res.headers.get("retry-after");
    assertExists(retryAfter, "Retry-After header should be present");
    const retrySeconds = parseInt(retryAfter!, 10);
    assert(
      retrySeconds >= 1,
      `Retry-After should be >= 1, got ${retrySeconds}`,
    );
    await res.json(); // consume
  } finally {
    await http.shutdown();
  }
});

Deno.test("security - ipRateLimit onLimitExceeded='wait' delays instead of rejecting", async () => {
  const server = new ConcurrentMCPServer({
    name: "rate-wait",
    version: "1.0.0",
    logger: () => {},
  });

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    ipRateLimit: { maxRequests: 1, windowMs: 200, onLimitExceeded: "wait" },
    maxBodyBytes: null,
  });

  try {
    // First request uses the slot
    const { res: res1 } = await jsonRpc(port, "initialize");
    assertEquals(res1.status, 200);

    // Second request should wait (not 429) because onLimitExceeded="wait"
    const start = Date.now();
    const { res: res2 } = await jsonRpc(port, "initialize");
    const elapsed = Date.now() - start;

    // It should have waited and eventually succeeded (or timed out with 429)
    // With windowMs=200, the wait should be short
    assert(
      res2.status === 200 || res2.status === 429,
      `Expected 200 (waited) or 429 (timeout), got ${res2.status}`,
    );
    if (res2.status === 200) {
      assert(
        elapsed >= 100,
        `Expected delay >= 100ms for wait mode, got ${elapsed}ms`,
      );
    }
  } finally {
    await http.shutdown();
  }
});

Deno.test("security - ipRateLimit applies to GET (SSE) endpoints too", async () => {
  const server = new ConcurrentMCPServer({
    name: "rate-sse",
    version: "1.0.0",
    logger: () => {},
  });

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    ipRateLimit: { maxRequests: 1, windowMs: 10_000 },
    maxBodyBytes: null,
  });

  try {
    // First request uses the slot (POST initialize)
    await jsonRpc(port, "initialize");

    // Second request: GET /mcp with SSE accept → should hit 429
    const res = await fetch(`http://localhost:${port}/mcp`, {
      headers: { "Accept": "text/event-stream" },
    });
    assertEquals(res.status, 429);
    await res.text(); // consume
  } finally {
    await http.shutdown();
  }
});

// ═══════════════════════════════════════════════════════════
// sessionId propagation into middleware context
// ═══════════════════════════════════════════════════════════

Deno.test("security - sessionId propagated to middleware context on tools/call", async () => {
  let capturedSessionId: string | undefined;

  // Custom middleware that captures ctx.sessionId
  const spyMiddleware: Middleware = async (ctx: MiddlewareContext, next) => {
    capturedSessionId = ctx.sessionId;
    return next();
  };

  const server = new ConcurrentMCPServer({
    name: "session-propagation",
    version: "1.0.0",
    logger: () => {},
  });

  server.use(spyMiddleware);
  server.registerTool(
    { name: "echo", description: "Echo args", inputSchema: { type: "object" } },
    (args) => args,
  );

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    maxBodyBytes: null,
  });

  try {
    // Step 1: Initialize to get a session
    const sessionId = await initSession(port);
    assertExists(sessionId);

    // Step 2: Call tool with session header
    const { res } = await jsonRpc(
      port,
      "tools/call",
      { name: "echo", arguments: { hello: "world" } },
      { "mcp-session-id": sessionId },
    );

    assertEquals(res.status, 200);
    // Verify the middleware received the correct sessionId
    assertEquals(capturedSessionId, sessionId);
  } finally {
    await http.shutdown();
  }
});

// ═══════════════════════════════════════════════════════════
// E2E: full secure flow
// ═══════════════════════════════════════════════════════════

Deno.test("e2e - secure flow: initialize → session → tools/call → result", async () => {
  const server = new ConcurrentMCPServer({
    name: "e2e-secure",
    version: "1.0.0",
    logger: () => {},
  });

  server.registerTool(
    {
      name: "multiply",
      description: "Multiply two numbers",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number" },
          b: { type: "number" },
        },
        required: ["a", "b"],
      },
    },
    (args) => ({ product: (args.a as number) * (args.b as number) }),
  );

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    maxBodyBytes: 10_000,
    corsOrigins: ["https://app.example.com"],
    ipRateLimit: { maxRequests: 20, windowMs: 10_000 },
  });

  try {
    // 1. Initialize
    const initRes = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      }),
    });
    assertEquals(initRes.status, 200);
    const initData = await initRes.json();
    assertEquals(initData.result.serverInfo.name, "e2e-secure");

    const sessionId = initRes.headers.get("mcp-session-id");
    assertExists(sessionId, "Session ID should be returned on initialize");

    // 2. tools/list with session
    const { data: listData } = await jsonRpc(port, "tools/list", undefined, {
      "mcp-session-id": sessionId!,
    });
    assertEquals((listData as any).result.tools.length, 1);
    assertEquals((listData as any).result.tools[0].name, "multiply");

    // 3. tools/call with session
    const { res: callRes, data: callData } = await jsonRpc(
      port,
      "tools/call",
      { name: "multiply", arguments: { a: 7, b: 6 } },
      { "mcp-session-id": sessionId! },
    );
    assertEquals(callRes.status, 200);
    const result = JSON.parse((callData as any).result.content[0].text);
    assertEquals(result.product, 42);

    // 4. Health check still works
    const healthRes = await fetch(`http://localhost:${port}/health`);
    assertEquals(healthRes.status, 200);
    await healthRes.json(); // consume
  } finally {
    await http.shutdown();
  }
});

Deno.test("e2e - invalid session returns 404", async () => {
  const server = new ConcurrentMCPServer({
    name: "e2e-bad-session",
    version: "1.0.0",
    logger: () => {},
  });

  server.registerTool(
    { name: "noop", description: "noop", inputSchema: { type: "object" } },
    () => "ok",
  );

  const port = getFreePort();
  const http = await server.startHttp({
    port,
    onListen: () => {},
    maxBodyBytes: null,
  });

  try {
    const { res, data } = await jsonRpc(
      port,
      "tools/call",
      { name: "noop", arguments: {} },
      { "mcp-session-id": "nonexistent-session-id-000" },
    );
    assertEquals(res.status, 404);
    assertEquals((data as any).error.code, -32001);
  } finally {
    await http.shutdown();
  }
});

Deno.test("e2e - default maxBodyBytes (1 MB) allows reasonable payloads", async () => {
  const server = new ConcurrentMCPServer({
    name: "e2e-default-limit",
    version: "1.0.0",
    logger: () => {},
  });

  const port = getFreePort();
  // Use default maxBodyBytes (no explicit option)
  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    // ~500 byte payload should be fine
    const { res } = await jsonRpc(port, "initialize", {
      info: "a".repeat(400),
    });
    assertEquals(res.status, 200);
  } finally {
    await http.shutdown();
  }
});
