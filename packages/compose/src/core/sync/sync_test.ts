/**
 * Tests for the sync rule engine (resolver + validator).
 *
 * @module sync/sync_test
 */

import { assertEquals } from "@std/assert";
import { resolveSyncRules } from "./resolver.ts";
import { validateSyncRules } from "./validator.ts";
import { ErrorCode } from "../types/errors.ts";
import type { CollectedUiResource } from "../types/resources.ts";
import type { UiSyncRule } from "../types/sync-rules.ts";

// =============================================================================
// resolveSyncRules Tests
// =============================================================================

Deno.test("resolveSyncRules - resolves tool names to slot indices", () => {
  const resources: CollectedUiResource[] = [
    { source: "postgres:query", resourceUri: "ui://pg/1", slot: 0 },
    { source: "viz:render", resourceUri: "ui://viz/2", slot: 1 },
  ];
  const rules: UiSyncRule[] = [
    { from: "postgres:query", event: "filter", to: "viz:render", action: "update" },
  ];

  const result = resolveSyncRules(rules, resources);

  assertEquals(result.rules.length, 1);
  assertEquals(result.rules[0].from, 0);
  assertEquals(result.rules[0].event, "filter");
  assertEquals(result.rules[0].to, 1);
  assertEquals(result.rules[0].action, "update");
  assertEquals(result.issues.length, 0);
});

Deno.test("resolveSyncRules - preserves broadcast marker '*'", () => {
  const resources: CollectedUiResource[] = [
    { source: "date:picker", resourceUri: "ui://date", slot: 0 },
    { source: "table:view", resourceUri: "ui://table", slot: 1 },
    { source: "chart:view", resourceUri: "ui://chart", slot: 2 },
  ];
  const rules: UiSyncRule[] = [
    { from: "date:picker", event: "change", to: "*", action: "refresh" },
  ];

  const result = resolveSyncRules(rules, resources);

  assertEquals(result.rules.length, 1);
  assertEquals(result.rules[0].from, 0);
  assertEquals(result.rules[0].to, "*");
  assertEquals(result.rules[0].action, "refresh");
  assertEquals(result.issues.length, 0);
});

Deno.test("resolveSyncRules - reports orphan source reference", () => {
  const resources: CollectedUiResource[] = [
    { source: "known:tool", resourceUri: "ui://known", slot: 0 },
  ];
  const rules: UiSyncRule[] = [
    { from: "unknown:tool", event: "test", to: "known:tool", action: "update" },
  ];

  const result = resolveSyncRules(rules, resources);

  assertEquals(result.rules.length, 0);
  assertEquals(result.issues.length, 1);
  assertEquals(result.issues[0].code, ErrorCode.ORPHAN_SYNC_REFERENCE);
  assertEquals(result.issues[0].path, "sync[0].from");
});

Deno.test("resolveSyncRules - reports orphan target reference", () => {
  const resources: CollectedUiResource[] = [
    { source: "known:tool", resourceUri: "ui://known", slot: 0 },
  ];
  const rules: UiSyncRule[] = [
    { from: "known:tool", event: "test", to: "missing:tool", action: "update" },
  ];

  const result = resolveSyncRules(rules, resources);

  assertEquals(result.rules.length, 0);
  assertEquals(result.issues.length, 1);
  assertEquals(result.issues[0].code, ErrorCode.ORPHAN_SYNC_REFERENCE);
  assertEquals(result.issues[0].path, "sync[0].to");
});

Deno.test("resolveSyncRules - handles empty rules array", () => {
  const resources: CollectedUiResource[] = [
    { source: "a", resourceUri: "ui://a", slot: 0 },
  ];

  const result = resolveSyncRules([], resources);

  assertEquals(result.rules.length, 0);
  assertEquals(result.issues.length, 0);
});

