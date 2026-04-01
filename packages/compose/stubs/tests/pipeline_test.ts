/**
 * Static pipeline tests — manifest loading + template validation.
 * No servers started.
 *
 * @module stubs/tests/pipeline_test
 */

import { assertEquals } from "@std/assert";
import { loadManifests } from "../../src/runtime/manifest.ts";
import { loadTemplate, validateTemplate } from "../../src/runtime/template.ts";

const STUBS_DIR = new URL("../", import.meta.url).pathname;

Deno.test("pipeline - loads all 4 stub manifests", async () => {
  const manifests = new Map<string, Awaited<ReturnType<typeof loadManifests>> extends Map<string, infer V> ? V : never>();

  for (const name of ["stub-list", "stub-detail", "stub-chart", "stub-filter"]) {
    const path = `${STUBS_DIR}${name}/manifest.json`;
    const json = await Deno.readTextFile(path);
    const { parseManifest } = await import("../../src/runtime/manifest.ts");
    const manifest = parseManifest(json, path);
    manifests.set(manifest.name, manifest);
  }

  assertEquals(manifests.size, 4);
  assertEquals(manifests.get("stub-list")?.tools[0].emits, ["item.selected"]);
  assertEquals(manifests.get("stub-list")?.tools[0].accepts, ["filter.apply"]);
  assertEquals(manifests.get("stub-detail")?.tools[0].accepts, ["item.show"]);
  assertEquals(manifests.get("stub-chart")?.tools[0].accepts, ["data.update"]);
  assertEquals(manifests.get("stub-filter")?.tools[0].emits, ["filter.changed"]);
});

Deno.test("pipeline - stub-list manifest has requiredEnv", async () => {
  const json = await Deno.readTextFile(`${STUBS_DIR}stub-list/manifest.json`);
  const { parseManifest } = await import("../../src/runtime/manifest.ts");
  const manifest = parseManifest(json);
  assertEquals(manifest.requiredEnv, ["STUB_API_KEY"]);
});

Deno.test("pipeline - master-detail template validates against manifests", async () => {
  const manifests = await loadStubManifests();
  const template = await loadTemplate(`${STUBS_DIR}templates/master-detail.yaml`);

  const result = validateTemplate(template, manifests);
  assertEquals(result.valid, true, `Errors: ${result.errors.join("; ")}`);
  assertEquals(template.orchestration.layout, "split");
  assertEquals(template.orchestration.sync?.length, 1);
});

Deno.test("pipeline - filter-chart template validates", async () => {
  const manifests = await loadStubManifests();
  const template = await loadTemplate(`${STUBS_DIR}templates/filter-chart.yaml`);

  const result = validateTemplate(template, manifests);
  assertEquals(result.valid, true, `Errors: ${result.errors.join("; ")}`);
});

Deno.test("pipeline - full-dashboard template validates", async () => {
  const manifests = await loadStubManifests();
  const template = await loadTemplate(`${STUBS_DIR}templates/full-dashboard.yaml`);

  const result = validateTemplate(template, manifests);
  assertEquals(result.valid, true, `Errors: ${result.errors.join("; ")}`);
  assertEquals(typeof template.orchestration.layout, "object"); // areas layout
  assertEquals(template.orchestration.sync?.length, 3);
  assertEquals(template.sources.length, 4);
});

// Helper: load all stub manifests
async function loadStubManifests() {
  const { parseManifest } = await import("../../src/runtime/manifest.ts");
  const manifests = new Map();
  for (const name of ["stub-list", "stub-detail", "stub-chart", "stub-filter"]) {
    const json = await Deno.readTextFile(`${STUBS_DIR}${name}/manifest.json`);
    const manifest = parseManifest(json);
    manifests.set(manifest.name, manifest);
  }
  return manifests;
}
