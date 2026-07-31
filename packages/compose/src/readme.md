# mcp-compose src layout

Layered architecture for MCP Apps UI composition.

## Layers

- `core/` — pure composition primitives (types, collector, sync, composer, renderer)
- `sdk/` — MCP SDK adapters (convenience wrappers for external SDK shapes)
- `host/` — pure host integration contracts, renderer, and static server
- `runtime/` — manifest/template execution, MCP connections, and the optional local interactive MCP
  Apps host

`src/` is the execution and composition pipeline only. It is not the product-facing authoring layer
for intent-first or end-user dashboard creation. `core/` is deterministic and I/O-free; the optional
runtime host has the separate responsibility of connecting live MCP servers and enforcing browser
slot grants.

## Tests

Unit tests stay co-located in each slice (`*_test.ts`). Cross-slice integration tests live at
`src/*_test.ts` because the whole `src/` layout is the integration boundary.

## Docs

Each layer and slice owns its local `readme.md` and `contract.md`. Those files are the local source
of truth for responsibilities and invariants.
