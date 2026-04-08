/**
 * Public API contract tests for mod.ts
 *
 * Guards the deprecated re-exports from accidental removal during cleanup.
 * When `ConcurrentMCPServer` and `ConcurrentServerOptions` are dropped in
 * v1.0, this file will fail to compile — that's the signal to delete it.
 *
 * @module lib/server/mod_test
 */

import { assert, assertStrictEquals } from "@std/assert";
import { ConcurrentMCPServer, McpApp } from "../mod.ts";

Deno.test("retro-compat: ConcurrentMCPServer is the same class as McpApp", () => {
  // Strict identity — both names point to the exact same constructor.
  assertStrictEquals(ConcurrentMCPServer, McpApp);

  // instanceof passes in both directions.
  const app = new ConcurrentMCPServer({ name: "test", version: "1.0.0" });
  assert(app instanceof McpApp);
  assert(app instanceof ConcurrentMCPServer);
});
