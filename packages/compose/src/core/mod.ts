/**
 * Core composition primitives — types, collector, sync, composer, renderer.
 *
 * @module core
 */

// Types
export type {
  AdvertisedComponentCatalog,
  CollectedUiResource,
  ComponentSurface,
  ComponentSurfaceItem,
  ComponentSurfaceLayout,
  ComponentSurfaceResolution,
  CompositeUiDescriptor,
  JsonValue,
  McpToolResult,
  McpUiCsp,
  McpUiPermissions,
  McpUiResourceMeta,
  McpUiToolMeta,
  ReadyComponentSurface,
  ResolvedSyncRule,
  SurfaceGap,
  SurfaceLayoutType,
  UiLayout,
  UiOrchestration,
  UiSyncRule,
  UnresolvedComponentSurface,
  ValidationIssue,
  ValidationResult,
} from "./types/mod.ts";

export {
  ErrorCode,
  isLayoutAreas,
  isLayoutPreset,
  isValidLayout,
  UI_LAYOUT_PRESETS,
} from "./types/mod.ts";

// Collector
export { createCollector, extractUiMeta } from "./collector/mod.ts";
export type { UiCollector } from "./collector/mod.ts";

// Sync
export { resolveSyncRules, validateSyncRules } from "./sync/mod.ts";
export type { ResolutionResult } from "./sync/mod.ts";

// Composer
export { buildCompositeUi } from "./composer/mod.ts";

// Small-component surfaces
export { resolveComponentSurface } from "./components/mod.ts";
