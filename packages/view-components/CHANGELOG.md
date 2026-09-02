# Changelog

All notable changes to `@casys/mcp-view-components` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.6.0] - 2026-09-02

### Added

- **`@casys/mcp-view-components/surface`** entry (`surface.ts`) — owns the MCP Apps runtime. The
  package root stays renderer-neutral and reaches `@casys/mcp-view` only through a type edge; a
  module graph test (`entries_test.ts`) pins that `@modelcontextprotocol/ext-apps` and the App
  lifecycle are absent from the root and present in `/surface`.
- **`startSurfaceApp`** (`/surface`) — the renderer-neutral result-driven App lifecycle every
  consumer viewer had rewritten by hand: projection and session subscription registered before
  connect, loading status as the initial view, one `fromToolResult` projection per tool result (sync
  or async, with `host.readServerResource`), `SurfaceDisplayState` (`loading` / `empty` / `error` /
  `notice` / `result`), host-selected or default surface, host context re-applied on every
  `hostcontextchanged` including the ones replayed from the handshake, remount only while a result
  is displayed and the context object moved, overtaken-mount guard, a navigation chain so a remount
  never reads the router mid-transition, `"Surface required"` for component-only registries without
  a host surface, a throwing projection turned into a `Result rejected` error status, and a failed
  mount or malformed host selection kept on the surface route as `Surface failed` /
  `Surface invalid` instead of a blank page. Statuses are rendered by the caller's
  `renderStatus(status)`; `SurfaceStatus` carries `kind`, `title`, `message`, `tone`, `busy` and the
  caller's optional `code`. Returns a `SurfaceAppHandle` (`show`, `dispose`). Accepts an optional
  `SurfaceAppRuntime` seam so the lifecycle is testable without ext-apps.
- **`SurfaceAppError`** (`/surface`, `/preact`) — a `TypeError` with a stable `code`
  (`SURFACE_APP_PROJECTION_CONFLICT`, `SURFACE_APP_SESSION_CONFLICT`,
  `SURFACE_APP_SESSION_INCOMPLETE`) and a frozen `data.recovery`, thrown for option conflicts;
  `SurfaceAppHandle.show()` after a teardown rejects with `SURFACE_APP_CLOSED`.
- **`viewerSession`** option (`SurfaceViewerSession`: `validate`, `toState`, `onInvalid`) on both
  `startSurfaceApp` and `startPreactSurfaceApp`, projecting a recorded session into the same
  `SurfaceDisplayState` as a tool result.
- **`.mcp-view-surface-shell`** theme class — the default host element of `startSurfaceApp`, styled
  as `.mcp-view-preact-surface`, which the Preact facade keeps as its own default.
- **Scaffold**: the generated `src/main.ts` imports `startSurfaceApp` from
  `@casys/mcp-view-components/surface` and hands it a `fromToolResult` projection whose closure
  keeps the last recorded result under a dated failure banner; `src/render.ts` gains `renderStatus`
  (`data-kind`, escaped `data-tone`, `aria-busy` on busy notices) and `renderViewer`; `src/model.ts`
  replaces `DisplayState`/`shownResult` with `ViewerData`; numbers format in `en-US` so output does
  not depend on the host locale. No `createMcpApp` call is emitted any more. `build.ts` derives the
  `/surface` module from `MCP_VIEW_COMPONENTS_MODULE` (or takes
  `MCP_VIEW_COMPONENTS_SURFACE_MODULE`), and the generated project is fmt-clean.
- **Release plumbing**: `release.yml` and `scripts/release-tag.ts` know `view-components-v*` tags;
  `deno task changelog:draft` and `deno task release:tag` in the package; the npm publish smoke
  imports `/surface` in ESM and CJS and refuses a tarball that ships `src/testing/`.

### Changed

- **BREAKING —** `startPreactSurfaceApp` is now a facade over `startSurfaceApp`: statuses render
  through `renderStatusMessage` (titled `Loading` / `Empty` / `Error`, tones `info` / `neutral` /
  `danger`, `aria-busy` while loading) instead of bare `.mcp-view-message-<kind>` divs;
  `statusClassName` lands on that `StateMessage`; `renderStatus` replaces `renderMessage`; the
  function returns a `SurfaceAppHandle` instead of `void`; `TData` is no longer constrained to
  `ResultData`. The shell keeps the `mcp-view-preact-surface` class.
- `PreactSurfaceAppState` and `PreactSurfaceContext` are aliases of `SurfaceAppState` and
  `SurfaceAppContext`; `/preact` re-exports the `SurfaceAppErrorCode`, `SurfaceAppRuntime`,
  `SurfaceProjection`, `SurfaceStatusTone` and `SurfaceToolResult` types.
