# ADR 0004: Componentized MCP App Authoring Framework

Date: 2026-08-01\
Status: Accepted, implementation in progress

## Context

Casys owns viewers for simulation, CAD, finite-element analysis, SysML, and ERP. They duplicate
protocol lifecycle plumbing, but their useful visual grammar is domain-specific. The earlier
responsive-mode experiment made each viewer choose between several prebuilt whole-page variants; it
did not make the actual UI blocks reusable when several Apps shared one dashboard.

## Decision

`@casys/mcp-view` is the preferred componentized MCP App authoring framework. A domain viewer
publishes a catalog of small meaningful components and may publish a standalone default surface. A
Compose host may request a safe surface made only from those advertised components. Product-only
palettes may omit the default instead of inventing a standalone page.

| Layer                | Owns                                                                                                           | Must not own                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `@casys/mcp-view`    | Apps lifecycle, structured results, component registry/mounting, safe primitives, cleanup, viewer event client | MCP transport, dashboard shell, domain schema               |
| Domain viewer        | validation, component implementations, optional standalone default, local state/actions                        | copied handshake plumbing, host layout policy               |
| `@casys/mcp-compose` | multi-App shell, explicit surface requests, stable instance IDs, event routes                                  | child DOM inspection, domain rendering, implicit size modes |

The wire value is JSON-only: component key, instance ID, `stack|row|grid` layout, bounded columns,
gap token, optional safe grid area, and component-owned props. It contains no HTML, JavaScript,
selectors, or arbitrary CSS. Unknown component keys resolve explicitly as `unresolved`.

When supplied, the App's `defaultSurface` is its standalone UI. There is no parallel standalone
implementation and no semantic size taxonomy. Standard MCP Apps display modes (`inline`,
`fullscreen`, `pip`) and container dimensions continue to describe the host environment, not which
evidence must exist. Without a default, a missing host selection is an explicit `surface-required`
state.

The shared theme and framework-neutral primitive classes use the compact component language first
proven by the ERPNext BOM palette: restrained cards, dense metrics and tables, semantic badges,
cross-selection state, and container queries. Domain viewers may add specialized CAD, diagram, and
evidence styling without redefining the shared shell.

## Events and state

Composition changes presentation only. `ui/compose/event` remains the separately declared
viewer-to-viewer plane. Local navigation, component state, tools, and domain actions remain owned by
the child App. A surface remount must clean up component listeners and renderer resources
deterministically.

## Adoption

Modelica, Build123d, CalculiX, and SysON are reference consumers. Together they prove metrics,
tables, artifacts, Three.js, Preact, diagrams, and solver evidence. The public ERPNext MCP remains a
compatibility baseline; a separate product-specific, read-only ERPNext component palette proves the
component-only Preact path without changing that public server.

## Conformance

Each migrated viewer must prove:

- handlers registered before `connect()` and initiating results preserved;
- ordinary-host fallback to the same default component surface, or an explicit `surface-required`
  state for a component-only App;
- requested surface selection without child DOM inspection;
- unknown component keys rejected explicitly;
- deterministic component teardown;
- rebuilt self-contained HTML with the new catalog key and no old projection capability;
- at least one real tool result exercised through a browser host.

## A2UI boundary

A2UI is a useful reference for agent-authored declarative interfaces. Casys does not reimplement its
widget renderer here. Our intermediate language composes domain components already owned and
rendered by MCP Apps; a future adapter may map compatible A2UI widgets at the boundary.

## Consequences

Agents compose a small vocabulary with stable semantics instead of selecting one of several prebaked
pages or generating raw application code. Specialized viewers remain powerful, while their useful
blocks become reusable in dashboards and in their own standalone composition.
