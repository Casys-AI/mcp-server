# `@casys/mcp-view`

Browser-side primitives for MCP Apps. The package creates the ext-apps connection, applies host
styles, provides memory-only view routing, and capability-gates calls back to the originating MCP
server.

```ts
import { createMcpApp, defineView } from "@casys/mcp-view";

const app = await createMcpApp({
  info: { name: "Engineering Viewer", version: "0.1.0" },
  root: document.getElementById("root")!,
  views: {
    home: defineView({ render: () => "<h1>Ready</h1>" }),
  },
  initialView: "home",
});
```

## Host tool notifications

Pass `onToolInput`, `onToolInputPartial`, or `onToolResult` directly to `createMcpApp` when a view
needs to react to notifications sent by its MCP Apps host. Each callback receives the notification
payload and a complete `AppHandle`.

```ts
const app = await createMcpApp({
  // ...info, root, views, initialView
  async onToolResult(result, app) {
    if (result.isError) return;
    await app.navigate("summary", result.structuredContent);
  },
});
```

`@casys/mcp-view` installs those ext-apps handlers **before** `App.connect()`. That matters:
ext-apps treats them as one-shot events and warns (or throws when `strict: true`) when they are
registered after the initialize handshake. Events that arrive during the handshake or first route
are buffered, then replayed in host arrival order once the `AppHandle` exists. Async callbacks are
serialized; an error is logged and does not stop later notifications.

For an executable two-view bundle, see [`examples/basic`](./examples/basic/README.md).
