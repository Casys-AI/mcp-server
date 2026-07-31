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

## Scaffold a vanilla result viewer

`mcp-view` also ships one narrow generator for the repeated MCP Apps pattern: receive an initiating
structured result and render a readable evidence-style view. It is deliberately a starting point,
not a component framework or a server generator.

```sh
deno run -A jsr:@casys/mcp-view@0.4.0/scaffold result-viewer ./result-viewer
cd ./result-viewer
deno task test
deno task build
```

The generated project is standalone and vanilla: `index.html`, `main.ts`, a generic
model/parser, renderer, host-aware accessible styles, build script, and parser/render test. Its
`onToolResult` callback is declared in `createMcpApp` configuration, so mcp-view registers it
before `connect()` and preserves the initiating result during the Apps handshake. It renders
loading, empty, error, metrics, scalar details, and URI-based artifacts without assuming an ERP,
CAD, or other domain schema.

The generator refuses a non-empty target directory. Pass `--force` only when overwriting its named
scaffold files is intentional; unrelated files are not removed.
