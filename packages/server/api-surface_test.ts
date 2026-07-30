/**
 * Public API surface, from a consumer's point of view.
 *
 * Every import below goes through `mod.ts`, the path a consumer actually uses —
 * not through `src/`. Internal tests reach into sub-modules directly and so prove
 * nothing about whether a feature is *reachable* once published.
 *
 * This exists because the Tasks extension shipped fully wired and fully tested
 * while `createTask` was absent from the barrel: no consumer could have opted a
 * tool into async mode. Nothing else in the suite noticed.
 *
 * @module lib/server/api-surface_test
 */

import { assertEquals } from "@std/assert";
import {
  createTask,
  exportStateKey,
  generateStateKey,
  McpApp,
  type MrtrOptions,
  sealRequestState,
  type SubscriptionFilter,
  SubscriptionRegistry,
  verifyRequestState,
} from "./mod.ts";

Deno.test("api surface - a consumer can configure all three 2026-07-28 features", () => {
  // Type-level as much as runtime: if an option or type were missing from the
  // barrel this would not compile.
  const app = new McpApp({
    name: "api-surface",
    version: "1.0.0",
    logger: () => {},
    transport: "stateless",
    extensions: { "io.modelcontextprotocol/tasks": {} },
    mrtr: { signingKey: "b".repeat(64) } satisfies MrtrOptions,
    cache: { ttlMs: 60_000, scope: "public" },
  });

  assertEquals(typeof app.registerTool, "function");
  assertEquals(typeof app.sendNotification, "function");
});

Deno.test("api surface - createTask is reachable and a tool can return it", () => {
  // The gap that motivated this file: Tasks was wired end-to-end while the one
  // function a handler needs was unexported.
  const app = new McpApp({
    name: "api-surface-tasks",
    version: "1.0.0",
    logger: () => {},
    transport: "stateless",
    extensions: { "io.modelcontextprotocol/tasks": {} },
  });

  app.registerTool(
    { name: "scan", description: "Long scan", inputSchema: { type: "object" } },
    () =>
      createTask({ pollIntervalMs: 10 }, async () => {
        await Promise.resolve();
        return { rows: 1 };
      }),
  );

  const descriptor = createTask({}, () => Promise.resolve("x"));
  assertEquals(typeof descriptor.run, "function");
});

Deno.test("api surface - the MRTR primitives round-trip through the public path", async () => {
  const key = await generateStateKey();
  const hex = await exportStateKey(key);
  assertEquals(hex.length, 64);

  const token = await sealRequestState({
    sub: "user-1",
    method: "tools/call",
    paramsDigest: "d".repeat(64),
    exp: Math.floor(Date.now() / 1000) + 60,
    nonce: "e".repeat(32),
  }, key);

  const verdict = await verifyRequestState(token, key, {
    principal: "user-1",
    method: "tools/call",
    paramsDigest: "d".repeat(64),
  });
  assertEquals(verdict.ok, true);
});

Deno.test("api surface - the subscription registry and its filter type are exported", () => {
  const filter: SubscriptionFilter = { toolsListChanged: true };
  const registry = new SubscriptionRegistry({
    serverInfo: { name: "api-surface", version: "1.0.0" },
    serverSupports: filter,
  });
  assertEquals(registry.computeAgreedFilter({ toolsListChanged: true }), {
    toolsListChanged: true,
  });
  // An allowlist: a type the mask omits is not granted.
  assertEquals(
    registry.computeAgreedFilter({ promptsListChanged: true }),
    {},
  );
  registry.shutdown();
});
