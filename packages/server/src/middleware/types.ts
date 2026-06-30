/**
 * Middleware pipeline types for McpApp.
 *
 * Provides an onion-model middleware system (similar to Koa/Hono)
 * where each middleware wraps the next, enabling before/after logic.
 *
 * @module lib/server/middleware/types
 */

import type {
  ClientCapabilities,
  Implementation,
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Context passed through the middleware pipeline.
 * Each middleware can read and enrich the context.
 */
export interface MiddlewareContext {
  /** Name of the tool being called */
  toolName: string;

  /** Tool arguments */
  args: Record<string, unknown>;

  /** HTTP request (only present for HTTP transport, undefined for STDIO) */
  request?: Request;

  /** Session ID (only present for HTTP transport) */
  sessionId?: string;

  /** Client implementation metadata (stateless HTTP transport, when provided) */
  clientInfo?: Implementation;

  /** Client capabilities metadata (stateless HTTP transport, when provided) */
  clientCapabilities?: ClientCapabilities;

  /** Extensible by middlewares (e.g., authInfo added by auth middleware) */
  [key: string]: unknown;
}

/**
 * Result returned by a middleware or the final handler.
 */
export type MiddlewareResult = unknown;

/**
 * Function to invoke the next middleware in the chain.
 */
export type NextFunction = () => Promise<MiddlewareResult>;

/**
 * A middleware function.
 *
 * Receives the context and a `next()` function to call the next middleware.
 * Can short-circuit the pipeline by not calling `next()`.
 *
 * @example
 * ```typescript
 * const loggingMiddleware: Middleware = async (ctx, next) => {
 *   console.log(`Before: ${ctx.toolName}`);
 *   const result = await next();
 *   console.log(`After: ${ctx.toolName}`);
 *   return result;
 * };
 * ```
 */
export type Middleware = (
  ctx: MiddlewareContext,
  next: NextFunction,
) => Promise<MiddlewareResult>;
