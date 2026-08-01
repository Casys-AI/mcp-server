import { assertEquals, assertStrictEquals } from "@std/assert";

import type { AppContext } from "../types.ts";
import {
  definePreactComponent,
  type PreactComponentRenderer,
  type PreactSurfaceAppState,
  type PreactSurfaceComponentProps,
} from "./surface.ts";

interface Data {
  title: string;
}

Deno.test("definePreactComponent forwards component surface context and cleans up", async () => {
  const events: string[] = [];
  let receivedProps: PreactSurfaceComponentProps<Data> | undefined;
  const renderer: PreactComponentRenderer = {
    mount(_component, props, target) {
      events.push("mount");
      receivedProps = props as PreactSurfaceComponentProps<Data>;
      assertStrictEquals(target, targetNode);
    },
    unmount(target) {
      events.push("unmount");
      assertStrictEquals(target, targetNode);
    },
  };
  const targetNode = {} as HTMLElement;
  const appContext = {} as AppContext<PreactSurfaceAppState<Data>>;
  const data = { title: "Boiler" };
  const Component = (_props: PreactSurfaceComponentProps<Data>) => null;
  const definition = definePreactComponent<Data>(
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
