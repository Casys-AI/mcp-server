/**
 * Lifecycle notifications received from an MCP Apps host while a view-side
 * application is bootstrapping.
 *
 * ext-apps requires its one-shot notification handlers to be registered
 * before `App.connect()`. `createMcpApp`, however, can only expose its
 * `AppHandle` after the handshake and initial route are ready. This module
 * bridges that gap: it captures early notifications, then replays every
 * callback in arrival order once a handle is available.
 *
 * @module
 */

import type { App } from "@modelcontextprotocol/ext-apps";
import type {
  McpUiToolInputNotification,
  McpUiToolInputPartialNotification,
  McpUiToolResultNotification,
} from "@modelcontextprotocol/ext-apps";

import type { AppHandle, AppLifecycleCallbacks } from "./types.ts";

/** Notification payload for a completed tool-input notification. */
export type ToolInputParams = McpUiToolInputNotification["params"];

/** Notification payload for a streaming, partial tool-input notification. */
export type ToolInputPartialParams = McpUiToolInputPartialNotification["params"];

/** Notification payload for a completed tool-result notification. */
export type ToolResultParams = McpUiToolResultNotification["params"];

/**
 * The three one-shot MCP Apps notifications that authors may observe through
 * {@link AppLifecycleCallbacks}. This union intentionally stays internal: the
 * public API is the named callbacks, which are easier to discover and type.
 */
type LifecycleEvent =
  | { kind: "toolInput"; params: ToolInputParams }
  | { kind: "toolInputPartial"; params: ToolInputPartialParams }
  | { kind: "toolResult"; params: ToolResultParams };

/** Structural minimum needed to install the ext-apps one-shot callbacks. */
type OneShotEventSource = Pick<App, "ontoolinput" | "ontoolinputpartial" | "ontoolresult">;

/**
 * Register the ext-apps one-shot notification handlers immediately.
 *
 * This function must run before `App.connect()`. It is deliberately separate
 * from activation so unit tests can verify the protocol ordering without a
 * DOM or a real postMessage transport.
 */
export function wireLifecycleCallbacks<S>(
  app: OneShotEventSource,
  callbacks: AppLifecycleCallbacks<S>,
): LifecycleDispatcher<S> {
  const dispatcher = new LifecycleDispatcher(callbacks);
  app.ontoolinput = (params) => dispatcher.capture({ kind: "toolInput", params });
  app.ontoolinputpartial = (params) => dispatcher.capture({ kind: "toolInputPartial", params });
  app.ontoolresult = (params) => dispatcher.capture({ kind: "toolResult", params });
  return dispatcher;
}

/**
 * Buffers host notifications until an {@link AppHandle} exists, then invokes
 * user callbacks one at a time. A slow asynchronous callback therefore never
 * lets a later notification overtake an earlier one.
 */
export class LifecycleDispatcher<S> {
  private readonly callbacks: AppLifecycleCallbacks<S>;
  private readonly pending: LifecycleEvent[] = [];
  private handle: AppHandle<S> | undefined;
  private queue: Promise<void> = Promise.resolve();

  constructor(callbacks: AppLifecycleCallbacks<S>) {
    this.callbacks = callbacks;
  }

  /** Capture an event synchronously. It is either buffered or queued. */
  capture(event: LifecycleEvent): void {
    if (!this.handle) {
      this.pending.push(event);
      return;
    }
    this.enqueue(event);
  }

  /**
   * Make the handle visible to callbacks and replay the early-notification
   * buffer. Resolves only after that replay completes, including async user
   * callbacks. Events arriving during replay append after the buffered FIFO.
   */
  async activate(handle: AppHandle<S>): Promise<void> {
    if (this.handle) {
      throw new Error("LifecycleDispatcher.activate() may only be called once");
    }
    this.handle = handle;
    for (const event of this.pending.splice(0)) this.enqueue(event);
    await this.drain();
  }

  /** Wait until all notifications observed so far have been delivered. */
  drain(): Promise<void> {
    return this.queue;
  }

  private enqueue(event: LifecycleEvent): void {
    this.queue = this.queue.then(async () => {
      const callback = this.callbackFor(event);
      if (!callback || !this.handle) return;
      try {
        await callback(event.params, this.handle);
      } catch (error) {
        // Host notification handlers cannot report a response. Surface the
        // application error without poisoning the FIFO and losing later events.
        console.error(`[mcp-view] ${event.kind} lifecycle callback failed:`, error);
      }
    });
  }

  private callbackFor(event: LifecycleEvent):
    | ((
      params: ToolInputParams | ToolInputPartialParams | ToolResultParams,
      handle: AppHandle<S>,
    ) => void | Promise<void>)
    | undefined {
    switch (event.kind) {
      case "toolInput":
        return this.callbacks.onToolInput;
      case "toolInputPartial":
        return this.callbacks.onToolInputPartial;
      case "toolResult":
        return this.callbacks.onToolResult;
    }
  }
}
