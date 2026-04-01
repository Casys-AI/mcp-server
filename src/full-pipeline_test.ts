/**
 * Integration tests — full pipeline: Collector -> Composer -> Renderer.
 *
 * @module tests/integration/full-pipeline_test
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { createCollector } from "./core/collector/mod.ts";
import { buildCompositeUi } from "./core/composer/mod.ts";
import { renderComposite } from "./host/renderer/mod.ts";
import { validateSyncRules } from "./core/sync/mod.ts";
import {
  DATE_FILTER_DASHBOARD_RESOURCES,
  SALES_DASHBOARD_RESOURCES,
  SAMPLE_TOOL_RESULTS,
  SINGLE_RESOURCE,
} from "./test-fixtures/sample-resources.ts";
import {
  DATE_FILTER_ORCHESTRATION,
  INDEPENDENT_TABS_ORCHESTRATION,
  SALES_DASHBOARD_ORCHESTRATION,
  SIMPLE_STACK_ORCHESTRATION,
} from "./test-fixtures/sample-orchestrations.ts";

// =============================================================================
// Full Pipeline: Collector -> Composer -> Renderer
// =============================================================================

Deno.test("full pipeline - collector to rendered HTML", () => {
  // 1. Collect
  const collector = createCollector();
  collector.collect(
    "postgres:query",
    SAMPLE_TOOL_RESULTS.withUi,
    { query: "SELECT * FROM users" },
  );
  collector.collect(
    "viz:render",
    {
      content: [{ type: "text", text: "Chart rendered" }],
      _meta: { ui: { resourceUri: "ui://viz/chart/viz-1" } },
    },
  );
  // This one should be skipped (no UI metadata)
  collector.collect("logger:log", SAMPLE_TOOL_RESULTS.withoutUi);

  const resources = collector.getResources();
  assertEquals(resources.length, 2);
  assertEquals(resources[0].slot, 0);
  assertEquals(resources[1].slot, 1);

  // 2. Compose
  const descriptor = buildCompositeUi(resources, {
    layout: "split",
    sync: [
      { from: "postgres:query", event: "filter", to: "viz:render", action: "update" },
    ],
  });

  assertEquals(descriptor.type, "composite");
  assertEquals(descriptor.layout, "split");
  assertEquals(descriptor.children.length, 2);
  assertEquals(descriptor.sync.length, 1);
  assertEquals(descriptor.sync[0].from, 0);
  assertEquals(descriptor.sync[0].to, 1);

  // 3. Render
  const html = renderComposite(descriptor);

  assertStringIncludes(html, "<!DOCTYPE html>");
  assertStringIncludes(html, 'class="layout-split"');
  assertStringIncludes(html, 'src="ui://postgres/table/abc123"');
  assertStringIncludes(html, 'src="ui://viz/chart/viz-1"');
  assertStringIncludes(html, '"from":0');
  assertStringIncludes(html, '"to":1');
  assertStringIncludes(html, "ui/initialize");
  assertStringIncludes(html, "ui/update-model-context");
});

// =============================================================================
// Pre-built Resources Pipeline
// =============================================================================

Deno.test("full pipeline - sales dashboard (split layout + sync)", () => {
  const descriptor = buildCompositeUi(
    SALES_DASHBOARD_RESOURCES,
    SALES_DASHBOARD_ORCHESTRATION,
  );

  assertEquals(descriptor.layout, "split");
  assertEquals(descriptor.sync.length, 1);
  assertEquals(descriptor.sync[0], { from: 0, event: "filter", to: 1, action: "update" });
  assertEquals(descriptor.sharedContext?.workflowId, "wf-001");

  const html = renderComposite(descriptor);

  assertStringIncludes(html, 'class="layout-split"');
  assertStringIncludes(html, 'data-source="postgres:query"');
  assertStringIncludes(html, 'data-source="viz:render"');
  assertStringIncludes(html, '"workflowId":"wf-001"');
});

Deno.test("full pipeline - date filter dashboard (grid + broadcast)", () => {
  const descriptor = buildCompositeUi(
    DATE_FILTER_DASHBOARD_RESOURCES,
    DATE_FILTER_ORCHESTRATION,
  );

  assertEquals(descriptor.layout, "grid");
  assertEquals(descriptor.sync.length, 1);
  assertEquals(descriptor.sync[0].from, 0);
  assertEquals(descriptor.sync[0].to, "*");
  assertEquals(descriptor.sync[0].action, "refresh");
  assertEquals(descriptor.sharedContext?.userId, "u-42");

  const html = renderComposite(descriptor);

  assertStringIncludes(html, 'class="layout-grid"');
  assertStringIncludes(html, "display: grid");
  assertStringIncludes(html, '"to":"*"');
});

Deno.test("full pipeline - independent tabs (no sync)", () => {
  const descriptor = buildCompositeUi(
    SALES_DASHBOARD_RESOURCES,
    INDEPENDENT_TABS_ORCHESTRATION,
  );

  assertEquals(descriptor.layout, "tabs");
  assertEquals(descriptor.sync, []);

  const html = renderComposite(descriptor);

  assertStringIncludes(html, 'class="layout-tabs"');
  assertStringIncludes(html, "tab-bar");
  assertStringIncludes(html, 'class="tab active"');
  assertStringIncludes(html, "switchTab");
});

Deno.test("full pipeline - single resource (stack)", () => {
  const descriptor = buildCompositeUi(SINGLE_RESOURCE, SIMPLE_STACK_ORCHESTRATION);

  assertEquals(descriptor.children.length, 1);
  assertEquals(descriptor.layout, "stack");

  const html = renderComposite(descriptor);

  assertStringIncludes(html, 'class="layout-stack"');
  assertStringIncludes(html, 'src="ui://editor/code/ed-1"');
});

Deno.test("full pipeline - empty resources", () => {
  const descriptor = buildCompositeUi([]);

  assertEquals(descriptor.children.length, 0);
  assertEquals(descriptor.layout, "stack");

  const html = renderComposite(descriptor);

  assertStringIncludes(html, "<!DOCTYPE html>");
  assertEquals(html.includes("<iframe"), false);
});

// =============================================================================
// Validation Integration
// =============================================================================

Deno.test("full pipeline - validation detects issues before composition", () => {
  const rules = SALES_DASHBOARD_ORCHESTRATION.sync!;
  const knownSources = DATE_FILTER_DASHBOARD_RESOURCES.map((r) => r.source);

  const result = validateSyncRules(rules, knownSources);

  assertEquals(result.valid, false);
  assertEquals(result.issues.length, 2); // both postgres:query and viz:render unknown
});

Deno.test("full pipeline - validation passes for correct config", () => {
  const rules = SALES_DASHBOARD_ORCHESTRATION.sync!;
  const knownSources = SALES_DASHBOARD_RESOURCES.map((r) => r.source);

  const result = validateSyncRules(rules, knownSources);

  assertEquals(result.valid, true);
  assertEquals(result.issues.length, 0);
});

// =============================================================================
// Determinism Test
// =============================================================================

Deno.test("full pipeline - same inputs produce same HTML (except workflow UUID)", () => {
  const html1 = renderComposite(
    buildCompositeUi(SALES_DASHBOARD_RESOURCES, SALES_DASHBOARD_ORCHESTRATION),
  );
  const html2 = renderComposite(
    buildCompositeUi(SALES_DASHBOARD_RESOURCES, SALES_DASHBOARD_ORCHESTRATION),
  );

  // The only difference should be the workflow UUID in resourceUri
  const normalize = (h: string) => h.replace(/ui:\/\/mcp-compose\/workflow\/[a-f0-9-]+/g, "UUID");
  assertEquals(normalize(html1), normalize(html2));
});
