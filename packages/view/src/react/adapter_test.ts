import {
  assertEquals,
  assertInstanceOf,
  assertRejects,
  assertStrictEquals,
  assertThrows,
} from "@std/assert";
import type { App, McpUiHostCapabilities } from "@modelcontextprotocol/ext-apps";

import type { AppContext } from "../types.ts";
import { Router } from "../router.ts";
import type { ViewToolDef } from "../tools.ts";
import {
  defineReactView,
  type ReactViewProps,
  type ReactViewRenderer,
  type ReactViewRoot,
} from "./adapter.ts";

interface State {
  selectedId?: string;
}

interface Data {
  title: string;
}

interface FakeElement {
  component: unknown;
  props: ReactViewProps<State, Data>;
}

interface FakeContainer {
  kind: "react-container";
}

function fakeContext(state: State = {}): AppContext<State> {
  return {
    navigate: () => Promise.resolve(),
    callTool: () => Promise.reject(new Error("not used")),
    sample: () => Promise.reject(new Error("not used")),
    capabilities: {} as McpUiHostCapabilities,
    hostContext: {},
    state,
    tools: {
      enable: () => {},
      disable: () => {},
      update: () => {},
      remove: () => {},
    },
    app: {} as App,
  };
}

function fakeRenderer(events: string[] = []): {
  renderer: ReactViewRenderer;
  roots: Array<ReactViewRoot & { rendered: unknown[] }>;
  containers: FakeContainer[];
} {
  const roots: Array<ReactViewRoot & { rendered: unknown[] }> = [];
  const containers: FakeContainer[] = [];

  const renderer: ReactViewRenderer = {
    createContainer() {
      events.push("container");
      const container: FakeContainer = { kind: "react-container" };
      containers.push(container);
      return container as unknown as HTMLElement;
    },
    createRoot(container) {
      events.push("root");
      assertStrictEquals(container, containers.at(-1) as unknown as HTMLElement);
      const root = {
        rendered: [] as unknown[],
        render(node: unknown) {
          events.push("react:render");
          this.rendered.push(node);
        },
        unmount() {
          events.push("react:unmount");
        },
      };
      roots.push(root);
      return root;
    },
    createElement(component, props) {
      events.push("element");
      return { component, props } as never;
    },
  };

  return { renderer, roots, containers };
}

Deno.test("defineReactView forwards typed ctx/data props and composes onEnter", async () => {
  const events: string[] = [];
  const { renderer, roots, containers } = fakeRenderer(events);
  const ctx = fakeContext({ selectedId: "before" });
  const Component = (_props: ReactViewProps<State, Data>) => null;

  const view = defineReactView<State, { id: string }, Data>({
    component: Component,
    onEnter(receivedCtx, args) {
      events.push(`enter:${args.id}`);
      assertStrictEquals(receivedCtx, ctx);
      receivedCtx.state.selectedId = args.id;
      return { title: `Item ${args.id}` };
    },
  }, renderer);

  const data = await view.onEnter?.(ctx, { id: "42" });
  const output = view.render(ctx, data as Data);

  assertStrictEquals(output, containers[0] as unknown as Node);
  assertEquals(events, ["enter:42", "container", "root", "element", "react:render"]);
  assertEquals(roots.length, 1);

  const element = roots[0].rendered[0] as FakeElement;
  assertStrictEquals(element.component, Component);
  assertStrictEquals(element.props.ctx, ctx);
  assertStrictEquals(element.props.data, data);
  assertEquals(ctx.state.selectedId, "42");
});

Deno.test("defineReactView preserves declared tools", () => {
  const { renderer } = fakeRenderer();
  const tools: Record<string, ViewToolDef<State>> = {
    refresh: {
      description: "Refresh the view",
      handler: () => ({ content: [{ type: "text", text: "ok" }] }),
    },
  };

  const view = defineReactView<State>({
    component: () => null,
    tools,
  }, renderer);

  assertStrictEquals(view.tools, tools);
});

Deno.test("defineReactView runs user onLeave before React unmount", async () => {
  const events: string[] = [];
  const { renderer } = fakeRenderer(events);
  const ctx = fakeContext();
  const view = defineReactView<State>({
    component: () => null,
    async onLeave(receivedCtx) {
      assertStrictEquals(receivedCtx, ctx);
      events.push("user:leave");
      await Promise.resolve();
    },
  }, renderer);

  view.render(ctx, undefined);
  await view.onLeave?.(ctx);

  assertEquals(events, [
    "container",
    "root",
    "element",
    "react:render",
    "user:leave",
    "react:unmount",
  ]);
});

