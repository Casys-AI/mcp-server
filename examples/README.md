# MCP Apps Bridge — Examples

## demo-time

A minimal end-to-end demo showing the MCP Apps Bridge in action with a Telegram Mini App.

The demo consists of:
- A simple HTML page that displays the server time
- A resource server that handles `tools/call` requests for a `get_time` tool
- The `bridge.js` client script (injected automatically by the resource server)

### Quick Start

**1. Start the server**

```bash
cd lib/mcp-bridge
TELEGRAM_BOT_TOKEN=123456:ABC-DEF deno run --allow-net --allow-read --allow-env examples/demo-time/start.ts
```

The server starts on port 4000 and is intended to be opened from Telegram, because the WebSocket session is authenticated with Telegram `initData`.

**2. Expose via ngrok** (for Telegram testing)

```bash
ngrok http 4000
```

Copy the HTTPS URL (e.g. `https://abc123.ngrok-free.app`).

**3. Create a Telegram Bot**

1. Open [@BotFather](https://t.me/BotFather) on Telegram
2. Send `/newbot` and follow the prompts
3. Send `/setmenubutton`
4. Select your bot
5. Enter the URL: `https://<ngrok-id>.ngrok-free.app/app/demo-time/index.html`

**4. Open the Mini App**

Open your bot on Telegram mobile, tap the Menu Button at the bottom. The Mini App loads, connects to the bridge, and displays the server time.

### What Happens

```
Telegram Mini App (WebView)
    |
    | postMessage (JSON-RPC)
    v
bridge.js (injected by resource server)
    |
    | WebSocket
    v
Resource Server (Deno, port 4000)
    |
    | onMessage handler
    v
get_time tool -> returns current time
```

1. The resource server serves `index.html` with `bridge.js` auto-injected
2. `bridge.js` intercepts `postMessage` calls from the MCP App
3. The App sends `ui/initialize` (handled locally by bridge.js)
4. The App sends `tools/call { name: "get_time" }` via WebSocket to the server
5. The server's `onMessage` handler returns the current time
6. bridge.js dispatches the response back to the App as a `MessageEvent`

### Features Demonstrated

- MCP Apps protocol handshake (`ui/initialize`)
- Tool calls via JSON-RPC over WebSocket
- Telegram theme detection and CSS variable injection
- Theme change notifications (`ui/notifications/host-context-changed`)
- Automatic dark/light mode switching
- Session management
- Reconnection with exponential backoff
