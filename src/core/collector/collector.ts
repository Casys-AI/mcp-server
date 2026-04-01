/**
 * UI resource collector — inspects MCP tool results and accumulates UI resources.
 *
 * @module collector/collector
 */

import type { CollectedUiResource } from "../types/resources.ts";
import { extractUiMeta } from "./extractor.ts";

/**
 * Collector interface for accumulating UI resources from MCP tool results.
 *
 * @example
 * ```typescript
 * const collector = createCollector();
 * collector.collect("postgres:query", toolResult);
 * collector.collect("viz:render", vizResult);
 * const resources = collector.getResources();
 * ```
 */
export interface UiCollector {
  /** Inspect a tool result and collect any UI resource. Returns the resource or `null`. */
  collect(
    toolName: string,
    result: unknown,
    context?: Record<string, unknown>,
  ): CollectedUiResource | null;

  /** Get all collected resources in slot order. */
  getResources(): CollectedUiResource[];

  /** Reset collected resources. */
  clear(): void;
}

/**
 * Create a new UI resource collector.
 *
 * The collector inspects MCP tool call results for `_meta.ui.resourceUri`
 * and accumulates them with auto-incrementing slot indices.
 *
 * @returns A new `UiCollector` instance
 *
 * @example
 * ```typescript
 * const collector = createCollector();
 *
 * const r1 = collector.collect("postgres:query", {
 *   content: [{ type: "text", text: "OK" }],
 *   _meta: { ui: { resourceUri: "ui://pg/table/1" } },
 * });
 * // r1 === { source: "postgres:query", resourceUri: "ui://pg/table/1", slot: 0 }
 *
 * const r2 = collector.collect("viz:render", {
 *   content: [{ type: "text", text: "Chart" }],
 *   _meta: { ui: { resourceUri: "ui://viz/chart/2" } },
 * });
 * // r2.slot === 1
 *
 * collector.getResources().length; // 2
 * ```
 */
export function createCollector(): UiCollector {
  let resources: CollectedUiResource[] = [];

  return {
    collect(
      toolName: string,
      result: unknown,
      context?: Record<string, unknown>,
    ): CollectedUiResource | null {
      const meta = extractUiMeta(result);
      if (!meta?.resourceUri) {
        return null;
      }

      const resource: CollectedUiResource = {
        source: toolName,
        resourceUri: meta.resourceUri,
        context,
        slot: resources.length,
      };

      resources.push(resource);
      return resource;
    },

    getResources(): CollectedUiResource[] {
      return [...resources];
    },

    clear(): void {
      resources = [];
    },
  };
}
