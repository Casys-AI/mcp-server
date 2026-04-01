# collector

Collect UI-capable MCP tool results into stable slot-ordered resources.

## API

- `extractUiMeta(result)` — extract `_meta.ui` from a raw tool result, or `null`
- `createCollector()` — factory returning a `UiCollector` instance

## Pipeline position

First stage: raw tool results in, `CollectedUiResource[]` out.

## Design

The collector assigns monotonically increasing slot indices. Results without
`_meta.ui.resourceUri` are silently skipped (no slot consumed). The `clear()`
method resets both resources and the slot counter.
