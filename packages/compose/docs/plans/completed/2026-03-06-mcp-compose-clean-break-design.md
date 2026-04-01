# MCP Compose clean break design

Date: 2026-03-06
Status: Completed

> **Note (2026-03-19):** This refactor is complete. The renderer has since moved
> from `core/renderer/` to `host/renderer/` (see commit 075b185). The rest of the
> decisions remain in effect.

## Context

`lib/mcp-compose` has been partially refactored toward a clearer `core / sdk / host` architecture, but the repository still contains legacy duplicate paths (`src/types/*`, `src/collector/*`, `src/sync/*`, `src/composer/*`, `src/renderer/*`) alongside the new structure. That creates ambiguity about the source of truth and makes the package harder to navigate.

In parallel, `lib/server` currently declares MCP Apps UI metadata such as `resourceUri`, `visibility`, `emits`, and `accepts`. Those event-related fields are presently defined locally as free-form strings, while the composition semantics belong conceptually to `mcp-compose`, not the server package.

The goal is to finish the refactor cleanly, with no backward-compatibility burden, and establish a single source of truth for sync event contracts.

## Decisions

### 1. Clean break: no backward compatibility

This package has not been used externally yet, so the refactor will be a clean break.

Implications:
- Remove legacy duplicate modules rather than keeping shims.
- Prefer a single canonical path for every concept.
- Optimize for clarity over compatibility.

### 2. Canonical package structure

`lib/mcp-compose/src` will be organized around exactly three top-level areas:

- `src/core/*` — composition semantics and pure building blocks
- `src/sdk/*` — adapters for external MCP SDK result shapes
- `src/host/*` — host/runtime contracts for embedding composite UIs

Within `src/core/*`, the canonical substructure is:
- `src/core/types/*`
- `src/core/collector/*`
- `src/core/sync/*`
- `src/core/composer/*`
- `src/core/renderer/*`

### 3. What belongs in each layer

#### `core`
Owns the meaning of composition:
- types
- sync event vocabulary / contracts
- sync rule validation and resolution
- collected resource shapes
- composition descriptor building
- renderer and event-bus generation

`core` is the source of truth for the composition model.

#### `sdk`
Owns adaptation only:
- accepts MCP SDK-specific result shapes
- normalizes them into `core` collector inputs
- does not own composition semantics

#### `host`
Owns host integration only:
- contracts/interfaces for embedding composite UIs
- host-specific runtime expectations
- no orchestration semantics
- no sync business logic

### 4. Event ownership and dependency direction

The server package should remain a server package. It may declare that a tool/UI emits or accepts certain events, but it should not own the composition contract itself.

Therefore:
- `mcp-compose/core` becomes the single source of truth for sync event types/constants/contracts.
- `lib/server` imports those types from `mcp-compose/core` when declaring `_meta.ui.emits` and `_meta.ui.accepts`.
- `lib/server` remains focused on MCP server concerns.
- `mcp-compose` adds the orchestration layer on top.

This gives the correct separation:
- server announces capabilities
- mcp-compose understands and orchestrates them

### 5. Dependency rule for `lib/server`

`lib/server` should depend only on the minimal composition contract it needs.

Preferred rule:
- `lib/server` imports from `mcp-compose/core` only
- no dependency from `server` to host runtime or renderer internals beyond the core contract boundary

This keeps the dependency lightweight and reduces the chance of contaminating consumers such as ERP MCP Next with unnecessary runtime coupling.

### 6. ERP MCP Next caveat

ERP MCP Next is currently closer to a self-contained package. If it consumes `lib/server` and that server package imports event contract types from `mcp-compose/core`, the dependency chain must remain light.

Decision:
- accept the `server -> mcp-compose/core` dependency for now
- verify that the dependency remains light and type-oriented
- do **not** prematurely extract another shared package
- only extract a separate `ui-contract` / `mcp-ui-types` package later if real friction appears

This avoids speculative architecture.

## Repository cleanup plan

### Keep
- `src/core/types/*`
- `src/core/collector/*`
- `src/core/sync/*`
- `src/core/composer/*`
- `src/core/renderer/*`
- `src/sdk/*`
- `src/host/*`

### Remove
- `src/types/*`
- `src/collector/*`
- `src/sync/*`
- `src/composer/*`
- `src/renderer/*`
- any remaining compatibility shims whose only purpose is legacy indirection
- ambiguous exports that point to multiple physical implementations

### Normalize
- colocate tests with their modules
- add `readme.md` for each major directory
- add `contract.md` for each major directory
- ensure `mod.ts` exists at each level where public re-exports are intended
- reduce the root public API to a clear, deliberate surface

## Public API intent

The public API should reflect the architecture rather than leak the previous file layout.

Desired export shape:
- root `mod.ts` offers clean public re-exports
- `src/core/mod.ts` re-exports composition primitives
- `src/sdk/mod.ts` re-exports SDK adapters
- `src/host/mod.ts` re-exports host contracts

No parallel export trees should remain.

## Testing strategy

Tests should be colocated and aligned to the new architecture:
- unit tests next to collector/composer/sync/renderer modules
- integration tests at the nearest reasonable level inside `src`
- no tests depending on removed legacy paths

Success criteria:
- tests pass
- no duplicate implementation trees remain
- repository structure is obvious from a single glance at `src/`
- event contract ownership is unambiguous

## Implementation notes

The renderer event bus remains part of `core` for now because it carries composition semantics, not merely host transport glue.

`host` stays intentionally thin.

The refactor should avoid inventing new abstraction layers unless needed to satisfy the dependency rule above.

## Out of scope

- introducing backward-compatibility shims
- extracting a new shared package preemptively
- redesigning ERP MCP Next architecture now
- changing package semantics beyond what is needed to complete the clean-break refactor
