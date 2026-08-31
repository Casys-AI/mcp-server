import { assert, assertEquals, assertFalse } from "@std/assert";
import {
  Badge,
  BadgeGroup,
  Card,
  DataTable,
  InlineCode,
  installMcpViewTheme,
  LimitGauge,
  MCP_VIEW_THEME_CSS,
  PathBar,
  Row,
  SemanticElement,
} from "./preact-components.ts";

Deno.test("Preact components entry exposes presentation without an MCP Apps runtime", () => {
  assertEquals(typeof Badge, "function");
  assertEquals(typeof BadgeGroup, "function");
  assertEquals(typeof Card, "function");
  assertEquals(typeof DataTable, "function");
  assertEquals(typeof PathBar, "function");
  assertEquals(typeof Row, "function");
  assertEquals(typeof LimitGauge, "function");
  assertEquals(typeof SemanticElement, "function");
  assertEquals(typeof installMcpViewTheme, "function");
  assertEquals(typeof InlineCode, "function");
  assert(MCP_VIEW_THEME_CSS.includes(".mcp-view-card"));
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
        "/src/app.ts",
        "/src/lifecycle.ts",
        "/src/compose-events.ts",
      ]
    ) {
      assertFalse(
        references.some((reference) => reference.includes(forbidden)),
        `pure presentation graph must not reference ${forbidden}`,
      );
    }
  },
});
