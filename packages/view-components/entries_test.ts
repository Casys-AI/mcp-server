import { assert, assertEquals, assertFalse } from "@std/assert";

/**
 * Modules reached from an entry through code imports only. Type-only edges
 * are erased by every bundler and by Deno at runtime, so they cost nothing.
 */
async function runtimeModules(entry: URL): Promise<string[]> {
  const result = await new Deno.Command(Deno.execPath(), {
    args: ["info", "--json", entry.href],
    stdout: "piped",
    stderr: "piped",
  }).output();
  assert(result.success, new TextDecoder().decode(result.stderr));
  const graph = JSON.parse(new TextDecoder().decode(result.stdout)) as {
    roots?: string[];
    redirects?: Record<string, string>;
    modules?: Array<{
      specifier?: string;
      dependencies?: Array<{ code?: { specifier?: string } }>;
    }>;
  };
  const modules = new Map((graph.modules ?? []).map((module) => [module.specifier ?? "", module]));
  const redirects = graph.redirects ?? {};
  const reached = new Set<string>();
  const pending = [...(graph.roots ?? [])];
  while (pending.length > 0) {
    const raw = pending.pop()!;
    const current = redirects[raw] ?? raw;
    if (reached.has(current)) continue;
    reached.add(current);
    for (const dependency of modules.get(current)?.dependencies ?? []) {
      if (dependency.code?.specifier) pending.push(dependency.code.specifier);
    }
  }
  return [...reached];
}

Deno.test({
  name: "the package root costs no MCP Apps runtime: the App lifecycle is the /surface entry",
  permissions: { read: true, run: true, env: true },
  async fn() {
    const root = await runtimeModules(new URL("./mod.ts", import.meta.url));
    for (
      const forbidden of ["@modelcontextprotocol/ext-apps", "/view/src/app.ts", "/surface-app.ts"]
    ) {
      assertFalse(
        root.some((specifier) => specifier.includes(forbidden)),
        `the root must not load ${forbidden} at runtime, got ${root.join("\n")}`,
      );
    }
    const surface = await runtimeModules(new URL("./surface.ts", import.meta.url));
    assert(
      surface.some((specifier) => specifier.includes("@modelcontextprotocol/ext-apps")),
      "the /surface entry is where the App runtime lives",
    );
  },
});

Deno.test("the root and the /surface entry split the registry from the App lifecycle", async () => {
  const root = await import("./mod.ts") as Record<string, unknown>;
  const surface = await import("./surface.ts") as Record<string, unknown>;
  assertEquals(typeof root.defineComponentRegistry, "function");
  assertFalse("startSurfaceApp" in root, "the root must not export the App lifecycle");
  assertEquals(typeof surface.startSurfaceApp, "function");
  assertEquals(typeof surface.SurfaceAppError, "function");
});
