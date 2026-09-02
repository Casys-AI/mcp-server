import { assert, assertEquals, assertFalse } from "@std/assert";
import {
  Badge,
  BadgeGroup,
  Card,
  CollectionCard,
  DataTable,
  ElementLimit,
  InlineCode,
  LimitGauge,
  PathBar,
  Row,
  SemanticElement,
} from "./preact-components.ts";

Deno.test("Preact components entry exposes presentation without an MCP Apps runtime", () => {
  assertEquals(typeof Badge, "function");
  assertEquals(typeof BadgeGroup, "function");
  assertEquals(typeof Card, "function");
  assertEquals(typeof CollectionCard, "function");
  assertEquals(typeof DataTable, "function");
  assertEquals(typeof ElementLimit, "function");
  assertEquals(typeof PathBar, "function");
  assertEquals(typeof Row, "function");
  assertEquals(typeof LimitGauge, "function");
  assertEquals(typeof SemanticElement, "function");
  assertEquals(typeof InlineCode, "function");
});

Deno.test("Preact components entry ships components without the stylesheet", async () => {
  // The theme is an explicit install from the package root. Re-exporting it
  // here put the whole sheet in every bundle that imported one component.
  const entry = await import("./preact-components.ts") as Record<string, unknown>;
  for (const absent of ["MCP_VIEW_THEME_CSS", "installMcpViewTheme", "MCP_VIEW_THEME_TOKENS"]) {
    assertFalse(absent in entry, `${absent} must not ship from the components entry`);
  }
  const root = await import("./mod.ts") as Record<string, unknown>;
  assertEquals(typeof root.installMcpViewTheme, "function");
  assert(String(root.MCP_VIEW_THEME_CSS).includes(".mcp-view-card"));
});

Deno.test({
  name: "Preact components module graph excludes iframe and MCP Apps runtime modules",
  permissions: { read: true, run: true, env: true },
  async fn() {
    const entryPoint = new URL("./preact-components.ts", import.meta.url);
    const result = await new Deno.Command(Deno.execPath(), {
      args: ["info", "--json", entryPoint.href],
      stdout: "piped",
      stderr: "piped",
    }).output();
    assert(
      result.success,
      new TextDecoder().decode(result.stderr),
    );

    const graph = JSON.parse(new TextDecoder().decode(result.stdout)) as {
      modules?: Array<{
        specifier?: string;
        dependencies?: Array<{
          specifier?: string;
          code?: { specifier?: string };
          type?: { specifier?: string };
        }>;
      }>;
    };
    const references = (graph.modules ?? []).flatMap((module) => [
      module.specifier ?? "",
      ...(module.dependencies ?? []).flatMap((dependency) => [
        dependency.specifier ?? "",
        dependency.code?.specifier ?? "",
        dependency.type?.specifier ?? "",
      ]),
    ]);

    for (
      const forbidden of [
        "@modelcontextprotocol/ext-apps",
        "/packages/view/src/",
        "/src/app.ts",
        "/src/surface-app.ts",
        "/src/lifecycle.ts",
        "/src/compose-events.ts",
        "/src/theme.ts",
      ]
    ) {
      assertFalse(
        references.some((reference) => reference.includes(forbidden)),
        `pure presentation graph must not reference ${forbidden}`,
      );
    }
  },
});
