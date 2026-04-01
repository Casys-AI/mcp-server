// deno-lint-ignore-file require-await
/**
 * Tests for auth middleware, bearer extraction, and HTTP integration.
 *
 * @module lib/server/auth/auth_test
 */

import { assert, assertEquals, assertRejects } from "@std/assert";
import { AuthProvider } from "./provider.ts";
import type { AuthInfo, ProtectedResourceMetadata } from "./types.ts";
import {
  AuthError,
  createAuthMiddleware,
  createForbiddenResponse,
  createUnauthorizedResponse,
  extractBearerToken,
} from "./middleware.ts";
import { createScopeMiddleware } from "./scope-middleware.ts";
import type { MiddlewareContext } from "../middleware/types.ts";
import { ConcurrentMCPServer } from "../concurrent-server.ts";

// ============================================
// Mock AuthProvider
// ============================================

class MockAuthProvider extends AuthProvider {
  public verifyCallCount = 0;
  private authInfo: AuthInfo | null;

  constructor(authInfo?: Partial<AuthInfo> | null) {
    super();
    if (authInfo === null) {
      this.authInfo = null;
    } else if (authInfo) {
      this.authInfo = {
        subject: authInfo.subject ?? "mock-user",
        scopes: authInfo.scopes ?? [],
        claims: authInfo.claims ?? {},
        clientId: authInfo.clientId,
        expiresAt: authInfo.expiresAt,
      };
    } else {
      this.authInfo = null;
    }
  }

  async verifyToken(_token: string): Promise<AuthInfo | null> {
    this.verifyCallCount++;
    return this.authInfo;
  }

  getResourceMetadata(): ProtectedResourceMetadata {
    return {
      resource: "https://mock.example.com",
      authorization_servers: ["https://auth.example.com"],
      bearer_methods_supported: ["header"],
    };
  }
}

// ============================================
// Bearer Token Extraction
// ============================================

Deno.test("extractBearerToken - valid bearer", () => {
  const req = new Request("http://localhost", {
    headers: { Authorization: "Bearer abc123" },
  });
  assertEquals(extractBearerToken(req), "abc123");
});

Deno.test("extractBearerToken - bearer with spaces trimmed", () => {
  const req = new Request("http://localhost", {
    headers: { Authorization: "Bearer   token123  " },
  });
  assertEquals(extractBearerToken(req), "token123");
});

Deno.test("extractBearerToken - missing header", () => {
  const req = new Request("http://localhost");
  assertEquals(extractBearerToken(req), null);
});

Deno.test("extractBearerToken - basic auth (not bearer)", () => {
  const req = new Request("http://localhost", {
    headers: { Authorization: "Basic abc123" },
  });
  assertEquals(extractBearerToken(req), null);
});

Deno.test("extractBearerToken - empty bearer", () => {
  const req = new Request("http://localhost", {
    headers: { Authorization: "Bearer " },
  });
  assertEquals(extractBearerToken(req), null);
});

// ============================================
// Unauthorized / Forbidden Responses
// ============================================

Deno.test("createUnauthorizedResponse - status 401 with WWW-Authenticate", async () => {
  const res = createUnauthorizedResponse(
    "https://example.com/.well-known/oauth-protected-resource",
  );
  assertEquals(res.status, 401);
  const wwwAuth = res.headers.get("WWW-Authenticate");
  assert(
    wwwAuth?.includes(
      'resource_metadata="https://example.com/.well-known/oauth-protected-resource"',
    ),
  );
  const body = await res.json();
  assertEquals(body.error.code, -32001);
});

Deno.test("createUnauthorizedResponse - includes error and description", async () => {
  const res = createUnauthorizedResponse(
    "https://example.com/.well-known/oauth-protected-resource",
    "invalid_token",
    "Token has expired",
  );
  const wwwAuth = res.headers.get("WWW-Authenticate")!;
  assert(wwwAuth.includes('error="invalid_token"'));
  assert(wwwAuth.includes('error_description="Token has expired"'));
  const body = await res.json();
  assertEquals(body.error.message, "Token has expired");
});

Deno.test("createForbiddenResponse - status 403", async () => {
  const res = createForbiddenResponse(["admin", "write"]);
  assertEquals(res.status, 403);
  const body = await res.json();
  assert(body.error.message.includes("admin"));
  assert(body.error.message.includes("write"));
});

// ============================================
// Auth Middleware
// ============================================

Deno.test("createAuthMiddleware - skips auth on STDIO (no request)", async () => {
  const provider = new MockAuthProvider({
    subject: "user-1",
    scopes: ["read"],
  });
  const middleware = createAuthMiddleware(provider);
  let nextCalled = false;

  await middleware(
    { toolName: "test", args: {} },
    async () => {
      nextCalled = true;
      return "ok";
    },
  );

  assertEquals(nextCalled, true);
  assertEquals(provider.verifyCallCount, 0);
});

