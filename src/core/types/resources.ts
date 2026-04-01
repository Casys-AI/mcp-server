/**
 * Collected UI resource types.
 *
 * @module types/resources
 */

/**
 * UI resource collected from an MCP tool response.
 *
 * When a tool call returns `_meta.ui.resourceUri`, the collector
 * captures it for later composition into a composite UI.
 *
 * @example
 * ```typescript
 * const resource: CollectedUiResource = {
 *   source: "postgres:query",
 *   resourceUri: "ui://postgres/table/abc123",
 *   context: { query: "SELECT * FROM sales" },
 *   slot: 0,
 * };
 * ```
 */
export interface CollectedUiResource {
  /** Tool that produced this UI resource (e.g., `"postgres:query"`). */
  source: string;

  /** URI of the UI resource (from `_meta.ui.resourceUri`). */
  resourceUri: string;

  /** Optional context data for the UI. */
  context?: Record<string, unknown>;

  /** Slot index (0-based execution order). */
  slot: number;
}
