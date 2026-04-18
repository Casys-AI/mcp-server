import { assertEquals, assertRejects } from "@std/assert";
import type { App, McpUiHostCapabilities } from "@modelcontextprotocol/ext-apps";

import { Router } from "./router.ts";
import type { AppContext, ViewMap } from "./types.ts";
import { defineView } from "./app.ts";

// Minimal HTMLElement stub — Deno's default test runner has no DOM. We only
// implement what Router's mount() reaches for: the HTML-string property and
// replaceChildren().
interface FakeRoot {
  innerHTML: string;
  children: unknown[];
  replaceChildren(...nodes: unknown[]): void;
}

function fakeRoot(): FakeRoot {
  const root: FakeRoot = {
    innerHTML: "",
    children: [],
    replaceChildren(...nodes: unknown[]) {
      this.children = nodes;
      this.innerHTML = "";
    },
  };
  return root;
}

function fakeContext<S>(state: S): AppContext<S> {
  return {
    navigate: () => Promise.resolve(),
    callTool: () => Promise.reject(new Error("not used in router tests")),
    capabilities: {} as McpUiHostCapabilities,
    state,
    app: {} as App,
  };
}

Deno.test("Router.goto runs onEnter then render and mounts string output", async () => {
  const events: string[] = [];
  const views: ViewMap<Record<string, never>> = {
    list: defineView({
      onEnter(_ctx) {
        events.push("enter:list");
        return "DATA";
      },
      render(_ctx, data) {
        events.push(`render:${data}`);
        return `<div>${data}</div>`;
      },
    }),
  };
  const root = fakeRoot();
  const router = new Router(views, root as unknown as HTMLElement);
  router.setContext(fakeContext({}));

  await router.goto("list", undefined);

  assertEquals(events, ["enter:list", "render:DATA"]);
  assertEquals(root.innerHTML, "<div>DATA</div>");
  assertEquals(router.currentView, "list");
});

Deno.test("Router.goto runs onLeave of previous then onEnter of target", async () => {
  const events: string[] = [];
  const views: ViewMap<Record<string, never>> = {
    list: defineView<Record<string, never>, void, void>({
      onEnter() {
        events.push("enter:list");
      },
      onLeave() {
        events.push("leave:list");
      },
      render() {
        events.push("render:list");
        return "<ul/>";
      },
    }),
    detail: defineView<Record<string, never>, { id: string }, string>({
      onEnter(_ctx, args) {
        events.push(`enter:detail:${args.id}`);
        return `detail-${args.id}`;
      },
      render(_ctx, data) {
        events.push(`render:detail:${data}`);
        return `<section>${data}</section>`;
      },
    }),
  };
  const root = fakeRoot();
  const router = new Router(views, root as unknown as HTMLElement);
  router.setContext(fakeContext({}));

  await router.goto("list", undefined);
  await router.goto("detail", { id: "42" });

  assertEquals(events, [
    "enter:list",
    "render:list",
    "leave:list",
    "enter:detail:42",
    "render:detail:detail-42",
  ]);
  assertEquals(router.currentView, "detail");
});

Deno.test("Router.goto forwards args to onEnter", async () => {
  let received: unknown = null;
  const views: ViewMap<Record<string, never>> = {
    v: defineView<Record<string, never>, { x: number }, void>({
      onEnter(_ctx, args) {
        received = args;
      },
      render() {
        return "";
      },
    }),
  };
  const router = new Router(views, fakeRoot() as unknown as HTMLElement);
  router.setContext(fakeContext({}));

  await router.goto("v", { x: 7 });
  assertEquals(received, { x: 7 });
});

Deno.test("Router.goto throws on unknown view name", async () => {
  const views: ViewMap<Record<string, never>> = {
    a: defineView<Record<string, never>>({ render: () => "" }),
  };
  const router = new Router(views, fakeRoot() as unknown as HTMLElement);
  router.setContext(fakeContext({}));

  await assertRejects(
    () => router.goto("nonexistent", undefined),
    Error,
    'Unknown view "nonexistent"',
  );
});

