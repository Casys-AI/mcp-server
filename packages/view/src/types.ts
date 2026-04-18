/**
 * Public type surface for `@casys/mcp-compose/view`.
 *
 * View-side SDK for MCP Apps: bootstraps the ext-apps `App`, performs the
 * `ui/initialize` handshake, and runs a memory-based view router inside the
 * iframe. Authors compose views with {@link defineView} and start the app
 * with {@link createMcpApp}.
 *
 * No implementation lives in this file — only signatures. Runtime code is in
 * sibling modules (`app.ts`, `router.ts`, `capabilities.ts`).
 *
 * @module
 */

/// <reference lib="dom" />

import type {
  App,
  McpUiAppCapabilities,
  McpUiHostCapabilities,
} from "@modelcontextprotocol/ext-apps";
import type {
  CallToolResult,
  Implementation,
} from "@modelcontextprotocol/sdk/types.js";

// ---------------------------------------------------------------------------
// Rendering primitives
// ---------------------------------------------------------------------------

/**
 * Output of a view's `render` function.
 *
 * - `string` — HTML string, inserted via `innerHTML`. Pick this for vanilla
 *   template-literal views (the default path).
 * - `Node` — a pre-built DOM node, appended as-is. Pick this when you build
 *   the tree imperatively and want to preserve element identity / event
 *   listeners across re-renders of unrelated views.
 *
 * Framework adapters (React, Vue, …) will ship in separate sub-exports and
 * are responsible for bridging their VDOM into one of these two forms.
 */
export type ViewOutput = string | Node;

/**
 * A view's render function. Pure: must depend only on `ctx` and `data`.
 *
 * Called after `onEnter` resolves. If `onEnter` is omitted, `data` is
 * `undefined`.
 *
 * @typeParam S - User state shape, shared across views via `ctx.state`.
 * @typeParam D - Data shape returned by this view's `onEnter`.
 */
export type ViewRenderer<S, D> = (
  ctx: AppContext<S>,
  data: D,
) => ViewOutput;

/**
 * Lifecycle hooks for a view.
 *
 * - `onEnter` runs before `render`. Fetch remote data here via
 *   `ctx.callTool`. Whatever is returned is forwarded to `render` as `data`.
 *   Throw to abort navigation (the error propagates out of `ctx.navigate`).
 * - `onLeave` runs before the next view's `onEnter`. Use for cleanup of
 *   listeners / timers attached during `render`. Return value is ignored.
 *
 * @typeParam S - User state shape.
 * @typeParam A - Args shape accepted by `onEnter` (forwarded from
 *   `ctx.navigate(name, args)`).
 * @typeParam D - Data shape produced by `onEnter` and consumed by `render`.
 */
export interface ViewLifecycle<S, A, D> {
  /**
   * Resolve the data needed by `render`. Optional; omit for static views.
   *
   * @param ctx - App context (navigate, callTool, capabilities, state).
   * @param args - Args passed by the caller of `ctx.navigate(name, args)`.
   *   Typed via the view's `A` generic; at the `navigate` call site the
   *   type is inferred from the views map (see {@link AppConfig}).
   */
  onEnter?(ctx: AppContext<S>, args: A): D | Promise<D>;

  /**
   * Called when leaving this view (including when re-navigating to self
   * with new args). Intended for listener/timer cleanup.
   */
  onLeave?(ctx: AppContext<S>): void | Promise<void>;
}

// ---------------------------------------------------------------------------
// View definition
// ---------------------------------------------------------------------------

/**
 * Complete view contract returned by {@link defineView}.
 *
 * @typeParam S - User state shape.
 * @typeParam A - Args accepted on entry. `void` means no args required.
 * @typeParam D - Data produced by `onEnter`. `void`/`undefined` for static
 *   views (no `onEnter`).
 */
export interface ViewDefinition<S, A = void, D = void>
  extends ViewLifecycle<S, A, D> {
  /**
   * Render the view. Receives the `data` returned by `onEnter` (or
   * `undefined` if none).
   */
  render: ViewRenderer<S, D>;
}

// ---------------------------------------------------------------------------
// Context (passed to every hook)
// ---------------------------------------------------------------------------

/**
 * Result shape of `ctx.callTool`.
 *
 * Re-export of `CallToolResult` from the MCP SDK (surfaced via ext-apps).
 * Note: tool-level errors arrive as `{ isError: true, content: [...] }` —
 * they are NOT thrown. Transport errors and missing-capability errors ARE
 * thrown. See spec.md §"Error contract".
 */
export type ToolResult = CallToolResult;

/**
 * Runtime context passed to every view hook (`onEnter`, `render`, `onLeave`).
 *
 * Designed to be extended: new methods (`sendMessage`, `requestDisplayMode`, …)
 * can be added as optional fields in future minor versions without breaking
 * existing views.
 *
 * @typeParam S - User state shape declared in {@link AppConfig}.
 */
