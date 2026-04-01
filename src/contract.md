# src contract

## Inputs

- MCP tool results exposing `_meta.ui.resourceUri`
- Optional orchestration config (`layout`, `sync`, `sharedContext`)
- Layer-level contracts from `src/{core,sdk,host}/contract.md`

## Outputs

- Deterministic composite UI descriptors
- Deterministic rendered HTML for MCP Apps hosts
- Explicit validation issues for invalid sync configurations
- Host integration types for embedding

## Invariants

- Pipeline order is `collector -> sync/composer -> renderer`.
- Layer dependency: `host` -> `core` <- `sdk`. No circular deps.
- `src/` consumes explicit orchestration; it does not infer product intent from natural language.
- Product-facing intent interpretation belongs upstream from `src/`.
- Slice docs and tests are co-located with the slice they describe.
- Cross-slice tests stay at `src/` because they validate the full pipeline.
- Rendering stays pure for the same descriptor input.
