# ADR 0001: Orchestration Authoring Boundary

Date: 2026-03-10
Status: Accepted

## Context

`mcp-compose` already has a clear low-level responsibility: consume explicit orchestration and MCP
tool UI metadata, then produce a deterministic composite UI.

The open question is whether orchestration authoring itself belongs inside this repository or in a
higher product layer.

## Options

### 1. Keep orchestration authoring in `mcp-compose`

Pros:

- fewer repos and layers
- one package for authoring plus execution

Cons:

- blurs the primitive/product boundary
- increases API instability risk
- makes docs and ownership less clear

Assessment:

- conceptual clarity: low
- API stability risk: high
- product confusion risk: high
- implementation cost: medium
- AX quality: weak

### 2. Add a friendlier agent-facing DSL in this repo

Pros:

- can improve ergonomics for agent authors
- keeps authoring close to execution semantics

Cons:

- still mixes primitive and product concerns
- pushes more policy into the library
- likely to create churn before the higher layer is understood

Assessment:

- conceptual clarity: medium
- API stability risk: medium-high
- product confusion risk: medium-high
- implementation cost: medium
- AX quality: mixed

### 3. Keep `mcp-compose` primitive-only and build authoring elsewhere

Pros:

- preserves a clean, deterministic core
- keeps product experimentation out of the low-level library
- aligns with `core / sdk / host` responsibilities
- reduces confusion about who authors orchestration today

Cons:

- requires a separate higher layer for authoring UX
- some ergonomics work may be duplicated temporarily upstream

Assessment:

- conceptual clarity: high
- API stability risk: low
- product confusion risk: low
- implementation cost: medium
- AX quality: strong

## Decision

Choose option 3.

`mcp-compose` stays primitive-only.
Intent-first, template-driven, or end-user-friendly orchestration authoring belongs in a higher
layer that compiles down to explicit `mcp-compose` inputs.

## Consequences

- `src/` remains the execution and composition pipeline
- `sdk/` remains an adaptation layer, not a product DSL
- docs must describe orchestration as explicit upstream input
- future ergonomics work should be justified without collapsing the boundary above

## Follow-Up

- keep `README.md`, `SPEC.md`, and `PRD.md` aligned on this boundary
- only add code-level authoring ergonomics here if they remain narrow and do not turn the package
  into a product layer
