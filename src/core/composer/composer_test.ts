/**
 * Tests for the composer module.
 *
 * @module composer/composer_test
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { buildCompositeUi } from "./composer.ts";
import type { CollectedUiResource } from "../types/resources.ts";
import type { UiOrchestration } from "../types/orchestration.ts";

Deno.test("buildCompositeUi - creates descriptor with correct type and resourceUri", () => {
  const resources: CollectedUiResource[] = [
    { source: "tool:a", resourceUri: "ui://a", slot: 0 },
  ];

  const result = buildCompositeUi(resources);

  assertEquals(result.type, "composite");
  assertStringIncludes(result.resourceUri, "ui://mcp-compose/workflow/");
  const uuid = result.resourceUri.split("/").pop()!;
  assertEquals(uuid.length, 36);
});

Deno.test("buildCompositeUi - resolves sync rules to slot indices", () => {
  const resources: CollectedUiResource[] = [
    { source: "postgres:query", resourceUri: "ui://pg/1", slot: 0 },
    { source: "viz:render", resourceUri: "ui://viz/2", slot: 1 },
  ];
  const orchestration: UiOrchestration = {
    layout: "split",
    sync: [{ from: "postgres:query", event: "filter", to: "viz:render", action: "update" }],
  };

  const result = buildCompositeUi(resources, orchestration);

  assertEquals(result.layout, "split");
  assertEquals(result.children.length, 2);
  assertEquals(result.sync.length, 1);
  assertEquals(result.sync[0].from, 0);
  assertEquals(result.sync[0].to, 1);
  assertEquals(result.sync[0].event, "filter");
  assertEquals(result.sync[0].action, "update");
});

Deno.test("buildCompositeUi - defaults to stack layout without orchestration", () => {
  const resources: CollectedUiResource[] = [
    { source: "a", resourceUri: "ui://a", slot: 0 },
    { source: "b", resourceUri: "ui://b", slot: 1 },
  ];

  const result = buildCompositeUi(resources);

  assertEquals(result.layout, "stack");
  assertEquals(result.sync, []);
});

Deno.test("buildCompositeUi - preserves broadcast marker '*'", () => {
  const resources: CollectedUiResource[] = [
    { source: "date:picker", resourceUri: "ui://date", slot: 0 },
    { source: "table:view", resourceUri: "ui://table", slot: 1 },
    { source: "chart:view", resourceUri: "ui://chart", slot: 2 },
  ];
  const orchestration: UiOrchestration = {
    layout: "split",
    sync: [{ from: "date:picker", event: "change", to: "*", action: "refresh" }],
  };

  const result = buildCompositeUi(resources, orchestration);

  assertEquals(result.sync[0].from, 0);
  assertEquals(result.sync[0].to, "*");
  assertEquals(result.sync[0].action, "refresh");
});

Deno.test("buildCompositeUi - excludes rules with unknown tool names", () => {
  const resources: CollectedUiResource[] = [
    { source: "known:tool", resourceUri: "ui://known", slot: 0 },
  ];
  const orchestration: UiOrchestration = {
    layout: "stack",
    sync: [{ from: "unknown:tool", event: "test", to: "known:tool", action: "update" }],
  };

  const result = buildCompositeUi(resources, orchestration);

  assertEquals(result.sync.length, 0);
});

Deno.test("buildCompositeUi - maintains children order", () => {
  const resources: CollectedUiResource[] = [
    { source: "first", resourceUri: "ui://1", slot: 0 },
    { source: "second", resourceUri: "ui://2", slot: 1 },
    { source: "third", resourceUri: "ui://3", slot: 2 },
  ];

  const result = buildCompositeUi(resources, { layout: "grid" });

  assertEquals(result.children.length, 3);
  assertEquals(result.children[0].source, "first");
  assertEquals(result.children[1].source, "second");
  assertEquals(result.children[2].source, "third");
});

Deno.test("buildCompositeUi - handles empty resources", () => {
  const result = buildCompositeUi([], { layout: "stack" });

  assertEquals(result.type, "composite");
  assertEquals(result.children.length, 0);
  assertEquals(result.sync, []);
});

// =============================================================================
// Shared Context Tests
// =============================================================================

Deno.test("buildCompositeUi - extracts sharedContext from resources", () => {
  const resources: CollectedUiResource[] = [
    {
      source: "postgres:query",
      resourceUri: "ui://pg/1",
      slot: 0,
      context: { workflowId: "wf-123", query: "SELECT *" },
    },
    {
      source: "viz:render",
      resourceUri: "ui://viz/2",
      slot: 1,
      context: { userId: "user-456", chartType: "bar" },
    },
  ];
  const orchestration: UiOrchestration = {
    layout: "split",
    sharedContext: ["workflowId", "userId"],
  };

  const result = buildCompositeUi(resources, orchestration);

  assertEquals(result.sharedContext?.workflowId, "wf-123");
  assertEquals(result.sharedContext?.userId, "user-456");
  assertEquals(result.sharedContext?.query, undefined);
  assertEquals(result.sharedContext?.chartType, undefined);
});

Deno.test("buildCompositeUi - sharedContext undefined when no keys specified", () => {
  const resources: CollectedUiResource[] = [
    { source: "a", resourceUri: "ui://a", slot: 0, context: { foo: "bar" } },
  ];

  const result = buildCompositeUi(resources);

  assertEquals(result.sharedContext, undefined);
});

Deno.test("buildCompositeUi - sharedContext undefined when no matching keys", () => {
  const resources: CollectedUiResource[] = [
    { source: "a", resourceUri: "ui://a", slot: 0, context: { foo: "bar" } },
  ];

  const result = buildCompositeUi(resources, { layout: "stack", sharedContext: ["missing"] });

  assertEquals(result.sharedContext, undefined);
});

Deno.test("buildCompositeUi - sharedContext first value wins for duplicate keys", () => {
  const resources: CollectedUiResource[] = [
    { source: "a", resourceUri: "ui://a", slot: 0, context: { sessionId: "first" } },
    { source: "b", resourceUri: "ui://b", slot: 1, context: { sessionId: "second" } },
  ];

  const result = buildCompositeUi(resources, {
    layout: "split",
    sharedContext: ["sessionId"],
  });

  assertEquals(result.sharedContext?.sessionId, "first");
});
