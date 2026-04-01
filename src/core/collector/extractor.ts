/**
 * UI metadata extractor — extracts `_meta.ui` from MCP tool results.
 *
 * @module collector/extractor
 */

import type { McpUiToolMeta } from "../types/mcp-apps.ts";

/**
 * Extract UI metadata from an MCP tool call result.
 *
 * Looks for `_meta.ui.resourceUri` in the result object.
 * Returns `null` if the result is not an object, has no `_meta`,
 * or has no `ui.resourceUri`.
 *
 * @param result - Raw MCP tool call result (unknown shape)
 * @returns Extracted UI metadata, or `null` if none found
 *
 * @example
 * ```typescript
 * const meta = extractUiMeta({
 *   content: [{ type: "text", text: "OK" }],
 *   _meta: { ui: { resourceUri: "ui://pg/table/1" } },
 * });
 * // meta === { resourceUri: "ui://pg/table/1" }
 * ```
 *
 * @example No UI metadata
 * ```typescript
 * const meta = extractUiMeta({ content: [{ type: "text", text: "OK" }] });
 * // meta === null
 * ```
 */
export function extractUiMeta(result: unknown): McpUiToolMeta | null {
  if (result === null || typeof result !== "object") {
    return null;
  }

  const obj = result as Record<string, unknown>;
  const meta = obj._meta;

  if (meta === null || typeof meta !== "object") {
    return null;
  }

  const metaObj = meta as Record<string, unknown>;
  const ui = metaObj.ui;

  if (ui === null || typeof ui !== "object") {
    return null;
  }

  const uiObj = ui as Record<string, unknown>;

  if (typeof uiObj.resourceUri !== "string" || uiObj.resourceUri === "") {
    return null;
  }

  return {
    resourceUri: uiObj.resourceUri,
    visibility: Array.isArray(uiObj.visibility) ? uiObj.visibility : undefined,
  };
}
