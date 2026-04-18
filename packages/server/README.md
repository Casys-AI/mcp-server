# @casys/mcp-server

[![npm](https://img.shields.io/npm/v/@casys/mcp-server)](https://www.npmjs.com/package/@casys/mcp-server)
[![JSR](https://jsr.io/badges/@casys/mcp-server)](https://jsr.io/@casys/mcp-server)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**The "Hono for MCP"** — a production-grade framework for building Model Context
Protocol servers in TypeScript.

Composable middleware, OAuth2 auth, dual transport, observability, and
everything you need to ship reliable MCP servers. Built on the official
[@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk).

```
rate-limit → auth → custom middleware → scope-check → validation → backpressure → handler
```

---

## Why @casys/mcp-server?

The official SDK gives you the protocol. This framework gives you the production
stack.

|                         | Official SDK |       @casys/mcp-server        |
| ----------------------- | :----------: | :----------------------------: |
| MCP protocol compliance |     Yes      |              Yes               |
| Concurrency control     |      --      |   3 backpressure strategies    |
| Middleware pipeline     |      --      |     Composable onion model     |
| OAuth2 / JWT auth       |      --      |   Built-in + 4 OIDC presets    |
| Rate limiting           |      --      |   Sliding window, per-client   |
| Schema validation       |      --      |       JSON Schema (ajv)        |
| Streamable HTTP + SSE   |    Manual    |  Built-in session management   |
| OpenTelemetry tracing   |      --      | Automatic spans per tool call  |
| Prometheus metrics      |      --      |      `/metrics` endpoint       |
| MCP Apps (UI resources) |    Manual    | `registerResource()` + `ui://` |
| Sampling bridge         |      --      |  Bidirectional LLM delegation  |

---

## Install

```bash
# Deno (primary target — JSR)
deno add jsr:@casys/mcp-server

# Node (secondary — npm, via build-node compilation)
npm install @casys/mcp-server
```

## Runtime targets

`@casys/mcp-server` is **Deno-first**. The canonical deployment path is Deno 2.x
running on [Deno Deploy](https://deno.com/deploy) or self-hosted Deno, with a
Node 20+ distribution as a secondary target via `scripts/build-node.sh` (which
swaps the HTTP runtime adapter and remaps `@std/*` imports to their npm
equivalents).

| Runtime                                       |      Status      |
| --------------------------------------------- | :--------------: |
| **Deno 2.x** (Deno Deploy, self-hosted)       |    ✅ Primary    |
| **Node.js 20+** (Express, Hono-on-Node, bare) |   ✅ Secondary   |
| **Cloudflare Workers / workerd**              | ❌ Not supported |
| **Browser / WebContainer**                    | ❌ Not supported |

If you need to target Cloudflare Workers or the browser, use
[`@modelcontextprotocol/server`](https://www.npmjs.com/package/@modelcontextprotocol/server)
directly with its workerd / browser shims — that package focuses on the protocol
and runtime portability, while `@casys/mcp-server` focuses on the production
stack (auth, middleware, observability, multi-tenant, MCP Apps helpers) for Deno
deployments.

---

## Quick Start

### STDIO Server (5 lines)

```typescript
import { McpApp } from "@casys/mcp-server";

const server = new McpApp({ name: "my-server", version: "1.0.0" });

server.registerTool(
  {
    name: "greet",
    description: "Greet a user",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"],
    },
  },
  ({ name }) => `Hello, ${name}!`,
);

await server.start();
```

### HTTP Server with Auth

```typescript
import { createGoogleAuthProvider, McpApp } from "@casys/mcp-server";

const server = new McpApp({
  name: "my-api",
  version: "1.0.0",
  maxConcurrent: 10,
  backpressureStrategy: "queue",
  validateSchema: true,
  rateLimit: { maxRequests: 100, windowMs: 60_000 },
  auth: {
    provider: createGoogleAuthProvider({
      audience: "https://my-mcp.example.com",
      resource: "https://my-mcp.example.com",
    }),
  },
});

server.registerTool(
  {
    name: "query",
    description: "Query the database",
    inputSchema: {
      type: "object",
      properties: { sql: { type: "string" } },
    },
    requiredScopes: ["db:read"],
  },
  async ({ sql }) => ({ rows: [] }),
);

await server.startHttp({ port: 3000 });
// GET  /health   → { status: "ok" }
// GET  /metrics  → Prometheus text format
// POST /mcp      → JSON-RPC (tools/call, tools/list, ...)
// GET  /mcp      → SSE stream (server→client notifications)
```

**Secure-by-default HTTP options:**

```typescript
await server.startHttp({
  port: 3000,
  requireAuth: true, // fail fast if auth isn't configured
  corsOrigins: ["https://app.example.com"],
  maxBodyBytes: 1_000_000, // 1 MB
  ipRateLimit: { maxRequests: 120, windowMs: 60_000 },
});
```

**Notes:**

- `requireAuth: true` throws if no auth provider is configured
- `corsOrigins` defaults to `"*"` — use an allowlist in production
- `maxBodyBytes` defaults to **1 MB** (set `null` to disable)
- `ipRateLimit` keys on client IP by default

---

## Features

### Middleware Pipeline

Composable onion model — same mental model as Hono, Koa, or Express.

```typescript
import type { Middleware } from "@casys/mcp-server";

const timing: Middleware = async (ctx, next) => {
  const start = performance.now();
  const result = await next();
  console.log(
    `${ctx.toolName} took ${(performance.now() - start).toFixed(0)}ms`,
  );
  return result;
};

server.use(timing);
```

Built-in pipeline:
`rate-limit → auth → custom → scope-check → validation → backpressure → handler`

### OAuth2 / JWT Auth

Four OIDC presets out of the box:

```typescript
import {
  createAuth0AuthProvider, // Auth0
  createGitHubAuthProvider, // GitHub Actions OIDC
  createGoogleAuthProvider, // Google OIDC
  createOIDCAuthProvider, // Generic OIDC (Keycloak, Okta, etc.)
} from "@casys/mcp-server";

const auth0 = createAuth0AuthProvider({
  domain: "my-tenant.auth0.com",
  audience: "https://my-mcp.example.com",
  resource: "https://my-mcp.example.com",
  scopesSupported: ["read", "write"],
});
```

Or use `JwtAuthProvider` directly for custom setups:

```typescript
import { JwtAuthProvider } from "@casys/mcp-server";

const provider = new JwtAuthProvider({
  issuer: "https://my-idp.example.com",
  audience: "https://my-mcp.example.com",
  resource: "https://my-mcp.example.com",
  authorizationServers: ["https://my-idp.example.com"],
});
```

Token verification is cached (SHA-256 hash → AuthInfo, TTL = min(token expiry,
5min)) to avoid redundant JWKS round-trips.

### YAML + Env Config

For binary distribution — users configure auth without code:

```yaml
# mcp-server.yaml
auth:
  provider: auth0
  audience: https://my-mcp.example.com
  resource: https://my-mcp.example.com
  domain: my-tenant.auth0.com
  scopesSupported: [read, write, admin]
```

Env vars override YAML at deploy time:

```bash
MCP_AUTH_AUDIENCE=https://prod.example.com ./my-server --http --port 3000
```

Priority: `programmatic > env vars > YAML > no auth`

### RFC 9728

When auth is configured, the framework automatically exposes
`GET /.well-known/oauth-protected-resource` per
[RFC 9728](https://www.rfc-editor.org/rfc/rfc9728).

### DCR Discovery Proxy (RFC 8414 + RFC 7591)

IdPs without native Dynamic Client Registration (Zitadel, unconfigured
Keycloak, Okta free tier) don't publish `registration_endpoint` in their
AS metadata, so MCP clients like Claude.ai or Cursor can't auto-register.

`createAsMetadataHandler` is a framework-agnostic Web Standard handler
that proxies the upstream RFC 8414 metadata and injects a
`registration_endpoint` pointing to your own DCR proxy:

```typescript
// routes/.well-known/oauth-authorization-server.ts (Fresh example)
import { createAsMetadataHandler } from "@casys/mcp-server";

const handle = createAsMetadataHandler({
  upstreamIssuer: "https://my-tenant.zitadel.cloud",
  registrationEndpoint: "https://my-app.example.com/oauth/register",
  // cacheTtlMs?: 24h default, stale-while-revalidate
  // extraFields?: override scopes_supported, etc.
});

export const handler = { GET: (ctx) => handle(ctx.req) };
```

Then point the PRM at your own host so clients hit the enriched metadata:

```typescript
authorizationServers: ["https://my-app.example.com"],
```

The DCR endpoint itself (RFC 7591 `/oauth/register`) is out of scope —
mount it in your framework and forward to the IdP's admin API.

**Path caveat**: if the MCP server lives at `/mcp`, clients may build
the discovery URL as
`<host>/.well-known/oauth-authorization-server/mcp`. Mount the handler
at the exact path your PRM advertises.

### Observability

Every tool call emits an **OpenTelemetry span** with rich attributes:

```
mcp.tool.call query
  mcp.tool.name       = "query"
  mcp.server.name     = "my-api"
  mcp.transport        = "http"
  mcp.session.id       = "a1b2c3..."
  mcp.tool.duration_ms = 42
  mcp.tool.success     = true
```

Enable with Deno's native OTEL support:

```bash
OTEL_DENO=true deno run --unstable-otel server.ts
```

The HTTP server exposes a **Prometheus-compatible** `/metrics` endpoint:

```
mcp_server_tool_calls_total 1024
mcp_server_tool_calls_success_total 1018
mcp_server_tool_calls_failed_total 6
mcp_server_tool_call_duration_ms_bucket{le="50"} 892
mcp_server_tool_call_duration_ms_bucket{le="100"} 987
mcp_server_tool_calls_by_name{tool="query",status="success"} 512
mcp_server_active_requests 3
mcp_server_active_sessions 42
mcp_server_sse_clients 7
mcp_server_uptime_seconds 86400
```

Programmatic access:

```typescript
server.getServerMetrics(); // Full snapshot (counters, histograms, gauges)
server.getPrometheusMetrics(); // Prometheus text format string
```

### Concurrency Control

Three backpressure strategies when the server is at capacity:

| Strategy          | Behavior                                   |
| ----------------- | ------------------------------------------ |
| `sleep` (default) | Busy-wait with configurable sleep interval |
| `queue`           | FIFO queue with ordered release            |
| `reject`          | Fail fast with immediate error             |

```typescript
new McpApp({
  maxConcurrent: 10,
  backpressureStrategy: "queue",
});
```

### Rate Limiting

Sliding window rate limiter with per-client tracking:

```typescript
new McpApp({
  rateLimit: {
    maxRequests: 100,
    windowMs: 60_000,
    keyExtractor: (ctx) => ctx.args.clientId as string,
    onLimitExceeded: "wait", // or "reject"
  },
});
```

For HTTP endpoints, use `startHttp({ ipRateLimit: ... })` to rate limit by
client IP (or custom key).

### Security Best Practices (Tool Handlers)

Tool handlers receive **untrusted JSON input**. Treat args as hostile:

- **Define strict schemas**: `additionalProperties: false`, `minLength`,
  `pattern`, `enum`.
- **Never pass raw args to a shell** (`Deno.Command`, `child_process.exec`). If
  you must, use an allowlist + argv array (no shell).
- **Validate paths & resources**: allowlisted roots, deny `..`, restrict env
  access.
- **Prefer safe APIs**: parameterized DB queries, SDK methods, typed clients.
- **Log sensitive actions**: file writes, network calls, admin ops.

### MCP Apps (UI Resources)

Register interactive UIs as MCP resources:

```typescript
import { MCP_APP_MIME_TYPE, McpApp } from "@casys/mcp-server";

server.registerResource(
  { uri: "ui://my-server/viewer", name: "Data Viewer" },
  async (uri) => ({
    uri: uri.toString(),
    mimeType: MCP_APP_MIME_TYPE,
    text: "<html><body>...</body></html>",
  }),
);
```

#### Capability negotiation (clients that don't support MCP Apps)

Not every MCP client renders UI resources. Clients that do advertise the
[MCP Apps extension](https://github.com/modelcontextprotocol/ext-apps) in their
capabilities (per the SDK 1.29 `extensions` field). Read it from a tool handler
to decide between rich UI and a text-only fallback:

```typescript
import { MCP_APP_MIME_TYPE, McpApp } from "@casys/mcp-server";

const app = new McpApp({ name: "weather-server", version: "1.0.0" });

app.registerTool(
  {
    name: "get-weather",
    description: "Get the weather forecast for a city",
    inputSchema: {
      type: "object",
      properties: { city: { type: "string" } },
      required: ["city"],
    },
  },
  async ({ city }) => {
    const forecast = await fetchForecast(city);
    const cap = app.getClientMcpAppsCapability();

    if (cap?.mimeTypes?.includes(MCP_APP_MIME_TYPE)) {
      // Rich UI: small text summary + interactive resource
      return {
        content: [{ type: "text", text: `Forecast for ${city} loaded` }],
        _meta: { ui: { resourceUri: `ui://weather/${city}` } },
      };
    }

    // Text-only fallback for clients that can't render the UI
    return {
      content: [{ type: "text", text: formatForecastAsText(forecast) }],
    };
  },
);
```

`getClientMcpAppsCapability()` returns `undefined` before the client has
completed its initialize handshake, when the client doesn't advertise MCP Apps
support, or when the advertised capability is malformed. The standalone
`getMcpAppsCapability(clientCapabilities)` function is also exported for use
against arbitrary capability objects.

The constants `MCP_APPS_EXTENSION_ID` (`"io.modelcontextprotocol/ui"`) and
`MCP_APPS_PROTOCOL_VERSION` (`"2026-01-26"`) are exported for agents that need
to introspect the protocol target directly.

---

## API Reference

### McpApp

> **Note:** `ConcurrentMCPServer` and `ConcurrentServerOptions` remain exported
> as `@deprecated` aliases for backwards compatibility and will be removed in
> v1.0. New code should use `McpApp` / `McpAppOptions`. The aliases point to the
> exact same class — `instanceof` checks pass on both.

```typescript
const server = new McpApp(options: McpAppOptions);

// Registration (before start)
server.registerTool(tool, handler);
server.registerTools(tools, handlers);
server.registerResource(resource, handler);
server.registerResources(resources, handlers);
server.use(middleware);

// Transport
await server.start();                  // STDIO
await server.startHttp({ port: 3000 }); // HTTP + SSE
await server.stop();                    // Graceful shutdown

// Observability
server.getMetrics();              // { inFlight, queued }
server.getServerMetrics();        // Full snapshot
server.getPrometheusMetrics();    // Prometheus text format
server.getRateLimitMetrics();     // { keys, totalRequests }

// Introspection
server.getToolCount();
server.getToolNames();
server.getResourceCount();
server.getResourceUris();
server.getSSEClientCount();

// SSE (Streamable HTTP)
server.sendToSession(sessionId, message);
server.broadcastNotification(method, params);
```

### Standalone Components

Each component works independently:

```typescript
import { RateLimiter, RequestQueue, SchemaValidator } from "@casys/mcp-server";

// Rate limiter
const limiter = new RateLimiter({ maxRequests: 10, windowMs: 1000 });
if (limiter.checkLimit("client-123")) {
  /* proceed */
}

// Request queue
const queue = new RequestQueue({
  maxConcurrent: 5,
  strategy: "queue",
  sleepMs: 10,
});
await queue.acquire();
try {
  /* work */
} finally {
  queue.release();
}

// Schema validator
const validator = new SchemaValidator();
validator.addSchema("tool", {
  type: "object",
  properties: { n: { type: "number" } },
});
validator.validate("tool", { n: 5 }); // { valid: true, errors: [] }
```

---

## HTTP Endpoints

When running with `startHttp()`:

| Method | Path                                    | Description                                                 |
| ------ | --------------------------------------- | ----------------------------------------------------------- |
| `POST` | `/mcp` or `/`                           | JSON-RPC endpoint (initialize, tools/call, tools/list, ...) |
| `GET`  | `/mcp` or `/`                           | SSE stream (server→client notifications)                    |
| `GET`  | `/health`                               | Health check                                                |
| `GET`  | `/metrics`                              | Prometheus metrics                                          |
| `GET`  | `/.well-known/oauth-protected-resource` | RFC 9728 metadata (when auth enabled)                       |

---

## License

MIT