Deno.test("defineReactView still unmounts when user onLeave rejects", async () => {
  const events: string[] = [];
  const { renderer } = fakeRenderer(events);
  const ctx = fakeContext();
  const view = defineReactView<State>({
    component: () => null,
    onLeave() {
      events.push("user:leave");
      throw new Error("custom cleanup failed");
    },
  }, renderer);

  view.render(ctx, undefined);
  await assertRejects(
    () => view.onLeave?.(ctx) ?? Promise.resolve(),
    Error,
    "custom cleanup failed",
  );

  assertEquals(events.at(-1), "react:unmount");
});

Deno.test("defineReactView preserves both user and React cleanup errors", async () => {
  const renderer: ReactViewRenderer = {
    createContainer: () => ({}) as HTMLElement,
    createRoot: () => ({
      render() {},
      unmount() {
        throw new Error("React cleanup failed");
      },
    }),
    createElement: () => null,
  };
  const view = defineReactView<State>({
    component: () => null,
    onLeave() {
      throw new Error("user cleanup failed");
    },
  }, renderer);
  const ctx = fakeContext();
  view.render(ctx, undefined);

  let caught: unknown;
  try {
    await view.onLeave?.(ctx);
  } catch (error) {
    caught = error;
  }

  assertInstanceOf(caught, AggregateError);
  assertEquals(caught.errors.map((error) => (error as Error).message), [
    "user cleanup failed",
    "React cleanup failed",
  ]);
});

Deno.test("defineReactView onLeave is idempotent after the root was unmounted", async () => {
  const events: string[] = [];
  const { renderer } = fakeRenderer(events);
  const ctx = fakeContext();
  const view = defineReactView<State>({ component: () => null }, renderer);

  view.render(ctx, undefined);
  await view.onLeave?.(ctx);
  await view.onLeave?.(ctx);

  assertEquals(events.filter((event) => event === "react:unmount").length, 1);
});

Deno.test("defineReactView replaces an orphaned root before rendering again", () => {
  const events: string[] = [];
  const { renderer } = fakeRenderer(events);
  const ctx = fakeContext();
  const view = defineReactView<State>({ component: () => null }, renderer);

  view.render(ctx, undefined);
  view.render(ctx, undefined);

  assertEquals(events.filter((event) => event === "react:unmount").length, 1);
  assertEquals(events.filter((event) => event === "react:render").length, 2);
});

Deno.test("defineReactView keeps roots isolated when a definition is reused", async () => {
  const events: string[] = [];
  const { renderer, roots } = fakeRenderer(events);
  const firstCtx = fakeContext();
  const secondCtx = fakeContext();
  const view = defineReactView<State>({ component: () => null }, renderer);

  view.render(firstCtx, undefined);
  view.render(secondCtx, undefined);
  assertEquals(events.filter((event) => event === "react:unmount").length, 0);

  await view.onLeave?.(firstCtx);
  assertEquals(events.filter((event) => event === "react:unmount").length, 1);
  assertEquals(roots.length, 2);

  await view.onLeave?.(secondCtx);
  assertEquals(events.filter((event) => event === "react:unmount").length, 2);
});

Deno.test("Router.dispose deterministically unmounts the active React view", async () => {
  const events: string[] = [];
  const { renderer } = fakeRenderer(events);
  const view = defineReactView<State>({ component: () => null }, renderer);
  const root = {
    children: [] as unknown[],
    replaceChildren(...nodes: unknown[]) {
      this.children = nodes;
    },
  };
  const router = new Router({ react: view }, root as unknown as HTMLElement);
  router.setContext(fakeContext());

  await router.goto("react", undefined);
  assertEquals(root.children.length, 1);

  await Promise.all([router.dispose(), router.dispose()]);
  assertEquals(events.filter((event) => event === "react:unmount").length, 1);
  assertEquals(root.children, []);
});

Deno.test("defineReactView unmounts the new root when React render throws", () => {
  const events: string[] = [];
  const renderer: ReactViewRenderer = {
    createContainer: () => ({}) as HTMLElement,
    createRoot: () => ({
      render() {
        events.push("react:render");
        throw new Error("React render failed");
      },
      unmount() {
        events.push("react:unmount");
      },
    }),
    createElement: () => null,
  };
  const view = defineReactView<State>({ component: () => null }, renderer);

  assertThrows(() => view.render(fakeContext(), undefined), Error, "React render failed");
  assertEquals(events, ["react:render", "react:unmount"]);
});
