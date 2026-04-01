#!/usr/bin/env -S deno run --allow-all
/**
 * Demo: compose a dashboard from stubs and open it in the browser.
 *
 * Usage:
 *   deno run --allow-all stubs/demo.ts [template]
 *   deno task demo [template]
 *
 * Templates:
 *   master-detail   — list + detail (split)
 *   filter-chart    — filter + chart (split)
 *   full            — all 4 stubs (grid) [default]
 *
 * @module stubs/demo
 */

import { parseManifest } from "../src/runtime/manifest.ts";
import { loadTemplate } from "../src/runtime/template.ts";
import { composeDashboard } from "../src/runtime/compose.ts";
import { serveDashboard } from "../src/host/serve.ts";
import type { McpManifest } from "../src/runtime/types.ts";

const STUBS_DIR = new URL("./", import.meta.url).pathname;

const TEMPLATES: Record<string, string> = {
  "master-detail": "templates/master-detail.yaml",
  "filter-chart": "templates/filter-chart.yaml",
  "full": "templates/full-dashboard.yaml",
};

// Parse CLI arg
const templateName = Deno.args[0] ?? "full";
const templateFile = TEMPLATES[templateName];
if (!templateFile) {
  console.error(`Unknown template: ${templateName}`);
  console.error(`Available: ${Object.keys(TEMPLATES).join(", ")}`);
  Deno.exit(1);
}

// Load manifests
async function loadManifest(name: string, env?: Record<string, string>): Promise<McpManifest> {
  const json = await Deno.readTextFile(`${STUBS_DIR}${name}/manifest.json`);
  const manifest = parseManifest(json);
  if (manifest.transport.type === "stdio") {
    manifest.transport.args = manifest.transport.args?.map((a) =>
      a.startsWith("stubs/") ? `${STUBS_DIR}../${a}` : a
    );
    if (env) manifest.transport.env = { ...manifest.transport.env, ...env };
  }
  return manifest;
}

const manifests = new Map<string, McpManifest>();
for (const name of ["stub-list", "stub-detail", "stub-chart", "stub-filter"]) {
  const env = name === "stub-list" ? { STUB_API_KEY: "demo" } : undefined;
  manifests.set(name, await loadManifest(name, env));
}

// Load template
const template = await loadTemplate(`${STUBS_DIR}${templateFile}`);

console.log(`Composing: ${template.name}`);
console.log(`Sources: ${template.sources.map((s) => s.manifest).join(", ")}`);

// Compose with keepAlive so iframes can load
const result = await composeDashboard({ template, manifests, keepAlive: true });

if (result.warnings.length > 0) {
  console.warn("Warnings:", result.warnings.join("; "));
}

console.log(`Dashboard: ${result.descriptor.children.length} UIs, ${result.descriptor.sync.length} sync rules`);

// Serve dashboard
const handle = await serveDashboard(result.html, { open: true });
console.log(`Dashboard: ${handle.url}`);
console.log("Press Ctrl+C to stop.");

// Keep alive until Ctrl+C
await new Promise<void>((resolve) => {
  Deno.addSignalListener("SIGINT", () => {
    console.log("\nShutting down...");
    resolve();
  });
});

await handle.shutdown();
await result.cluster?.stopAll();
console.log("Done.");
