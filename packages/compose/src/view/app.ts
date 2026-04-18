/// <reference lib="dom" />
/**
 * View-side SDK bootstrap: wraps ext-apps `App`, performs the
 * `ui/initialize` handshake via `PostMessageTransport`, then mounts the
 * initial view.
 *
 * Public entry points: {@link createMcpApp} and {@link defineView}. All
 * other exports are type-only and flow through `mod.ts`.
 *
 * @module
 */

import {
  App,
  PostMessageTransport,
} from "@modelcontextprotocol/ext-apps";
import type { McpUiHostCapabilities } from "@modelcontextprotocol/ext-apps";

import type {
  AppConfig,
  AppContext,
  AppHandle,
  ToolResult,
  ViewDefinition,
} from "./types.ts";
import { Router } from "./router.ts";
import { callServerToolGated } from "./capabilities.ts";

/**
 * Identity function: lets TS infer `S`, `A`, `D` at the call site from the
 * shape of the hooks. No runtime behaviour.
 */
export function defineView<S, A = void, D = void>(
  view: ViewDefinition<S, A, D>,
): ViewDefinition<S, A, D> {
  return view;
}

/**
 * Bootstrap the view-side runtime.
 *
 * Steps (see `spec.md` §Lifecycle):
 * 1. Instantiate `App` with app info + capabilities.
 * 2. `connect()` with `PostMessageTransport(window.parent, window.parent)`.
 * 3. Snapshot `hostCapabilities` returned by the handshake.
 * 4. Build the `AppContext` and hand it to the router.
 * 5. `router.goto(initialView, initialArgs)`.
 *
 * Throws if `window.parent` is unavailable (must run inside an iframe),
 * if `initialView` is not a registered view, or if the handshake fails.
 */
export async function createMcpApp<S = Record<string, never>>(
  config: AppConfig<S>,
): Promise<AppHandle<S>> {
  validateConfig(config);

  const app = new App(config.info, config.capabilities ?? {});

  const parent = getParentWindow();
  const transport = new PostMessageTransport(parent, parent);
  await app.connect(transport);

  const hostCaps = app.getHostCapabilities();
  if (!hostCaps) {
    // Defensive: ext-apps guarantees this is set after connect() resolves,
    // but a malformed host could in theory skip the handshake response.
    throw new Error(
      "ui/initialize handshake completed without host capabilities — " +
        "the host response was malformed.",
    );
  }
  const capabilities: McpUiHostCapabilities = Object.freeze({ ...hostCaps });

  const router = new Router<S>(config.views, config.root);

  // Build the context. `navigate` and `callTool` close over `router` and
  // `app` respectively; the same object reference is reused for the whole
  // app lifetime, as documented in AppHandle.
  const state = (config.initialState ?? {}) as S;
  const ctx: AppContext<S> = {
    navigate: (name, args) => router.goto(name, args),
    callTool: (name, args): Promise<ToolResult> =>
      callServerToolGated(app, capabilities, name, args),
    capabilities,
    state,
    app,
  };
  router.setContext(ctx);

  await router.goto(config.initialView, config.initialArgs);

  let disposed = false;
  const handle: AppHandle<S> = {
    ctx,
    get currentView() {
      return router.currentView;
    },
    navigate: (name, args) => router.goto(name, args),
    dispose: async () => {
      if (disposed) return;
      disposed = true;
      // Drain pending navigations before closing to avoid tearing down the
      // transport while an onLeave/onEnter hook is still in flight.
      await router.drain();
      // Close the transport directly. We avoid `app.close()` because the
      // declared `App` type in ext-apps@1.6.0 does not surface the inherited
      // `Protocol.close` method on its .d.ts surface (TS2339); closing the
      // transport triggers the same JSON-RPC teardown path.
      await transport.close();
    },
  };
  return handle;
}

function validateConfig<S>(config: AppConfig<S>): void {
  if (!config.root) {
    throw new Error("createMcpApp: `root` is required");
  }
  if (!config.views || Object.keys(config.views).length === 0) {
    throw new Error("createMcpApp: `views` must contain at least one view");
  }
  if (!config.initialView) {
    throw new Error("createMcpApp: `initialView` is required");
  }
  if (!config.views[config.initialView]) {
    throw new Error(
      `createMcpApp: initialView "${config.initialView}" is not a registered view. ` +
        `Registered: ${Object.keys(config.views).join(", ")}`,
    );
  }
  for (const [name, view] of Object.entries(config.views)) {
    if (typeof view.render !== "function") {
      throw new Error(`View "${name}" is missing a render function`);
    }
  }
}

/**
 * Resolve the parent window for `PostMessageTransport`. Split out for
 * test injection: tests can override `globalThis.window` before calling
 * `createMcpApp`.
 */
function getParentWindow(): Window {
  // deno-lint-ignore no-explicit-any
  const w = (globalThis as any).window as Window | undefined;
  if (!w || !w.parent) {
    throw new Error(
      "createMcpApp: no `window.parent` available. This SDK must run " +
        "inside an iframe hosted by an MCP Apps-compatible client.",
    );
  }
  return w.parent;
}
