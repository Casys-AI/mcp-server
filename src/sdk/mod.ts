/**
 * MCP SDK adapters — optional convenience wrappers for MCP client SDKs.
 *
 * @module sdk
 */

export { createMcpSdkCollector } from "./mcp-sdk.ts";
export type { McpSdkCallToolResult, McpSdkCollector } from "./mcp-sdk.ts";

export { uiMeta } from "./ui-meta-builder.ts";
export type { UiMetaOptions, UiMetaResult, UiMetaUi } from "./ui-meta-builder.ts";

export { validateComposition } from "./composition-validator.ts";
export type {
  CompositionIssue,
  CompositionIssueCode,
  CompositionValidationResult,
} from "./composition-validator.ts";

export { composeEvents, COMPOSE_EVENT_METHOD } from "./compose-events.ts";
export type {
  ComposeEventHandler,
  ComposeEventPayload,
  ComposeEvents,
  ComposeSource,
  ComposeTarget,
} from "./compose-events.ts";
