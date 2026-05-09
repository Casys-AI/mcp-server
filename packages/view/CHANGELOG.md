# Changelog

All notable changes to `@casys/mcp-view` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-05-09

Wraps the four interesting additions of `@modelcontextprotocol/ext-apps` 1.7.0 as first-class
`@casys/mcp-view` API. All changes are strictly additive — existing 0.2.x code keeps working
unchanged. Bump is minor to surface the new public surface.

### Added

- **`ctx.sample(args): Promise<SampleResult>`** — wraps `App.createSamplingMessage`. Lets a View ask
  the host to run an LLM inference on its behalf (auto-titles, summaries, suggestions, …) without
  round-tripping through a server-side tool. Capability-gated on `host.capabilities.sampling`;
  throws `MCPViewError("MISSING_SAMPLING_CAPABILITY")` otherwise. `SampleArgs` is a discriminated
  union: `{ prompt }` (sugar — single user message) | `{ messages }` (explicit multi-turn). Common
  fields: `systemPrompt`, `maxTokens` (default `1024`), `temperature`, `modelPreferences`,
  `stopSequences`, `metadata`. Result exposes `text` (concatenation of every `type: "text"` block in
  the response — empty for multimodal/tool-use), `stopReason`, `model`, and `raw` (the full ext-apps
  response for callers that need fidelity).

- **`defineView({ tools })` + `ctx.tools`** — wraps `App.registerTool` and
  `App.sendToolListChanged`. Lets a View expose tools that the host (and its agent) can discover and
  call, inverting the usual MCP flow. Two layers:

  1. **Declarative on `defineView({ tools })`** — tools are auto-registered after `onEnter` and
     removed before the next view's `onEnter`. Each transition emits a single batched
     `tools/list_changed` notification (one for the unregister, one after the new view's register).
  2. **Imperative on `ctx.tools`** — `enable(name)`, `disable(name)`,
     `update(name, { title?, description?, annotations? })`, `remove(name)`. Use this for runtime
     availability ("save when dirty"); flipping `enabled` is cheaper than recreating the view.

  Schema surface is `StandardSchemaV1` (Zod v4, Valibot, ArkType). `update` deliberately does not
  accept schema changes — swap by removing and re-registering on the next view.

  `createMcpApp` auto-advertises `tools.listChanged: true` on the App capabilities when at least one
  view declares tools, merging with any user-supplied capabilities. Without this, ext-apps refuses
  `registerTool` calls.

- **`AppConfig.strict?: boolean`** — forwarded to ext-apps `AppOptions.strict`. Throws on detected
  misuse (host-bound methods called before `connect()`, one-shot handlers registered after
  `connect()`) instead of `console.warn`. Default: `false`. Recommended `true` in dev.

- **`AppConfig.allowUnsafeEval?: boolean`** — forwarded to ext-apps `AppOptions.allowUnsafeEval`.
  Default: `false` (strict CSP via `z.config({ jitless: true })`). Set `true` only when the host's
  CSP permits `unsafe-eval` and the JIT path is required.

- **`AppConfig.autoResize?: boolean`** — forwarded to ext-apps `AppOptions.autoResize`. Toggles the
  `ResizeObserver` that reports iframe size changes. Ext-apps default is `true`; set `false` for
  fixed-aspect-ratio embeds.

  Each option is forwarded to ext-apps only when the user supplies it, so the ext-apps defaults
  remain authoritative for anything unspecified — guards against an ext-apps default flip turning
  into a silent regression here.

### Added (errors)

- `MCPViewError` taxonomy gains three codes: `MISSING_SAMPLING_CAPABILITY`, `INVALID_SAMPLE_ARGS`,
  `UNKNOWN_TOOL`. All follow the existing closed-taxonomy contract (stable `.code`, structured
  `.data`).

### Tests

- 21 new tests across `sample_test.ts` (8) and `tools_test.ts` (12) plus one compile-time smoke test
  for the new `AppConfig` options. Total now 51 (up from 30).

## [0.2.1] - 2026-05-09

Maintenance release: align with upstream `@modelcontextprotocol/ext-apps` 1.7.x.

### Changed

- **Bump `@modelcontextprotocol/ext-apps` `^1.6.0` → `^1.7.1`.** Picks up `App.registerTool()` /
  `sendToolListChanged()` (View-side WebMCP-style tool exposure), `App.createSamplingMessage()`
  (sampling support via stock SDK types), and handshake-ordering guards (warn-or-throw via
  `AppOptions.strict`).

- **Default behaviour change inherited from ext-apps 1.7.0: `allowUnsafeEval: false`.** The ext-apps
  `App` constructor now sets `z.config({ jitless: true })` by default so Views run under strict CSP
  without `unsafe-eval`. `@casys/mcp-view` wraps the runtime `App` class, so this default propagates
  to consumers. Authors who need the JIT path (e.g. for hot loops using libraries that compile
  expressions at runtime) can pass `{ allowUnsafeEval: true }` through to `App` — but the
  recommended posture is to keep the default and let strict CSP catch unsafe code paths.

### Notes

- Transitive: `zod` `4.3.6` → `4.4.3` in `deno.lock`. Single zod family preserved.

## [0.2.0] - 2026-04-18

AX (Agent Experience) compliance pass — three violations fixed against the 8 AX principles.

### Added

- **AX #3 — Machine-readable errors.** New `MCPViewError` class (`src/errors.ts`) with a stable
  `.code` from a closed taxonomy: `INVALID_CONFIG_ROOT`, `INVALID_CONFIG_VIEWS`,
  `INVALID_CONFIG_INITIAL_VIEW`, `ORPHAN_INITIAL_VIEW`, `MISSING_RENDER`,
  `MISSING_SERVER_TOOLS_CAPABILITY`, `HANDSHAKE_NO_CAPABILITIES`, `NO_PARENT_WINDOW`,
  `UNKNOWN_VIEW`, `ROUTER_NOT_INITIALIZED`. `.data` carries structured context (e.g.
  `{ initialView, registered }`) agents can parse without scraping the message.

- **AX #4 — Explicit over implicit.** `AppConfig` gains `autoTheme?: boolean` (default `true`).
  Previously the theme/CSS/font auto-apply was silent and opt-out required bypassing `createMcpApp`
  entirely. The default is now visible in the signature and documented. `ctx.hostContext` stays live
  either way — only the side-effects (`applyDocumentTheme`, `applyHostStyleVariables`,
  `applyHostFonts`) are gated by the flag.

- **AX #8 — Test-first invariants.** 10 new tests (5 in `errors_test.ts` covering the `MCPViewError`
  surface — `.code`, `.data` frozen, `instanceof Error`, factory; 5 in `app_test.ts` asserting each
  error path produces the expected `.code`).

