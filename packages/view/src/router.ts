/// <reference lib="dom" />
/**
 * Memory-based view router for MCP App views.
 *
 * The router owns two pieces of state — `currentView` and the DOM root —
 * and orchestrates the `onLeave → onEnter → render → mount` sequence. No
 * URL, no history, no reactivity. Re-navigating to the current view is
 * allowed and re-runs the full lifecycle.
 *
 * Errors in `onEnter` / `render` / `onLeave` propagate out of
 * {@link Router.goto}. The router does NOT swallow them; silent error
 * handling in a routing layer masks bugs.
 *
 * Note on innerHTML: views that opt into the `string` render path are
 * trusting their own template output. Authors concerned about XSS should
 * return a `Node` built via safe DOM APIs instead.
 *
 * @module
 */

import type { AppContext, ViewMap, ViewOutput } from "./types.ts";

/**
 * Internal router state. Constructed by `app.ts`; not exported publicly.
 */
export class Router<S> {
  readonly views: ViewMap<S>;
  readonly root: HTMLElement;
  private _currentView: string | null = null;
  private _context: AppContext<S> | null = null;
  private _queue: Promise<void> = Promise.resolve();

  constructor(views: ViewMap<S>, root: HTMLElement) {
    this.views = views;
    this.root = root;
  }

  /**
   * Wire the context. Must be called before {@link goto}. The context is
   * constructed in `app.ts` after the router instance (the context's
   * `navigate` binds back to this router), so injection happens post-hoc.
   */
  setContext(ctx: AppContext<S>): void {
    this._context = ctx;
  }

  get currentView(): string {
    if (this._currentView === null) {
      throw new Error(
        "Router.currentView read before initial navigation — " +
          "did you forget to await createMcpApp()?",
      );
    }
    return this._currentView;
  }

  /**
   * Returns a promise that resolves when all pending navigations complete.
   * Useful for graceful shutdown before closing the transport.
   */
  drain(): Promise<void> {
    return this._queue;
  }

  /**
   * Switch to a registered view. Calls are serialized: concurrent `goto`
   * calls are queued and executed one at a time to prevent interleaved
   * lifecycle hooks.
   *
   * Runs the previous view's `onLeave`, then the target's `onEnter`, then
   * its `render`, then mounts the output into the DOM root.
   */
  goto(name: string, args: unknown): Promise<void> {
    // Chain onto the existing queue. The onReject branch keeps the queue alive
    // even if the previous navigation threw, so subsequent gotos still run.
    this._queue = this._queue.then(
      () => this._doGoto(name, args),
      () => this._doGoto(name, args),
    );
    return this._queue;
  }

  private async _doGoto(name: string, args: unknown): Promise<void> {
    if (this._context === null) {
      throw new Error("Router.goto called before setContext");
    }
    const target = this.views[name];
    if (!target) {
      throw new Error(
        `Unknown view "${name}". Registered views: ${
          Object.keys(this.views).join(", ") || "(none)"
        }`,
      );
    }

    // Snapshot and clear _currentView before any async lifecycle hook.
    // This ensures that if onLeave or onEnter throws, the router does not
    // keep a stale pointer to the half-left view.
    const prevName = this._currentView;
    this._currentView = null;

    if (prevName !== null) {
      const prev = this.views[prevName];
      if (prev?.onLeave) {
        await prev.onLeave(this._context);
      }
    }

    const data = target.onEnter
      ? await target.onEnter(this._context, args)
      : undefined;
    const output = target.render(this._context, data);

    mount(this.root, output);
    this._currentView = name;
  }
}

/**
 * Replace the contents of `root` with `output`. Accepts HTML strings or
 * pre-built DOM nodes. See module docstring on innerHTML trust model.
 */
function mount(root: HTMLElement, output: ViewOutput): void {
  if (typeof output === "string") {
    // deno-lint-ignore no-explicit-any
    (root as any).innerHTML = output;
    return;
  }
  root.replaceChildren(output);
}
