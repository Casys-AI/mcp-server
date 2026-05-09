/**
 * View-side tool registration: lets a View expose tools that the host
 * (and its agent) can call. Wraps `App.registerTool` /
 * `App.sendToolListChanged` from `@modelcontextprotocol/ext-apps` 1.7.0.
 *
 * Two layers:
 *
 * 1. **Declarative lifecycle** — tools declared on `defineView({ tools })`.
 *    The router auto-registers a view's tools on `onEnter` and removes them
 *    on `onLeave`, so each view sees only its own tools while it's mounted.
 *
 * 2. **Imperative handle** — `ctx.tools.{enable,disable,update,remove}`
 *    forwards to ext-apps `RegisteredAppTool` methods. Use this for
 *    availability that depends on runtime state ("save" only when a form
 *    is dirty) without recreating the view.
 *
 * Schemas: `inputSchema` / `outputSchema` use `StandardSchemaV1` (Zod v4,
 * Valibot, ArkType, …) — the same surface ext-apps requires. We do not
 * wrap or transform; the caller passes the schema directly.
 *
 * @module
 */

import type { App, RegisteredAppTool, StandardSchemaV1 } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

import { MCPViewError } from "./errors.ts";
import type { AppContext } from "./types.ts";

/**
 * Infer the JS type a `StandardSchemaV1` validates. Falls back to
 * `Record<string, unknown>` when no schema is declared.
 */
export type InferToolArgs<S extends StandardSchemaV1 | undefined> = S extends StandardSchemaV1
  ? StandardSchemaV1.InferOutput<S>
  : Record<string, unknown>;

/**
 * A View-exposed tool. Forwarded to ext-apps `App.registerTool` with the
 * View's `AppContext` injected ahead of the validated args.
 *
 * @typeParam S - User state shape (matches the enclosing `AppContext<S>`).
 * @typeParam I - Input schema; defaults to none (handler receives a loose
 *   record).
 */
export interface ViewToolDef<
  S,
  I extends StandardSchemaV1 | undefined = undefined,
> {
  /** Short, agent-facing description. Required: this is what the LLM reads. */
  description: string;
  /** Human-readable title (optional, for display in UIs that show one). */
  title?: string;
  /** Args schema — Standard Schema V1 (Zod v4, Valibot, …). */
  inputSchema?: I;
  /** Result schema. Same Standard Schema V1 contract. */
  outputSchema?: StandardSchemaV1;
  /** Tool annotations (idempotent / readOnly / …) per the MCP spec. */
  annotations?: ToolAnnotations;
  /** Forwarded as-is on `_meta` of the tool definition. */
  // deno-lint-ignore no-explicit-any
  _meta?: Record<string, any>;
  /**
   * Called when the host (or its agent) invokes the tool. Receives the
   * current `AppContext` and the validated args. Must return a
   * `CallToolResult` (the SDK shape — `{ content: [...], isError? }`).
   */
  handler: (
    ctx: AppContext<S>,
    args: InferToolArgs<I>,
  ) => CallToolResult | Promise<CallToolResult>;
}

/**
 * Public surface of `ctx.tools`. Forwards to ext-apps' per-tool handle
 * methods and emits `tools/list_changed` after mutations that affect the
 * advertised list (`remove`, `update` of name-visible fields).
 *
 * `enable` / `disable` flip a tool's `enabled` flag — disabled tools stay
 * registered but reject calls until re-enabled. Useful for "save when dirty"
 * patterns.
 *
 * Throws `MCPViewError("UNKNOWN_TOOL")` when the named tool is not currently
 * registered by the active view.
 */
export interface ToolsHandle {
  enable(name: string): void;
  disable(name: string): void;
  update(
    name: string,
    updates: Partial<{
      title: string;
      description: string;
      annotations: ToolAnnotations;
    }>,
  ): void;
  remove(name: string): Promise<void>;
}

/**
 * Internal: owns the live `RegisteredAppTool` handles for the current view
 * and routes lifecycle / mutation calls. Constructed by `app.ts`, passed
 * into the router via setter, and exposed (typed as `ToolsHandle`) on
 * `ctx.tools`.
 */