Deno.test("createAuthMiddleware - throws AuthError on missing token", async () => {
  const provider = new MockAuthProvider({ subject: "user-1", scopes: [] });
  const middleware = createAuthMiddleware(provider);

  await assertRejects(
    () =>
      middleware(
        {
          toolName: "test",
          args: {},
          request: new Request("http://localhost"),
        },
        async () => "ok",
      ),
    AuthError,
    "Authorization header with Bearer token required",
  );
});

Deno.test("createAuthMiddleware - throws AuthError on invalid token", async () => {
  const provider = new MockAuthProvider(null); // verifyToken returns null
  const middleware = createAuthMiddleware(provider);

  await assertRejects(
    () =>
      middleware(
        {
          toolName: "test",
          args: {},
          request: new Request("http://localhost", {
            headers: { Authorization: "Bearer invalid-token" },
          }),
        },
        async () => "ok",
      ),
    AuthError,
    "Invalid or expired token",
  );
});

Deno.test("createAuthMiddleware - injects frozen authInfo on valid token", async () => {
  const provider = new MockAuthProvider({
    subject: "user-1",
    scopes: ["read", "write"],
  });
  const middleware = createAuthMiddleware(provider);
  const ctx: MiddlewareContext = {
    toolName: "test",
    args: {},
    request: new Request("http://localhost", {
      headers: { Authorization: "Bearer valid-token" },
    }),
  };

  await middleware(ctx, async () => "ok");

  const authInfo = ctx.authInfo as AuthInfo;
  assertEquals(authInfo.subject, "user-1");
  assertEquals(authInfo.scopes, ["read", "write"]);
  assert(Object.isFrozen(ctx.authInfo));
});

// ============================================
// Scope Middleware
// ============================================

Deno.test("createScopeMiddleware - passes when no scopes required", async () => {
  const middleware = createScopeMiddleware(new Map());
  let nextCalled = false;

  await middleware(
    { toolName: "test", args: {}, authInfo: { subject: "u", scopes: [] } },
    async () => {
      nextCalled = true;
      return "ok";
    },
  );

  assertEquals(nextCalled, true);
});

Deno.test("createScopeMiddleware - passes when user has required scopes", async () => {
  const scopes = new Map([["admin_tool", ["admin"]]]);
  const middleware = createScopeMiddleware(scopes);
  let nextCalled = false;

  await middleware(
    {
      toolName: "admin_tool",
      args: {},
      authInfo: { subject: "u", scopes: ["admin", "read"] },
    },
    async () => {
      nextCalled = true;
      return "ok";
    },
  );

  assertEquals(nextCalled, true);
});

Deno.test("createScopeMiddleware - throws AuthError when scopes missing", async () => {
  const scopes = new Map([["admin_tool", ["admin", "write"]]]);
  const middleware = createScopeMiddleware(scopes);

  await assertRejects(
    () =>
      middleware(
        {
          toolName: "admin_tool",
          args: {},
          authInfo: { subject: "u", scopes: ["read"] },
        },
        async () => "ok",
      ),
    AuthError,
    "Insufficient scope",
  );
});

Deno.test("createScopeMiddleware - passes when no authInfo (STDIO)", async () => {
  const scopes = new Map([["admin_tool", ["admin"]]]);
  const middleware = createScopeMiddleware(scopes);
  let nextCalled = false;

  await middleware(
    { toolName: "admin_tool", args: {} }, // no authInfo, no request = STDIO
    async () => {
      nextCalled = true;
      return "ok";
    },
  );

  assertEquals(nextCalled, true);
});

Deno.test("createScopeMiddleware - throws when no authInfo on HTTP request (no-silent-fallback)", async () => {
  const scopes = new Map([["admin_tool", ["admin"]]]);
  const middleware = createScopeMiddleware(scopes);

  await assertRejects(
    () =>
      middleware(
        {
          toolName: "admin_tool",
          args: {},
          request: new Request("http://localhost"),
        }, // HTTP but no authInfo
        async () => "ok",
      ),
    Error,
    "no authInfo found on HTTP request",
  );
});

// ============================================
// HTTP Integration with Auth
// ============================================

Deno.test("HTTP + Auth - 401 without token", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-auth",
    version: "1.0.0",
    logger: () => {},
    auth: {
      provider: new MockAuthProvider({ subject: "user-1", scopes: ["read"] }),
      authorizationServers: ["https://auth.example.com"],
      resource: "https://my-mcp.example.com",
    },
  });

  server.registerTool(
    { name: "echo", description: "Echo", inputSchema: { type: "object" } },
    (args) => args,
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
        params: { name: "echo", arguments: { hello: "world" } },
      }),
    });

    assertEquals(res.status, 401);
    const wwwAuth = res.headers.get("WWW-Authenticate");
    assert(wwwAuth?.includes("Bearer"));
    assert(wwwAuth?.includes("resource_metadata="));
    await res.json(); // consume body to avoid leak
  } finally {
    await http.shutdown();
  }
});

