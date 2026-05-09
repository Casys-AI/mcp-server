# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in
this repository.

## Project Overview

`@casys/mcp-server` — a production-grade framework for building MCP (Model
Context Protocol) servers in TypeScript. Think "Hono for MCP". Built on the
official `@modelcontextprotocol/sdk`, it adds middleware, auth, concurrency
control, and observability.

Published to both **JSR** (`jsr:@casys/mcp-server`) and **npm**
(`@casys/mcp-server`).

## Commands

```bash
# Run all tests
deno task test

# Run a single test file
deno test --allow-net --allow-read --allow-write --allow-env --no-check src/<file>_test.ts

# Targeted test suites
deno task test:security    # HTTP security tests only
deno task test:http        # HTTP + security tests

# Build Node.js distribution (output: dist-node/)
bash scripts/build-node.sh
```

No separate lint or format task is configured — Deno's built-in `deno fmt` and
`deno lint` apply.

## Architecture

Entry point is `mod.ts` which re-exports the entire public API. The central
class is `McpApp` in `src/mcp-app.ts`. (`ConcurrentMCPServer` remains exported
as a `@deprecated` alias for backwards compatibility — it points to the same
class and will be removed in v1.0.)

### Key modules

- **`src/mcp-app.ts`** — Main server class wrapping `McpServer` from the
  official SDK. Handles tool/resource registration, dual transport (STDIO via
  `start()`, HTTP via `startHttp()`), and orchestrates the middleware pipeline.
- **`src/middleware/`** — Onion-model middleware pipeline (like Hono/Koa).
  Built-in chain:
  `rate-limit → auth → custom → scope-check → validation → backpressure → handler`.
  Types in `types.ts`, runner in `runner.ts`.
- **`src/auth/`** — OAuth2/JWT authentication. `JwtAuthProvider` does token
  verification with JWKS caching. Four OIDC presets (`presets.ts`): Google,
  Auth0, GitHub Actions, generic OIDC. YAML + env config loading in `config.ts`.
- **`src/concurrency/`** — `RequestQueue` (3 backpressure strategies:
  sleep/queue/reject) and `RateLimiter` (sliding window, per-client).
- **`src/validation/`** — JSON Schema validation via ajv.
- **`src/observability/`** — OpenTelemetry tracing (`otel.ts`) and Prometheus
  metrics (`metrics.ts`).
- **`src/security/`** — CSP header generation, HMAC channel auth for PostMessage
  (MCP Apps).
- **`src/runtime/`** — Runtime abstraction layer. `runtime.ts` uses
  `Deno.serve`, `runtime.node.ts` uses `node:http`. The Node build script swaps
  them.
- **`src/client-auth/`** — Client-side OAuth2 flow (callback server, token
  stores).
- **`src/ui/`** — MCP Apps viewer discovery and utilities.
- **`src/sampling/`** — Bidirectional LLM delegation (sampling bridge).
- **`src/inspector/`** — MCP Inspector launcher for interactive debugging.

### Important patterns

- **Local sibling dependency**: `@casys/mcp-compose` is imported from
  `../mcp-compose/` (mapped in `deno.json`). This must exist locally for the
  project to work.
- **Test convention**: `*_test.ts` files colocated with source. Uses Deno's
  native test runner with `@std/assert`.
- **Node.js compatibility**: `scripts/build-node.sh` copies source to
  `dist-node/`, swaps the runtime adapter, and remaps Deno imports to npm
  equivalents. The HTTP layer uses Hono for portable routing.
- **Dual transport**: STDIO for local/CLI usage, HTTP (Streamable HTTP + SSE)
  for remote. Auth only applies to HTTP transport.
- **Publishing**: On push to `main`, `.github/workflows/publish.yml` publishes
  every workspace member to JSR (`npx jsr publish` skips already-published
  versions) and three of them to npm (`server`, `compose`, `bridge` via dnt;
  `view` is JSR-only at this stage — see the comment at the bottom of
  `publish.yml`). Each npm job is idempotent: it queries `npm view <pkg>@<ver>`
  before publishing, so repeated runs without a version bump exit cleanly
  instead of masking auth/build/network failures behind `|| echo`.

## Release process

Versioning is **independent per package**. Each package owns its own `deno.json`
`version`, `CHANGELOG.md`, and (for `compose`) a `src/version.ts` constant whose
drift is asserted by `version_test.ts`. Bump them together.

Per-package release flow (run from inside `packages/<pkg>/`):

```bash
# 1. Generate a draft of unreleased entries from conventional commits.
#    Output is meant to be edited — git-cliff gives you the *what*, you write
#    the *why* in the narrative style the existing CHANGELOG entries follow.
deno task changelog:draft

# 2. Edit packages/<pkg>/CHANGELOG.md: promote [Unreleased] → [<version>] and
#    expand bullets with the rationale, trade-offs, and breaking notes.

# 3. Bump version in packages/<pkg>/deno.json. For compose, also bump
#    packages/compose/src/version.ts (drift test will catch a miss).

# 4. Run the release pre-flight (lint + check + tests).
deno task release:check

# 5. Create the annotated tag <pkg>-v<version> locally.
deno task release:tag

# 6. Push the tag to trigger .github/workflows/release.yml (creates the
#    GitHub Release with the CHANGELOG section as notes). The actual JSR/npm
#    publish still rides on push to main, separately.
git push origin <pkg>-v<version>
```

Tag format is `<pkg>-v<version>` (e.g. `server-v0.17.6`, `compose-v0.5.2`). This
is what `release.yml` listens for and what `git-cliff` filters on via the shared
`cliff.toml` at the repo root. **Do not** create unscoped `vX.Y.Z` tags for
individual package releases — those are reserved for legacy history.
