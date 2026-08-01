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
  and optional standalone default surface.
- ERPNext's public direct-`ext-apps` viewers remain untouched. Product dashboards use a separate
  read-only ERPNext component palette backed by the public provider client.

See [ADR 0004](decision-records/0004-view-authoring-framework.md).

## Consumer map

Snapshot: 2026-08-01, from the local workspace checkouts.

| Repository                                             | Viewer source                       | Role                                                                 |
| ------------------------------------------------------ | ----------------------------------- | -------------------------------------------------------------------- |
| `mcp-modelica`                                         | `src/ui/results-viewer/`            | Reference metrics, provenance, artifacts, and run navigation         |
| `mcp-build123d`                                        | `src/ui/results-viewer/`            | Geometry canvas and artifact components                              |
| `mcp-calculix`                                         | `src/ui/results-viewer/`            | Solver, mesh, constraints, and displacement components               |
| `mcp-syson`                                            | six viewers under `src/ui/`         | Preact diagram/table components and lifecycle preservation           |
| `mcp-erpnext`                                          | seven React viewers under `src/ui/` | Public compatibility baseline; source remains outside this migration |
| `casys-digital-thread/services/mcp-erpnext-components` | one Preact component palette        | Product-only BOM composition and shared-theme reference              |

## Component contract

A viewer defines:

1. stable component keys such as `modelica.metrics` or `build123d.canvas`;
2. a serializable descriptor for every key;
3. optionally one `defaultSurface`, which is the complete standalone viewer; omit it when the App is
   intentionally a Compose-only palette;
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
3. In Preact Apps, import `Card`, `Badge`, `MetricGrid`, `KeyValueList`, `DataTable`, `Button`,
   `Toolbar`, `EmptyState`, and `StateMessage` from `@casys/mcp-view/preact`. Keep only CAD,
   diagrams, charts, and domain actions in custom components; do not copy the shared presentation
   CSS into every MCP.
4. If standalone usage matters, define it as `defaultSurface` using those same blocks. Otherwise
   omit it deliberately.
5. Mount the negotiated surface from the App host context, falling back to `defaultSurface` when
   present and to the explicit `surface-required` state otherwise.
6. Preserve existing cross-view events and local navigation; do not invent events to prove the API.
7. Run the repository checks, rebuild the single-file HTML, then exercise both standalone and
   Compose paths with a real tool result.

For unreleased framework work, use the consumer's existing local module override rather than
publishing a temporary version.

## ERPNext compatibility rule

ERPNext already uses `@casys/mcp-server`, registers proper MCP App resources, embeds the official
`ext-apps` client, and installs handlers before `connect()`. This migration does not edit its
source, dependencies, bundles, or visible behavior. The product-specific component palette is a
separate MCP service with one read-only BOM tool; it reuses the published provider client and owns
only the presentation contract needed by Compose.