Deno.test("HTTP + Auth - 200 with valid token", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-auth",
    version: "1.0.0",
    logger: () => {},
    auth: {
      provider: new MockAuthProvider({ subject: "user-1", scopes: ["read"] }),
      authorizationServers: ["https://auth.example.com"],
      resource: "https://my-mcp.example.com",
    },
  });

  server.registerTool(
    { name: "echo", description: "Echo", inputSchema: { type: "object" } },
    (args) => args,
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "echo", arguments: { hello: "world" } },
      }),
    });

    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.jsonrpc, "2.0");
    const result = JSON.parse(data.result.content[0].text);
    assertEquals(result.hello, "world");
  } finally {
    await http.shutdown();
  }
});

Deno.test("HTTP + Auth - 401 with invalid token", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-auth",
    version: "1.0.0",
    logger: () => {},
    auth: {
      provider: new MockAuthProvider(null), // verifyToken returns null
      authorizationServers: ["https://auth.example.com"],
      resource: "https://my-mcp.example.com",
    },
  });

  server.registerTool(
    { name: "echo", description: "Echo", inputSchema: { type: "object" } },
    (args) => args,
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer bad-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "echo", arguments: {} },
      }),
    });

    assertEquals(res.status, 401);
    const wwwAuth = res.headers.get("WWW-Authenticate");
    assert(wwwAuth?.includes("invalid_token"));
    await res.json(); // consume body to avoid leak
  } finally {
    await http.shutdown();
  }
});

Deno.test("HTTP + Auth - RFC 9728 endpoint returns metadata", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-auth",
    version: "1.0.0",
    logger: () => {},
    auth: {
      provider: new MockAuthProvider({ subject: "user-1", scopes: [] }),
      authorizationServers: ["https://auth.example.com"],
      resource: "https://my-mcp.example.com",
    },
  });

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(
      `http://localhost:${port}/.well-known/oauth-protected-resource`,
    );
    assertEquals(res.status, 200);
    const metadata = await res.json();
    assertEquals(metadata.resource, "https://mock.example.com");
    assertEquals(metadata.authorization_servers, ["https://auth.example.com"]);
    assertEquals(metadata.bearer_methods_supported, ["header"]);
  } finally {
    await http.shutdown();
  }
});

Deno.test("HTTP + Auth - RFC 9728 endpoint 404 when no auth", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-no-auth",
    version: "1.0.0",
    logger: () => {},
    // No auth configured
  });

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(
      `http://localhost:${port}/.well-known/oauth-protected-resource`,
    );
    assertEquals(res.status, 404);
    await res.text(); // consume body
  } finally {
    await http.shutdown();
  }
});

Deno.test("HTTP + Auth - no auth config means tools work without token", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-no-auth",
    version: "1.0.0",
    logger: () => {},
    // No auth configured
  });

  server.registerTool(
    { name: "echo", description: "Echo", inputSchema: { type: "object" } },
    (args) => args,
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
        params: { name: "echo", arguments: { ok: true } },
      }),
    });

    assertEquals(res.status, 200);
    const data = await res.json();
    const result = JSON.parse(data.result.content[0].text);
    assertEquals(result.ok, true);
  } finally {
    await http.shutdown();
  }
});

Deno.test("HTTP + Auth - scope enforcement 403", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-scopes",
    version: "1.0.0",
    logger: () => {},
    auth: {
      provider: new MockAuthProvider({ subject: "user-1", scopes: ["read"] }), // only "read"
      authorizationServers: ["https://auth.example.com"],
      resource: "https://my-mcp.example.com",
    },
  });

  server.registerTool(
    {
      name: "admin_action",
      description: "Admin only",
      inputSchema: { type: "object" },
      requiredScopes: ["admin"],
    },
    () => "admin result",
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "admin_action", arguments: {} },
      }),
    });

    assertEquals(res.status, 403);
    const body = await res.json();
    assert(body.error.message.includes("admin"));
  } finally {
    await http.shutdown();
  }
});

Deno.test("HTTP + Auth - tools/list requires token (no auth bypass)", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-auth-bypass",
    version: "1.0.0",
    logger: () => {},
    auth: {
      provider: new MockAuthProvider({ subject: "user-1", scopes: ["read"] }),
      authorizationServers: ["https://auth.example.com"],
      resource: "https://my-mcp.example.com",
    },
  });

  server.registerTool(
    { name: "echo", description: "Echo", inputSchema: { type: "object" } },
    (args) => args,
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    // tools/list WITHOUT token should be 401
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
      }),
    });

    assertEquals(res.status, 401);
    await res.json(); // consume body

    // tools/list WITH valid token should work
    const res2 = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      }),
    });

    assertEquals(res2.status, 200);
    const data = await res2.json();
    assertEquals(data.result.tools.length, 1);
    assertEquals(data.result.tools[0].name, "echo");
  } finally {
    await http.shutdown();
  }
});

Deno.test("HTTP + Auth - initialize does NOT require token", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-init-no-auth",
    version: "1.0.0",
    logger: () => {},
    auth: {
      provider: new MockAuthProvider({ subject: "user-1", scopes: [] }),
      authorizationServers: ["https://auth.example.com"],
      resource: "https://my-mcp.example.com",
    },
  });

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    // initialize WITHOUT token should still work (200)
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
      }),
    });

    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.result.serverInfo.name, "test-init-no-auth");
  } finally {
    await http.shutdown();
  }
});
