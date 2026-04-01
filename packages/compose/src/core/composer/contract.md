# composer contract

## Role

Build a composite UI descriptor from collected resources and optional orchestration config.

## Inputs

- `CollectedUiResource[]` — slot-ordered resources from collector
- `UiOrchestration` (optional) — layout, sync rules, sharedContext keys

## Outputs

- `CompositeUiDescriptor` — final descriptor with children, resolved sync, layout, sharedContext

## Invariants

- Composer is tolerant: invalid sync rules resolve best-effort; validator is the strict gate.
- Default layout is `"stack"` when orchestration is absent.
- `sharedContext` is `undefined` when no keys match.

## Dependency constraints

- Imports from `../types/` (resources, descriptor, orchestration) and `../sync/` (resolver).
- No dependency on collector, renderer, sdk, or host.
