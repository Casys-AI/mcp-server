/**
 * Composite UI descriptor types.
 *
 * @module types/descriptor
 */

import type { UiLayout } from "./layout.ts";
import type { ResolvedSyncRule } from "./sync-rules.ts";
import type { CollectedUiResource } from "./resources.ts";

/**
 * Composite UI descriptor — the output of the composer.
 *
 * Contains all collected UI resources and resolved sync rules
 * for rendering a multi-UI composite layout.
 *
 * @example
 * ```typescript
 * const composite: CompositeUiDescriptor = {
 *   type: "composite",
 *   resourceUri: "ui://mcp-compose/workflow/abc-123",
 *   layout: "split",
 *   children: [
 *     { source: "postgres:query", resourceUri: "ui://postgres/table/1", slot: 0 },
 *     { source: "viz:render", resourceUri: "ui://viz/chart/2", slot: 1 },
 *   ],
 *   sync: [{ from: 0, event: "filter", to: 1, action: "update" }],
 * };
 * ```
 */
export interface CompositeUiDescriptor {
  /** Type discriminant. Always `"composite"`. */
  type: "composite";

  /** URI of this composite UI resource. */
  resourceUri: string;

  /** Layout mode for arranging children. */
  layout: UiLayout;

  /** Child UI resources in slot order. */
  children: CollectedUiResource[];

  /** Resolved sync rules (tool names replaced with slot indices). */
  sync: ResolvedSyncRule[];

  /** Shared context injected into all child UIs. */
  sharedContext?: Record<string, unknown>;

  /** Mapping of source name to area name (for areas layout). */
  areaMap?: Record<string, string>;
}
