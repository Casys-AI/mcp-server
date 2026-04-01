# collector contract

## Role

Extract UI metadata from raw MCP tool results and build a slot-ordered resource list.

## Inputs

- Raw tool result payload (any shape — defensive extraction)
- Source tool name (`string`)
- Optional context (`Record<string, unknown>`)

## Outputs

- `CollectedUiResource | null` per call
- `CollectedUiResource[]` via `getResources()`

## Invariants

- Slot numbering is stable and append-only per collector instance.
- Results without `_meta.ui.resourceUri` return `null` and consume no slot.
- `getResources()` returns a defensive copy.

## Dependency constraints

- Imports only from `../types/` (resources, mcp-apps).
- No dependency on sync, composer, renderer, sdk, or host.
