# sdk contract

## Inputs

- MCP SDK `CallToolResult` objects (structural typing)
- `UiMetaOptions` for `uiMeta()` builder
- Tool definitions with `_meta.ui` + `UiSyncRule[]` for `validateComposition()`
- `ComposeTarget` + `ComposeSource` for `composeEvents()` (defaults to `window.parent` / `window`)

## Outputs

- `CollectedUiResource[]` via core collector delegation
- `UiMetaResult` (`{ _meta: { ui } }`) from `uiMeta()`
- `CompositionValidationResult` from `validateComposition()`
- `ComposeEvents` (`{ emit, on, destroy }`) from `composeEvents()`

## Invariants

- SDK adapters only normalize external result shapes.
- SDK adapters must not own composition or rendering logic.
- `validateComposition()` delegates structural checks to core `validateSyncRules`.
- Semantic checks (emits/accepts) only fire when tools declare them.
- Depends only on core — no circular deps to host or other layers.
- `composeEvents()` uses `ui/compose/event` method exclusively — never sends or listens on MCP Apps protocol methods.
- `composeEvents()` is browser-only; uses no Deno or Node APIs.
