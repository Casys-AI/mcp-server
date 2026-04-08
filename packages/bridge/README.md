# @casys/mcp-bridge

[![npm](https://img.shields.io/npm/v/@casys/mcp-bridge)](https://www.npmjs.com/package/@casys/mcp-bridge)
[![JSR](https://jsr.io/badges/@casys/mcp-bridge)](https://jsr.io/@casys/mcp-bridge)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Bridge
[MCP Apps](https://modelcontextprotocol.io/specification/2025-11-25/client/roots)
interactive UIs to messaging platforms. Turn any MCP tool with a `ui://`
resource into a Telegram Mini App or LINE LIFF app.

```
MCP Server (tools with ui:// resources)
        |
        v
+------------------+
|  @casys/mcp-bridge  |
|   Resource Server   |  Serves HTML + injects bridge.js
|   Bridge Client     |  Intercepts postMessage, routes via WebSocket
|   Platform Adapters |  Telegram theme/viewport/auth mapping
+------------------+
        |
        v
Telegram Mini App / LINE LIFF WebView
```

---

## Install

```bash
# npm
npm install @casys/mcp-bridge

# Deno
deno add jsr:@casys/mcp-bridge
```

---

## Quick Start

### 1. Create a resource server

```typescript
import { JsonRpcMcpBackend, startResourceServer } from "@casys/mcp-bridge";

const server = startResourceServer({
  assetDirectories: {
    "my-app": "./my-app",
  },
  platform: "telegram",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  options: {
    resourceServerPort: 4000,
  },
  backend: new JsonRpcMcpBackend({
    endpointUrl: "https://my-mcp.example.com/mcp",
  }),
});

console.log(`Bridge running at ${server.baseUrl}`);
```

### 2. Create your MCP App HTML

```html
<!DOCTYPE html>
<html>
  <head><title>My MCP App</title></head>
  <body>
    <button id="btn">Get Data</button>
    <div id="result"></div>
    <script>
      // bridge.js is auto-injected by the resource server
      // It intercepts postMessage and routes via WebSocket to your handler

      window.addEventListener("mcp-bridge-ready", () => {
        document.getElementById("btn").onclick = async () => {
          const id = Date.now();
          window.parent.postMessage({
            jsonrpc: "2.0",
            id,
            method: "tools/call",
            params: { name: "get_data", arguments: {} },
          }, "*");
        };
      });

      window.addEventListener("message", (e) => {
        if (e.data?.result) {
          document.getElementById("result").textContent = JSON.stringify(
            e.data.result,
          );
        }
      });
    </script>
  </body>
</html>
```

### 3. Expose via HTTPS and configure Telegram

```bash
# Option A: Reverse proxy (recommended for production)
# Add to your Caddy/nginx config:
#   /app/*  -> localhost:4000
#   /bridge -> localhost:4000

# Option B: ngrok (for development)
ngrok http 4000
```

Then configure your Telegram bot via [@BotFather](https://t.me/BotFather):

1. `/setmenubutton` -> select your bot
2. Enter your HTTPS URL: `https://your-domain.com/app/my-app/index.html`
3. Open the bot on Telegram mobile -> tap Menu Button

---

## How It Works

1. **User opens Mini App** in Telegram (or LINE)
2. **Resource server** serves the MCP App HTML with `bridge.js` auto-injected
3. **bridge.js** intercepts `postMessage` calls from the MCP App
4. Messages are routed via **WebSocket** to the resource server
5. Resource server forwards **`tools/call`** and **`resources/read`** to your
   configured backend
6. Response flows back: backend -> WebSocket -> bridge.js -> MCP App

The MCP App doesn't know it's running in Telegram. It uses the standard MCP Apps
SDK (`postMessage`), and the bridge handles the translation.

---

## API

### Resource Server

```typescript
import { JsonRpcMcpBackend, startResourceServer } from "@casys/mcp-bridge";
import type { ResourceServerConfig } from "@casys/mcp-bridge";

const config: ResourceServerConfig = {
  assetDirectories: {
    "my-app": "./my-app",
  },
  platform: "telegram",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
  options: {
    resourceServerPort: 4000,
  },
  csp: {
    scriptSources: ["https://telegram.org"],
    connectSources: ["wss://my-domain.com"],
    frameAncestors: ["https://web.telegram.org"],
  },
  backend: new JsonRpcMcpBackend({
    endpointUrl: "https://my-mcp.example.com/mcp",
  }),
};
```

### Protocol Helpers

```typescript
import {
  buildErrorResponse,
  buildSuccessResponse,
  buildToolCallRequest,
  isRequest,
  isResponse,
  MessageRouter,
} from "@casys/mcp-bridge";

const router = new MessageRouter();
router.onRequest("tools/call", async (params) => {
  return { content: [{ type: "text", text: "result" }] };
});
```

### Platform Adapters

```typescript
// Telegram — used internally by bridge.js, or standalone
import { TelegramPlatformAdapter } from "@casys/mcp-bridge";

const adapter = new TelegramPlatformAdapter();
const hostContext = await adapter.initialize();
// { colorScheme: "dark", viewportHeight: 640, ... }

// LINE LIFF
import { LineAdapter } from "@casys/mcp-bridge";
```

### Resource URI Parsing

```typescript
import { parseResourceUri, resolveToHttp } from "@casys/mcp-bridge";

const uri = parseResourceUri("ui://my-server/dashboard.html?tab=metrics");
const httpUrl = resolveToHttp(uri, "https://my-domain.com");
// => "https://my-domain.com/app/my-server/dashboard.html?tab=metrics"

const proxyUrl = resolveToHttp(uri, "https://my-domain.com", { mode: "query" });
// => "https://my-domain.com/ui?uri=ui%3A%2F%2Fmy-server%2Fdashboard.html%3Ftab%3Dmetrics"
```

---

## Architecture

| Layer        | Component              | Role                                                                          |
| ------------ | ---------------------- | ----------------------------------------------------------------------------- |
| **Client**   | `bridge.js`            | IIFE injected into MCP App HTML. Intercepts postMessage, routes via WebSocket |
| **Server**   | `ResourceServer`       | HTTP server (serves HTML + bridge.js), WebSocket endpoint, session management |
| **Protocol** | `MessageRouter`        | JSON-RPC 2.0 routing, pending request tracking, timeout                       |
| **Adapters** | Platform runtimes      | Map host SDKs (Telegram today, extensible for others) to MCP Apps HostContext |
| **Security** | `CSP` + `SessionStore` | Content-Security-Policy headers, session auth, path traversal protection      |

---

## Development

```bash
# Run tests
deno task test

# Type-check
deno task check

# Lint
deno task lint

# Run the demo
deno task demo
```

---

## Companion Package

Built to work with [@casys/mcp-server](https://jsr.io/@casys/mcp-server) — the
production MCP server framework. Use `@casys/mcp-server` to build MCP tools with
`ui://` resources, and `@casys/mcp-bridge` to deliver them to messaging
platforms.

---

## License

MIT
