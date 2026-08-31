import { assertEquals, assertRejects, assertStrictEquals } from "@std/assert";

import type { AppContext } from "@casys/mcp-view";
import type { ViewComponentRegistry } from "../components.ts";
import {
  definePreactComponent,
  type PreactComponentRenderer,
  type PreactSurfaceAppState,
  type PreactSurfaceComponentProps,
  type PreactSurfaceContext,
  startPreactSurfaceApp,
} from "./surface.ts";

interface Data {
  title: string;
}

type TestAppContext = AppContext<PreactSurfaceAppState<Data>>;

Deno.test("definePreactComponent forwards component surface context and cleans up", async () => {
  const events: string[] = [];
  let receivedProps: PreactSurfaceComponentProps<Data, TestAppContext> | undefined;
  const renderer: PreactComponentRenderer = {
    mount(_component, props, target) {
      events.push("mount");
      receivedProps = props as PreactSurfaceComponentProps<Data, TestAppContext>;
      assertStrictEquals(target, targetNode);
    },
    unmount(target) {
      events.push("unmount");
      assertStrictEquals(target, targetNode);
    },
  };
  const targetNode = {} as HTMLElement;
  const appContext = {} as TestAppContext;
  const data = { title: "Boiler" };
  const Component = (_props: PreactSurfaceComponentProps<Data, TestAppContext>) => null;
  const definition = definePreactComponent<Data, TestAppContext>(
    { title: "Identity" },
    Component,
    renderer,
  );

  const cleanup = await definition.mount(targetNode, {
    data,
    props: { compact: true },
    instanceId: "identity-1",
    appContext,
    hostContext: {},
  });

  assertStrictEquals(receivedProps?.data, data);
  assertStrictEquals(receivedProps?.context, appContext);
  assertEquals(receivedProps?.props, { compact: true });
  assertEquals(receivedProps?.instanceId, "identity-1");
  assertEquals(events, ["mount"]);

  await cleanup?.();
  assertEquals(events, ["mount", "unmount"]);
});

Deno.test("recorded sessions require an App validator and data mapper as one pair", async () => {
  type Result = Record<string, unknown>;
  type Session = { readonly schema: "io.casys.test.session/1.0" };
  const registry = {} as ViewComponentRegistry<Result, PreactSurfaceContext<Result>>;

  await assertRejects(
    () =>
      startPreactSurfaceApp<Result, Session>({
        root: {} as HTMLElement,
        info: { name: "Session test", version: "1.0.0" },
        registry,
        validateSession: (value): value is Session =>
          typeof value === "object" && value !== null &&
          (value as { schema?: unknown }).schema === "io.casys.test.session/1.0",
      }),
    TypeError,
    "requires both validateSession and mapSessionToData",
  );
});
