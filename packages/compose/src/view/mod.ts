/**
 * `@casys/mcp-compose/view` — View-side SDK for MCP Apps.
 *
 * Public entry point. See `spec.md` for the full contract and
 * `types.ts` for type-level documentation.
 *
 * @module
 */

export { createMcpApp, defineView } from "./app.ts";
export { MissingServerToolsCapabilityError } from "./capabilities.ts";

export type {
  AppConfig,
  AppContext,
  AppHandle,
  ToolResult,
  ViewDefinition,
  ViewLifecycle,
  ViewMap,
  ViewOutput,
  ViewRenderer,
} from "./types.ts";
