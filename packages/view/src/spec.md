# `@casys/mcp-view` — Specification

## Overview

`view/` is the **View-side SDK** (iframe runtime) for MCP Apps authors. It replaces the anti-pattern
of calling `app.sendMessage("show details for X")` from a UI event handler — a flow that pollutes
the chat thread and triggers Claude's "the app is trying to speak for you" warning — with a pure
intra-iframe SPA model: click a row → fetch data via `ctx.callTool` → `ctx.navigate("detail")` →
re-render, no roundtrip through the host chat.

The module is a renderer-neutral authoring layer over the `App` class from
`@modelcontextprotocol/ext-apps`. It owns lifecycle bootstrap, memory-based view routing,
capability-gated tool calls, structured-result extraction, renderer-neutral component surfaces, and
the viewer side of declared Compose events. It does not own MCP server transport, dashboard layout,
or domain rendering. Direct use of `ext-apps` remains conformant.

## Public API

### `createMcpApp<S>(config: AppConfig<S>): Promise<AppHandle<S>>`

Bootstraps the App: instantiates `ext-apps`' `App`, performs the `ui/initialize` handshake (via
`App.connect()`), then mounts `initialView`.

```ts
const app = await createMcpApp({
  info: { name: "DoclistViewer", version: "1.0.0" },
  root: document.getElementById("root")!,
  initialState: { filter: "all" },
  initialView: "list",
  views: { list: listView, detail: detailView },
});
```

### `defineView<S, A, D>(view: ViewDefinition<S, A, D>): ViewDefinition<S, A, D>`

Identity function for inference. Declares `onEnter(ctx, args) → data`, then
`render(ctx, data) → string | Node`, plus optional `onLeave(ctx)`.

```ts
const detailView = defineView<State, { id: string }, Invoice>({
  async onEnter(ctx, { id }) {
    const res = await ctx.callTool("einvoice_invoice_get", { id });
    return res.structuredContent as Invoice;
  },
  render(ctx, invoice) {
    return `<h1>${invoice.number}</h1><button id="back">Back</button>`;
  },
});
```

### Optional renderer adapters

`@casys/mcp-view/react` exports `defineReactView()`. It returns a normal `ViewDefinition`, mounts
with ReactDOM, and guarantees that the active root is unmounted on route leave or App teardown.
React, ReactDOM, and their types are optional npm peers; importing the main package does not load a
renderer. `@casys/mcp-view/preact` exports `definePreactComponent()`, `startPreactSurfaceApp()`, and
the shared `Card`, `Badge`, `MetricGrid`, `KeyValueList`, `DataTable`, `Button`, `Toolbar`,
`EmptyState`, and `StateMessage` presentation components. Preact is also an optional peer.

### Structured results, component surfaces, and Compose events

- `readStructuredContent()` reads only record-shaped `structuredContent`.
- `readResultData()` adds JSON text fallback only with `{ fallback: "json-text" }`.
- `defineComponentRegistry()` declares small domain components and an optional standalone default
  surface. Omitting it creates a component-only App that requires a host-selected surface.
- `mountComponentSurface()` mounts the host-selected or default surface and aggregates cleanup.
- `defineStatusComponent()`, `defineMetricGridComponent()`, and `defineKeyValueComponent()` provide
  safe renderer-neutral primitives; `defineCustomComponent()` keeps specialized rendering local.
- `ctx.events.emit()` / `ctx.events.on()` exchange validated `ui/compose/event` messages with a
  compatible parent. This channel is optional and distinct from standard model-context messages.
- `installMcpViewTheme()` installs the shared ERPNext-derived visual tokens and component classes
  once per document. The Preact surface runtime does this by default.

#### `AppConfig<S>` fields

