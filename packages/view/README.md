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

The core package does not depend on a rendering framework. Existing React component trees can use
the optional adapter without duplicating the MCP Apps lifecycle:

```tsx
import { readStructuredContent } from "@casys/mcp-view";
import { defineReactView } from "@casys/mcp-view/react";

const detail = defineReactView<State, { id: string }, Invoice>({
  async onEnter(ctx, { id }) {
    return readStructuredContent<Invoice>(await ctx.callTool("invoice_get", { id }));
  },
  component: ({ ctx, data }) => (
    <InvoiceViewer
      invoice={data}
      onBack={() => ctx.navigate("list")}
    />
  ),
});
```

React and ReactDOM are optional peers of the npm package. Preact and direct use of the official
`ext-apps` SDK remain supported choices; adopting this wrapper is not a protocol-conformance
requirement. See the [adoption guide](docs/adoption.md) and
[authoring-framework decision](docs/decision-records/0004-view-authoring-framework.md).

## Reusable components and composable surfaces

An MCP App exposes small domain components plus one default standalone composition. A compatible
Compose host can request another composition of the same components; it never inspects the child DOM
and never asks for a size mode:

```ts
import {
  advertisedComponentCatalog,
  createMcpApp,
  defineComponentRegistry,
  defineMetricGridComponent,
  defineStatusComponent,
  mountComponentSurface,
} from "@casys/mcp-view";

const components = defineComponentRegistry<Simulation>({
  components: {
    "thermal.status": defineStatusComponent({
      title: "Simulation status",
      select: (data) => ({ label: data.status }),
    }),
    "thermal.metrics": defineMetricGridComponent({
      title: "Thermal metrics",
      select: (data) => [{
        id: "max-temperature",
        label: "Max temperature",
        value: data.maxTemperature,
        unit: "°C",
      }],
    }),
  },
  defaultSurface: {
    layout: { type: "stack", gap: "sm" },
    components: [
      { id: "status", component: "thermal.status" },
      { id: "metrics", component: "thermal.metrics" },
    ],
  },
});

await createMcpApp({
  // ...info, root, views, initialView
  componentCatalog: advertisedComponentCatalog(components),
});
```

Use `mountComponentSurface()` from a view renderer. It mounts the negotiated surface when present,
otherwise `defaultSurface`, and returns one deterministic cleanup handle. Components receive the
same domain data and may be implemented with the supplied status/metric/key-value primitives, custom
DOM, React, Preact, Three.js, or any other renderer. The public contract stays JSON-only: component
keys, layout, instance IDs, safe props, and event routes.

The default surface is the standalone viewer, not a second implementation. A composed dashboard can
select, order, and repeat advertised components in YAML while the owning MCP App keeps domain
rendering, local state, and actions.

Viewer-to-viewer interactions use the separate optional `ctx.events` channel. Its messages are
restricted to `ui/compose/event`, validated at the iframe boundary, and removed automatically on
teardown. Domain viewers still decide which selections, filters, or highlights are meaningful.

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

Use `readStructuredContent()` for the normal data path or `readResultData()` when a legacy JSON text
fallback is explicitly required. Neither helper silently prefers model-facing text over
`structuredContent`.

For an executable two-view bundle, see [`examples/basic`](./examples/basic/README.md).

## Scaffold a vanilla result viewer

`mcp-view` also ships one narrow generator for the repeated MCP Apps pattern: receive an initiating
structured result and render a readable evidence-style view. It is a starting point for a
componentized viewer, not a server generator.

```sh
deno run -A jsr:@casys/mcp-view@0.5.0/scaffold result-viewer ./result-viewer
cd ./result-viewer
deno task test
deno task build
```

The generated project is standalone and vanilla: `index.html`, `main.ts`, a generic model/parser,
renderer, host-aware accessible styles, build script, and parser/render test. Its `onToolResult`
callback is declared in `createMcpApp` configuration, so mcp-view registers it before `connect()`
and preserves the initiating result during the Apps handshake. It renders loading, empty, error,
metrics, scalar details, and URI-based artifacts without assuming an ERP, CAD, or other domain
schema.

The generator refuses a non-empty target directory. Pass `--force` only when overwriting its named
scaffold files is intentional; unrelated files are not removed.
