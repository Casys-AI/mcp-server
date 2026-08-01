/**
 * `@casys/mcp-view` — View-side SDK for MCP Apps
 *
 * Lets MCP App authors build SPAs with internal routing instead of using
 * `ui/message` for every navigation (which pollutes the chat thread and
 * triggers the Claude prompt-injection warning on every click).
 *
 * Thin opinionated wrapper around the `App` class from
 * `@modelcontextprotocol/ext-apps`. Owns three concerns: lifecycle bootstrap,
 * memory-based view routing, capability-gated tool call proxy.
 *
 * @example Basic SPA with list + detail views
 * ```typescript
 * import { createMcpApp, defineView } from "@casys/mcp-view";
 *
 * const list = defineView({
 *   async onEnter(ctx) {
 *     return await ctx.callTool("list_invoices");
 *   },
 *   render(ctx, data) {
 *     // build UI, wire row clicks to ctx.navigate("detail", { id })
 *   },
 * });
 *
 * const detail = defineView<State, { id: string }, Invoice>({
 *   async onEnter(ctx, { id }) {
 *     const res = await ctx.callTool("get_invoice", { id });
 *     return res.structuredContent as Invoice;
 *   },
 *   render(ctx, invoice) { ... },
 * });
 *
 * const app = await createMcpApp({
 *   info: { name: "InvoiceViewer", version: "1.0.0" },
 *   root: document.getElementById("root")!,
 *   views: { list, detail },
 *   initialView: "list",
 * });
 * ```
 *
 * @module mcp-view
 */

export { createMcpApp, defineView } from "./src/app.ts";
export { MCPViewError } from "./src/errors.ts";
export type { MCPViewErrorCode } from "./src/errors.ts";

export { COMPOSE_EVENT_METHOD, createComposeEventClient } from "./src/compose-events.ts";
export type {
  ComposeEventClient,
  ComposeEventHandler,
  ComposeEventPayload,
  ComposeEventSource,
  ComposeEventTarget,
} from "./src/compose-events.ts";

export { readResultData, readStructuredContent } from "./src/results.ts";
export type { ReadResultDataOptions, ResultData } from "./src/results.ts";

export {
  activeComponentSurface,
  advertisedComponentCatalog,
  applySurfaceContext,
  CASYS_COMPONENT_CATALOG_CAPABILITY_KEY,
  CASYS_SURFACE_CONTEXT_KEY,
  componentCatalogCapabilities,
  defineComponentRegistry,
  defineComponentSurface,
  defineViewComponent,
  mountComponentSurface,
  readSurfaceContext,
} from "./src/components.ts";

export {
  defineCustomComponent,
  defineKeyValueComponent,
  defineMetricGridComponent,
  defineStatusComponent,
} from "./src/component-primitives.ts";
export type {
  ComponentTone,
  KeyValueComponentValue,
  MetricComponentValue,
  StatusComponentValue,
} from "./src/component-primitives.ts";
export type {
  AdvertisedComponentCatalog,
  ComponentCleanup,
  ComponentSurface,
  ComponentSurfaceItem,
  ComponentSurfaceLayout,
  JsonValue,
  MountComponentSurfaceOptions,
  MountedComponentSurface,
  SurfaceContext,
  SurfaceGap,
  SurfaceLayoutType,
  ViewComponentDefinition,
  ViewComponentDescriptor,
  ViewComponentMountContext,
  ViewComponentRegistry,
} from "./src/components.ts";

export type {
  AppConfig,
  AppContext,
  AppHandle,
  AppLifecycleCallbacks,
  TeardownLifecycleCallback,
  TeardownReason,
  ToolInputLifecycleCallback,
  ToolInputPartialLifecycleCallback,
  ToolResult,
  ToolResultLifecycleCallback,
  ViewDefinition,
  ViewLifecycle,
  ViewMap,
  ViewOutput,
  ViewRenderer,
} from "./src/types.ts";
