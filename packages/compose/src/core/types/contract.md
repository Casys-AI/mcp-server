# types contract

## Role

Define the shared vocabulary for the entire composition pipeline.

## Inputs

- None (leaf module — only defines shapes, no runtime inputs)

## Outputs

- Type definitions consumed by collector, sync, composer, renderer, sdk, and host

## Invariants

- Types stay transport-agnostic and reusable across slices.
- Error codes are stable identifiers consumed by validators and tests.
- No slice-specific business logic lives here.

## Dependency constraints

- Zero imports from other core slices (types is the dependency root).
- May import only from Deno stdlib or other types files within this folder.