export class ToolRegistry<S> implements ToolsHandle {
  private readonly handles = new Map<string, RegisteredAppTool>();
  private context: AppContext<S> | null = null;

  constructor(private readonly app: App) {}

  /**
   * Bind the live context. Called once by `app.ts` after the context object
   * is assembled. Tool handlers close over this reference.
   */
  setContext(ctx: AppContext<S>): void {
    this.context = ctx;
  }

  /**
   * Register every tool from a view's `tools` map. Sends a single
   * `tools/list_changed` notification at the end (batched).
   *
   * The wrapper passed to ext-apps injects `ctx` ahead of the validated
   * args, matching `ViewToolDef.handler`.
   */
  async registerForView(
    tools: Record<string, ViewToolDef<S, StandardSchemaV1 | undefined>> | undefined,
  ): Promise<void> {
    if (!tools || Object.keys(tools).length === 0) return;
    if (this.context === null) {
      throw new MCPViewError(
        "ROUTER_NOT_INITIALIZED",
        "ToolRegistry.registerForView called before setContext",
      );
    }
    const ctx = this.context;
    for (const [name, def] of Object.entries(tools)) {
      const handle = this.app.registerTool(
        name,
        {
          title: def.title,
          description: def.description,
          inputSchema: def.inputSchema,
          outputSchema: def.outputSchema,
          annotations: def.annotations,
          _meta: def._meta,
          // deno-lint-ignore no-explicit-any
        } as any,
        // ext-apps passes the validated args as the first positional arg
        // and a `RequestHandlerExtra` object as the second. We only forward
        // the args.
        // deno-lint-ignore no-explicit-any
        ((args: any) => def.handler(ctx, args)) as any,
      );
      this.handles.set(name, handle);
    }
    await this.app.sendToolListChanged();
  }

  /**
   * Remove every tool registered for the current view. Single batched
   * `tools/list_changed` notification at the end. No-op when nothing is
   * currently registered (skips the network round-trip).
   */
  async unregisterAll(): Promise<void> {
    if (this.handles.size === 0) return;
    for (const handle of this.handles.values()) {
      handle.remove();
    }
    this.handles.clear();
    await this.app.sendToolListChanged();
  }

  // ---- ToolsHandle methods (exposed on ctx.tools) -------------------------

  enable(name: string): void {
    this.requireHandle(name).enable();
  }

  disable(name: string): void {
    this.requireHandle(name).disable();
  }

  update(
    name: string,
    updates: Partial<{
      title: string;
      description: string;
      annotations: ToolAnnotations;
    }>,
  ): void {
    // ext-apps' RegisteredAppTool.update accepts a wider Partial that includes
    // schemas; we expose only the metadata fields here because changing a
    // schema mid-flight would invalidate calls already in flight against the
    // old shape. Schema swaps require remove() + register on the next view.
    this.requireHandle(name).update(updates);
  }

  async remove(name: string): Promise<void> {
    const handle = this.requireHandle(name);
    handle.remove();
    this.handles.delete(name);
    await this.app.sendToolListChanged();
  }

  private requireHandle(name: string): RegisteredAppTool {
    const handle = this.handles.get(name);
    if (!handle) {
      throw new MCPViewError(
        "UNKNOWN_TOOL",
        `tool "${name}" is not currently registered. ` +
          `Active tools: ${[...this.handles.keys()].join(", ") || "(none)"}.`,
        { tool: name, active: [...this.handles.keys()] },
      );
    }
    return handle;
  }
}

/**
 * Walk the view map and return `true` if any view declares at least one
 * tool. `app.ts` uses this to decide whether to advertise the
 * `tools.listChanged` capability before connect().
 */
export function viewsDeclareTools(
  views: Record<string, unknown>,
): boolean {
  for (const view of Object.values(views)) {
    if (!view || typeof view !== "object" || !("tools" in view)) continue;
    const tools = (view as { tools?: unknown }).tools;
    if (tools && typeof tools === "object" && Object.keys(tools).length > 0) {
      return true;
    }
  }
  return false;
}
