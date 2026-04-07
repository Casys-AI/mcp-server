# Changelog

All notable changes to `@casys/mcp-server` will be documented in this file.

## [Unreleased]

### Added

- **`createMultiTenantMiddleware()`** — tenant resolution middleware sitting after the auth middleware. Delegates tenant identification to a user-provided `TenantResolver`, injects the resolved `tenantId` into `ctx.authInfo`, and rejects mismatches with a generic `invalid_token` error. Passthrough on STDIO; fails fast with a config error if `ctx.authInfo` is missing on HTTP.
- **`AuthInfo.tenantId`** — new optional field populated by the multi-tenant middleware. Tool handlers should read this instead of raw JWT claims. `authInfo` is re-frozen after injection.
- **`MultiTenantMiddlewareOptions.onRejection`** — async audit hook awaited before the 401 is thrown. Rejection reasons are server-side only; the client always sees a generic `invalid_token` error. Hook exceptions are caught and logged to stderr — they can never change client-visible behaviour or become an oracle for attackers.
- **Empty-`tenantId` guard** — `{ ok: true, tenantId: "" }` is rejected as if it were a resolver failure, preventing truthy-guard bypasses in downstream handlers.
- **`ConcurrentMCPServer.getFetchHandler()`** — returns a Web Standard fetch handler without binding a port. Use this to mount the MCP HTTP layer inside another framework (Fresh, Hono, Express, Cloudflare Workers, etc.) without giving up port ownership to `startHttp`. Auth, multi-tenant middleware, scope checks, rate limiting, sessions, and SSE all run identically. Designed for the multi-tenant SaaS pattern of caching one server-per-tenant and dispatching from the host framework's routing layer.
- **`HttpServerOptions.embedded` + `embeddedHandlerCallback`** — internal mechanism powering `getFetchHandler`. Most consumers should use `getFetchHandler` directly rather than setting these.
- **`FetchHandler` type re-exported from `./types.ts`** — was already exported from the runtime port at top-level, now also re-exported alongside `HttpServerOptions` for ergonomic single-import use.
- **New types** — `TenantResolver`, `TenantResolution`, `MultiTenantMiddlewareOptions` exported from `mod.ts`.

Non-breaking: existing single-tenant servers require no changes.

## [0.12.0] - 2026-03-22

### Added