- `SurfaceMessageKind` gains `"notice"`; the console prefix of the default `onError` is
  `[mcp-view-components]` instead of `[mcp-view/preact]`.

| 0.5.0                                       | 0.6.0                                                 |
| ------------------------------------------- | ----------------------------------------------------- |
| `renderMessage(message, kind)`              | `renderStatus(status)` with `status.kind` and `.tone` |
| `.mcp-view-message-<kind>` selectors        | `.mcp-view-state[data-tone]` (`StateMessage`)         |
| `await startPreactSurfaceApp(...)` → `void` | `const app = await …` → `SurfaceAppHandle`            |
| `validateSession` + `mapSessionToData`      | `viewerSession: { validate, toState }`                |
| `TData extends ResultData`                  | any `TData`                                           |

### Deprecated

- `validateSession`, `mapSessionToData` and `onInvalidSession` on `startPreactSurfaceApp`: use
  `viewerSession`. Mixing the two forms is refused. Removed in 0.7.0.

## [0.5.0] - 2026-09-01

### Added

- **`NoticeGroup`** (`NoticeGroupProps`) — gathers short notices under a single severity heading
  (`src/preact/components.tsx`). Renders nothing when `items` is empty and no `omittedLabel` is
  supplied, so the caller never has to guard the call site. Truncation is stated by the caller via
  `omittedLabel`: the group displays only the notices it was handed and never counts what it was not
  given. Accepts an optional `PresentationTone` (default `"neutral"`).

- **`renderStatusMessage`** — imperative bridge that renders a `StateMessage` into a real DOM node
  and returns it (`src/preact/components.tsx`). `defineView` must return a native element, so every
  viewer built on it previously wrote its own Preact-to-DOM bridge; those bridges drifted in tone,
  ARIA role, and class. Without `container` (`StatusMessageMount`) it returns the rendered
  `.mcp-view-state` element itself, so the node a caller mounts carries the class, the tone and the
  alert role — a bare wrapper would hand `defineView` a root that no viewer stylesheet and no
  assistive technology can see. `className` lands on that same node. With a `container` it renders
  inside the node the caller already owns and returns it. Lives in the pure presentation module
  (`preact/components` entry) and does not import `@casys/mcp-view`, so it is reachable from any
  entry that does not need the surface lifecycle.

## [0.4.0] - 2026-09-01

### Added

- **`Skeleton`** — frame-first loading placeholder (`src/preact/components.tsx`). Draws the
  structure of a recorded view before its values arrive so layout does not shift on load. Caller
  supplies an accessible `label` and an optional `lines` count (default three). Throws `RangeError`
  for non-positive `lines`.

- **`DrillHint`** — affordance for one available drill-down in direction `"in-view"` or
  `"to-model"`. Without `onActivate` the component renders plain text and no glyph, so a host that
  cannot follow a step never advertises an action that does not exist. `actionLabel` is required
  together with the callback and never accepted without it.

- **`TypeBadge`** — inline badge that names what kind of view one level is (`"list"`, `"chart"`, or
  `"record"`). The caller supplies all wording; the kit does not translate or invent labels.

- **`StaleBanner`** — marks surrounding values as recorded earlier without hiding or replacing them.
  Accepts a caller-formatted `message`, an optional `PresentationTone` (default `"warning"`), and an
  optional `action` callback. Promotes its ARIA role to `alert` when tone is `"danger"`.

- **`Slot3D`** — reserved area for a provider-owned 3D renderer. Without `children` the slot stays
  visibly reserved with a placeholder mark. The kit renders no geometry.

- **`TreeList`** — controlled hierarchy with caller-owned type wording and per-node coverage labels.
  Expansion (`expandedIds`) and selection (`selectedId`) are fully caller-managed; omit `onSelect`
  for a read-only tree. Node `coverageLabel` is displayed verbatim — the kit counts nothing.

- **Plots module** (`src/preact/plots.tsx`, new) — three pure numeric-evidence marks:

  - **`Sparkline`** — compact polyline for one recorded series, readable at chip and row density.
    Requires at least two finite samples already ordered by the caller.
  - **`SeriesChart`** — multi-series plot on a shared finite scale with an optional declared cursor
    readout. The chart never resamples, interpolates a missing point, formats a number, picks a
    unit, derives an extremum, or owns pointer state.
  - **`IntervalPlot`** — caller-declared deviation intervals laid out against a shared zero line.
    The scale must contain zero; every bound and label is caller-supplied.

- **`PathBarItem.detail`** — optional recorded state for a kept level, revealed only inside the
  collapsed disclosure.

