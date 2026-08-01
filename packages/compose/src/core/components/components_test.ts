import { assertEquals } from "@std/assert";
import { resolveComponentSurface } from "./components.ts";
import type { AdvertisedComponentCatalog } from "../types/components.ts";

const catalog: AdvertisedComponentCatalog = {
  components: {
    "modelica.status": { title: "Status" },
    "modelica.metrics": { title: "Metrics" },
  },
  defaultSurface: {
    layout: { type: "stack" },
    components: [
      { id: "status", component: "modelica.status" },
      { id: "metrics", component: "modelica.metrics" },
    ],
  },
};

Deno.test("component surface resolver uses the App default without inventing size modes", () => {
  assertEquals(resolveComponentSurface(catalog), {
    status: "ready",
    source: "default",
    surface: catalog.defaultSurface!,
  });
});

Deno.test("component surface resolver accepts an explicit subset and layout", () => {
  const requested = {
    layout: { type: "grid" as const, columns: 2, gap: "sm" as const },
    components: [{ id: "metrics", component: "modelica.metrics" }],
  };
  assertEquals(resolveComponentSurface(catalog, requested), {
    status: "ready",
    source: "requested",
    surface: requested,
  });
});

Deno.test("component-only catalogs require an explicit host surface", () => {
  assertEquals(
    resolveComponentSurface({ components: catalog.components }),
    {
      status: "unresolved",
      reason: "surface-required",
    },
  );
});

Deno.test("component surface resolver reports unknown components explicitly", () => {
  assertEquals(
    resolveComponentSurface(catalog, {
      layout: { type: "stack" },
      components: [
        { id: "chart", component: "modelica.chart" },
        { id: "unknown", component: "modelica.unknown" },
      ],
    }),
    {
      status: "unresolved",
      reason: "unknown-components",
      missingComponents: ["modelica.chart", "modelica.unknown"],
    },
  );
});
