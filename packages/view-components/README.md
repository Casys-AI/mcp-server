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
  DrillHint,
  ElementBody,
  ElementIdent,
  ElementLimit,
  ElementProvenance,
  ElementReading,
  InlineCode,
  IntervalPlot,
  LimitGauge,
  NoticeGroup,
  PathBar,
  renderStatusMessage,
  Row,
  SemanticElement,
  SemanticList,
  SeriesChart,
  Skeleton,
  Slot3D,
  Sparkline,
  StaleBanner,
  TextInput,
  TreeList,
  TypeBadge,
} from "@casys/mcp-view-components/preact";
```

## Presentation vocabulary

Primitives:

- `Card`, `Badge`, `BadgeGroup`, `Button`, `Toolbar`, `Stack`, `Row`, `TextInput`, `InlineCode`,
  `CodeBlock`, `Skeleton`
- `Metric`, `MetricGrid`, `KeyValueList`, `DataTable`
- `Message`, `StateMessage`, `EmptyState`, `CrossSelection`, `NoticeGroup`

Reusable structures:

- `PathBar` for local navigation inside one bounded view; a path of one item renders nothing. New
  optional props: `maxVisible` (inline capacity before leading items collapse; default three),
  `collapsedLabel` (accessible name of the collapsed disclosure), `backLabel` (leading step-out
  control), and `PathBarItem.detail` (recorded state of a kept level, revealed in the collapsed
  disclosure).
- `LimitGauge` for caller-supplied readings, bounds, labels, and tone
- `ArtifactRow` for immutable artifact identity and literal verification status
- `DrillHint` for one available drill-down, in direction `"in-view"` or `"to-model"`. Without a
  callback the hint degrades to plain text so a host that cannot follow it never advertises a step
  that does not exist.
- `TypeBadge` names what kind of view one level is (`"list"`, `"chart"`, or `"record"`); the caller
  supplies all wording.
- `StaleBanner` marks surrounding values as recorded earlier without hiding or replacing them. Tone
  defaults to `"warning"`; `"danger"` promotes the ARIA role to `alert`.
- `Slot3D` reserves a bounded area for a provider-owned renderer; without `children` the slot stays
  visibly reserved. The kit renders no geometry.
- `TreeList` for a controlled hierarchy with caller-owned type wording and coverage labels;
  expansion and selection state are fully caller-managed.

Numeric evidence:

- `Sparkline` for the compact shape of one recorded series, readable at chip and row density.
  Requires at least two finite samples already ordered by the caller.
- `SeriesChart` for a multi-series plot on a shared finite scale. Each series requires a `mark`
  field (`"line"` or `"bar"`): `"line"` connects samples with a polyline — an assertion that the
  quantity existed between them; `"bar"` draws each recorded sample as an isolated mark and claims
  nothing about the interval. The optional `onScrub` callback reports the pointer position on the
  shared x scale (`undefined` when the pointer leaves); a series with no recorded point at that
  position is absent from the readout rather than filled. The kit never interpolates, aligns to a
  nearest neighbour, draws a continuity it has not measured, or invents a value — the provider
  declares both the mark shape and which sample a position corresponds to.
- `IntervalPlot` for caller-declared deviation intervals laid out against a shared zero line. The
  scale must contain zero; every bound and label is caller-supplied.

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

## System states

Three components express a view's readiness without hiding or fabricating content.

`Skeleton` is a frame-first loading placeholder: it draws the structure before values arrive so
layout does not shift on load. The caller supplies an accessible label and an optional line count
(default three).

`StaleBanner` keeps dated values visible while flagging that the snapshot is not current. The caller
formats the message, including the recorded instant. The banner never refetches or replaces a value
with a gap.

`DrillHint` without a callback degrades to plain text. A host that cannot follow a drill-down step
omits `onActivate`; the hint stays visible but renders no affordance. Providers declare every
available next step without advertising actions the host cannot execute.

`NoticeGroup` gathers short notices under a single severity heading. It renders nothing when there
are no items and no `omittedLabel`, so the caller never has to guard the call site. Truncation is
stated by the caller via `omittedLabel`: the group displays only the items it was handed and never
counts what it was not given.

## Imperative bridge

`renderStatusMessage(detail, options?)` renders a `StateMessage` into a real DOM node and returns
it. `defineView` must return a native element, so every viewer built on it previously wrote its own
Preact-to-DOM bridge; those bridges drifted in tone, ARIA role, and class. `renderStatusMessage` is
that bridge, made canonical. It lives in the pure presentation module
`@casys/mcp-view-components/preact/components` and does not import `@casys/mcp-view`, so it is
reachable from any entry that does not need the surface lifecycle.

Without `container` it creates a detached `div`; with one it renders into that node and returns it.

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

## Common compositions

The kit stays small and non-prescriptive, leaving assembly to the caller. When multiple viewers
build the same assembly from the same primitives, this section is what they should have found first.

### Named quantity section

`Card` + `MetricGrid` carries one named group of measurements. Repeat the pattern for each domain
region; `EmptyState` handles the no-data case without shifting layout.

```tsx
<Card title="Load margins">
  {items.length === 0 ? <EmptyState>No values recorded.</EmptyState> : <MetricGrid items={items} />}
</Card>;
```

### Artifact collection

`CollectionCard` + `ArtifactRow` keeps a single outer border for a bounded list of immutable
artifacts. Thread the count through `eyebrow` or `actions`; `EmptyState` fills the list body when
there is nothing to show. `CollectionCard` is available since 0.3.x; the `eyebrow` slot on `Card`
accepts any `ComponentChildren`, so a plain count string requires no extra component.

```tsx
<CollectionCard
  label="Build artifacts"
  title="Artifacts"
  eyebrow={artifacts.length > 0 ? `${artifacts.length} items` : undefined}
>
  {artifacts.length === 0
    ? <EmptyState>No artifacts recorded.</EmptyState>
    : artifacts.map((a) => (
      <ArtifactRow
        key={a.uri}
        label={a.label}
        uri={a.uri}
        verification={a.verification}
      />
    ))}
</CollectionCard>;
```

## Result-viewer scaffold (Deno/JSR only)

The project generator intentionally uses Deno filesystem APIs and `deno fmt`. Run it from JSR:

```sh
deno run -A jsr:@casys/mcp-view-components@0.5.0/scaffold result-viewer ./result-viewer
```

The npm package contains only the runtime and presentation entry points. It does not export or ship
`@casys/mcp-view-components/scaffold`; Node ESM imports and CommonJS requires of that subpath are
expected to fail with `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a Deno-only module.