export interface AppContext<S> {
  /**
   * Switch to another view. Memory-only: does not hit the host.
   *
   * @param name - Key from the `views` map declared in {@link AppConfig}.
   * @param args - Args forwarded to the target view's `onEnter`. Typed as
   *   `unknown` at this level because `AppContext` is not generic over the
   *   views map; concrete apps can tighten via a local helper type.
   * @throws Error when `name` is not a registered view.
   */
  navigate(name: string, args?: unknown): Promise<void>;

  /**
   * Call a tool on the originating MCP server (proxied through the host).
   *
   * Thin wrapper around `App.callServerTool`. Checks the host advertised
   * the `serverTools` capability before calling.
   *
   * @throws Error if `capabilities.serverTools` is absent.
   * @throws Error on transport failure, timeout, or host refusal.
   * @returns Tool result. Check `result.isError` for tool-level failures.
   */
  callTool(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<ToolResult>;

  /**
   * Frozen snapshot of host capabilities received during `ui/initialize`.
   * Undefined guard not needed: `createMcpApp` never resolves before the
   * handshake completes.
   */
  readonly capabilities: McpUiHostCapabilities;

  /**
   * Shared mutable user state. Authors can mutate fields directly; views
   * must re-render (via `navigate(currentView, args)`) to reflect changes.
   * No reactivity is provided by design.
   */
  state: S;

  /**
   * Escape hatch: the underlying ext-apps `App` instance. Use for anything
   * the SDK does not wrap (sendMessage, updateModelContext, event listeners).
   */
  readonly app: App;
}

// ---------------------------------------------------------------------------
// App configuration
// ---------------------------------------------------------------------------

/**
 * Map of view name → view definition. The keys form the valid argument set
 * for `ctx.navigate` and `AppConfig.initialView`.
 *
 * Using `ViewDefinition<S, any, any>` here is deliberate: args and data
 * shapes vary per view, and a heterogeneous map cannot be typed more
 * precisely without forcing a tuple/const-map pattern that would hurt
 * ergonomics. Per-view types remain enforced inside each `defineView` call.
 */
// deno-lint-ignore no-explicit-any
export type ViewMap<S> = Record<string, ViewDefinition<S, any, any>>;

/**
 * Config passed to {@link createMcpApp}.
 *
 * @typeParam S - User state shape. Defaults to an empty object.
 */
export interface AppConfig<S = Record<string, never>> {
  /**
   * App identity advertised to the host in `ui/initialize`.
   */
  info: Implementation;

  /**
   * DOM element where views mount. Its contents are replaced on every
   * navigation. Typically `document.getElementById("root")`.
   */
  root: HTMLElement;

  /**
   * Map of view name → {@link ViewDefinition}.
   */
  views: ViewMap<S>;

  /**
   * Name of the view to mount after the handshake. Must be a key of
   * `views`. Runtime validates this.
   */
  initialView: keyof ViewMap<S> & string;

  /**
   * Args passed to `initialView.onEnter`. Type left as `unknown` for the
   * same reason as `navigate` — the map is heterogeneous.
   */
  initialArgs?: unknown;

  /**
   * Initial user state. Reference kept live as `ctx.state`.
   */
  initialState?: S;

  /**
   * Capabilities advertised to the host. Default: `{}` (no app-side
   * capabilities). Set this if the view itself exposes tools via
   * `ctx.app.oncalltool`.
   */
  capabilities?: McpUiAppCapabilities;
}

// ---------------------------------------------------------------------------
// createMcpApp return value
// ---------------------------------------------------------------------------

/**
 * Handle returned by {@link createMcpApp}. Exposes the live context plus
 * imperative navigation from outside any view (e.g. from a top-level
 * DOM event listener installed before the first view mounts).
 */
export interface AppHandle<S> {
  /**
   * The context that views receive. Same object reference across the
   * app's lifetime.
   */
  readonly ctx: AppContext<S>;

  /**
   * Name of the currently-mounted view.
   */
  readonly currentView: string;

  /**
   * Imperative navigate; equivalent to `handle.ctx.navigate(...)`.
   */
  navigate(name: string, args?: unknown): Promise<void>;

  /**
   * Tear down the router and close the transport. Idempotent.
   */
  dispose(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Factory signatures (implementation lives in sibling modules)
// ---------------------------------------------------------------------------

/**
 * Identity function over {@link ViewDefinition}; exists for type inference
 * of `S`, `A`, `D` at the call site.
 */
export declare function defineView<S, A = void, D = void>(
  view: ViewDefinition<S, A, D>,
): ViewDefinition<S, A, D>;

/**
 * Bootstrap an MCP App view-side runtime. See spec.md §"Lifecycle".
 */
export declare function createMcpApp<S = Record<string, never>>(
  config: AppConfig<S>,
): Promise<AppHandle<S>>;
