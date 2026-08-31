/**
 * Host integration layer for mcp-compose.
 *
 * Defines the contracts for host applications that embed composite UIs,
 * and provides the HTML/CSS/JS renderer for generating self-contained dashboards.
 *
 * @module host
 */

export type { CompositeUiHost, HostConfig } from "./types.ts";
export { MCP_COMPOSE_HOST_GATEWAY_KEY } from "./component-actions.ts";
export type {
  HostComponentAction,
  HostComponentActionGateway,
  HostComponentActionRejectionReason,
  HostComponentActionResult,
} from "./component-actions.ts";
export {
  CASYS_COMPONENT_CATALOG_CAPABILITY_KEY,
  CASYS_SURFACE_CONTEXT_KEY,
} from "./components-contract.ts";

// Renderer
export { renderComposite } from "./renderer/mod.ts";

// Server
export { serveDashboard } from "./serve.ts";
export type { ServeDashboardHandle, ServeDashboardOptions } from "./serve.ts";
