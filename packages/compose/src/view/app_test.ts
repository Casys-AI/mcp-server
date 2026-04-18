import { assertEquals, assertRejects } from "@std/assert";

import { createMcpApp, defineView } from "./app.ts";
import type { AppConfig } from "./types.ts";

// ---------------------------------------------------------------------------
// Validation tests — these exercise createMcpApp's config guards BEFORE any
// transport is touched, so they don't need a DOM/window mock.
// ---------------------------------------------------------------------------

const minimalInfo = { name: "TestApp", version: "0.0.0" };

Deno.test("createMcpApp rejects when initialView is not a registered view", async () => {
  const cfg = {
    info: minimalInfo,
    // Cast: in a browser root would be HTMLElement; we never reach any DOM op
    // because validation fires first.
    root: {} as unknown as HTMLElement,
    views: {
      list: defineView<Record<string, never>>({ render: () => "" }),
    },
    initialView: "missing",
  } as unknown as AppConfig;

  await assertRejects(
    () => createMcpApp(cfg),
    Error,
    'initialView "missing" is not a registered view',
  );
});

Deno.test("createMcpApp rejects when views is empty", async () => {
  const cfg = {
    info: minimalInfo,
    root: {} as unknown as HTMLElement,
    views: {},
    initialView: "x",
  } as unknown as AppConfig;

  await assertRejects(
    () => createMcpApp(cfg),
    Error,
    "`views` must contain at least one view",
  );
});

Deno.test("createMcpApp rejects when root is missing", async () => {
  const cfg = {
    info: minimalInfo,
    views: {
      list: defineView<Record<string, never>>({ render: () => "" }),
    },
    initialView: "list",
  } as unknown as AppConfig;

  await assertRejects(() => createMcpApp(cfg), Error, "`root` is required");
});

Deno.test("createMcpApp rejects when no window.parent is available", async () => {
  // Deno's default global has no `window.parent`. Confirm we throw the
  // documented message instead of crashing mid-transport.
  const cfg: AppConfig = {
    info: minimalInfo,
    root: {} as unknown as HTMLElement,
    views: {
      list: defineView<Record<string, never>>({ render: () => "ok" }),
    },
    initialView: "list",
  };

  await assertRejects(
    () => createMcpApp(cfg),
    Error,
    "no `window.parent` available",
  );
});

Deno.test("defineView is an identity function", () => {
  const v = {
    render: () => "x",
  };
  const out = defineView<Record<string, never>>(v);
  // Same reference: no wrapping, no side effects.
  assertEquals(out, v);
});

Deno.test("validateConfig throws when a view is missing render", async () => {
  const cfg = {
    info: minimalInfo,
    root: {} as unknown as HTMLElement,
    views: {
      // deno-lint-ignore no-explicit-any
      broken: {} as any, // no render function
    },
    initialView: "broken",
  } as unknown as AppConfig;

  await assertRejects(
    () => createMcpApp(cfg),
    Error,
    'View "broken" is missing a render function',
  );
});
