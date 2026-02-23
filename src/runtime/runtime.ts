/**
 * Runtime adapter — Deno implementation
 *
 * Implements the RuntimePort contract for Deno.
 * For Node.js, the build script swaps this file with runtime.node.ts.
 *
 * @see runtime-types.ts for the port contract
 * @module lib/server/runtime
 */

import type {
  FetchHandler,
  RuntimePort,
  ServeHandle,
  ServeOptions,
} from "./types.ts";

// Re-export types so consumers import from a single module
export type { FetchHandler, ServeHandle, ServeOptions } from "./types.ts";

/**
 * Get an environment variable.
 */
export function env(key: string): string | undefined {
  return Deno.env.get(key);
}

/**
 * Read a UTF-8 text file.
 * Returns null if the file does not exist.
 */
export async function readTextFile(path: string): Promise<string | null> {
  try {
    return await Deno.readTextFile(path);
  } catch (err) {
    if (err instanceof Deno.errors.NotFound) {
      return null;
    }
    throw err;
  }
}

/**
 * Start an HTTP server with a fetch-style handler.
 */
export function serve(
  options: ServeOptions,
  handler: FetchHandler,
): ServeHandle {
  const server = Deno.serve(
    {
      port: options.port,
      hostname: options.hostname,
      onListen: options.onListen,
    },
    handler,
  );
  return {
    shutdown: () => server.shutdown(),
  };
}

/**
 * Unref a timer so it doesn't block process exit.
 */
export function unrefTimer(id: number): void {
  Deno.unrefTimer(id);
}

/** Compile-time contract check — ensures this module satisfies RuntimePort */
void ({ env, readTextFile, serve, unrefTimer } satisfies RuntimePort);
