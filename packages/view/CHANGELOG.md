# Changelog

All notable changes to `@casys/mcp-view` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