### Removed

- **Breaking — `MissingServerToolsCapabilityError` class.** Replaced by `MCPViewError` with
  `code: "MISSING_SERVER_TOOLS_CAPABILITY"`. 0.1.x was too fresh for external consumers, so the
  break is judged acceptable.

## [0.1.1] - 2026-04-18

### Added

- **Auto-apply host theme + CSS variables + fonts** after the `ui/initialize` handshake. Strictly
  additive — no new public surface, only an automatic side-effect inside `createMcpApp`:
  1. Snapshot `app.getHostContext()` (theme, styles, locale, timezone, displayMode, toolInfo, …).
  2. Apply via ext-apps helpers: `applyDocumentTheme(ctx.theme)`,
     `applyHostStyleVariables(ctx.styles.variables)`, `applyHostFonts(ctx.styles.css.fonts)`.
  3. Listen for `ui/notifications/host-context-changed` via `addEventListener` (not
     `onhostcontextchanged`, so user handlers on `ctx.app.onhostcontextchanged` are preserved) and
     re-apply partial updates.
  4. Unwire the listener on `dispose()` so the `App` instance can be safely reused.

  Quick win identified in ADR 0002 §1.

- **`AppContext.hostContext: McpUiHostContext` getter** — live reference that updates on
  host-context-changed. Handy for reading non-styling fields like `locale`, `timezone`,
  `displayMode` without going through `ctx.app`.

### Fixed

- **Add `LICENSE` file and `license` field to `deno.json`** so JSR publish stops complaining.

## [0.1.0] - 2026-04-18

Initial release as a dedicated workspace package, split out of `@casys/mcp-compose/view` (compose
0.5.0).

### Why split

The View-side SDK initially shipped inside `@casys/mcp-compose` did not pass JSR publish: JSR
rejected the `/// <reference lib="dom" />` directives the sources used to make `HTMLElement` /
`Node` resolve. Two alternatives were considered and rejected:

- Adding `lib: ["dom"]` to compose/deno.json — gives `host/`, `runtime/`, `deploy/` modules access
  to DOM globals, inviting `document.getElementById` bugs that crash under Deno Deploy.
- Local DOM-type shims under `view/` — signals "misfiled code".

Chosen: promote `view/` to a dedicated workspace member. Package topology now mirrors runtime
reality — 3 server packages + 1 browser package:

```
@casys/mcp-server   (server)
@casys/mcp-compose  (server, multi-iframe host + composition)
@casys/mcp-view     (browser, single-iframe SPA SDK)  ← this package
@casys/mcp-bridge   (server)
```

### Public API (frozen surface inherited from compose 0.5.0)

- `createMcpApp({ info, root, views, initialView, … })` — bootstrap + `ui/initialize` handshake via
  the ext-apps `App` class.
- `defineView({ onEnter?, render, onLeave? })` — view lifecycle contract.
- `AppContext { navigate, callTool, capabilities, state, app }` — passed to every hook. `callTool`
  is capability-gated on `host.serverTools`.
- `AppHandle { ctx, currentView, navigate, dispose }`.

### Guarantees

- Memory-only routing (no URL / history API — iframes have no address bar).
- Router serialises concurrent `goto()` via promise queue (prevents `onLeave`/`onEnter` interleaving
  on double-clicks).
- `_currentView` invalidated between `onLeave` and `onEnter` so a throwing `onEnter` cannot corrupt
  router state.
- `dispose()` drains the navigation queue before closing transport.
- Errors propagate: the router never swallows user-code exceptions.
