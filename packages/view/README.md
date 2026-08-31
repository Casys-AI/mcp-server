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

React and ReactDOM are optional peers of the npm package. Component-only Preact Apps can use the
official `@casys/mcp-view/preact` adapter; Preact is also an optional peer and is never loaded by
the renderer-neutral main export. Direct use of the official `ext-apps` SDK remains conformant. See
the [adoption guide](docs/adoption.md) and
[authoring-framework decision](docs/decision-records/0004-view-authoring-framework.md).

## Reusable components and composable surfaces

An MCP App exposes small domain components and may also expose a default standalone composition. A
component-only App deliberately omits `defaultSurface`: it renders only when a compatible Compose
host selects a surface. Compose never inspects the child DOM and never asks for a size mode:

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
      events: {
        emits: ["semantic.selection.changed"],
        accepts: ["semantic.selection.apply"],
      },
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
otherwise `defaultSurface`, and returns one deterministic cleanup handle. With neither selection nor
default it reports `surface-required`; it never invents a dashboard. Components receive the same
domain data and may be implemented with the supplied status/metric/key-value primitives, custom DOM,
React, Preact, Three.js, or any other renderer. The public contract stays JSON-only: component keys,
layout, instance IDs, safe props, and event routes.

When present, the default surface is the standalone viewer, not a second implementation. A composed
dashboard can select, order, and repeat advertised components in its JSON composition while the
owning MCP App keeps domain rendering, local state, and actions.

### App-owned JSON manifest

An App can publish the same presentation contract as versioned JSON without exposing provider
endpoints, credentials, tool arguments, or host routing policy. The manifest pins the App version,
its exact `ui://` resources, supported result/session schemas, and the component catalog advertised
at runtime:

```ts
import {
  defineViewAppManifest,
  VIEWER_SESSION_APPLY_ACTION,
} from "@casys/mcp-view/contracts";

export const manifest = defineViewAppManifest({
  schemaVersion: "io.casys.mcp.view-app-manifest/1.0",
  app: { id: "io.casys.modelica.results", title: "Modelica results", version: "0.6.0" },
  resources: [{
    uri: "ui://mcp-modelica/results-viewer",
    resultSchemas: ["io.casys.modelica.run/2.0"],
    sessionSchemas: ["io.casys.thread.modelica-viewer-session/1.0"],
    components: {
      components: {
        "modelica.metrics": {
          title: "Simulation metrics",
          events: { accepts: [VIEWER_SESSION_APPLY_ACTION] },
        },
      },
    },
  }],
});
```

Declaring `viewer.session.apply` and `sessionSchemas` is inseparable. The action carries a versioned
read projection; it is not a substitute for `ui/notifications/tool-result`, which remains tied to a
real tool execution lifecycle. The Compose host decides when and where to deliver a compatible
session.

### Preact surface runtime and shared visual language

`startPreactSurfaceApp()` owns the result-driven MCP Apps handshake, advertises the component
catalog, mounts the host-selected surface, and remounts when the host changes composition. It also
installs the shared `mcp-view` theme by default:

```ts
import { defineComponentRegistry } from "@casys/mcp-view";
import { definePreactComponent, startPreactSurfaceApp } from "@casys/mcp-view/preact";

const registry = defineComponentRegistry({
  components: {
    "bom.metrics": definePreactComponent({ title: "BOM metrics" }, BomMetrics),
  },
  // No defaultSurface: this App is a palette for Compose.
});

await startPreactSurfaceApp({ root, info, registry });
```

Domain components should import the shared presentation kit instead of recreating its cards and
tables:

```tsx
import {
  Badge,
  Card,
  DataTable,
  KeyValueList,
  MetricGrid,
  type PreactSurfaceComponentProps,
} from "@casys/mcp-view/preact";

function SolveMetrics({ data }: PreactSurfaceComponentProps<StaticSolveResult>) {
  return (
    <Card title="Static solve" actions={<Badge tone="success">Solved</Badge>}>
      <MetricGrid items={toMetricItems(data)} />
    </Card>
  );
}
```

Native Preact applications that do not run inside an MCP Apps iframe should use the
presentation-only entry point. It includes the same components and theme, but no lifecycle, surface
registry, `ext-apps`, `window`, or postMessage bridge:

```tsx
import { Card, installMcpViewTheme, MetricGrid } from "@casys/mcp-view/preact/components";

installMcpViewTheme();
```

`@casys/mcp-view/preact` remains backwards-compatible and continues to export both this presentation
kit and the MCP Apps surface runtime.

This is deliberately closer to an imported design-system core than copied application CSS. A future
`mcp-view add` workflow may provide source-owned domain recipes, but the foundational presentation
components stay versioned here so every MCP receives the same fixes.

The theme is the compact, container-friendly language first proven by the ERPNext BOM components. It
provides tokens and stable classes for cards, uppercase section titles, metric grids, badges, dense
tables, selected rows, cross-view state, empty states, stacks, and rows. Import
`installMcpViewTheme()` for custom renderers or set `theme: false` in the Preact runtime when an App
must supply a complete alternative theme. Domain-specific visuals remain owned by their MCP.

Viewer-to-viewer interactions use the separate optional `ctx.events` channel. Its messages are
restricted to `ui/compose/event`, validated at the iframe boundary, and removed automatically on
teardown. Domain viewers still decide which selections, filters, or highlights are meaningful.

Component descriptors may advertise `events.emits` and `events.accepts`. These ports are the App's
runtime capability manifest; they do not create routes by themselves. A Compose host may apply a
stable `portSync` policy to the currently active components, so adding a compatible App does not
require a whiteboard-specific code path.

Engineering viewers can share the versioned semantic-selection contract:

```ts
import {
  defineSemanticSelection,
  emitSemanticSelection,
  onSemanticSelection,
  SEMANTIC_SELECTION_EVENT_PORTS,
  type SemanticSelectionEventContext,
} from "@casys/mcp-view";

const scene = defineCustomComponent<unknown, SemanticSelectionEventContext>({
  title: "CAD scene",
  events: SEMANTIC_SELECTION_EVENT_PORTS,
  mount(target, { appContext }) {
    target.addEventListener("click", () => {
      emitSemanticSelection(
        appContext,
        defineSemanticSelection({
          mode: "replace",
          references: [{ domain: "cad", kind: "face", id: "face-12" }],
        }),
      );
    });
    return onSemanticSelection(appContext.events, (selection) => {
      // Highlight only an exact local or host-provided recorded binding.
      applyRecordedSelection(selection.references);
    });
  },
});
```

The contract keeps `domain` structurally open because the owning Digital Thread remains the
authority for its narrower domain vocabulary. Compose forwards references but never invents a
cross-domain mapping.

Server-side tool metadata can reuse the same constants without importing the iframe runtime:

```ts
import {
  SEMANTIC_SELECTION_APPLY_ACTION,
  SEMANTIC_SELECTION_CHANGED_EVENT,
} from "@casys/mcp-view/contracts";

const resultViewer = uiMeta({
  resourceUri: "ui://cad/results",
  emits: [SEMANTIC_SELECTION_CHANGED_EVENT],
  accepts: [SEMANTIC_SELECTION_APPLY_ACTION],
});
```

That tool metadata is the pre-open manifest an agent can inspect. The component catalog confirms the
ports actually mounted after the Apps handshake, so planning and runtime cannot silently diverge.

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
deno run -A jsr:@casys/mcp-view@0.8.0/scaffold result-viewer ./result-viewer
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
