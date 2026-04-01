/**
 * Composite UI builder — assembles descriptor from resources + orchestration.
 *
 * @module composer/composer
 */

import type { CollectedUiResource } from "../types/resources.ts";
import type { CompositeUiDescriptor } from "../types/descriptor.ts";
import type { UiOrchestration } from "../types/orchestration.ts";
import { resolveSyncRules } from "../sync/resolver.ts";

/**
 * Build a composite UI descriptor from collected resources.
 *
 * Resolves tool names in sync rules to slot indices, extracts shared context,
 * and generates a unique workflow ID.
 *
 * @param resources - UI resources collected during tool execution
 * @param orchestration - Optional layout, sync, and shared context configuration
 * @returns Composite UI descriptor ready for rendering
 *
 * @example
 * ```typescript
 * const descriptor = buildCompositeUi(
 *   [
 *     { source: "postgres:query", resourceUri: "ui://pg/table/1", slot: 0 },
 *     { source: "viz:render", resourceUri: "ui://viz/chart/2", slot: 1 },
 *   ],
 *   {
 *     layout: "split",
 *     sync: [{ from: "postgres:query", event: "filter", to: "viz:render", action: "update" }],
 *   },
 * );
 * // descriptor.sync[0] === { from: 0, event: "filter", to: 1, action: "update" }
 * ```
 */
export function buildCompositeUi(
  resources: CollectedUiResource[],
  orchestration?: UiOrchestration,
): CompositeUiDescriptor {
  const workflowId = crypto.randomUUID();
  const resolution = resolveSyncRules(orchestration?.sync ?? [], resources);

  // Invalid rules are silently excluded from the result.
  // Callers should use validateSyncRules() beforehand for upfront error detection.
  const sharedContext = extractSharedContext(resources, orchestration?.sharedContext);

  return {
    type: "composite",
    resourceUri: `ui://mcp-compose/workflow/${workflowId}`,
    layout: orchestration?.layout ?? "stack",
    children: resources,
    sync: resolution.rules,
    sharedContext,
  };
}

/**
 * Extract shared context values from collected UI resources.
 *
 * For each key in `keys`, scans resources in order and takes the first match.
 *
 * @param resources - Collected UI resources with optional context
 * @param keys - Keys to extract from each resource's context
 * @returns Merged shared context, or `undefined` if no keys specified or no matches
 */
function extractSharedContext(
  resources: CollectedUiResource[],
  keys?: string[],
): Record<string, unknown> | undefined {
  if (!keys || keys.length === 0) {
    return undefined;
  }

  const ctx: Record<string, unknown> = {};

  for (const resource of resources) {
    if (!resource.context) continue;
    for (const key of keys) {
      if (key in resource.context && !(key in ctx)) {
        ctx[key] = resource.context[key];
      }
    }
  }

  return Object.keys(ctx).length > 0 ? ctx : undefined;
}
