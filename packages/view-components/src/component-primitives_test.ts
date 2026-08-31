import { assertEquals } from "@std/assert";
import {
  defineKeyValueComponent,
  defineMetricGridComponent,
  defineStatusComponent,
} from "./component-primitives.ts";

Deno.test({
  name: "standard components render data as safe semantic DOM",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML("<html><body></body></html>");
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
    try {
      const status = defineStatusComponent<{ status: string }>({
        title: "Status",
        select: (data) => ({ label: data.status, tone: "success" }),
      });
      const metrics = defineMetricGridComponent<{ value: number }>({
        title: "Metrics",
        select: (
          data,
        ) => [{ id: "temperature", label: "Temperature", value: data.value, unit: "°C" }],
      });
      const facts = defineKeyValueComponent<{ model: string }>({
        title: "Identity",
        select: (data) => [{ key: "model", label: "Model", value: data.model }],
      });
      const targets = [0, 1, 2].map(() => dom.document.createElement("section"));
      await status.mount(targets[0] as unknown as HTMLElement, context({ status: "<b>ok</b>" }));
      await metrics.mount(targets[1] as unknown as HTMLElement, context({ value: 94 }));
      await facts.mount(
        targets[2] as unknown as HTMLElement,
        context({ model: "coffee-machine-v1" }),
      );

      assertEquals(targets[0].innerHTML.includes("<b>"), false);
      assertEquals(targets[0].textContent, "<b>ok</b>");
      assertEquals(targets[0].dataset.tone, "success");
      assertEquals(targets[1].textContent, "Temperature94°C");
      assertEquals(targets[2].textContent, "Modelcoffee-machine-v1");
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

function context<T>(data: T) {
  return {
    data,
    props: {},
    instanceId: "test",
    appContext: {},
    hostContext: {},
  };
}
