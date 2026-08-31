# @casys/mcp-view-components

Optional presentation runtime and light-first component kit for MCP Apps. It gives provider-owned
viewers a shared visual grammar without moving their data, semantics, or rendering authority into
the host.

The intended unit is a small recorded view: one run, artifact, requirement, metric, or other bounded
object. A provider may export several whole-view resources; it should not turn one viewer into a
dashboard that contains every provider capability. In a composed host such as the Digital Thread
Whiteboard, `chip`, `row`, and `card` densities project the same semantic object while the
whole-view App remains the exact viewer opened for that object.

## Package boundary

- `@casys/mcp-view-contracts` is dependency-free and owns serializable contracts.
- `@casys/mcp-view` owns the MCP App lifecycle and transport.
- `@casys/mcp-view-components` is optional. Apps that do not want the kit do not import it.
- Providers resolve references and validate values, units, limits, verdicts, and provenance. The
  components display those values and never infer them.
- The host composes and opens recorded views. It does not become a native CAD, Modelica, FEA, or
  SysML renderer.

The package root is renderer-neutral. Preact is an optional peer and is loaded only through the
Preact subpaths:

```ts
import { defineComponentRegistry, installMcpViewTheme } from "@casys/mcp-view-components";
import {
  ArtifactRow,
  BadgeGroup,
  Card,
  CodeBlock,
  CollectionCard,
  ElementBody,
  ElementIdent,
  ElementLimit,
  ElementProvenance,
  ElementReading,
  InlineCode,
  LimitGauge,
  PathBar,
  Row,
  SemanticElement,
  SemanticList,
  TextInput,
} from "@casys/mcp-view-components/preact";
```

## Presentation vocabulary

Primitives:

- `Card`, `Badge`, `BadgeGroup`, `Button`, `Toolbar`, `Stack`, `Row`, `TextInput`, `InlineCode`,
  `CodeBlock`
- `Metric`, `MetricGrid`, `KeyValueList`, `DataTable`
- `Message`, `StateMessage`, `EmptyState`, `CrossSelection`

Reusable structures:

- `PathBar` for local navigation inside one bounded view
- `LimitGauge` for caller-supplied readings, bounds, labels, and tone
- `ArtifactRow` for immutable artifact identity and literal verification status

Semantic composition:

- `SemanticElement` with `chip | row | card` density and kit-owned explicit selection
- `SemanticList` for a bounded, optionally scrollable group of row-density semantic objects
- `CollectionCard` composing `Card` and `SemanticList` into one outer-border collection
- required `ElementIdent`
- optional `ElementReading` or caller-declared `ElementLimit`, plus `ElementBody`, `ElementVerdict`,
  and `ElementProvenance`

`viewer` is deliberately not a `SemanticElement` density. It is the provider's whole-view App,
usually composed from one `card` plus an optional `PathBar`.

```tsx
<SemanticElement
  reference={{ domain: "cad", kind: "artifact", id: "bracket.step" }}
  density="card"
  tone="warning"
  ident={<ElementIdent marker="STEP" label="Bracket" detail="revision 4" />}
  reading={<ElementReading label="Minimum thickness" value="0.84" unit="mm" />}
  provenance={<ElementProvenance label="SHA-256" value={digest} />}
/>;
```

The semantic reference is structured but never dereferenced by the component. Likewise, `LimitGauge`
never derives whether a value passes a limit, and `ArtifactRow` never claims a digest was verified
unless the caller supplies that recorded status.

Use `ElementLimit` when the record contains only an authored bound. It displays the supplied
operator, value, and unit without inventing a measurement, range, satisfaction state, or verdict.

## Theme

`installMcpViewTheme()` installs the shared CSS once. The defaults are light-first and include an
explicit dark mapping. Typography has three shared roles: heading/readings, body copy, and monospace
labels/data. The preferred local faces mirror the v2 reference (`Space Grotesk`, `Work Sans`, and
`JetBrains Mono`) and fall back to native families when they are unavailable. The kit neither embeds
fonts nor makes a network font request. Apps can override the stable variables exported as
`MCP_VIEW_THEME_TOKENS`:

```css
:root {
  --mcp-view-accent: #0d7c8a;
  --mcp-view-brand: #8a4fa3;
  --mcp-view-font-heading: "Space Grotesk", "Avenir Next", sans-serif;
  --mcp-view-font-body: "Work Sans", Avenir, sans-serif;
  --mcp-view-font-mono: "JetBrains Mono", "SFMono-Regular", monospace;
  --mcp-view-radius: 0.5rem;
}
```

Whole-view recorded sessions are declared in `@casys/mcp-view-contracts` and consumed through the
core resource lifecycle. `startPreactSurfaceApp()` accepts paired `validateSession` and
`mapSessionToData` callbacks, installs them before the App connects, and keeps mapped data in App
state. No individual component claims `viewer.session.apply`, so a remount cannot lose a one-shot
session.

## Result-viewer scaffold (Deno/JSR only)

The project generator intentionally uses Deno filesystem APIs and `deno fmt`. Run it from JSR:

```sh
deno run -A jsr:@casys/mcp-view-components@0.3.1/scaffold result-viewer ./result-viewer
```

The npm package contains only the runtime and presentation entry points. It does not export or ship
`@casys/mcp-view-components/scaffold`; Node ESM imports and CommonJS requires of that subpath are
expected to fail with `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a Deno-only module.
