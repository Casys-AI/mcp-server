/**
 * Sync rule validator — checks rules for structural issues.
 *
 * @module sync/validator
 */

import type { UiSyncRule } from "../types/sync-rules.ts";
import type { ValidationIssue, ValidationResult } from "../types/errors.ts";
import { ErrorCode } from "../types/errors.ts";

/**
 * Validate sync rules against known tool sources.
 *
 * Checks for:
 * - Orphan references (tool names not in `knownSources`)
 * - Circular routes (`from === to` for non-broadcast rules)
 *
 * @param rules - Sync rules to validate
 * @param knownSources - Known tool names from collected resources
 * @returns Validation result with any issues found
 *
 * @example
 * ```typescript
 * const result = validateSyncRules(
 *   [{ from: "a", event: "click", to: "b", action: "update" }],
 *   ["a", "b"],
 * );
 * // result.valid === true
 * ```
 *
 * @example Detecting orphan references
 * ```typescript
 * const result = validateSyncRules(
 *   [{ from: "unknown", event: "click", to: "a", action: "update" }],
 *   ["a"],
 * );
 * // result.valid === false
 * // result.issues[0].code === ErrorCode.ORPHAN_SYNC_REFERENCE
 * ```
 */
export function validateSyncRules(
  rules: UiSyncRule[],
  knownSources: string[],
): ValidationResult {
  const known = new Set(knownSources);
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i];

    if (!known.has(rule.from)) {
      issues.push({
        code: ErrorCode.ORPHAN_SYNC_REFERENCE,
        message: `Sync rule references unknown source "${rule.from}"`,
        path: `sync[${i}].from`,
      });
    }

    if (rule.to !== "*" && !known.has(rule.to)) {
      issues.push({
        code: ErrorCode.ORPHAN_SYNC_REFERENCE,
        message: `Sync rule references unknown target "${rule.to}"`,
        path: `sync[${i}].to`,
      });
    }

    if (rule.to !== "*" && rule.from === rule.to) {
      issues.push({
        code: ErrorCode.CIRCULAR_SYNC_RULE,
        message: `Sync rule has circular route: "${rule.from}" -> "${rule.to}"`,
        path: `sync[${i}]`,
      });
    }
  }

  return { valid: issues.length === 0, issues };
}
