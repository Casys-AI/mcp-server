/**
 * Edge case tests — stress, security, and boundary conditions.
 *
 * @module tests/integration/edge-cases_test
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { createCollector } from "./core/collector/mod.ts";
import { buildCompositeUi } from "./core/composer/mod.ts";
import { renderComposite } from "./host/renderer/mod.ts";
import { resolveSyncRules } from "./core/sync/mod.ts";
import { validateSyncRules } from "./core/sync/mod.ts";
import { ErrorCode } from "./core/types/mod.ts";
import type { CollectedUiResource } from "./core/types/mod.ts";

// =============================================================================
// Very Large Number of Resources (100+)
// =============================================================================

Deno.test("edge case - 100+ resources compose and render correctly", () => {
  const count = 150;
  const resources: CollectedUiResource[] = Array.from({ length: count }, (_, i) => ({
    source: `tool:${i}`,
    resourceUri: `ui://tool/${i}/res`,
    slot: i,
  }));

  const descriptor = buildCompositeUi(resources, { layout: "grid" });

  assertEquals(descriptor.children.length, count);
  assertEquals(descriptor.type, "composite");

  const html = renderComposite(descriptor);

  assertStringIncludes(html, 'data-slot="0"');
  assertStringIncludes(html, 'data-slot="149"');
  assertStringIncludes(html, 'data-source="tool:0"');
  assertStringIncludes(html, 'data-source="tool:149"');
});

Deno.test("edge case - 100+ resources via collector", () => {
  const collector = createCollector();

  for (let i = 0; i < 120; i++) {
    collector.collect(`tool:${i}`, {
      _meta: { ui: { resourceUri: `ui://tool/${i}` } },
    });
  }

  assertEquals(collector.getResources().length, 120);
  assertEquals(collector.getResources()[119].slot, 119);
});

Deno.test("edge case - 100+ sync rules resolve correctly", () => {
  const resources: CollectedUiResource[] = Array.from({ length: 10 }, (_, i) => ({
    source: `tool:${i}`,
    resourceUri: `ui://tool/${i}`,
    slot: i,
  }));

  const rules = Array.from({ length: 100 }, (_, i) => ({
    from: `tool:${i % 10}`,
    event: `event:${i}`,
    to: `tool:${(i + 1) % 10}`,
    action: `action:${i}`,
  }));

  const result = resolveSyncRules(rules, resources);

  assertEquals(result.rules.length, 100);
  assertEquals(result.issues.length, 0);
});

// =============================================================================
// XSS Vectors in Tool Names and Resource URIs
// =============================================================================

Deno.test("edge case - XSS in tool name is escaped in HTML output", () => {
  const xssName = '<img src=x onerror=alert("xss")>';
  const resources: CollectedUiResource[] = [
    { source: xssName, resourceUri: "ui://safe/1", slot: 0 },
  ];

  const descriptor = buildCompositeUi(resources, { layout: "tabs" });
  const html = renderComposite(descriptor);

  // Must NOT contain the raw XSS payload
  assertEquals(html.includes('<img src=x onerror=alert("xss")>'), false);
  // Must contain escaped version
  assertStringIncludes(html, "&lt;img");
});

Deno.test("edge case - XSS in resourceUri is escaped in HTML attributes", () => {
  const xssUri = 'javascript:alert("xss")';
  const resources: CollectedUiResource[] = [
    { source: "safe:tool", resourceUri: xssUri, slot: 0 },
  ];

  const descriptor = buildCompositeUi(resources, { layout: "split" });
  const html = renderComposite(descriptor);

  // The src attribute should have the URI escaped
  assertStringIncludes(html, 'src="javascript:alert(&quot;xss&quot;)"');
});

Deno.test("edge case - script injection in tool name for non-tabs layout", () => {
  const resources: CollectedUiResource[] = [
    { source: '"><script>alert(1)</script><x a="', resourceUri: "ui://test", slot: 0 },
  ];

  const descriptor = buildCompositeUi(resources, { layout: "split" });
  const html = renderComposite(descriptor);

  assertEquals(html.includes("<script>alert(1)</script>"), false);
  assertStringIncludes(html, "&quot;&gt;&lt;script&gt;");
});

Deno.test("edge case - event injection in resourceUri", () => {
  const resources: CollectedUiResource[] = [
    { source: "tool", resourceUri: '" onload="alert(1)" x="', slot: 0 },
  ];

  const descriptor = buildCompositeUi(resources, { layout: "stack" });
  const html = renderComposite(descriptor);

  // Quotes must be escaped so the attribute boundary is preserved
  assertStringIncludes(html, "&quot; onload=&quot;alert(1)&quot; x=&quot;");
});

// =============================================================================
// Empty Orchestration with Resources
// =============================================================================

Deno.test("edge case - resources with undefined orchestration", () => {
  const resources: CollectedUiResource[] = [
    { source: "a", resourceUri: "ui://a", slot: 0 },
    { source: "b", resourceUri: "ui://b", slot: 1 },
  ];

  const descriptor = buildCompositeUi(resources);

  assertEquals(descriptor.layout, "stack");
  assertEquals(descriptor.sync, []);
  assertEquals(descriptor.sharedContext, undefined);
  assertEquals(descriptor.children.length, 2);

  const html = renderComposite(descriptor);
  assertStringIncludes(html, 'class="layout-stack"');
});

Deno.test("edge case - orchestration with empty sync array", () => {
  const resources: CollectedUiResource[] = [
    { source: "a", resourceUri: "ui://a", slot: 0 },
  ];

  const descriptor = buildCompositeUi(resources, { layout: "grid", sync: [] });

  assertEquals(descriptor.sync, []);
});

Deno.test("edge case - orchestration with empty sharedContext array", () => {
  const resources: CollectedUiResource[] = [
    { source: "a", resourceUri: "ui://a", slot: 0, context: { foo: "bar" } },
  ];

  const descriptor = buildCompositeUi(resources, {
    layout: "stack",
    sharedContext: [],
  });

  assertEquals(descriptor.sharedContext, undefined);
});

// =============================================================================
// Self-Reference Sync Rules (from === to)
// =============================================================================

Deno.test("edge case - self-reference sync rule detected by validator", () => {
  const result = validateSyncRules(
    [{ from: "a", event: "click", to: "a", action: "update" }],
    ["a"],
  );

  assertEquals(result.valid, false);
  assertEquals(result.issues.length, 1);
  assertEquals(result.issues[0].code, ErrorCode.CIRCULAR_SYNC_RULE);
  assertStringIncludes(result.issues[0].message, '"a"');
  assertStringIncludes(result.issues[0].message, "circular");
});

Deno.test("edge case - self-reference sync rule is resolved (composer is tolerant)", () => {
  const resources: CollectedUiResource[] = [
    { source: "a", resourceUri: "ui://a", slot: 0 },
  ];

  // resolveSyncRules doesn't check for circularity — that's the validator's job
  const result = resolveSyncRules(
    [{ from: "a", event: "click", to: "a", action: "update" }],
    resources,
  );

  assertEquals(result.rules.length, 1);
  assertEquals(result.rules[0].from, 0);
  assertEquals(result.rules[0].to, 0);
});

Deno.test("edge case - multiple self-reference rules all flagged", () => {
  const result = validateSyncRules(
    [
      { from: "a", event: "click", to: "a", action: "update" },
      { from: "b", event: "hover", to: "b", action: "highlight" },
    ],
    ["a", "b"],
  );

  assertEquals(result.valid, false);
  assertEquals(result.issues.length, 2);
  assertEquals(result.issues[0].code, ErrorCode.CIRCULAR_SYNC_RULE);
  assertEquals(result.issues[1].code, ErrorCode.CIRCULAR_SYNC_RULE);
});

// =============================================================================
// Unicode in Source Names
// =============================================================================

Deno.test("edge case - unicode tool names in collector", () => {
  const collector = createCollector();

  const r = collector.collect("日本語:ツール", {
    _meta: { ui: { resourceUri: "ui://jp/1" } },
  });

  assertEquals(r?.source, "日本語:ツール");
  assertEquals(r?.slot, 0);
});

Deno.test("edge case - unicode tool names render correctly in HTML", () => {
  const resources: CollectedUiResource[] = [
    { source: "données:requête", resourceUri: "ui://fr/données", slot: 0 },
    { source: "визуализация:график", resourceUri: "ui://ru/viz", slot: 1 },
  ];

  const descriptor = buildCompositeUi(resources, { layout: "tabs" });
  const html = renderComposite(descriptor);

  assertStringIncludes(html, "données:requête");
  assertStringIncludes(html, "визуализация:график");
});

Deno.test("edge case - emoji in tool names", () => {
  const resources: CollectedUiResource[] = [
    { source: "🔥:fire-tool", resourceUri: "ui://emoji/1", slot: 0 },
  ];

  const descriptor = buildCompositeUi(resources, { layout: "stack" });
  const html = renderComposite(descriptor);

  assertStringIncludes(html, "🔥:fire-tool");
});

Deno.test("edge case - unicode in sync rules resolves correctly", () => {
  const resources: CollectedUiResource[] = [
    { source: "données:入力", resourceUri: "ui://mixed/1", slot: 0 },
    { source: "出力:résultat", resourceUri: "ui://mixed/2", slot: 1 },
  ];

  const result = resolveSyncRules(
    [{ from: "données:入力", event: "submit", to: "出力:résultat", action: "display" }],
    resources,
  );

  assertEquals(result.rules.length, 1);
  assertEquals(result.rules[0].from, 0);
  assertEquals(result.rules[0].to, 1);
  assertEquals(result.issues.length, 0);
});

Deno.test("edge case - unicode in resourceUri", () => {
  const collector = createCollector();

  const r = collector.collect("tool", {
    _meta: { ui: { resourceUri: "ui://café/données/été" } },
  });

  assertEquals(r?.resourceUri, "ui://café/données/été");
});

// =============================================================================
// Mixed Edge Cases
// =============================================================================

Deno.test("edge case - resources with no context in sharedContext extraction", () => {
  const resources: CollectedUiResource[] = [
    { source: "a", resourceUri: "ui://a", slot: 0 },
    { source: "b", resourceUri: "ui://b", slot: 1 },
  ];

  const descriptor = buildCompositeUi(resources, {
    layout: "split",
    sharedContext: ["workflowId"],
  });

  assertEquals(descriptor.sharedContext, undefined);
});

Deno.test("edge case - single resource with all 4 layouts", () => {
  const layouts = ["split", "tabs", "grid", "stack"] as const;
  const resources: CollectedUiResource[] = [
    { source: "solo", resourceUri: "ui://solo", slot: 0 },
  ];

  for (const layout of layouts) {
    const descriptor = buildCompositeUi(resources, { layout });
    const html = renderComposite(descriptor);

    assertStringIncludes(html, `class="layout-${layout}"`);
    assertStringIncludes(html, "ui://solo");
  }
});
