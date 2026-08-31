import { assertEquals, assertRejects, assertThrows } from "@std/assert";
import {
  activeComponentSurface,
  advertisedComponentCatalog,
  CASYS_SURFACE_CONTEXT_KEY,
  componentCatalogCapabilities,
  defineComponentRegistry,
  defineComponentSurface,
  defineViewComponent,
  type McpViewHostContext,
  mountComponentSurface,
  readSurfaceContext,
} from "./components.ts";

function registry(cleanups: string[] = []) {
  return defineComponentRegistry({
    components: {
      "test.status": defineViewComponent({
        descriptor: {
          title: "Status",
          events: {
            emits: ["semantic.selection.changed"],
            accepts: ["semantic.selection.apply"],
          },
        },
        mount(target, context) {
          target.textContent = String((context.data as { status: string }).status);
          return () => {
            cleanups.push(context.instanceId);
          };
        },
      }),
      "test.metrics": defineViewComponent({
        descriptor: { title: "Metrics", description: "Typed values" },
        mount(target) {
          target.textContent = "metrics";
        },
      }),
    },
    defaultSurface: {
      layout: { type: "stack", gap: "sm" },
      components: [{ id: "status", component: "test.status" }],
    },
  });
}

Deno.test("component registry advertises descriptors and a default surface, never mount code", () => {
  const value = advertisedComponentCatalog(registry());
  assertEquals(value, {
    components: {
      "test.status": {
        title: "Status",
        events: {
          emits: ["semantic.selection.changed"],
          accepts: ["semantic.selection.apply"],
        },
      },
      "test.metrics": { title: "Metrics", description: "Typed values" },
    },
    defaultSurface: {
      layout: { type: "stack", gap: "sm" },
      components: [{ id: "status", component: "test.status" }],
    },
  });
  assertEquals(
    Object.keys(componentCatalogCapabilities(registry())),
    ["io.casys.mcp.view-components/v1"],
  );
});

Deno.test("component-only registries advertise no artificial standalone surface", () => {
  const value = advertisedComponentCatalog(defineComponentRegistry({
    components: registry().components,
  }));
  assertEquals(value, {
    components: {
      "test.status": {
        title: "Status",
        events: {
          emits: ["semantic.selection.changed"],
          accepts: ["semantic.selection.apply"],
        },
      },
      "test.metrics": { title: "Metrics", description: "Typed values" },
    },
  });
  assertEquals(
    activeComponentSurface(
      defineComponentRegistry({ components: registry().components }),
      {},
    ),
    undefined,
  );
});

Deno.test("component descriptors reject malformed or duplicate Compose event ports", () => {
  assertThrows(
    () =>
      defineViewComponent({
        descriptor: { title: "Broken", events: { emits: ["  "] } },
        mount() {},
      }),
    TypeError,
    "non-empty",
  );
  assertThrows(
    () =>
      defineViewComponent({
        descriptor: {
          title: "Duplicate",
          events: { accepts: ["semantic.selection.apply", "semantic.selection.apply"] },
        },
        mount() {},
      }),
    TypeError,
    "Duplicate",
  );
});

Deno.test("surface definitions reject arbitrary CSS, duplicate ids, and unknown components", () => {
  assertThrows(
    () =>
      defineComponentSurface({
        layout: { type: "grid", columns: 13 },
        components: [{ id: "one", component: "test.status" }],
      }),
    TypeError,
    "1 to 12",
  );
  assertThrows(
    () =>
      defineComponentSurface({
        layout: { type: "stack" },
        components: [
          { id: "one", component: "test.status" },
          { id: "one", component: "test.metrics" },
        ],
      }),
    TypeError,
    "Duplicate",
  );
  assertThrows(
    () =>
      defineComponentRegistry({
        components: registry().components,
        defaultSurface: {
          layout: { type: "stack" },
          components: [{ id: "missing", component: "test.missing" }],
        },
      }),
    TypeError,
    "Unknown surface components",
  );
});

Deno.test("negotiated surface replaces the default without size modes", () => {
  const requested = defineComponentSurface({
    layout: { type: "grid", columns: 2, gap: "md" },
    components: [
      { id: "status", component: "test.status" },
      { id: "metrics", component: "test.metrics" },
    ],
  });
  const hostContext = {
    [CASYS_SURFACE_CONTEXT_KEY]: {
      instanceId: "simulation",
      status: "ready",
      source: "requested",
      surface: requested,
    },
  } as McpViewHostContext;
  assertEquals(readSurfaceContext(hostContext)?.status, "ready");
  assertEquals(activeComponentSurface(registry(), hostContext), requested);
  assertEquals(activeComponentSurface(registry(), {}), registry().defaultSurface);
});

Deno.test({
  name: "surface runtime mounts declared components and cleans them up in reverse order",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const cleanup: string[] = [];
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML("<html><body><div id=root></div></body></html>");
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
    try {
      const root = dom.document.getElementById("root") as unknown as HTMLElement;
      const mounted = await mountComponentSurface({
        root,
        registry: registry(cleanup),
        data: { status: "succeeded" },
        appContext: {},
        hostContext: {},
        surface: {
          layout: { type: "row", gap: "xs" },
          components: [
            { id: "first", component: "test.status" },
            { id: "second", component: "test.status" },
          ],
        },
      });
      assertEquals(root.querySelectorAll("[data-component='test.status']").length, 2);
      assertEquals(root.textContent, "succeededsucceeded");
      await mounted.dispose();
      assertEquals(cleanup, ["second", "first"]);
      assertEquals(root.textContent, "");
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

Deno.test("surface runtime rejects an unknown requested component before mutating the root", async () => {
  const documentModule = await import("npm:linkedom@0.18.12");
  const dom = documentModule.parseHTML("<html><body><div id=root>preserved</div></body></html>");
  const previousDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
  try {
    const root = dom.document.getElementById("root") as unknown as HTMLElement;
    await assertRejects(
      () =>
        mountComponentSurface({
          root,
          registry: registry(),
          data: { status: "ready" },
          appContext: {},
          hostContext: {},
          surface: {
            layout: { type: "stack" },
            components: [{ id: "bad", component: "test.unknown" }],
          },
        }),
      TypeError,
      "Unknown surface components",
    );
    assertEquals(root.textContent, "preserved");
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previousDocument,
    });
  }
});

Deno.test("component-only runtime requires a host-selected surface", async () => {
  await assertRejects(
    () =>
      mountComponentSurface({
        root: {} as HTMLElement,
        registry: defineComponentRegistry({ components: registry().components }),
        data: { status: "ready" },
        appContext: {},
        hostContext: {},
      }),
    TypeError,
    "host-selected surface",
  );
});