Deno.test("Router re-navigating to same view re-runs lifecycle", async () => {
  const events: string[] = [];
  const views: ViewMap<Record<string, never>> = {
    self: defineView<Record<string, never>, { n: number }, number>({
      onEnter(_ctx, args) {
        events.push(`enter:${args.n}`);
        return args.n;
      },
      onLeave() {
        events.push("leave");
      },
      render(_ctx, n) {
        events.push(`render:${n}`);
        return `<span>${n}</span>`;
      },
    }),
  };
  const router = new Router(views, fakeRoot() as unknown as HTMLElement);
  router.setContext(fakeContext({}));

  await router.goto("self", { n: 1 });
  await router.goto("self", { n: 2 });

  assertEquals(events, ["enter:1", "render:1", "leave", "enter:2", "render:2"]);
});

Deno.test("Router.goto propagates errors from onEnter", async () => {
  const views: ViewMap<Record<string, never>> = {
    boom: defineView<Record<string, never>>({
      onEnter() {
        throw new Error("kaboom");
      },
      render: () => "",
    }),
  };
  const router = new Router(views, fakeRoot() as unknown as HTMLElement);
  router.setContext(fakeContext({}));

  await assertRejects(() => router.goto("boom", undefined), Error, "kaboom");
});

Deno.test("Router.currentView throws before first navigation", () => {
  const views: ViewMap<Record<string, never>> = {
    a: defineView<Record<string, never>>({ render: () => "" }),
  };
  const router = new Router(views, fakeRoot() as unknown as HTMLElement);
  let threw = false;
  try {
    router.currentView;
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("Router.goto throws 'called before setContext' if context missing", async () => {
  const views: ViewMap<Record<string, never>> = {
    a: defineView<Record<string, never>>({ render: () => "" }),
  };
  const router = new Router(views, fakeRoot() as unknown as HTMLElement);
  // setContext intentionally NOT called

  await assertRejects(
    () => router.goto("a", undefined),
    Error,
    "Router.goto called before setContext",
  );
});

Deno.test("Router.goto propagates errors from onLeave and leaves router in clean state", async () => {
  const events: string[] = [];
  const views: ViewMap<Record<string, never>> = {
    first: defineView<Record<string, never>, void, void>({
      onEnter() {
        events.push("enter:first");
      },
      onLeave() {
        events.push("leave:first");
        throw new Error("onLeave exploded");
      },
      render() {
        events.push("render:first");
        return "<p>first</p>";
      },
    }),
    second: defineView<Record<string, never>, void, void>({
      onEnter() {
        events.push("enter:second");
      },
      render() {
        events.push("render:second");
        return "<p>second</p>";
      },
    }),
  };
  const router = new Router(views, fakeRoot() as unknown as HTMLElement);
  router.setContext(fakeContext({}));

  // Initial navigation succeeds.
  await router.goto("first", undefined);
  assertEquals(router.currentView, "first");

  // Navigation away throws via onLeave.
  await assertRejects(
    () => router.goto("second", undefined),
    Error,
    "onLeave exploded",
  );
  // _currentView must be null (cleared before onLeave) — not "first".
  // We verify by checking that the next goto does NOT trigger a second onLeave
  // on "first".
  events.length = 0;

  // Next goto after the error should succeed without re-triggering onLeave of first.
  await router.goto("second", undefined);
  assertEquals(events, ["enter:second", "render:second"]);
  assertEquals(router.currentView, "second");
});

Deno.test("Router.goto serializes concurrent calls", async () => {
  const order: string[] = [];

  // Each view records enter/leave events so we can detect interleaving.
  const views: ViewMap<Record<string, never>> = {
    a: defineView<Record<string, never>, void, void>({
      async onEnter() {
        order.push("enter:a");
        // Yield to let other microtasks run — verifies serialization.
        await Promise.resolve();
      },
      async onLeave() {
        order.push("leave:a");
        await Promise.resolve();
      },
      render() {
        order.push("render:a");
        return "<p>a</p>";
      },
    }),
    b: defineView<Record<string, never>, void, void>({
      async onEnter() {
        order.push("enter:b");
        await Promise.resolve();
      },
      render() {
        order.push("render:b");
        return "<p>b</p>";
      },
    }),
  };
  const router = new Router(views, fakeRoot() as unknown as HTMLElement);
  router.setContext(fakeContext({}));

  // Fire two concurrent gotos without awaiting between them.
  const p1 = router.goto("a", undefined);
  const p2 = router.goto("b", undefined);
  await Promise.all([p1, p2]);

  // The full lifecycle of "a" must complete before "b" begins.
  assertEquals(order, [
    "enter:a",
    "render:a",
    "leave:a",
    "enter:b",
    "render:b",
  ]);
  assertEquals(router.currentView, "b");
});
