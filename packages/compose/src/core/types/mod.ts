/**
 * Type definitions for mcp-compose.
 *
 * @module types
 */

export type { UiLayout } from "./layout.ts";
export { isLayoutAreas, isLayoutPreset, isValidLayout, UI_LAYOUT_PRESETS } from "./layout.ts";
export type { UiLayoutAreas, UiLayoutGap, UiLayoutPreset } from "./layout.ts";

export type { ResolvedSyncRule, UiSyncRule } from "./sync-rules.ts";

export type { UiOrchestration } from "./orchestration.ts";

export type { CollectedUiResource } from "./resources.ts";

export type { CompositeUiDescriptor } from "./descriptor.ts";

export type {
  McpToolResult,
  McpUiCsp,
  McpUiPermissions,
  McpUiResourceMeta,
  McpUiToolMeta,
} from "./mcp-apps.ts";

export { ErrorCode } from "./errors.ts";
export type { ValidationIssue, ValidationResult } from "./errors.ts";
