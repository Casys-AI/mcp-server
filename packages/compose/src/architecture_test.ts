/**
 * Architecture tests — validates docs, structure, and public exports for core/sdk/host layers.
 *
 * @module src/architecture_test
 */

import { assert } from "@std/assert";
import * as pkg from "../mod.ts";
import * as core from "./core/mod.ts";
import * as sdk from "./sdk/mod.ts";
import * as host from "./host/mod.ts";

async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await Deno.stat(new URL(relativePath, import.meta.url));
    return true;
  } catch (_error) {
    return false;
  }
}

// --- New layer structure: core, sdk, host ---

const CORE_SLICE_DIRS = [
  "collector",
  "composer",
  "sync",
  "types",
] as const;

const HOST_SLICE_DIRS = [
  "renderer",
] as const;

const TOP_LEVEL_LAYERS = [
  "core",
  "sdk",
  "host",
] as const;

Deno.test("src architecture - core slices expose lowercase readme and contract docs", async () => {
  for (const dir of CORE_SLICE_DIRS) {
    assert(
      await fileExists(`./core/${dir}/readme.md`),
      `Missing readme.md for core slice ${dir}`,
    );
    assert(
      await fileExists(`./core/${dir}/contract.md`),
      `Missing contract.md for core slice ${dir}`,
    );
  }
});

Deno.test("src architecture - host slices expose lowercase readme and contract docs", async () => {
  for (const dir of HOST_SLICE_DIRS) {
    assert(
      await fileExists(`./host/${dir}/readme.md`),
      `Missing readme.md for host slice ${dir}`,
    );
    assert(
      await fileExists(`./host/${dir}/contract.md`),
      `Missing contract.md for host slice ${dir}`,
    );
  }
});

Deno.test("src architecture - top-level layers (core, sdk, host) expose readme and contract docs", async () => {
  for (const layer of TOP_LEVEL_LAYERS) {
    assert(
      await fileExists(`./${layer}/readme.md`),
      `Missing readme.md for layer ${layer}`,
    );
    assert(
      await fileExists(`./${layer}/contract.md`),
      `Missing contract.md for layer ${layer}`,
    );
  }
});

Deno.test("src architecture - root src exposes lowercase readme and contract docs", async () => {
  assert(await fileExists("./readme.md"), "Missing src/readme.md");
  assert(await fileExists("./contract.md"), "Missing src/contract.md");
});

Deno.test("src architecture - public module structure exports canonical entrypoints", () => {
  // Root package exports core composition primitives
  assert(typeof pkg.createCollector === "function", "pkg missing createCollector");
  assert(typeof pkg.buildCompositeUi === "function", "pkg missing buildCompositeUi");
  assert(typeof pkg.renderComposite === "function", "pkg missing renderComposite");
  assert(typeof pkg.resolveSyncRules === "function", "pkg missing resolveSyncRules");
  assert(typeof pkg.validateSyncRules === "function", "pkg missing validateSyncRules");
  assert(typeof pkg.extractUiMeta === "function", "pkg missing extractUiMeta");

  // Core re-exports composition primitives (no renderer)
  assert(typeof core.createCollector === "function", "core missing createCollector");
  assert(typeof core.buildCompositeUi === "function", "core missing buildCompositeUi");

  // SDK re-exports adapter
  assert(typeof sdk.createMcpSdkCollector === "function", "sdk missing createMcpSdkCollector");

  // Host exports renderer + types
  assert(host !== undefined, "host module failed to load");
  assert(typeof host.renderComposite === "function", "host missing renderComposite");
});
