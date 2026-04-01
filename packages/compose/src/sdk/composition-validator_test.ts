/**
 * Tests for the validateComposition() helper.
 *
 * @module sdk/composition-validator_test
 */

import { assertEquals } from "@std/assert";
import { validateComposition } from "./composition-validator.ts";
import type { CompositionIssue, CompositionValidationResult } from "./composition-validator.ts";
import { uiMeta } from "./ui-meta-builder.ts";

// Helper to build tool definitions with uiMeta
function tool(name: string, opts: Parameters<typeof uiMeta>[0]) {
  return { name, ...uiMeta(opts) };
}

// --- Valid compositions ---

Deno.test("validateComposition - valid composition returns no issues", () => {
  const tools = [
    tool("erp:customers", {
      resourceUri: "ui://erp/customers",
      emits: ["rowSelected"],
      accepts: ["setFilter"],
    }),
    tool("viz:chart", {
      resourceUri: "ui://viz/chart",
      emits: ["setFilter"],
      accepts: ["rowSelected"],
    }),
  ];
  const syncRules = [
    { from: "erp:customers", event: "rowSelected", to: "viz:chart", action: "rowSelected" },
    { from: "viz:chart", event: "setFilter", to: "erp:customers", action: "setFilter" },
  ];

  const result = validateComposition(tools, syncRules);

  assertEquals(result.valid, true);
  assertEquals(result.issues.length, 0);
});

Deno.test("validateComposition - empty inputs are valid", () => {
  const result = validateComposition([], []);

  assertEquals(result.valid, true);
  assertEquals(result.issues.length, 0);
});

// --- Orphan emits ---

Deno.test("validateComposition - detects orphan emits (no sync rule routes them)", () => {
  const tools = [
    tool("erp:customers", {
      resourceUri: "ui://erp/customers",
      emits: ["rowSelected", "filterChanged"],
    }),
    tool("viz:chart", {
      resourceUri: "ui://viz/chart",
      accepts: ["rowSelected"],
    }),
  ];
  const syncRules = [
    { from: "erp:customers", event: "rowSelected", to: "viz:chart", action: "highlight" },
  ];

  const result = validateComposition(tools, syncRules);

  assertEquals(result.valid, false);
  const orphanEmit = result.issues.find(
    (i) => i.code === "ORPHAN_EMIT" && i.message.includes("filterChanged"),
  );
  assertEquals(orphanEmit !== undefined, true);
});

// --- Orphan accepts ---

Deno.test("validateComposition - detects orphan accepts (no sync rule targets them)", () => {
  const tools = [
    tool("erp:customers", {
      resourceUri: "ui://erp/customers",
      emits: ["rowSelected"],
    }),
    tool("viz:chart", {
      resourceUri: "ui://viz/chart",
      accepts: ["rowSelected", "highlightRow"],
    }),
  ];
  const syncRules = [
    { from: "erp:customers", event: "rowSelected", to: "viz:chart", action: "highlight" },
  ];

  const result = validateComposition(tools, syncRules);

  assertEquals(result.valid, false);
  const orphanAccept = result.issues.find(
    (i) => i.code === "ORPHAN_ACCEPT" && i.message.includes("highlightRow"),
  );
  assertEquals(orphanAccept !== undefined, true);
});

// --- Mismatched sync rules ---

Deno.test("validateComposition - detects sync rule event not in source emits", () => {
  const tools = [
    tool("erp:customers", {
      resourceUri: "ui://erp/customers",
      emits: ["rowSelected"],
    }),
    tool("viz:chart", {
      resourceUri: "ui://viz/chart",
      accepts: ["unknownEvent"],
    }),
  ];
  const syncRules = [
    { from: "erp:customers", event: "unknownEvent", to: "viz:chart", action: "update" },
  ];

  const result = validateComposition(tools, syncRules);

  assertEquals(result.valid, false);
  const mismatch = result.issues.find(
    (i) => i.code === "SYNC_EVENT_NOT_EMITTED",
  );
  assertEquals(mismatch !== undefined, true);
});

