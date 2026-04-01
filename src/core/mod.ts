/**
 * Core composition primitives — types, collector, sync, composer, renderer.
 *
 * @module core
 */

// Types
export type {
  CollectedUiResource,
  CompositeUiDescriptor,
  McpToolResult,
  McpUiCsp,
  McpUiPermissions,
  McpUiResourceMeta,
  McpUiToolMeta,
  ResolvedSyncRule,
  UiLayout,
  UiOrchestration,
  UiSyncRule,
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

