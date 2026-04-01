/**
 * Orchestration configuration combining layout, sync rules, and shared context.
 *
 * @module types/orchestration
 */

import type { UiLayout } from "./layout.ts";
import type { UiSyncRule } from "./sync-rules.ts";

/**
 * Declarative UI orchestration configuration.
 *
 * Specifies how UI components should be arranged and synchronized.
 *
 * @example
 * ```typescript
 * const orchestration: UiOrchestration = {
 *   layout: "split",
 *   sync: [
 *     { from: "postgres:query", event: "filter", to: "viz:render", action: "update" },
 *   ],
 *   sharedContext: ["workflowId", "userId"],
 * };
 * ```
 */
export interface UiOrchestration {
  /** Layout mode for arranging UI components. */
  layout: UiLayout;

  /** Sync rules for cross-UI event routing. When omitted, UIs operate independently. */
  sync?: UiSyncRule[];

  /**
   * Keys to extract from collected UI contexts for shared injection.
   * Values are extracted from each resource's context and merged (first wins).
   */
  sharedContext?: string[];
}
