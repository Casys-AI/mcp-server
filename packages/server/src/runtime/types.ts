/**
 * Runtime Port — platform-agnostic contract
 *
 * Defines the interface that both Deno (runtime.ts) and Node.js (runtime.node.ts)
 * must implement. This is the only file consumers need to understand the API shape.
 *
 * Pattern: each runtime file exports module-level functions that satisfy this port.
 * The build script swaps runtime.ts → runtime.node.ts for Node.js distribution.
 *
 * @module lib/server/runtime-types
 */

// ─── Environment ─────────────────────────────────────────

/**
 * Get an environment variable.
 * Returns undefined if not set (never throws).
 */
export type EnvFn = (key: string) => string | undefined;

// ─── File System ─────────────────────────────────────────

/**
 * Read a UTF-8 text file.
 * Returns null if the file does not exist (no throw on ENOENT/NotFound).
 * Throws on other errors (permission denied, etc.).
 */
export type ReadTextFileFn = (path: string) => Promise<string | null>;

// ─── HTTP Server ─────────────────────────────────────────

/** Fetch-style request handler (Web standard) */
export type FetchHandler = (req: Request) => Response | Promise<Response>;

/** Options for starting an HTTP server */
export interface ServeOptions {
  port: number;
  hostname?: string;
  onListen?: (info: { hostname: string; port: number }) => void;
  /** Maximum request body size in bytes (optional, adapter-specific). */
  maxBodyBytes?: number | null;
}

/** Handle returned by serve(), used to shut down the server */
export interface ServeHandle {
  shutdown(): Promise<void>;
}

/**
 * Start an HTTP server with a fetch-style handler.
 *
 * Deno: wraps Deno.serve()
 * Node.js: wraps node:http.createServer() with Request/Response adapter
 */
export type ServeFn = (
  options: ServeOptions,
  handler: FetchHandler,
) => ServeHandle;

// ─── Timers ──────────────────────────────────────────────

/**
 * Unref a timer so it doesn't prevent process exit.
 *
 * Deno: Deno.unrefTimer(id)
 * Node.js: timer.unref() on the Timeout object
 */
export type UnrefTimerFn = (id: number) => void;

// ─── Port interface ──────────────────────────────────────

/**
 * Complete runtime port contract.
 *
 * Both runtime.ts (Deno) and runtime.node.ts (Node.js) must export
 * functions matching these signatures. Use `satisfies RuntimePort`
 * at the bottom of each implementation to enforce at compile time.
 *
 * @example
 * ```typescript
 * // At the bottom of runtime.ts / runtime.node.ts:
 * export const _port = { env, readTextFile, serve, unrefTimer } satisfies RuntimePort;
 * ```
 */
export interface RuntimePort {
  env: EnvFn;
  readTextFile: ReadTextFileFn;
  serve: ServeFn;
  unrefTimer: UnrefTimerFn;
}
