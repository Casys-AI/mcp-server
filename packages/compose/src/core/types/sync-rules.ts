/**
 * Sync rule types for cross-UI event routing.
 *
 * @module types/sync-rules
 */

/**
 * Declarative sync rule for cross-UI event routing.
 *
 * When a source UI emits an event, the sync rule specifies which
 * target UI should receive it and what action to trigger.
 *
 * @example Basic sync rule
 * ```typescript
 * const rule: UiSyncRule = {
 *   from: "postgres:query",
 *   event: "filter",
 *   to: "viz:render",
 *   action: "update",
 * };
 * ```
 *
 * @example Broadcast sync rule
 * ```typescript
 * const rule: UiSyncRule = {
 *   from: "date-picker",
 *   event: "change",
 *   to: "*",
 *   action: "refresh",
 * };
 * ```
 */
export interface UiSyncRule {
  /** Source tool name emitting the event (e.g., `"postgres:query"`). */
  from: string;

  /** Event type to listen for (e.g., `"filter"`, `"change"`). */
  event: string;

  /** Target tool name or `"*"` for broadcast to all other UIs. */
  to: string;

  /** Action to trigger on the target (e.g., `"update"`, `"refresh"`). */
  action: string;
}

/**
 * Resolved sync rule with slot indices instead of tool names.
 *
 * Used in `CompositeUiDescriptor` for client-side event routing.
 *
 * @example
 * ```typescript
 * const resolved: ResolvedSyncRule = {
 *   from: 0,
 *   event: "filter",
 *   to: 1,
 *   action: "update",
 * };
 * ```
 */
export interface ResolvedSyncRule {
  /** Source slot index. */
  from: number;

  /** Event type to listen for. */
  event: string;

  /** Target slot index, or `"*"` for broadcast. */
  to: number | "*";

  /** Action to trigger on the target. */
  action: string;
}
