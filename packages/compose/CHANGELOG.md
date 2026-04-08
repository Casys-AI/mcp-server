# Changelog

All notable changes to `@casys/mcp-compose` will be documented in this file.

## [Unreleased]

## [0.4.0] - 2026-04-08

Cleanup release: removes dead code, fixes version drift, and tightens the MCP Apps host role compose
plays for embedded apps (stops advertising capabilities it doesn't implement, drops a legacy sync
path that was bending the spec). No new features.

### Removed

- **Dead code: `src/core/renderer/`** — the renderer was moved from `core/` to `host/` in an earlier
  refactor (the renderer generates HTML, which violates `core/`'s "no I/O" rule), but the old
  `core/renderer/` directory was left behind orphaned. The two `html-generator.ts` files had
  diverged and the two `renderer_test.ts` files were mirrored duplicates. Removed the core side
  entirely (contract.md, readme.md, mod.ts, html-generator.ts, renderer_test.ts, css/, js/). Zero
  loss of coverage — the 20 tests in the removed file were symmetric duplicates of the host side.

- **`hostContext.sharedContext` field in `ui/initialize` response** — write-only data. Verified by
  grep that nothing in the compose codebase (stubs, SDK, runtime event bus) reads
  `hostContext.sharedContext`; consumers extract `sharedContext` from the `ui/compose/event` message
  params instead. Also fixes a spec drift issue (`McpUiHostContext` in the official ext-apps spec
  doesn't define `sharedContext`, and injecting compose-specific data into an otherwise-standard
  shape could break embedded apps that use strict validators).

- **Legacy `ui/update-model-context` sync routing** — the handler was originally written before
  `ui/compose/event` existed, and it bent the spec by using `ui/update-model-context` (whose
  documented intent is "inject content into the LLM's context for the next turn") as a broadcast
  channel for cross-UI sync. The `composeEvents()` SDK from `@casys/mcp-compose/sdk` has been the
  documented migration path for a while. This release removes the legacy handler, the
  `sendToolResult` helper it depended on, and the `ui/notifications/tool-result` forwarding logic.
  Cross-UI sync now routes exclusively through `ui/compose/event`.

- **`hostCapabilities.openLinks`** — was advertised but no handler existed for `ui/open-link`
  requests. Embedded apps calling `app.openLink(url)` would have hung or errored silently. Removed
  from the advertised capabilities until a real handler is added.

- **`hostCapabilities.updateModelContext`** — same cleanup as above: advertised but the handler was
  routing the method as a sync broadcast rather than injecting into LLM context. Not its documented
  purpose.

### Fixed

- **`hostInfo.version` was hardcoded to `'0.1.0'`** in the `ui/initialize` response for the last two
  minor versions (package had been at 0.3.0 for a while). Embedded apps were being told they're
  talking to compose 0.1.0 regardless of the actual package version. Now reads from a new
  `COMPOSE_VERSION` constant in `src/version.ts`, kept in sync with `deno.json` by a drift test
  (`src/version_test.ts`) that fails CI if the two files disagree.

- **`scripts/build-npm.ts` hardcoded `version: "0.3.0"`** in the dnt build config — matched
  `deno.json` today but was guaranteed to drift on the next bump. Now reads from `deno.json` via
  `JSON.parse(
  readTextFile(...))` at build time and fails fast if the version is missing. Mirrors
  the same fix from `@casys/mcp-server`'s `scripts/build-node.sh` landed in server v0.14.0.

### Breaking changes

Two behaviors changed that may affect consumers on 0.3.x:

1. **`ui/update-model-context` no longer routes sync events.** Consumers who were using raw
   `ui/update-model-context` postMessage calls as a cross-UI broadcast channel (an undocumented
   bending of the spec) will now hit the event bus's "Unknown method" warning. **Migration:** use
   `composeEvents().emit(event, data)` from `@casys/mcp-compose/sdk` instead. Consumers who were
   already using `composeEvents()` are unaffected.

2. **`hostCapabilities.openLinks` and `updateModelContext` are no longer advertised on
   `ui/initialize`.** Consumers who were checking these capabilities via `hostCapabilities`
   introspection will see them absent. This is a correctness fix — neither was actually implemented,
   so any consumer relying on them was already broken in practice.