Deno.test("validateComposition - detects sync rule action not in target accepts", () => {
  const tools = [
    tool("erp:customers", {
      resourceUri: "ui://erp/customers",
      emits: ["rowSelected"],
    }),
    tool("viz:chart", {
      resourceUri: "ui://viz/chart",
      accepts: ["highlight"],
    }),
  ];
  const syncRules = [
    { from: "erp:customers", event: "rowSelected", to: "viz:chart", action: "unknownAction" },
  ];

  const result = validateComposition(tools, syncRules);

  assertEquals(result.valid, false);
  const mismatch = result.issues.find(
    (i) => i.code === "SYNC_ACTION_NOT_ACCEPTED",
  );
  assertEquals(mismatch !== undefined, true);
});

// --- Structural validation (delegates to core) ---

Deno.test("validateComposition - detects unknown tool in sync rule (from)", () => {
  const tools = [
    tool("erp:customers", { resourceUri: "ui://erp/customers" }),
  ];
  const syncRules = [
    { from: "unknown:tool", event: "click", to: "erp:customers", action: "update" },
  ];

  const result = validateComposition(tools, syncRules);

  assertEquals(result.valid, false);
  const issue = result.issues.find((i) => i.code === "ORPHAN_SYNC_REFERENCE");
  assertEquals(issue !== undefined, true);
});

Deno.test("validateComposition - detects unknown tool in sync rule (to)", () => {
  const tools = [
    tool("erp:customers", { resourceUri: "ui://erp/customers" }),
  ];
  const syncRules = [
    { from: "erp:customers", event: "click", to: "unknown:tool", action: "update" },
  ];

  const result = validateComposition(tools, syncRules);

  assertEquals(result.valid, false);
  const issue = result.issues.find((i) => i.code === "ORPHAN_SYNC_REFERENCE");
  assertEquals(issue !== undefined, true);
});

// --- Tools without emits/accepts skip semantic checks ---

Deno.test("validateComposition - tools without emits/accepts skip semantic checks gracefully", () => {
  const tools = [
    tool("erp:customers", { resourceUri: "ui://erp/customers" }),
    tool("viz:chart", { resourceUri: "ui://viz/chart" }),
  ];
  const syncRules = [
    { from: "erp:customers", event: "click", to: "viz:chart", action: "update" },
  ];

  const result = validateComposition(tools, syncRules);

  assertEquals(result.valid, true);
  assertEquals(result.issues.length, 0);
});

// --- Broadcast rules ---

Deno.test("validateComposition - broadcast rules validate emits but not target accepts", () => {
  const tools = [
    tool("date-picker", {
      resourceUri: "ui://date/picker",
      emits: ["change"],
    }),
    tool("erp:customers", {
      resourceUri: "ui://erp/customers",
      accepts: ["refresh"],
    }),
    tool("viz:chart", {
      resourceUri: "ui://viz/chart",
      accepts: ["refresh"],
    }),
  ];
  const syncRules = [
    { from: "date-picker", event: "change", to: "*", action: "refresh" },
  ];

  const result = validateComposition(tools, syncRules);

  assertEquals(result.valid, true);
});

Deno.test("validateComposition - broadcast rule event not emitted is detected", () => {
  const tools = [
    tool("date-picker", {
      resourceUri: "ui://date/picker",
      emits: ["select"],
    }),
    tool("erp:customers", { resourceUri: "ui://erp/customers" }),
  ];
  const syncRules = [
    { from: "date-picker", event: "change", to: "*", action: "refresh" },
  ];

  const result = validateComposition(tools, syncRules);

  assertEquals(result.valid, false);
  const issue = result.issues.find((i) => i.code === "SYNC_EVENT_NOT_EMITTED");
  assertEquals(issue !== undefined, true);
});

// --- Multiple issues ---

Deno.test("validateComposition - accumulates multiple issues", () => {
  const tools = [
    tool("a", {
      resourceUri: "ui://a",
      emits: ["x", "y"],
      accepts: ["z"],
    }),
    tool("b", {
      resourceUri: "ui://b",
      emits: ["w"],
      accepts: ["q"],
    }),
  ];
  // No sync rules at all — all emits and accepts are orphaned
  const syncRules: Parameters<typeof validateComposition>[1] = [];

  const result = validateComposition(tools, syncRules);

  assertEquals(result.valid, false);
  // Should have orphan emits for x, y, w and orphan accepts for z, q
  assertEquals(result.issues.length >= 5, true);
});
