# Casys MCP Platform

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Monorepo for Casys MCP (Model Context Protocol) packages.

## Packages

| Package | Status | JSR | npm | Description |
|---------|--------|-----|-----|-------------|
| [`@casys/mcp-server`](packages/server/) | **Production** | [![JSR](https://jsr.io/badges/@casys/mcp-server)](https://jsr.io/@casys/mcp-server) | [![npm](https://img.shields.io/npm/v/@casys/mcp-server)](https://www.npmjs.com/package/@casys/mcp-server) | Production-grade MCP server framework — middleware, auth, concurrency, observability |
| [`@casys/mcp-compose`](packages/compose/) | Prototype | [![JSR](https://jsr.io/badges/@casys/mcp-compose)](https://jsr.io/@casys/mcp-compose) | — | Compose and synchronize multiple MCP Apps UIs into composite dashboards |
| [`@casys/mcp-bridge`](packages/bridge/) | Prototype | [![JSR](https://jsr.io/badges/@casys/mcp-bridge)](https://jsr.io/@casys/mcp-bridge) | [![npm](https://img.shields.io/npm/v/@casys/mcp-bridge)](https://www.npmjs.com/package/@casys/mcp-bridge) | Bridge MCP Apps UIs to messaging platforms (Telegram Mini Apps, LINE LIFF) |

## @casys/mcp-server

The main package — **"Hono for MCP"**. A production-grade framework for building MCP servers in TypeScript, built on the official [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/sdk).

```
rate-limit → auth → custom middleware → scope-check → validation → backpressure → handler
```

### Install

```bash
# npm
npm install @casys/mcp-server

# Deno
deno add jsr:@casys/mcp-server
```

### Quick Start

```typescript
import { ConcurrentMCPServer } from "@casys/mcp-server";

const server = new ConcurrentMCPServer({ name: "my-server", version: "1.0.0" });

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

### Key Features

- **Composable middleware** — onion model (like Hono/Koa)
- **OAuth2 / JWT auth** — 4 OIDC presets (Google, Auth0, GitHub Actions, generic)
- **Dual transport** — STDIO + HTTP (Streamable HTTP + SSE)
- **Concurrency control** — 3 backpressure strategies (sleep/queue/reject)
- **Rate limiting** — sliding window, per-client
- **Schema validation** — JSON Schema via ajv
- **OpenTelemetry tracing** — automatic spans per tool call
- **Prometheus metrics** — `/metrics` endpoint
- **MCP Apps** — interactive UI resources via `ui://`

See the [full documentation](packages/server/README.md) for HTTP auth setup, YAML config, observability, and API reference.

## Development

This is a Deno workspace. Cross-package imports resolve automatically.

```bash
# Run tests for a specific package
cd packages/server && deno task test
cd packages/compose && deno task test
cd packages/bridge && deno task test
```

## License

MIT
