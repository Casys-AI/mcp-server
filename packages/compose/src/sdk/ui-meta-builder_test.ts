/**
 * Tests for the uiMeta() builder.
 *
 * @module sdk/ui-meta-builder_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { uiMeta } from "./ui-meta-builder.ts";
import type { UiMetaOptions } from "./ui-meta-builder.ts";

// --- Basic shape ---

Deno.test("uiMeta - returns _meta with ui containing resourceUri", () => {
  const result = uiMeta({ resourceUri: "ui://erp/customers" });

  assertEquals(result._meta.ui.resourceUri, "ui://erp/customers");
});

Deno.test("uiMeta - result is spreadable into tool definition", () => {
  const tool = {
    name: "erp:customers",
    ...uiMeta({ resourceUri: "ui://erp/customers" }),
  };

  assertEquals(tool.name, "erp:customers");
  assertExists(tool._meta.ui);
});

// --- Standard SEP-1865 fields ---

Deno.test("uiMeta - passes through visibility", () => {
  const result = uiMeta({
    resourceUri: "ui://test",
    visibility: ["model", "app"],
  });

  assertEquals(result._meta.ui.visibility, ["model", "app"]);
});

Deno.test("uiMeta - passes through csp", () => {
  const csp = { connectDomains: ["api.example.com"] };
  const result = uiMeta({ resourceUri: "ui://test", csp });

  assertEquals(result._meta.ui.csp, csp);
});

Deno.test("uiMeta - passes through permissions", () => {
  const permissions = { clipboardWrite: {} as Record<string, never> };
  const result = uiMeta({ resourceUri: "ui://test", permissions });

  assertEquals(result._meta.ui.permissions, permissions);
});

Deno.test("uiMeta - passes through domain", () => {
  const result = uiMeta({ resourceUri: "ui://test", domain: "example.com" });

  assertEquals(result._meta.ui.domain, "example.com");
});

Deno.test("uiMeta - passes through prefersBorder", () => {
  const result = uiMeta({ resourceUri: "ui://test", prefersBorder: true });

  assertEquals(result._meta.ui.prefersBorder, true);
});

// --- PML extensions (emits / accepts) ---

Deno.test("uiMeta - includes emits array", () => {
  const result = uiMeta({
    resourceUri: "ui://erp/customers",
    emits: ["rowSelected", "filterChanged"],
  });

  assertEquals(result._meta.ui.emits, ["rowSelected", "filterChanged"]);
});

Deno.test("uiMeta - includes accepts array", () => {
  const result = uiMeta({
    resourceUri: "ui://erp/customers",
    accepts: ["setFilter", "highlightRow"],
  });

  assertEquals(result._meta.ui.accepts, ["setFilter", "highlightRow"]);
});

Deno.test("uiMeta - full example with all fields", () => {
  const result = uiMeta({
    resourceUri: "ui://erp/customers",
    emits: ["rowSelected", "filterChanged"],
    accepts: ["setFilter", "highlightRow"],
    visibility: ["model", "app"],
    csp: { connectDomains: ["api.erp.com"] },
    permissions: { clipboardWrite: {} as Record<string, never> },
    domain: "erp.example.com",
    prefersBorder: false,
  });

  const ui = result._meta.ui;
  assertEquals(ui.resourceUri, "ui://erp/customers");
  assertEquals(ui.emits, ["rowSelected", "filterChanged"]);
  assertEquals(ui.accepts, ["setFilter", "highlightRow"]);
  assertEquals(ui.visibility, ["model", "app"]);
  assertEquals(ui.csp?.connectDomains, ["api.erp.com"]);
  assertEquals(ui.prefersBorder, false);
});

// --- Omission semantics ---

Deno.test("uiMeta - omits undefined optional fields", () => {
  const result = uiMeta({ resourceUri: "ui://test" });
  const ui = result._meta.ui;

  assertEquals("emits" in ui, false);
  assertEquals("accepts" in ui, false);
  assertEquals("visibility" in ui, false);
  assertEquals("csp" in ui, false);
  assertEquals("permissions" in ui, false);
  assertEquals("domain" in ui, false);
  assertEquals("prefersBorder" in ui, false);
});

Deno.test("uiMeta - empty emits/accepts are preserved", () => {
  const result = uiMeta({
    resourceUri: "ui://test",
    emits: [],
    accepts: [],
  });

  assertEquals(result._meta.ui.emits, []);
  assertEquals(result._meta.ui.accepts, []);
});
