# core

Pure composition primitives for MCP Apps UI orchestration.

## Slices

- `types/` — shared type definitions and error codes
- `collector/` — extract and collect UI resources from tool results
- `sync/` — validate and resolve sync rules
- `composer/` — build composite descriptors from collected resources
- `renderer/` — render descriptors into self-contained HTML

## Design

All modules are pure functions with zero I/O. No network, no filesystem,
no side effects. This makes them safe to use in any runtime context.

## Tests

Unit tests are co-located with each slice (`*_test.ts`).
Cross-slice integration tests live at `src/*_test.ts`.
