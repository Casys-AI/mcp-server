import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import type { App, RegisteredAppTool } from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { ToolRegistry, viewsDeclareTools, type ViewToolDef } from "./tools.ts";
import { MCPViewError } from "./errors.ts";
import type { AppContext } from "./types.ts";

// ---- helpers ---------------------------------------------------------------

interface FakeRegisteredAppTool extends RegisteredAppTool {
  removed: boolean;
  /** Snapshot of the (name, config, cb) triple at registration time. */
  registeredAs: { name: string; config: Record<string, unknown> };
}

function fakeApp(): {
  app: App;
  registered: FakeRegisteredAppTool[];
  toolListChangedCount: number;
  // deno-lint-ignore no-explicit-any
  invoke: (name: string, args: any) => Promise<CallToolResult>;
} {
  const registered: FakeRegisteredAppTool[] = [];
  let toolListChangedCount = 0;
  // deno-lint-ignore no-explicit-any
  const callbacks = new Map<string, (args: any) => Promise<CallToolResult>>();

  const app = {
    // deno-lint-ignore no-explicit-any
    registerTool(name: string, config: any, cb: any): RegisteredAppTool {
      callbacks.set(name, cb);
      const handle = {
        title: config.title,
        description: config.description,
        inputSchema: config.inputSchema,
        outputSchema: config.outputSchema,
        annotations: config.annotations,
        _meta: config._meta,
        enabled: true,
        removed: false,
        registeredAs: { name, config },
        enable() {
          this.enabled = true;
        },
        disable() {
          this.enabled = false;
        },
        remove() {
          this.removed = true;
          callbacks.delete(name);
        },
        // deno-lint-ignore no-explicit-any
        update(updates: any) {
          Object.assign(this, updates);
        },
        // deno-lint-ignore no-explicit-any
        handler: cb as any,
      } as FakeRegisteredAppTool;
      registered.push(handle);
      return handle;
    },
    sendToolListChanged() {
      toolListChangedCount++;
      return Promise.resolve();
    },
    // deno-lint-ignore no-explicit-any
  } as any as App;

  // deno-lint-ignore no-explicit-any
  const invoke = (name: string, args: any) => {
    const cb = callbacks.get(name);
    if (!cb) throw new Error(`no callback for ${name}`);
    return cb(args);
  };

  return {
    app,
    registered,
    get toolListChangedCount() {
      return toolListChangedCount;
    },
    invoke,
  };
}

function fakeContext<S>(state: S): AppContext<S> {
  return {
    navigate: () => Promise.resolve(),
    callTool: () => Promise.reject(new Error("not used")),
    sample: () => Promise.reject(new Error("not used")),
    // deno-lint-ignore no-explicit-any
    capabilities: {} as any,
    // deno-lint-ignore no-explicit-any
    hostContext: {} as any,
    state,
    tools: {
      enable: () => {},
      disable: () => {},
      update: () => {},
      remove: () => Promise.resolve(),
    },
    // deno-lint-ignore no-explicit-any
    app: {} as any,
  };
}

// ---- viewsDeclareTools -----------------------------------------------------

Deno.test("viewsDeclareTools returns false when no view declares tools", () => {
  const views = {
    a: { render: () => "" },
    b: { render: () => "", tools: {} },
  };
  assertEquals(viewsDeclareTools(views), false);
});

Deno.test("viewsDeclareTools returns true when at least one view has tools", () => {
  const views = {
    a: { render: () => "" },
    b: {
      render: () => "",
      tools: { foo: { description: "x", handler: () => ({} as CallToolResult) } },
    },
  };
  assertEquals(viewsDeclareTools(views), true);
});

// ---- ToolRegistry: lifecycle ----------------------------------------------

Deno.test("registerForView is a no-op when tools map is undefined or empty", async () => {
  const fake = fakeApp();
  const reg = new ToolRegistry(fake.app);
  reg.setContext(fakeContext({}));

  await reg.registerForView(undefined);
  await reg.registerForView({});

  assertEquals(fake.registered.length, 0);
  assertEquals(fake.toolListChangedCount, 0);
});

Deno.test("registerForView throws if called before setContext", async () => {
  const fake = fakeApp();
  const reg = new ToolRegistry(fake.app);

  const tools: Record<string, ViewToolDef<unknown>> = {
    foo: { description: "x", handler: () => ({ content: [] } as CallToolResult) },
  };

  const err = await assertRejects(
    () => reg.registerForView(tools),
    MCPViewError,
  );
  assertEquals((err as MCPViewError).code, "ROUTER_NOT_INITIALIZED");
});

Deno.test("registerForView registers each tool and emits a single tools/list_changed", async () => {
  const fake = fakeApp();
  const reg = new ToolRegistry(fake.app);
  reg.setContext(fakeContext({}));

  await reg.registerForView({
    foo: { description: "Foo", handler: () => ({ content: [] } as CallToolResult) },
    bar: {
      description: "Bar",
      title: "Bar Tool",
      handler: () => ({ content: [] } as CallToolResult),
    },
  });

  assertEquals(fake.registered.length, 2);
  assertEquals(fake.registered[0].registeredAs.name, "foo");
  assertEquals(fake.registered[1].registeredAs.name, "bar");
  assertEquals(fake.registered[1].registeredAs.config.title, "Bar Tool");
  // Single batched notification, not one per tool.
  assertEquals(fake.toolListChangedCount, 1);
});

