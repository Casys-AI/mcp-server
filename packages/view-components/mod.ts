/**
 * `@casys/mcp-view-components` — optional presentation runtime and visual kit.
 *
 * The root stays renderer-neutral. Import Preact bindings from `/preact` or
 * pure Preact presentation primitives from `/preact/components`.
 *
 * @module
 */

export {
  activeComponentSurface,
  advertisedComponentCatalog,
  applySurfaceContext,
  CASYS_COMPONENT_CATALOG_CAPABILITY_KEY,
  CASYS_SURFACE_CONTEXT_KEY,
  componentCatalogCapabilities,
  defineComponentRegistry,
  defineComponentSurface,
  defineViewComponent,
  mountComponentSurface,
  readSurfaceContext,
} from "./src/components.ts";
export type {
  AdvertisedComponentCatalog,
  ComponentCleanup,
  ComponentSurface,
  ComponentSurfaceItem,
  ComponentSurfaceLayout,
  JsonValue,
  McpViewHostContext,
  MountComponentSurfaceOptions,
  MountedComponentSurface,
  SurfaceContext,
  SurfaceGap,
  SurfaceLayoutType,
  ViewComponentDefinition,
  ViewComponentDescriptor,
  ViewComponentEventPorts,
  ViewComponentMountContext,
  ViewComponentRegistry,
} from "./src/components.ts";

export {
  defineCustomComponent,
  defineKeyValueComponent,
  defineMetricGridComponent,
  defineStatusComponent,
} from "./src/component-primitives.ts";
export type {
  ComponentTone,
  KeyValueComponentValue,
  MetricComponentValue,
  StatusComponentValue,
} from "./src/component-primitives.ts";

export { installMcpViewTheme, MCP_VIEW_THEME_CSS, MCP_VIEW_THEME_STYLE_ID } from "./src/theme.ts";
export type { McpViewThemeDocument } from "./src/theme.ts";
