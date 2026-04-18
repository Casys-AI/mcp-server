# ADR 0002: Compose Positioning vs `@modelcontextprotocol/ext-apps`

Date: 2026-04-18  Status: Accepted

## Context

In April 2026 the MCP working group published `@modelcontextprotocol/ext-apps`
as an official npm package. It ships:

- Types + Zod schemas for the full MCP Apps spec (`McpUiToolMeta`,
  `McpUiResourceMeta`, `McpUiHostContext`, display modes, etc.).
- An `App` class (View-side postMessage wrapper).
- An `AppBridge` class (host-side, designed for 1-iframe-per-client).
- `./server` helpers (`registerAppTool`, `registerAppResource`).
- A React adapter.
- Agent Skills for scaffolding via Claude Code plugins.

This overlaps significantly with what `@casys/mcp-compose` was doing when
it was written (before the official lib existed): its own `ui/compose/event`
event bus, its own types, its own postMessage handling.

The question: should compose depend on ext-apps now that it exists, and if so,
how much?

## Options

### 1. Rewrite compose on top of `AppBridge`

Replace the inline event bus with `AppBridge` from ext-apps.

**Rejected.** `AppBridge` assumes one MCP App per host (1 iframe ↔ 1 MCP
client). Compose embeds **multiple** Apps in a composite dashboard and
routes events between them via `ui/compose/event` (a spec extension). Using
`AppBridge` would force a rewrite that loses the View↔View routing.

### 2. Full shape-compat, zero dependency

Keep rewriting the types and protocol constants locally, even when ext-apps
now provides them.

**Rejected.** Sustains duplication forever; silent drift from the spec
becomes inevitable as ext-apps evolves.

### 3. Types-only dependency (chosen)

Depend on `@modelcontextprotocol/ext-apps` for types, schemas, and protocol
constants. Do **not** depend on `App`/`AppBridge` runtime classes.

## Decision

Compose is a **value-add layer on top of** the official spec, not a
replacement.

Concretely:

- `core/types/mcp-apps.ts` re-exports types from ext-apps. `McpUiCsp` /
  `McpUiPermissions` kept as `@deprecated` aliases for backwards compat.
- `LATEST_PROTOCOL_VERSION` from ext-apps drives compose's advertised
  `protocolVersion` (re-exported as `MCP_APPS_PROTOCOL_VERSION`).
- `view/` SDK (v0.5.0) wraps the `App` class — this is the one place the
  ext-apps runtime class fits, because View-side is genuinely 1-iframe-per-app.
- Host-side (the event bus in `host/renderer/js/event-bus.ts`) stays
  compose-native because `AppBridge` does not support multi-iframe routing.

## Consequences

Positive:
- Type drift eliminated. Spec bumps propagate via `deno.lock`.
- Deno-first preserved: types + constants are pure TS, no runtime Node deps.
- The compose-specific value add (`ui/compose/event`, sync rules, dashboard
  composition) remains the visible raison d'être.

Negative:
- Dependency on a pre-1.0 ext-apps package (1.6.0 as of this ADR). Breaking
  changes upstream may cascade. Mitigation: restrict consumption to types +
  method-name constants (less volatile than class APIs).

Follow-up decision: compose will **not** contribute `ui/compose/event` back
to the spec unless the MCP working group signals interest in multi-iframe
routing. Until then it remains a compose extension.

## References

- Spec: `packages/compose/src/view/spec.md`
- Bump commit: f670dd8 (v0.4.1 — consume @modelcontextprotocol/ext-apps types)