Deno.test("unregisterAll removes every handle and emits one tools/list_changed", async () => {
  const fake = fakeApp();
  const reg = new ToolRegistry(fake.app);
  reg.setContext(fakeContext({}));

  await reg.registerForView({
    foo: { description: "x", handler: () => ({ content: [] } as CallToolResult) },
    bar: { description: "y", handler: () => ({ content: [] } as CallToolResult) },
  });
  assertEquals(fake.toolListChangedCount, 1);

  await reg.unregisterAll();

  assertEquals(fake.registered.every((h) => h.removed), true);
  // 1 (register) + 1 (unregister batch).
  assertEquals(fake.toolListChangedCount, 2);
});

Deno.test("unregisterAll is a no-op when nothing is registered", async () => {
  const fake = fakeApp();
  const reg = new ToolRegistry(fake.app);
  reg.setContext(fakeContext({}));

  await reg.unregisterAll();
  assertEquals(fake.toolListChangedCount, 0);
});

// ---- ToolRegistry: handler wiring ----------------------------------------

Deno.test("registered handler receives the AppContext and forwards args", async () => {
  type State = { count: number };
  const fake = fakeApp();
  const reg = new ToolRegistry<State>(fake.app);
  const seen: Array<{ ctx: AppContext<State>; args: unknown }> = [];
  const ctx = fakeContext<State>({ count: 42 });
  reg.setContext(ctx);

  await reg.registerForView({
    inc: {
      description: "increment",
      handler: (innerCtx, args) => {
        seen.push({ ctx: innerCtx, args });
        return { content: [{ type: "text", text: "ok" }] } as CallToolResult;
      },
    },
  });

  const result = await fake.invoke("inc", { delta: 1 });
  assertEquals(result.content, [{ type: "text", text: "ok" }]);
  assertEquals(seen.length, 1);
  assertEquals(seen[0].ctx.state.count, 42);
  assertEquals(seen[0].args, { delta: 1 });
});

// ---- ToolsHandle: enable / disable / update / remove ---------------------

Deno.test("ctx.tools.disable / enable flip the underlying handle's enabled flag", async () => {
  const fake = fakeApp();
  const reg = new ToolRegistry(fake.app);
  reg.setContext(fakeContext({}));
  await reg.registerForView({
    foo: { description: "x", handler: () => ({ content: [] } as CallToolResult) },
  });

  reg.disable("foo");
  assertEquals(fake.registered[0].enabled, false);
  reg.enable("foo");
  assertEquals(fake.registered[0].enabled, true);
});

Deno.test("ctx.tools.update mutates description without touching schemas", async () => {
  const fake = fakeApp();
  const reg = new ToolRegistry(fake.app);
  reg.setContext(fakeContext({}));
  await reg.registerForView({
    foo: { description: "old", handler: () => ({ content: [] } as CallToolResult) },
  });

  reg.update("foo", { description: "new" });
  // deno-lint-ignore no-explicit-any
  assertEquals((fake.registered[0] as any).description, "new");
});

Deno.test("ctx.tools.remove drops the handle and emits tools/list_changed", async () => {
  const fake = fakeApp();
  const reg = new ToolRegistry(fake.app);
  reg.setContext(fakeContext({}));
  await reg.registerForView({
    foo: { description: "x", handler: () => ({ content: [] } as CallToolResult) },
  });
  const beforeCount = fake.toolListChangedCount;

  await reg.remove("foo");

  assertEquals(fake.registered[0].removed, true);
  assertEquals(fake.toolListChangedCount, beforeCount + 1);
  // After removal, ctx.tools.disable("foo") must throw UNKNOWN_TOOL.
  const err = assertThrows(() => reg.disable("foo"), MCPViewError);
  assertEquals((err as MCPViewError).code, "UNKNOWN_TOOL");
});

Deno.test("ctx.tools.{enable,disable,update,remove} throw UNKNOWN_TOOL on unknown name", async () => {
  const fake = fakeApp();
  const reg = new ToolRegistry(fake.app);
  reg.setContext(fakeContext({}));

  for (const op of ["enable", "disable"] as const) {
    const err = assertThrows(() => reg[op]("nope"), MCPViewError);
    assertEquals((err as MCPViewError).code, "UNKNOWN_TOOL");
  }
  const updateErr = assertThrows(
    () => reg.update("nope", { description: "x" }),
    MCPViewError,
  );
  assertEquals((updateErr as MCPViewError).code, "UNKNOWN_TOOL");

  const removeErr = await assertRejects(() => reg.remove("nope"), MCPViewError);
  assertEquals((removeErr as MCPViewError).code, "UNKNOWN_TOOL");
});
