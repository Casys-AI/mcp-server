# sync contract

## Role

Resolve symbolic sync rules to slot-indexed rules and validate rule configurations.

## Inputs

- `UiSyncRule[]` — symbolic rules referencing tool names
- `CollectedUiResource[]` — for slot resolution
- `string[]` (known sources) — for validation

## Outputs

- `ResolutionResult` — resolved rules + orphan diagnostics
- `ValidationResult` — structured issues with `ErrorCode`

## Invariants

- Validation is explicit and machine-readable via `ErrorCode`.
- Resolution never throws — orphans are reported, not fatal.
- Broadcast `to: "*"` is not treated as circular.

## Dependency constraints

- Imports only from `../types/` (sync-rules, resources, errors).
- No dependency on collector, composer, renderer, sdk, or host.