- `info` — app identity for `ui/initialize`.
- `root` — DOM element where views mount (required).
- `views` — map of view name → `ViewDefinition` (at least one required).
- `initialView` — name of the view to mount first (must be in `views`).
- `initialArgs?` — args forwarded to `initialView.onEnter`.
- `initialState?` — initial value of `ctx.state`.
- `capabilities?` — app-side capabilities (default `{}`).
- `componentCatalog?` — component registry advertised under `io.casys.mcp.view-components/v1`. When
  present, its optional default surface is the complete standalone composition.
- `autoTheme?` — auto-apply host theme/CSS/fonts on handshake and context updates. Default `true`.
  Set to `false` if the App ships its own complete stylesheet. `ctx.hostContext` remains live
  regardless.
- `onToolInput?`, `onToolInputPartial?`, `onToolResult?` — optional callbacks for the three one-shot
  host tool notifications. Each receives `(params, appHandle)` after the initial view has mounted.
  They are registered on ext-apps **before** `connect()`; notifications received during setup are
  buffered and replayed in host arrival order. Async callbacks are serialized. A callback error is
  logged and does not block later notifications.
- `onTeardown?` — optional author cleanup callback. Host teardown and manual `dispose()` share one
  idempotent cleanup path and receive either `"host"` or `"dispose"` as the reason.

### `AppContext<S>` (passed to every view hook)

- `navigate(name, args?)` — switch view, internal only, no MCP traffic.
- `callTool(name, args?)` — proxy to `App.callServerTool`. Throws if the host did not advertise
  `serverTools` capability, or if the underlying transport errors. Tool-level errors
  (`isError: true`) are returned, not thrown — the view decides.
- `capabilities` — frozen snapshot of `McpUiHostCapabilities` from the handshake.
- `state` — mutable ref to user state `S` (shared across views).
- `hostContext` — live host theme, locale, display mode, and optional composition context.
- `tools` — route-scoped App tool registry.
- `events` — optional Compose event client, always cleaned up on teardown.
- `app` — the underlying `App` instance, escape hatch for advanced use.

## Lifecycle

```
createMcpApp(config)
  └─ new App(info, capabilities)
  └─ install one-shot tool notification handlers
  └─ app.connect(PostMessageTransport)        ← ui/initialize
       └─ host tool notifications buffer here, if any
  └─ snapshot hostCapabilities
  └─ router.goto(initialView, undefined)
       └─ onEnter(ctx, args) → data
       └─ render(ctx, data) → string|Node
       └─ mount into config.root
  └─ create AppHandle; replay buffered notifications FIFO

ctx.navigate("detail", { id })
  └─ current.onLeave?(ctx)
  └─ target.onEnter(ctx, { id }) → data
  └─ target.render(ctx, data)
  └─ replace DOM content of config.root

app.dispose() or ui/resource-teardown
  └─ config.onTeardown?(handle, reason)
  └─ active view onLeave(ctx)
  └─ remove tools, listeners, Compose events, and mounted DOM
```

Re-render on same view: `navigate(currentView, newArgs)` is allowed and re-runs `onEnter → render`.
No implicit state diffing.

## Error codes

All errors thrown by the SDK are instances of `MCPViewError` (extends `Error`) with a stable `.code`
field. Match on `.code`, not on `.message`.

| Code                              | Thrown when                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `INVALID_CONFIG_ROOT`             | `config.root` is absent or falsy                                                                             |
| `INVALID_CONFIG_VIEWS`            | `config.views` is empty or missing                                                                           |
| `INVALID_CONFIG_INITIAL_VIEW`     | `config.initialView` is absent or falsy                                                                      |
| `ORPHAN_INITIAL_VIEW`             | `config.initialView` names a view not registered in `config.views`; `.data.initialView` + `.data.registered` |
| `MISSING_RENDER`                  | A view in `config.views` has no `render` function; `.data.view`                                              |
| `MISSING_SERVER_TOOLS_CAPABILITY` | `ctx.callTool` called without `serverTools` host capability; `.data.tool`                                    |
| `HANDSHAKE_NO_CAPABILITIES`       | `ui/initialize` handshake returned no host capabilities (malformed host)                                     |
| `NO_PARENT_WINDOW`                | `window.parent` unavailable — SDK not running inside an iframe                                               |
| `UNKNOWN_VIEW`                    | `ctx.navigate(name)` with an unregistered name; `.data.view` + `.data.registered`                            |
| `ROUTER_NOT_INITIALIZED`          | Internal: `Router.goto` called before `setContext` (should never reach user code)                            |