- **`PATH_BAR_DEFAULT_MAX_VISIBLE`** — exported constant (`3`) for the default inline capacity of
  `PathBar`.

- New optional `PathBar` props: `maxVisible` (inline capacity before leading items collapse),
  `collapsedLabel` (accessible name of the collapsed disclosure), and `backLabel` (accessible name
  of the leading step-out control; renders a button only when the current item has a predecessor).

- **`SeriesChart.onScrub`** — optional `(x: number | undefined) => void` callback. Reports the
  pointer position on the shared x scale; `undefined` signals that the pointer has left the chart.
  The chart resolves no sample at that position. A series with no recorded point at the scrubbed x
  is absent from the accompanying `SeriesChartCursor.readouts` rather than filled with an
  interpolated or nearest-neighbour value: determining which recorded sample corresponds to a
  position — or that none does — remains the provider's decision, as only the provider knows its
  sampling strategy (a fixed-step series has a different notion of proximity than an adaptive trace
  whose step size varies with the signal).

- **`SeriesMark`** — exported string union `"line" | "bar"` that every `SeriesChartSeries` must now
  declare via the required `mark` field:

  - `"line"` draws a polyline through the samples. Using `"line"` is an assertion that the measured
    quantity existed between the recorded points — valid when the series is sampled densely enough
    that the intervals carry meaning.
  - `"bar"` draws one vertical mark per recorded sample. When the scale contains zero the bar is
    anchored on the baseline; otherwise it sits on the scale floor. `"bar"` makes no claim about the
    interval between samples.

  The chart never deduces the mark from sample spacing: the provider declares it because the
  provider knows its sampling strategy.

### Changed

- **BREAKING — `@casys/mcp-view-components/preact/components` no longer re-exports theme symbols.**
  `installMcpViewTheme`, `MCP_VIEW_THEME_CSS`, `MCP_VIEW_THEME_STYLE_ID`, `MCP_VIEW_THEME_TOKENS`,
  `McpViewThemeDocument`, `McpViewThemeToken`, and `McpViewThemeTokens` are removed from the
  `./preact/components` barrel and remain available from the package root
  `@casys/mcp-view-components` only.

  **Why:** the barrel unconditionally re-exported the theme sheet; `deno bundle` did not elide it.
  An entry importing only `Card` produced 53.8 KB; it produces 11.0 KB after this change. The theme
  is an explicit installation step (`installMcpViewTheme()`) and must cost an explicit import.

  **Migration:** move theme imports to the root entry point:

  ```ts
  // before
  import { installMcpViewTheme } from "@casys/mcp-view-components/preact/components";
  // after
  import { installMcpViewTheme } from "@casys/mcp-view-components";
  ```

  A test in `preact_components_test.ts` now asserts that the barrel has no module edge to
  `src/theme.ts`. No known consumer imported theme symbols from this barrel; the migration is
  mechanical.

- **BREAKING — `SeriesChartSeries.mark` is now required.** Every series must declare a `mark` field
  of type `SeriesMark` (`"line"` or `"bar"`). The field was absent before; adding it is the
  migration.

  **Migration:** add `mark: "line"` to restore the previous polyline rendering — but verify that a
  line is justified for that series before doing so. Connecting two samples is an assertion that the
  quantity existed between them; if the sampling is sparse or the intervals carry no meaning,
  `"bar"` is the correct mark.

- **BREAKING — `PathBar` return type is now `JSX.Element | null`.** A path with fewer than two items
  returns `null`: the first level has nothing to leave, so no navigation is rendered.

  **Migration — what callers must do:**

  1. **TypeScript strict mode.** Any site that assigned the return value to a `JSX.Element` variable
     or prop without `| null` now produces a type error. Widen the annotation or wrap the call:
     `{items.length > 1 && <PathBar … />}`.

  2. **Layout that relied on the `<nav>` being present for a single-item path.** The previous
     behaviour rendered a one-crumb bar that the browser included in flow (height, border, gap). A
     caller whose outer layout reserved that space unconditionally — via a fixed height, a flex gap,
     or a border that depended on the element existing — must now guard the surrounding container on
     the path length or use a `min-height` that stays consistent when the bar is absent.

  3. **Consumers upgrading from 0.1.x or 0.2.x.** This breaking change lands in the same upgrade
     that introduces several new minor features. Callers jumping multiple minors in one step should
     audit every `PathBar` call site in a single pass before shipping.

- `PathBar` validates `maxVisible` at call time and throws `RangeError` for non-positive or
  non-integer values, consistent with the existing item-id and `currentId` guards.
