# Changelog

All notable changes to `@casys/mcp-server` will be documented in this file.

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