## Error contract

- `createMcpApp` throws if `connect()` fails (host unreachable, handshake rejected, transport gone).
  Caller wraps in try/catch; no Result type.
- `ctx.callTool` throws when:
  1. `capabilities.serverTools` is absent (pre-flight check),
  2. `App.callServerTool` rejects (timeout, transport loss, host refusal).
- `ctx.navigate(name)` throws synchronously if `name` is not a registered view.
- User errors inside `onEnter`/`render` propagate up. The router does NOT catch them — view author
  handles or crashes visibly. Rationale: silent error handlers in a routing layer always mask bugs.

## Bundling rules

- **No `import.meta.url`.** Must tree-shake and bundle cleanly through esbuild in IIFE mode with no
  external hints.
- **No Node built-ins at module top-level.** `@modelcontextprotocol/ext-apps` is imported but must
  resolve to a browser-compatible entry (its `PostMessageTransport` is pure DOM). If an `ext-apps`
  subpath drags `node:crypto` etc, the bundler config in examples will alias; we do not reach into
  `ext-apps` internals.
- **Deno + Node compat.** Types reference only `@modelcontextprotocol/ext-apps` types and DOM lib.
  No `Deno.*`, no `process.*`, no `Buffer`.
- **Self-contained viewer bundles.** Consumer output is normally `<script type="module">` or an IIFE
  bundle with no unresolved runtime imports. The generated npm package exposes both ESM and CJS
  entry points for Node-compatible tooling.
- **Optional renderer.** The main npm export has no React dependency. React and ReactDOM are
  optional peers used only by the `/react` subpath.
- Published as dedicated workspace member `@casys/mcp-view` (`packages/view/`). See
  `packages/compose/docs/decision-records/0002` addendum for the rationale of the split.

## Non-goals (MVP)

Explicitly **out of scope** for v0.1.0; may ship later:

- `sendMessage`, `updateModelContext`, `requestDisplayMode`, `openLink`, `downloadFile` wrappers —
  authors call `ctx.app.<method>` directly.
- URL-based routing / history API integration.
- State persistence across teardown.
- Vue and Svelte adapters without a demonstrated consumer need.
- Data-loader caching, suspense, optimistic updates.
- Route guards, nested views, layout components.
- Dashboard layout, domain schemas, and a universal JSON renderer.

The type surface is designed so each of the above can be added without breaking existing `AppConfig`
/ `ViewDefinition` / `AppContext` shapes (all extension points are optional fields).

## Result-viewer scaffold

`@casys/mcp-view/scaffold` is an executable subpath, not part of the iframe runtime API:

```sh
deno run -A jsr:@casys/mcp-view@0.7.0/scaffold result-viewer <target> [--force]
```

It emits a small vanilla project with an inline-HTML bundling script and no domain brand or remote
asset. The generated viewer uses `createMcpApp` with `onToolInput` and `onToolResult` supplied in
the initial configuration. The callback registration and buffering guarantee documented above are
therefore the mechanism that preserves the initiating tool result; the scaffold does not install a
late `app.ontoolresult` handler or invent a polling layer.

Its parser accepts a generic `structuredContent` object. `metrics` may be a record or a list of
named values, `artifacts` is an optional list of URI-bearing objects, and remaining scalar fields
become Details. Invalid payloads render an actionable error; an otherwise empty object renders an
empty state. It deliberately does not claim to validate any domain envelope.

The CLI refuses a non-empty target without `--force`, and `--force` overwrites only emitted files;
it never deletes unrelated files. This keeps the tool safe to use in an existing repository while
making replacement an explicit choice.
