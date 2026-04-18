# `@casys/mcp-view` — Specification

## Overview

`view/` is the **View-side SDK** (iframe runtime) for MCP Apps authors. It
replaces the anti-pattern of calling `app.sendMessage("show details for X")`
from a UI event handler — a flow that pollutes the chat thread and triggers
Claude's "the app is trying to speak for you" warning — with a pure intra-iframe
SPA model: click a row → fetch data via `ctx.callTool` → `ctx.navigate("detail")`
→ re-render, no roundtrip through the host chat.

The module is a thin opinionated wrapper around the `App` class from
`@modelcontextprotocol/ext-apps`. It owns three things and nothing else:
lifecycle bootstrap, memory-based view routing, and a capability-gated tool
call proxy.

## Public API

### `createMcpApp<S>(config: AppConfig<S>): Promise<AppHandle<S>>`

Bootstraps the App: instantiates `ext-apps`' `App`, performs the `ui/initialize`
handshake (via `App.connect()`), then mounts `initialView`.

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

### `AppContext<S>` (passed to every view hook)

- `navigate(name, args?)` — switch view, internal only, no MCP traffic.
- `callTool(name, args?)` — proxy to `App.callServerTool`. Throws if the host
  did not advertise `serverTools` capability, or if the underlying transport
  errors. Tool-level errors (`isError: true`) are returned, not thrown — the
  view decides.
- `capabilities` — frozen snapshot of `McpUiHostCapabilities` from the handshake.
- `state` — mutable ref to user state `S` (shared across views).
- `app` — the underlying `App` instance, escape hatch for advanced use.

## Lifecycle

```
createMcpApp(config)
  └─ new App(info, capabilities)
  └─ app.connect(PostMessageTransport)        ← ui/initialize
  └─ snapshot hostCapabilities
  └─ router.goto(initialView, undefined)
       └─ onEnter(ctx, args) → data
       └─ render(ctx, data) → string|Node
       └─ mount into config.root

ctx.navigate("detail", { id })
  └─ current.onLeave?(ctx)
  └─ target.onEnter(ctx, { id }) → data
  └─ target.render(ctx, data)
  └─ replace DOM content of config.root
```

Re-render on same view: `navigate(currentView, newArgs)` is allowed and
re-runs `onEnter → render`. No implicit state diffing.

## Error contract

- `createMcpApp` throws if `connect()` fails (host unreachable, handshake
  rejected, transport gone). Caller wraps in try/catch; no Result type.
- `ctx.callTool` throws when:
  1. `capabilities.serverTools` is absent (pre-flight check),
  2. `App.callServerTool` rejects (timeout, transport loss, host refusal).
- `ctx.navigate(name)` throws synchronously if `name` is not a registered view.
- User errors inside `onEnter`/`render` propagate up. The router does NOT
  catch them — view author handles or crashes visibly. Rationale: silent
  error handlers in a routing layer always mask bugs.

## Bundling rules

- **No `import.meta.url`.** Must tree-shake and bundle cleanly through esbuild
  in IIFE mode with no external hints.
- **No Node built-ins at module top-level.** `@modelcontextprotocol/ext-apps`
  is imported but must resolve to a browser-compatible entry (its
  `PostMessageTransport` is pure DOM). If an `ext-apps` subpath drags
  `node:crypto` etc, the bundler config in examples will alias; we do not
  reach into `ext-apps` internals.
- **Deno + Node compat.** Types reference only `@modelcontextprotocol/ext-apps`
  types and DOM lib. No `Deno.*`, no `process.*`, no `Buffer`.
- **ESM-only.** Output of consumers is `<script type="module">` or IIFE bundle;
  we don't ship CJS.
- Published as dedicated workspace member `@casys/mcp-view`
  (`packages/view/`). See `packages/compose/docs/decision-records/0002`
  addendum for the rationale of the split.

## Non-goals (MVP)

Explicitly **out of scope** for v0.1.0; may ship later:

- `sendMessage`, `updateModelContext`, `requestDisplayMode`, `openLink`,
  `downloadFile` wrappers — authors call `ctx.app.<method>` directly.
- URL-based routing / history API integration.
- State persistence across teardown.
- React / Vue / Svelte bindings (future: `@casys/mcp-view-react`, etc.).
- Data-loader caching, suspense, optimistic updates.
- Route guards, nested views, layout components.
- Automatic `ontoolresult` → view refresh wiring. Authors opt in via
  `ctx.app.addEventListener`.

The type surface is designed so each of the above can be added without
breaking existing `AppConfig` / `ViewDefinition` / `AppContext` shapes
(all extension points are optional fields).
