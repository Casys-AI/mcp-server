/**
 * Sample orchestration configurations for tests.
 *
 * @module tests/fixtures/sample-orchestrations
 */

import type { UiOrchestration } from "../core/types/orchestration.ts";

/** Split layout with query-to-chart sync. */
export const SALES_DASHBOARD_ORCHESTRATION: UiOrchestration = {
  layout: "split",
  sync: [
    { from: "postgres:query", event: "filter", to: "viz:render", action: "update" },
  ],
  sharedContext: ["workflowId"],
};

/** Grid layout with broadcast sync from date picker. */
export const DATE_FILTER_ORCHESTRATION: UiOrchestration = {
  layout: "grid",
  sync: [
    { from: "date:picker", event: "change", to: "*", action: "refresh" },
  ],
  sharedContext: ["userId"],
};

/** Tabs layout with no sync rules. */
export const INDEPENDENT_TABS_ORCHESTRATION: UiOrchestration = {
  layout: "tabs",
};

/** Stack layout (default). */
export const SIMPLE_STACK_ORCHESTRATION: UiOrchestration = {
  layout: "stack",
};
