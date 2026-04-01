/**
 * Integration tests — start stub servers via the runtime cluster,
 * call tools, verify UI endpoints.
 *
 * These tests start real child processes.
 * Requires --allow-run --allow-net --allow-read --allow-env.
 *
 * @module stubs/tests/cluster_test
 */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { parseManifest } from "../../src/runtime/manifest.ts";
import { startServer, createCluster } from "../../src/runtime/cluster.ts";
import type { McpManifest, RuntimeError } from "../../src/runtime/types.ts";
import { RuntimeErrorCode } from "../../src/runtime/types.ts";

const STUBS_DIR = new URL("../", import.meta.url).pathname;
const PROJECT_ROOT = new URL("../../", import.meta.url).pathname;

// Integration tests use child processes — disable sanitizers
const TEST_OPTS = { sanitizeOps: false, sanitizeResources: false };

/** Load a stub manifest with absolute paths. */
async function loadStubManifest(name: string, env?: Record<string, string>): Promise<McpManifest> {
  const json = await Deno.readTextFile(`${STUBS_DIR}${name}/manifest.json`);
  const manifest = parseManifest(json);
  if (manifest.transport.type === "stdio") {
    manifest.transport.args = manifest.transport.args?.map((a) =>
      a.startsWith("stubs/") ? `${PROJECT_ROOT}${a}` : a
    );
    if (env) manifest.transport.env = { ...manifest.transport.env, ...env };
  }
  return manifest;
}

/** Load all stub manifests into a Map. */
async function loadAllManifests(): Promise<Map<string, McpManifest>> {
  const map = new Map<string, McpManifest>();
  for (const name of ["stub-list", "stub-detail", "stub-chart", "stub-filter"]) {
    const env = name === "stub-list" ? { STUB_API_KEY: "test" } : undefined;
    const manifest = await loadStubManifest(name, env);
    map.set(manifest.name, manifest);
  }
  return map;
}

// =============================================================================
// Single server tests
// =============================================================================

Deno.test({ name: "cluster - start stub-filter and verify health", ...TEST_OPTS, fn: async () => {
  const manifest = await loadStubManifest("stub-filter");
  const conn = await startServer(manifest, { timeoutMs: 10_000 });

  try {
    assertEquals(conn.name, "stub-filter");
    assertEquals(conn.transportType, "stdio");
    assertStringIncludes(conn.uiBaseUrl, "http://");

    const res = await fetch(`${conn.uiBaseUrl}/health`);
    const data = await res.json();
    assertEquals(data.status, "ok");
    assertEquals(data.server, "stub-filter");
  } finally {
    await conn.close();
  }
}});

Deno.test({ name: "cluster - start stub-list with STUB_API_KEY", ...TEST_OPTS, fn: async () => {
  const manifest = await loadStubManifest("stub-list", { STUB_API_KEY: "test-key" });
  const conn = await startServer(manifest, { timeoutMs: 10_000 });

  try {
    const res = await fetch(`${conn.uiBaseUrl}/health`);
    const data = await res.json();
    assertEquals(data.status, "ok");
  } finally {
    await conn.close();
  }
}});

Deno.test({ name: "cluster - stub-list fails without STUB_API_KEY", ...TEST_OPTS, fn: async () => {
  const manifest = await loadStubManifest("stub-list", {});

  try {
    await startServer(manifest, { timeoutMs: 5_000 });
    throw new Error("Should have thrown");
  } catch (e) {
    const err = e as RuntimeError;
    assertEquals(
      err.code === RuntimeErrorCode.PROCESS_DIED || err.code === RuntimeErrorCode.PROCESS_START_FAILED,
      true,
      `Expected PROCESS_DIED or PROCESS_START_FAILED, got ${err.code}`,
    );
  }
}});

// =============================================================================
// UI endpoint tests
// =============================================================================

Deno.test({ name: "cluster - /ui serves HTML with composeEvents", ...TEST_OPTS, fn: async () => {
  const manifest = await loadStubManifest("stub-chart");
  const conn = await startServer(manifest, { timeoutMs: 10_000 });

  try {
    const res = await fetch(
      `${conn.uiBaseUrl}/ui?uri=${encodeURIComponent("ui://stub-chart/bar-chart")}`,
    );
    assertEquals(res.status, 200);
    assertStringIncludes(res.headers.get("content-type") ?? "", "text/html");

    const html = await res.text();
    assertStringIncludes(html, "<!DOCTYPE html>");
    assertStringIncludes(html, "composeEvents");
    assertStringIncludes(html, "ui/compose/event");
  } finally {
    await conn.close();
  }
}});

Deno.test({ name: "cluster - /ui returns 400 without uri param", ...TEST_OPTS, fn: async () => {
  const manifest = await loadStubManifest("stub-filter");
  const conn = await startServer(manifest, { timeoutMs: 10_000 });

  try {
    const res = await fetch(`${conn.uiBaseUrl}/ui`);
    assertEquals(res.status, 400);
    await res.body?.cancel();
  } finally {
    await conn.close();
  }
}});

Deno.test({ name: "cluster - /ui returns 404 for unknown resource", ...TEST_OPTS, fn: async () => {
  const manifest = await loadStubManifest("stub-filter");
  const conn = await startServer(manifest, { timeoutMs: 10_000 });

  try {
    const res = await fetch(
      `${conn.uiBaseUrl}/ui?uri=${encodeURIComponent("ui://stub-filter/nonexistent")}`,
    );
    assertEquals(res.status, 404);
    await res.body?.cancel();
  } finally {
    await conn.close();
  }
}});

// =============================================================================
// Multi-server cluster tests
// =============================================================================

Deno.test({ name: "cluster - start filter + chart", ...TEST_OPTS, fn: async () => {
  const manifests = await loadAllManifests();
  const cluster = createCluster(manifests, ["stub-filter", "stub-chart"]);
  await cluster.startAll();

  try {
    const filterUrl = cluster.getUiBaseUrl("stub-filter");
    const chartUrl = cluster.getUiBaseUrl("stub-chart");
    assertEquals(typeof filterUrl, "string");
    assertEquals(typeof chartUrl, "string");

    const filterHealth = await (await fetch(`${filterUrl}/health`)).json();
    assertEquals(filterHealth.server, "stub-filter");

    const chartHealth = await (await fetch(`${chartUrl}/health`)).json();
    assertEquals(chartHealth.server, "stub-chart");
  } finally {
    await cluster.stopAll();
  }
}});

Deno.test({ name: "cluster - start all 4 stubs", ...TEST_OPTS, fn: async () => {
  const manifests = await loadAllManifests();
  const cluster = createCluster(manifests, ["stub-filter", "stub-chart", "stub-list", "stub-detail"]);
  await cluster.startAll();

  try {
    for (const name of ["stub-filter", "stub-chart", "stub-list", "stub-detail"]) {
      const url = cluster.getUiBaseUrl(name);
      assertEquals(typeof url, "string", `Missing uiBaseUrl for ${name}`);
    }
  } finally {
    await cluster.stopAll();
  }
}});