- **`structuredContent` support** — tool handlers can return `{ content: "summary", structuredContent: { ...data } }` to separate LLM context (text summary) from viewer payload (structured data). Reduces LLM token usage for data-heavy tools.
- **`outputSchema` on tools** — optional JSON Schema for tool output, passed through in `tools/list`. Enables host-side validation of tool results.
- **`annotations` on tools** — behavioural hints (`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) passed through in `tools/list`.
- **Tool visibility filtering** — tools with `_meta.ui.visibility: ["app"]` are excluded from `tools/list` (hidden from LLM) but remain callable via `tools/call`. Cleans up LLM tool list from UI-only actions (refresh, pagination, etc.).
- **`registerAppOnlyTool()` helper** — shortcut to register app-only tools with `visibility: ["app"]` auto-injected.
- **`toolErrorMapper` option** — centralized error-to-`isError` mapping. Business errors produce `{ isError: true }` results; system errors rethrow as JSON-RPC errors. Configurable via `ConcurrentServerOptions.toolErrorMapper`.
- **New types** — `ToolAnnotations`, `StructuredToolResult`, `ToolErrorMapper` exported from `mod.ts`.

### Changed

- **`tools/list` refactored** — both STDIO and HTTP paths now use shared `buildToolListing()` method (deduplication).
- **`tools/call` refactored** — both STDIO and HTTP paths now use shared `buildToolCallResult()` and `handleToolError()` methods. Serialization errors are no longer routed through `toolErrorMapper`.

## [0.11.0] - 2026-03-20

### Added

- **`registerViewers()` CSP option** — `csp` field on `RegisterViewersConfig` declares external domains the viewer needs (tiles, APIs, CDNs). Injects `_meta.ui.csp` into resource content.
- **Re-export compose SDK helpers** — `composeEvents`, `uiMeta`, and related types re-exported from `mod.ts` via `@casys/mcp-compose`.

### Changed

- **Bump `@casys/mcp-compose` ^0.2.0 → ^0.3.0**.

## [0.10.0] - 2026-03-20

### Changed

- **Bump MCP SDK ^1.15 → ^1.27** — unlocks `structuredContent`, `outputSchema`, `annotations`, `isError` at the protocol level.
- **Bump `@casys/mcp-compose` → ^0.2.0** — adds sub-path exports (`/sdk`, `/core`).
- **`McpUiToolMeta` imported from mcp-compose** — replaced inlined base type with `import type { McpUiToolMeta } from "@casys/mcp-compose/core"`. No API change.

## [0.9.2] - 2026-03-17

### Added

- **MCP Inspector launcher** — `launchInspector()` starts an interactive MCP Inspector session for debugging. Exported from `mod.ts` with `InspectorOptions` type.

## [0.9.1] - 2026-03-17

### Changed

- **Import `McpUiToolMetaBase` from `@casys/mcp-compose/core`** — replaced inlined visibility/resourceUri type with proper dependency import.

## [0.9.0] - 2026-03-17

### Added

- **Client-side OAuth2 flow** — `CallbackServer` (localhost redirect capture), `OAuthClientProviderImpl`, `connect()` helper for MCP client auth. Token stores: `FileTokenStore` (persistent, 0o600 permissions) and `MemoryTokenStore` (ephemeral).
- **MCP Apps viewer utilities** — `resolveViewerDistPath()` and `discoverViewers()` for auto-discovering built UI viewers. `registerViewers()` method on `ConcurrentMCPServer` for bulk resource registration.
- **New exports** — `RegisterViewersConfig`, `RegisterViewersSummary`, `resolveViewerDistPath`, `discoverViewers` from `mod.ts`.

## [0.8.0] - 2026-02-12

### Added

- **Security: HMAC-SHA256 channel authentication for PostMessage (MCP Apps)** — `MessageSigner` class for signing/verifying JSON-RPC messages with `_hmac` + `_seq` (anti-replay). `injectChannelAuth()` injects an inline script into iframe HTML that signs outgoing postMessages. Host-side verification via `MessageSigner.verify()`.
- **Security: HTTP hardening options** — `maxBodyBytes` (default 1 MB, returns 413 JSON-RPC error), `corsOrigins` allowlist with wildcard warning, `requireAuth` fail-fast at startup, `ipRateLimit` per-IP 429 + `Retry-After` header, `sessionId` propagation into middleware context.
- **Security: CSP injection** — `buildCspHeader()` and `injectCspMetaTag()` for Content-Security-Policy in MCP Apps HTML resources. Configurable via `resourceCsp` in `ConcurrentServerOptions`.
- **Security: CORS wildcard warning** — logs `[WARN]` when `corsOrigins` is `"*"` regardless of auth configuration.
- **Node.js runtime adapter** — `runtime.node.ts` implements the `RuntimePort` contract for Node.js 18+ with `maxBodyBytes` enforcement at both `Content-Length` and streaming body levels.
- **Observability: `recordAuthEvent()` wired** — auth tracing spans now fire on token verify, reject, and JWT cache hit (gated by `isOtelEnabled()`).
- **`HttpServerInstance` return type** — `startHttp()` now returns `{ shutdown(), addr }` for programmatic control.

### Changed

- **File reorganization** — moved files into domain subfolders: `src/runtime/`, `src/concurrency/`, `src/validation/`, `src/sampling/`. All re-exports from `mod.ts` are unchanged.
- **API cleanup** — removed internal types from public barrel (`PromiseResolver`, `QueueOptions`, `MCP_APP_URI_SCHEME`).
- **Lint cleanup** — zero `deno lint` errors, zero `deno fmt` issues, no slow types.

## [0.7.0] - 2026-02-07

### Added

- **Observability: OTel tracing** — every tool call emits an OpenTelemetry span (`mcp.tool.call {name}`) with attributes (tool name, server name, transport, session ID, duration, success/error). Requires `OTEL_DENO=true` + `--unstable-otel`.
- **Observability: Prometheus `/metrics` endpoint** — exposes counters (tool calls, auth, sessions, rate limiting), histogram (tool call latency), and gauges (active requests, queued, sessions, SSE clients, uptime) in Prometheus text format.
- **Observability: `ServerMetrics` class** — embeddable metrics collector with per-tool breakdown, `getSnapshot()`, `toPrometheusFormat()`, and `reset()`.
- **Observability: `getServerMetrics()` / `getPrometheusMetrics()`** — public methods on `ConcurrentMCPServer` for programmatic access.
- **Observability: auth event tracing** — `recordAuthEvent()` helper for fire-and-forget auth spans.
- **Security: per-IP rate limiting on `initialize`** — 10 requests/min per IP to prevent session exhaustion attacks (DoS).
- **Reliability: session cleanup grace period** — 60s grace period added to session TTL so in-flight requests are not killed mid-execution.
- **Reliability: `RateLimiter.purgeExpiredKeys()`** — periodic cleanup of stale keys to prevent unbounded memory growth. Auto-triggers every 1000 operations.

### Fixed

- **Critical: RateLimiter memory leak** — keys with no active requests were never removed from the internal Map, causing unbounded growth in long-running servers with per-IP rate limiting.
- **Critical: SSE zombie clients** — failed `controller.enqueue()` calls were silently caught without removing the dead client from the Map, causing memory leaks and wasted CPU on every `sendToSession()`.
- **High: JWT token cache** — added SHA-256 token cache (max 1000 entries, TTL = min(token expiry, 5min)) to avoid redundant JWKS network round-trips on every tool call.

## [0.6.0] - 2026-02-06

### Added

- **OAuth2/Bearer authentication** — `JwtAuthProvider` with JWKS validation, 4 presets (Google, Auth0, GitHub, OIDC).
- **YAML + env config** — `loadAuthConfig()` reads `mcp-server.yaml` + `MCP_AUTH_*` env vars with priority: programmatic > env > YAML.
- **Middleware pipeline** — composable onion-model pipeline: rate-limit → auth → custom → scope-check → validation → backpressure → handler.
- **Scope enforcement** — `requiredScopes` on tools with AND-based checking.
- **RFC 9728** — `/.well-known/oauth-protected-resource` metadata endpoint.
- **HTTP/SSE transport** — `startHttp()` with Streamable HTTP, session management, SSE streaming.
- **MCP Apps** — `ui://` scheme, `MCP_APP_MIME_TYPE`, `registerResource()`.

## [0.5.0] - 2026-01-28

### Added

- Initial release: `ConcurrentMCPServer`, `RequestQueue`, `RateLimiter`, `SchemaValidator`, `SamplingBridge`.
- STDIO transport with backpressure strategies (sleep/queue/reject).
- Schema validation with ajv.