Deno.test("resolveSyncRules - handles multiple rules", () => {
  const resources: CollectedUiResource[] = [
    { source: "a", resourceUri: "ui://a", slot: 0 },
    { source: "b", resourceUri: "ui://b", slot: 1 },
    { source: "c", resourceUri: "ui://c", slot: 2 },
  ];
  const rules: UiSyncRule[] = [
    { from: "a", event: "click", to: "b", action: "highlight" },
    { from: "b", event: "select", to: "c", action: "update" },
  ];

  const result = resolveSyncRules(rules, resources);

  assertEquals(result.rules.length, 2);
  assertEquals(result.rules[0], { from: 0, event: "click", to: 1, action: "highlight" });
  assertEquals(result.rules[1], { from: 1, event: "select", to: 2, action: "update" });
});

Deno.test("resolveSyncRules - skips rule with orphan and resolves valid ones", () => {
  const resources: CollectedUiResource[] = [
    { source: "a", resourceUri: "ui://a", slot: 0 },
    { source: "b", resourceUri: "ui://b", slot: 1 },
  ];
  const rules: UiSyncRule[] = [
    { from: "a", event: "click", to: "b", action: "update" },
    { from: "unknown", event: "x", to: "b", action: "y" },
  ];

  const result = resolveSyncRules(rules, resources);

  assertEquals(result.rules.length, 1);
  assertEquals(result.issues.length, 1);
  assertEquals(result.rules[0].from, 0);
  assertEquals(result.rules[0].to, 1);
});

// =============================================================================
// validateSyncRules Tests
// =============================================================================

Deno.test("validateSyncRules - returns valid for correct rules", () => {
  const rules: UiSyncRule[] = [
    { from: "a", event: "click", to: "b", action: "update" },
  ];

  const result = validateSyncRules(rules, ["a", "b"]);

  assertEquals(result.valid, true);
  assertEquals(result.issues.length, 0);
});

Deno.test("validateSyncRules - detects orphan source", () => {
  const rules: UiSyncRule[] = [
    { from: "unknown", event: "click", to: "a", action: "update" },
  ];

  const result = validateSyncRules(rules, ["a"]);

  assertEquals(result.valid, false);
  assertEquals(result.issues.length, 1);
  assertEquals(result.issues[0].code, ErrorCode.ORPHAN_SYNC_REFERENCE);
  assertEquals(result.issues[0].path, "sync[0].from");
});

Deno.test("validateSyncRules - detects orphan target", () => {
  const rules: UiSyncRule[] = [
    { from: "a", event: "click", to: "unknown", action: "update" },
  ];

  const result = validateSyncRules(rules, ["a"]);

  assertEquals(result.valid, false);
  assertEquals(result.issues.length, 1);
  assertEquals(result.issues[0].code, ErrorCode.ORPHAN_SYNC_REFERENCE);
  assertEquals(result.issues[0].path, "sync[0].to");
});

Deno.test("validateSyncRules - detects circular route", () => {
  const rules: UiSyncRule[] = [
    { from: "a", event: "click", to: "a", action: "update" },
  ];

  const result = validateSyncRules(rules, ["a"]);

  assertEquals(result.valid, false);
  assertEquals(result.issues.length, 1);
  assertEquals(result.issues[0].code, ErrorCode.CIRCULAR_SYNC_RULE);
  assertEquals(result.issues[0].path, "sync[0]");
});

Deno.test("validateSyncRules - broadcast to '*' is not circular", () => {
  const rules: UiSyncRule[] = [
    { from: "a", event: "change", to: "*", action: "refresh" },
  ];

  const result = validateSyncRules(rules, ["a"]);

  assertEquals(result.valid, true);
  assertEquals(result.issues.length, 0);
});

Deno.test("validateSyncRules - reports multiple issues", () => {
  const rules: UiSyncRule[] = [
    { from: "unknown1", event: "x", to: "unknown2", action: "y" },
  ];

  const result = validateSyncRules(rules, ["a"]);

  assertEquals(result.valid, false);
  assertEquals(result.issues.length, 2);
});

Deno.test("validateSyncRules - handles empty rules", () => {
  const result = validateSyncRules([], ["a"]);

  assertEquals(result.valid, true);
  assertEquals(result.issues.length, 0);
});

Deno.test("validateSyncRules - handles empty known sources", () => {
  const rules: UiSyncRule[] = [
    { from: "a", event: "x", to: "b", action: "y" },
  ];

  const result = validateSyncRules(rules, []);

  assertEquals(result.valid, false);
  assertEquals(result.issues.length, 2);
});
