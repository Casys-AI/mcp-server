/**
 * Sample UI resources for tests.
 *
 * @module tests/fixtures/sample-resources
 */

import type { CollectedUiResource } from "../core/types/resources.ts";

/** Two-panel dashboard: SQL query + chart visualization. */
export const SALES_DASHBOARD_RESOURCES: CollectedUiResource[] = [
  {
    source: "postgres:query",
    resourceUri: "ui://postgres/table/sales-q1",
    context: { query: "SELECT * FROM sales WHERE quarter = 'Q1'", workflowId: "wf-001" },
    slot: 0,
  },
  {
    source: "viz:render",
    resourceUri: "ui://viz/chart/sales-bar",
    context: { chartType: "bar", workflowId: "wf-001" },
    slot: 1,
  },
];

/** Three-panel dashboard with a date picker broadcasting. */
export const DATE_FILTER_DASHBOARD_RESOURCES: CollectedUiResource[] = [
  {
    source: "date:picker",
    resourceUri: "ui://date/picker/dp-1",
    context: { range: "last-30-days" },
    slot: 0,
  },
  {
    source: "table:view",
    resourceUri: "ui://table/view/tv-1",
    context: { userId: "u-42" },
    slot: 1,
  },
  {
    source: "chart:view",
    resourceUri: "ui://chart/view/cv-1",
    context: { userId: "u-42" },
    slot: 2,
  },
];

/** Single resource (no composition needed but should still work). */
export const SINGLE_RESOURCE: CollectedUiResource[] = [
  {
    source: "editor:code",
    resourceUri: "ui://editor/code/ed-1",
    slot: 0,
  },
];

/** Sample MCP tool results with _meta.ui for collector tests. */
export const SAMPLE_TOOL_RESULTS = {
  withUi: {
    content: [{ type: "text", text: "Query executed successfully" }],
    _meta: {
      ui: {
        resourceUri: "ui://postgres/table/abc123",
        visibility: ["model", "app"],
      },
    },
  },
  withoutUi: {
    content: [{ type: "text", text: "No UI here" }],
  },
  withEmptyMeta: {
    content: [],
    _meta: {},
  },
} as const;
