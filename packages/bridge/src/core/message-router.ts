/**
 * Routes incoming JSON-RPC messages to registered method handlers.
 *
 * Supports:
 * - Request/response dispatch with automatic JSON-RPC response generation
 * - Notification dispatch (fire-and-forget)
 * - Pending request tracking for outgoing requests (match response by `id`)
 * - Handler removal
 */

import type {
  McpAppsErrorResponse,
  McpAppsMessage,
  McpAppsNotification,
  McpAppsRequest,
  McpAppsResponse,
} from "./types.ts";

/** Handler for a JSON-RPC request that returns a result. */
export type RequestHandler = (
  params: Record<string, unknown> | undefined,
) => Promise<unknown> | unknown;

/** Handler for a JSON-RPC notification (fire-and-forget). */
export type NotificationHandler = (
  params: Record<string, unknown> | undefined,
) => void;

/** Resolver for a pending outgoing request. */
interface PendingRequest {
  resolve: (result: unknown) => void;
  reject: (error: Error) => void;
  method: string;
  createdAt: number;
}

/**
 * JSON-RPC message router.
 *
 * Register handlers for specific method names, then call `handleMessage()`
 * for each incoming message. The router will dispatch to the correct handler
 * and produce the appropriate JSON-RPC response.
 *
 * For outgoing requests, use `trackRequest()` to get a Promise that resolves
 * when the matching response arrives.
 */
export class MessageRouter {
  private readonly requestHandlers = new Map<string, RequestHandler>();
  private readonly notificationHandlers = new Map<string, NotificationHandler>();
  private readonly pendingRequests = new Map<string | number, PendingRequest>();

  // -------------------------------------------------------------------------
  // Handler registration
  // -------------------------------------------------------------------------

  /** Register a handler for a JSON-RPC request method. */
  onRequest(method: string, handler: RequestHandler): void {
    if (this.requestHandlers.has(method)) {
      throw new Error(
        `[MessageRouter] Request handler already registered for method "${method}".`,
      );
    }
    this.requestHandlers.set(method, handler);
  }

  /** Register a handler for a JSON-RPC notification method. */
  onNotification(method: string, handler: NotificationHandler): void {
    if (this.notificationHandlers.has(method)) {
      throw new Error(
        `[MessageRouter] Notification handler already registered for method "${method}".`,
      );
    }
    this.notificationHandlers.set(method, handler);
  }

  /** Remove a previously registered request handler. */
  removeRequestHandler(method: string): boolean {
    return this.requestHandlers.delete(method);
  }

  /** Remove a previously registered notification handler. */
  removeNotificationHandler(method: string): boolean {
    return this.notificationHandlers.delete(method);
  }

  /** Check if a request handler is registered for a method. */
  hasRequestHandler(method: string): boolean {
    return this.requestHandlers.has(method);
  }

  /** Check if a notification handler is registered for a method. */
  hasNotificationHandler(method: string): boolean {
    return this.notificationHandlers.has(method);
  }

  // -------------------------------------------------------------------------
  // Outgoing request tracking
  // -------------------------------------------------------------------------

  /**
   * Track an outgoing request by its `id`.
   *
   * Returns a Promise that resolves with the result when the matching
   * response arrives, or rejects if an error response is received.
   *
   * @param id - The request `id` to track.
   * @param method - The method name (for error messages).
   * @param timeoutMs - Timeout in ms. Defaults to 30_000.
   */
  trackRequest(
    id: string | number,
    method: string,
    timeoutMs = 30_000,
  ): Promise<unknown> {
    if (this.pendingRequests.has(id)) {
      throw new Error(
        `[MessageRouter] Request with id "${id}" is already being tracked.`,
      );
    }

    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(
          new Error(
            `[MessageRouter] Request "${method}" (id=${id}) timed out after ${timeoutMs}ms.`,
          ),
        );
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (result: unknown) => {
          clearTimeout(timer);
          this.pendingRequests.delete(id);
          resolve(result);
        },
        reject: (error: Error) => {
          clearTimeout(timer);
          this.pendingRequests.delete(id);
          reject(error);
        },
        method,
        createdAt: Date.now(),
      });
    });
  }

  /** Number of pending outgoing requests. */
  get pendingCount(): number {
    return this.pendingRequests.size;
  }

  // -------------------------------------------------------------------------
  // Message dispatch
  // -------------------------------------------------------------------------

  /**
   * Route an incoming message to the appropriate handler.
   *
   * - **Responses** (with `result` or `error`, no `method`) are matched
   *   against pending outgoing requests by `id`.
   * - **Requests** (with `id` and `method`) are dispatched to request
   *   handlers and return a JSON-RPC response.
   * - **Notifications** (with `method`, no `id`) are dispatched to
   *   notification handlers and return `null`.
   */
  async handleMessage(
    message: McpAppsMessage,
  ): Promise<McpAppsResponse | McpAppsErrorResponse | null> {
    // Response -> resolve/reject pending request
    if (isSuccessResponse(message)) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        pending.resolve(message.result);
      }
      return null;
    }

    if (isErrorResponseMsg(message)) {
      const pending = message.id !== null
        ? this.pendingRequests.get(message.id)
        : undefined;
      if (pending) {
        pending.reject(
          new Error(
            `[MessageRouter] RPC error ${message.error.code}: ${message.error.message}`,
          ),
        );
      }
      return null;
    }

    if (!isRequestOrNotification(message)) {
      return null;
    }

    const { method, params } = message;

    // Notification (no id)
    if (!("id" in message) || (message as McpAppsRequest).id === undefined) {
      const handler = this.notificationHandlers.get(method);
      if (handler) {
        handler(params);
      }
      return null;
    }

    // Request (with id)
    const reqId = (message as McpAppsRequest).id;
    const handler = this.requestHandlers.get(method);
    if (!handler) {
      return errorResponse(reqId, -32601, `Method not found: ${method}`);
    }

    try {
      const result = await handler(params);
      return successResponse(reqId, result);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return errorResponse(reqId, -32603, errorMessage);
    }
  }

  /**
   * Clean up all pending requests by rejecting them.
   * Call this when tearing down the router.
   */
  destroy(): void {
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(
        new Error(
          `[MessageRouter] Router destroyed while request "${pending.method}" (id=${id}) was pending.`,
        ),
      );
    }
    this.pendingRequests.clear();
    this.requestHandlers.clear();
    this.notificationHandlers.clear();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRequestOrNotification(
  msg: McpAppsMessage,
): msg is McpAppsRequest | McpAppsNotification {
  return "method" in msg;
}

function isSuccessResponse(msg: McpAppsMessage): msg is McpAppsResponse {
  return "result" in msg && "id" in msg && !("method" in msg);
}

function isErrorResponseMsg(
  msg: McpAppsMessage,
): msg is McpAppsErrorResponse {
  return "error" in msg && "id" in msg && !("method" in msg);
}

function successResponse(
  id: string | number,
  result: unknown,
): McpAppsResponse {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(
  id: string | number | null,
  code: number,
  message: string,
): McpAppsErrorResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}
