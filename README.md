# Casys MCP Platform

[![JSR](https://jsr.io/badges/@casys/mcp-server)](https://jsr.io/@casys/mcp-server)
[![npm](https://img.shields.io/npm/v/@casys/mcp-server)](https://www.npmjs.com/package/@casys/mcp-server)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Everything you need to build, compose, and deploy production MCP servers.**

The official SDK gives you the protocol. Casys MCP Platform gives you the
production stack: composable middleware, OAuth2 auth, concurrency control,
observability, interactive UIs, and multi-server composition — all in
TypeScript.

```
rate-limit → auth → custom middleware → scope-check → validation → backpressure → handler
```

---

## Packages

| Package                                   | Status         | Description                                                                                |
| ----------------------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| [`@casys/mcp-server`](packages/server/)   | **Production** | The framework. Middleware, auth, dual transport, observability.                            |
| [`@casys/mcp-compose`](packages/compose/) | Experimental   | Multi-server UI composition — sync and orchestrate MCP Apps into dashboards.               |
| [`@casys/mcp-bridge`](packages/bridge/)   | Experimental   | Deliver MCP Apps UIs through Telegram Mini Apps, LINE LIFF, and other messaging platforms. |

---

## Quick Start

```bash
# npm
npm install @casys/mcp-server

# Deno
deno add jsr:@casys/mcp-server
```

### STDIO Server

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
import { createAuth0AuthProvider, McpApp } from "@casys/mcp-server";

const server = new McpApp({
  name: "my-api",
  version: "1.0.0",
  maxConcurrent: 10,
  backpressureStrategy: "queue",
  validateSchema: true,
  rateLimit: { maxRequests: 100, windowMs: 60_000 },
  auth: {
    provider: createAuth0AuthProvider({
      domain: "my-tenant.auth0.com",
      audience: "https://my-mcp.example.com",
      resource: "https://my-mcp.example.com",
    }),
  },
});

await server.startHttp({ port: 3000 });
```

---

## Why Casys MCP Platform?

|                          | Official SDK |       @casys/mcp-server        |
| ------------------------ | :----------: | :----------------------------: |
| MCP protocol compliance  |     Yes      |              Yes               |
| Composable middleware    |      —       |  Onion model (like Hono/Koa)   |
| OAuth2 / JWT auth        |      —       |  4 OIDC presets + YAML config  |
| Concurrency control      |      —       |   3 backpressure strategies    |
| Rate limiting            |      —       |   Sliding window, per-client   |
| Schema validation        |      —       |       JSON Schema (ajv)        |
| Streamable HTTP + SSE    |    Manual    |  Built-in session management   |
| OpenTelemetry tracing    |      —       | Automatic spans per tool call  |
| Prometheus metrics       |      —       |      `/metrics` endpoint       |
| MCP Apps (UI resources)  |    Manual    | `registerResource()` + `ui://` |
| Multi-server composition |      —       |      `@casys/mcp-compose`      |

---

## Platform Overview

### @casys/mcp-server — The Framework

The core of the platform. Build MCP servers with the same developer experience
as Hono or Koa — register tools, plug in middleware, start serving.

**Highlights:**

- **Middleware pipeline** — rate-limit, auth, validation, backpressure, all
  composable
- **4 OAuth2 presets** — Google, Auth0, GitHub Actions, generic OIDC
- **Dual transport** — STDIO for local/CLI, HTTP (Streamable HTTP + SSE) for
  remote
- **Observability** — OpenTelemetry spans + Prometheus metrics out of the box
- **MCP Apps** — serve interactive UIs as MCP resources

[Full documentation and API reference](packages/server/README.md)

### @casys/mcp-compose — Multi-Server Composition

> _Experimental — API may change._

Orchestrate multiple MCP Apps UIs into composite dashboards. Define layouts,
sync rules between panels, and let the composition engine handle the event
routing.

[Documentation](packages/compose/README.md)

### @casys/mcp-bridge — Messaging Platform Bridge

> _Experimental — API may change._

Deliver MCP Apps interactive UIs through messaging platforms. Currently supports
Telegram Mini Apps and LINE LIFF with platform-specific authentication and
lifecycle handling.

[Documentation](packages/bridge/README.md)

---

## Development

Deno workspace — cross-package imports resolve automatically.

```bash
# Tests
cd packages/server && deno task test     # 270 tests
cd packages/compose && deno task test    # 219 tests
cd packages/bridge && deno task test     # 120 tests
```

## License

MIT
