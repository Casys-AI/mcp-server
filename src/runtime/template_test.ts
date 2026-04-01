/**
 * Tests for template parsing, validation, and arg injection.
 *
 * @module runtime/template_test
 */

import { assertEquals } from "@std/assert";
import {
  injectArgs,
  parseTemplate,
  validateTemplate,
} from "./template.ts";
import { RuntimeErrorCode } from "./types.ts";
import type { DashboardTemplate, McpManifest, RuntimeError } from "./types.ts";

// =============================================================================
// Helpers
// =============================================================================

function makeManifests(
  ...entries: Array<{ name: string; tools: string[] }>
): Map<string, McpManifest> {
  const map = new Map<string, McpManifest>();
  for (const entry of entries) {
    map.set(entry.name, {
      name: entry.name,
      transport: { type: "stdio", command: "test" },
      tools: entry.tools.map((t) => ({ name: t })),
    });
  }
  return map;
}

function makeTemplate(
  overrides?: Partial<DashboardTemplate>,
): DashboardTemplate {
  return {
    name: "test-dashboard",
    sources: [
      { manifest: "server-a", calls: [{ tool: "tool-1" }] },
    ],
    orchestration: { layout: "split" },
    ...overrides,
  };
}

// =============================================================================
// parseTemplate
// =============================================================================

Deno.test("parseTemplate - valid YAML", () => {
  const template = parseTemplate(`
name: Sales Dashboard
sources:
  - manifest: postgres
    calls:
      - tool: query
        args:
          sql: "SELECT * FROM sales"
orchestration:
  layout: split
  sharedContext:
    - customer_id
  `);

  assertEquals(template.name, "Sales Dashboard");
  assertEquals(template.sources.length, 1);
  assertEquals(template.sources[0].manifest, "postgres");
  assertEquals(template.sources[0].calls[0].tool, "query");
  assertEquals(template.orchestration.layout, "split");
  assertEquals(template.orchestration.sharedContext, ["customer_id"]);
});

Deno.test("parseTemplate - invalid YAML throws TEMPLATE_PARSE_ERROR", () => {
  try {
    parseTemplate("{{invalid yaml");
    throw new Error("should have thrown");
  } catch (e) {
    const err = e as RuntimeError;
    assertEquals(err.code, RuntimeErrorCode.TEMPLATE_PARSE_ERROR);
  }
});

Deno.test("parseTemplate - non-object YAML throws", () => {
  try {
    parseTemplate("just a string");
    throw new Error("should have thrown");
  } catch (e) {
    const err = e as RuntimeError;
    assertEquals(err.code, RuntimeErrorCode.TEMPLATE_PARSE_ERROR);
    assertEquals(err.message.includes("YAML object"), true);
  }
});

Deno.test("parseTemplate - includes filePath in error", () => {
  try {
    parseTemplate("not yaml: {{", "/tmp/bad.yaml");
    throw new Error("should have thrown");
  } catch (e) {
    const err = e as RuntimeError;
    assertEquals(err.message.includes("/tmp/bad.yaml"), true);
  }
});

// =============================================================================
// validateTemplate
// =============================================================================

Deno.test("validateTemplate - valid template passes", () => {
  const manifests = makeManifests({ name: "server-a", tools: ["tool-1"] });
  const result = validateTemplate(makeTemplate(), manifests);
  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("validateTemplate - missing manifest detected", () => {
  const manifests = makeManifests(); // empty
  const result = validateTemplate(makeTemplate(), manifests);
  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("not found")), true);
});

Deno.test("validateTemplate - unknown tool detected", () => {
  const manifests = makeManifests({ name: "server-a", tools: ["other-tool"] });
  const result = validateTemplate(makeTemplate(), manifests);
  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("tool-1")), true);
});

Deno.test("validateTemplate - invalid layout detected", () => {
  const manifests = makeManifests({ name: "server-a", tools: ["tool-1"] });
  const template = makeTemplate({
    orchestration: { layout: "invalid" as "split" },
  });
  const result = validateTemplate(template, manifests);
  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("layout")), true);
});

Deno.test("validateTemplate - empty sources detected", () => {
  const manifests = makeManifests();
  const template = makeTemplate({ sources: [] });
  const result = validateTemplate(template, manifests);
  assertEquals(result.valid, false);
  assertEquals(result.errors.some((e) => e.includes("at least one source")), true);
});

Deno.test("validateTemplate - multiple sources validated", () => {
  const manifests = makeManifests(
    { name: "server-a", tools: ["tool-1"] },
    { name: "server-b", tools: ["tool-2"] },
  );
  const template = makeTemplate({
    sources: [
      { manifest: "server-a", calls: [{ tool: "tool-1" }] },
      { manifest: "server-b", calls: [{ tool: "tool-2" }] },
    ],
  });
  const result = validateTemplate(template, manifests);
  assertEquals(result.valid, true);
});

// =============================================================================
// injectArgs
// =============================================================================

Deno.test("injectArgs - full placeholder replaced with value", () => {
  const result = injectArgs(
    [{ tool: "query", args: { id: "{{customer_id}}" } }],
    { customer_id: "C-123" },
  );
  assertEquals(result[0].args?.id, "C-123");
});

Deno.test("injectArgs - full placeholder preserves non-string type", () => {
  const result = injectArgs(
    [{ tool: "query", args: { limit: "{{max}}" } }],
    { max: 42 },
  );
  assertEquals(result[0].args?.limit, 42);
});

Deno.test("injectArgs - partial placeholder becomes string", () => {
  const result = injectArgs(
    [{ tool: "query", args: { sql: "SELECT * WHERE id = '{{id}}'" } }],
    { id: "ABC" },
  );
  assertEquals(result[0].args?.sql, "SELECT * WHERE id = 'ABC'");
});

Deno.test("injectArgs - missing arg preserves placeholder", () => {
  const result = injectArgs(
    [{ tool: "query", args: { id: "{{unknown}}" } }],
    {},
  );
  assertEquals(result[0].args?.id, "{{unknown}}");
});

Deno.test("injectArgs - non-string values pass through", () => {
  const result = injectArgs(
    [{ tool: "query", args: { limit: 10, active: true } }],
    { limit: 999 },
  );
  assertEquals(result[0].args?.limit, 10); // not a placeholder, untouched
  assertEquals(result[0].args?.active, true);
});

Deno.test("injectArgs - no args in call passes through", () => {
  const result = injectArgs([{ tool: "query" }], { id: "C-123" });
  assertEquals(result[0].args, undefined);
});

Deno.test("injectArgs - does not mutate input", () => {
  const original = [{ tool: "query", args: { id: "{{x}}" } }];
  const result = injectArgs(original, { x: "replaced" });
  assertEquals(original[0].args.id, "{{x}}");
  assertEquals(result[0].args?.id, "replaced");
});

Deno.test("injectArgs - multiple placeholders in one string", () => {
  const result = injectArgs(
    [{ tool: "q", args: { sql: "{{schema}}.{{table}}" } }],
    { schema: "public", table: "users" },
  );
  assertEquals(result[0].args?.sql, "public.users");
});
