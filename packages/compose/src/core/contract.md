# core contract

## Inputs

- MCP tool results exposing `_meta.ui.resourceUri`
- Optional orchestration config (`layout`, `sync`, `sharedContext`)

## Outputs

- Deterministic composite UI descriptors
- Deterministic rendered HTML for MCP Apps hosts
- Explicit validation issues for invalid sync configurations

## Invariants

- Pipeline order: `collector -> sync/composer -> renderer`.
- All functions are pure — no I/O, no side effects.
- Slice docs and tests are co-located with the slice they describe.
- Rendering is deterministic for the same descriptor input.
