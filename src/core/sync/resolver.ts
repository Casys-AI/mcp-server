/**
 * Sync rule resolver — resolves tool names to slot indices.
 *
 * @module sync/resolver
 */

import type { CollectedUiResource } from "../types/resources.ts";
import type { ResolvedSyncRule, UiSyncRule } from "../types/sync-rules.ts";
import type { ValidationIssue } from "../types/errors.ts";
import { ErrorCode } from "../types/errors.ts";

/**
 * Result of sync rule resolution.
 *
 * @example
 * ```typescript
 * const result: ResolutionResult = resolveSyncRules(rules, resources);
 * if (result.issues.length > 0) {
 *   // Handle orphan references
 * }
 * const resolvedRules = result.rules;
 * ```
 */
export interface ResolutionResult {
  /** Successfully resolved rules. */
  rules: ResolvedSyncRule[];

  /** Issues encountered during resolution (orphan references, etc.). */
  issues: ValidationIssue[];
}

/**
 * Resolve sync rules from tool names to slot indices.
 *
 * Maps tool names in `from` and `to` fields to their corresponding
 * slot indices based on collected resources. Rules referencing unknown
 * tools are reported as issues and excluded from the result.
 *
 * @param rules - Sync rules with tool names
 * @param resources - Collected UI resources providing the name → slot mapping
 * @returns Resolved rules and any issues found
 *
 * @example
 * ```typescript
 * const result = resolveSyncRules(
 *   [{ from: "postgres:query", event: "filter", to: "viz:render", action: "update" }],
 *   [
 *     { source: "postgres:query", resourceUri: "ui://pg/1", slot: 0 },
 *     { source: "viz:render", resourceUri: "ui://viz/2", slot: 1 },
 *   ],
 * );
 * // result.rules[0] === { from: 0, event: "filter", to: 1, action: "update" }
 * ```
 */
export function resolveSyncRules(
  rules: UiSyncRule[],
  resources: CollectedUiResource[],
): ResolutionResult {
  const toolToSlot = new Map<string, number>();
  for (const resource of resources) {
    toolToSlot.set(resource.source, resource.slot);
  }

  const resolved: ResolvedSyncRule[] = [];
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];
    const fromSlot = toolToSlot.get(rule.from);
    const isBroadcast = rule.to === "*";
    const toSlot = isBroadcast ? ("*" as const) : toolToSlot.get(rule.to);

    if (fromSlot === undefined) {
      issues.push({
        code: ErrorCode.ORPHAN_SYNC_REFERENCE,
        message: `Sync rule references unknown source tool "${rule.from}"`,
        path: `sync[${i}].from`,
      });
      continue;
    }

    if (!isBroadcast && toSlot === undefined) {
      issues.push({
        code: ErrorCode.ORPHAN_SYNC_REFERENCE,
        message: `Sync rule references unknown target tool "${rule.to}"`,
        path: `sync[${i}].to`,
      });
      continue;
    }

    resolved.push({
      from: fromSlot,
      event: rule.event,
      to: toSlot as number | "*",
      action: rule.action,
    });
  }

  return { rules: resolved, issues };
}
