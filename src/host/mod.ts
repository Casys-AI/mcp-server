/**
 * Host integration layer for mcp-compose.
 *
 * Defines the contracts for host applications that embed composite UIs,
 * and provides the HTML/CSS/JS renderer for generating self-contained dashboards.
 *
 * @module host
 */

export type { CompositeUiHost, HostConfig } from "./types.ts";

// Renderer
export { renderComposite } from "./renderer/mod.ts";

// Server
export { serveDashboard } from "./serve.ts";
export type { ServeDashboardHandle, ServeDashboardOptions } from "./serve.ts";
