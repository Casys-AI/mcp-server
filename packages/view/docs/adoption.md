# Adopting `@casys/mcp-view`

This guide maps the Casys MCP Apps onto one componentized authoring framework. Generated `dist/`
HTML is never the editable source; a migration is complete only after rebuilding and exercising the
served artifact.

## Framework boundary

- `@casys/mcp-view` owns the child-App lifecycle, renderer-neutral component registry, surface
  mounting, safe shared primitives, and optional Compose event client.
- `@casys/mcp-compose` owns the dashboard shell, selection/order of advertised components, physical
  panel layout, and declared viewer-to-viewer routes.
- Each MCP repository owns its data validation, domain components, specialized renderers, actions,
  and standalone default surface.
- ERPNext remains untouched. Its direct `ext-apps` viewers are already conformant and public.

See [ADR 0004](decision-records/0004-view-authoring-framework.md).

## Consumer map

Snapshot: 2026-08-01, from the local workspace checkouts.

| Repository      | Viewer source                       | Role                                                             |
| --------------- | ----------------------------------- | ---------------------------------------------------------------- |
| `mcp-modelica`  | `src/ui/results-viewer/`            | Reference metrics, provenance, artifacts, and run navigation     |
| `mcp-build123d` | `src/ui/results-viewer/`            | Geometry canvas and artifact components                          |
| `mcp-calculix`  | `src/ui/results-viewer/`            | Solver, mesh, constraints, and displacement components           |
| `mcp-syson`     | six viewers under `src/ui/`         | Preact diagram/table components and lifecycle preservation       |
| `mcp-erpnext`   | seven React viewers under `src/ui/` | Public compatibility baseline; explicitly outside this migration |

## Component contract

A viewer defines:

1. stable component keys such as `modelica.metrics` or `build123d.canvas`;
2. a serializable descriptor for every key;
3. one `defaultSurface`, which is the complete standalone viewer;
4. mount functions that receive validated domain data, JSON-only props, local App context, and host
   context;
5. deterministic cleanup for timers, listeners, renderer roots, and GPU resources.

Compose may select, order, repeat, and configure only advertised components. It does not inspect the
iframe DOM, inject application code, or infer a compact/detail mode from pixel dimensions.
`ui/compose/event` stays orthogonal: components communicate across viewers only through declared
event routes.

## Migration recipe

1. Preserve focused tests around the current result model and visible evidence.
2. Split the existing viewer into the smallest meaningful domain blocks; avoid tiny decorative
   fragments and avoid keeping the whole viewer as one component.
3. Reuse status, metric-grid, and key-value primitives where they fit. Keep CAD, diagrams, charts,
   tables, and domain actions in custom components.
4. Define the existing standalone experience as `defaultSurface` using those same blocks.
5. Mount the negotiated surface from the App host context, falling back to `defaultSurface` in an
   ordinary MCP Apps host.
6. Preserve existing cross-view events and local navigation; do not invent events to prove the API.
7. Run the repository checks, rebuild the single-file HTML, then exercise both standalone and
   Compose paths with a real tool result.

For unreleased framework work, use the consumer's existing local module override rather than
publishing a temporary version.

## Compatibility rule for ERPNext

ERPNext already uses `@casys/mcp-server`, registers proper MCP App resources, embeds the official
`ext-apps` client, and installs handlers before `connect()`. This migration must not edit its
source, dependencies, bundles, or visible behavior. Any future adoption requires a separate
compatibility review and a concrete product benefit.
