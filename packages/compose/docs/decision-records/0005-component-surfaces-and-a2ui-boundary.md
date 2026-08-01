# ADR 0005: Explicit Component Surfaces and A2UI Boundary

Date: 2026-08-01\
Status: Accepted, prototype implemented

## Context

Compose originally mounted complete standalone viewers in dashboard panels. An intermediate
experiment added prebuilt responsive variants with required/preferred facets. That still made the
viewer the indivisible unit: combining several elaborate pages produced poor dimensions and
duplicated chrome instead of a coherent dashboard.

## Decision

Each componentized MCP App advertises `io.casys.mcp.view-components/v1` during `ui/initialize`:

- a map of stable component keys to serializable descriptions;
- one standalone `defaultSurface`;
- no executable code or DOM contract.

A template may request `surface` for a source:

```yaml
sources:
  - id: thermal
    manifest: mcp-modelica
    surface:
      layout: { type: grid, columns: 2, gap: sm }
      components:
        - { id: status, component: modelica.execution-status }
        - { id: metrics, component: modelica.metrics }
    calls:
      - tool: modelica_simulate
```

Compose validates only the safe grammar, then sends the requested or default surface under
`io.casys.mcp.surface/v1`. A missing catalog yields `legacy`; unknown component keys yield
`unresolved`. Resolution never depends on dimensions or child DOM inspection.

`ui/compose/event` remains a separate, declared event plane. A component instance's stable `id`
supports future stateful patch operations and unambiguous event routing without changing the current
whole-surface contract.

## A2UI boundary

A2UI describes host-native widgets. This contract addresses a different boundary: composition of
domain components whose renderer and state remain inside an MCP App. Compose will not execute
agent-generated JavaScript or reimplement A2UI. A future adapter may translate a safe compatible
subset at the edge.

## Acceptance criteria

1. Network completion order never changes source slots.
2. The standalone surface and dashboard surface use the same component implementations.
3. Unknown component keys fail explicitly.
4. Repeated component instances have distinct stable IDs.
5. Event routes deliver the same payload independently of surface composition.
6. Legacy Apps continue to mount unchanged.
