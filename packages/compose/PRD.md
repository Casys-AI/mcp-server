# mcp-compose PRD

## Problem

MCP tools can already expose isolated UIs through `_meta.ui.resourceUri`, but hosts and agents need
a small, deterministic primitive for combining those UIs into one coordinated surface with explicit
layout and event routing.

## Target Users

- developers embedding multiple MCP App UIs in one host
- integrators wiring cross-tool UI flows
- agents generating explicit orchestration from higher-level intent
- host implementers that need a stable composition primitive

## Non-Users

- end users expecting a no-code dashboard builder
- users expecting natural-language authoring directly inside this library
- teams looking for a gateway, workflow engine, or orchestration platform

## Current Product Truth (v1)

- `mcp-compose` is dev-first and agent-first
- orchestration is explicit and authored upstream in code or generated artifacts
- the library consumes tool results plus orchestration and produces a composite UI
- `core` owns composition semantics
- `sdk` provides optional convenience helpers
- `host` defines pure embedding and renderer contracts
- `runtime` can explicitly create a loopback MCP Apps host for a composed dashboard, with a per-slot
  source/resource/tool allowlist

## Target UX (Later)

A future product layer may offer friendlier authoring:

- intent-first dashboard generation
- templates or presets
- guided orchestration authoring
- end-user-facing UX

That higher layer should compile down to explicit `mcp-compose` inputs rather than push product
ambiguity into this library.

## What Users Should Never Have To Hand-Author

- host-side `postMessage` plumbing
- iframe wiring and slot index resolution
- JSON-RPC event-bus details
- repetitive HTML shell code for composed dashboards

## What Remains Explicit In v1

- collected UI resources
- layout choice
- sync rules
- shared context extraction keys
- any upstream logic that decides which tools belong in one dashboard

## Boundary With Future Host/Product Layer

`mcp-compose` owns the deterministic composition primitive:

- validation and resolution of sync rules
- descriptor construction
- rendered composite HTML
- host-facing contracts for embedding
- the narrow local lifecycle needed to render an explicit MCP Apps dashboard

Upstream product or agent layers own:

- intent capture
- authoring UX
- heuristic inference
- templates, presets, and product-specific workflow semantics

## Success Criteria

- the repo exposes one obvious architecture: `core / sdk / host / runtime`
- composition semantics have a single source of truth
- docs do not imply end users hand-author orchestration in this library
- hosts and agents can compose dashboards without writing low-level transport glue
- an interactive panel cannot turn its local host into an arbitrary MCP proxy
- server-side packages depend only on the narrow shared contract they need

## Non-Goals

- building a no-code dashboard product here
- inferring orchestration from natural language inside `src/`
- becoming a general-purpose MCP client, gateway, or auth layer
- owning long-term workflow state or persistence

See `docs/decision-records/0001-orchestration-authoring-boundary.md` for the authoring-boundary
decision.
