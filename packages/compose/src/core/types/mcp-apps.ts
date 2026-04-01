/**
 * MCP Apps specification types (SEP-1865).
 *
 * Types from the MCP Apps protocol for UI resource metadata.
 *
 * @module types/mcp-apps
 */

/**
 * UI metadata in an MCP tool response (`_meta.ui`).
 *
 * @example
 * ```typescript
 * const meta: McpUiToolMeta = {
 *   resourceUri: "ui://postgres/table/abc123",
 *   visibility: ["model", "app"],
 * };
 * ```
 */
export interface McpUiToolMeta {
  /** URI of the UI resource to display. */
  resourceUri?: string;

  /** Visibility settings: `"model"` (LLM), `"app"` (user). */
  visibility?: Array<"model" | "app">;
}

/**
 * Content Security Policy for UI resources.
 *
 * @example
 * ```typescript
 * const csp: McpUiCsp = {
 *   connectDomains: ["api.example.com"],
 *   resourceDomains: ["cdn.example.com"],
 * };
 * ```
 */
export interface McpUiCsp {
  /** Domains for `connect-src` (fetch, WebSocket). */
  connectDomains?: string[];

  /** Domains for resource loading (scripts, styles). */
  resourceDomains?: string[];

  /** Domains for iframe embedding. */
  frameDomains?: string[];

  /** Base URI domains for relative URLs. */
  baseUriDomains?: string[];
}

/**
 * Permission capabilities for UI resources.
 *
 * @example
 * ```typescript
 * const permissions: McpUiPermissions = {
 *   clipboardWrite: {},
 *   camera: {},
 * };
 * ```
 */
export interface McpUiPermissions {
  camera?: Record<string, never>;
  microphone?: Record<string, never>;
  geolocation?: Record<string, never>;
  clipboardWrite?: Record<string, never>;
}

/**
 * Resource metadata for UI rendering.
 *
 * @example
 * ```typescript
 * const meta: McpUiResourceMeta = {
 *   csp: { connectDomains: ["api.example.com"] },
 *   permissions: { clipboardWrite: {} },
 *   domain: "example.com",
 *   prefersBorder: true,
 * };
 * ```
 */
export interface McpUiResourceMeta {
  /** Content Security Policy configuration. */
  csp?: McpUiCsp;

  /** Permission capabilities the UI may request. */
  permissions?: McpUiPermissions;

  /** Domain hint for the UI resource. */
  domain?: string;

  /** Whether the UI prefers a visible border/frame. */
  prefersBorder?: boolean;
}

/**
 * Shape of an MCP tool call result that may contain UI metadata.
 *
 * Used by the collector to extract `_meta.ui` from tool responses.
 *
 * @example
 * ```typescript
 * const result: McpToolResult = {
 *   content: [{ type: "text", text: "Query executed" }],
 *   _meta: {
 *     ui: { resourceUri: "ui://postgres/table/abc123" },
 *   },
 * };
 * ```
 */
export interface McpToolResult {
  content?: unknown[];
  _meta?: {
    ui?: McpUiToolMeta;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
