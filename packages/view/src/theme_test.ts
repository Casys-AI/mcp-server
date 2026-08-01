import { assertEquals, assertStrictEquals, assertStringIncludes } from "@std/assert";

import {
  installMcpViewTheme,
  MCP_VIEW_THEME_CSS,
  MCP_VIEW_THEME_STYLE_ID,
  type McpViewThemeDocument,
} from "./theme.ts";

Deno.test("shared theme exposes the ERPNext-derived component vocabulary", () => {
  for (
    const className of [
      ".mcp-view-card",
      ".mcp-view-card-title",
      ".mcp-view-metrics",
      ".mcp-view-table",
      ".mcp-view-cross-selection",
      ".mcp-view-key-values",
      ".mcp-view-button",
      ".mcp-view-state",
      ":focus-visible",
      '[data-tone="danger"]',
    ]
  ) {
    assertStringIncludes(MCP_VIEW_THEME_CSS, className);
  }
});

Deno.test("installMcpViewTheme is idempotent", () => {
  let existing: HTMLStyleElement | null = null;
  let appends = 0;
  const target = {
    getElementById(id: string) {
      return id === MCP_VIEW_THEME_STYLE_ID ? existing : null;
    },
    createElement() {
      return { id: "", textContent: "" } as HTMLStyleElement;
    },
    head: {
      append(node: HTMLStyleElement) {
        appends += 1;
        existing = node;
      },
    },
  } as McpViewThemeDocument;

  const first = installMcpViewTheme(target);
  const second = installMcpViewTheme(target);

  assertStrictEquals(first, second);
  assertEquals(appends, 1);
  assertEquals(first.id, MCP_VIEW_THEME_STYLE_ID);
  assertEquals(first.textContent, MCP_VIEW_THEME_CSS);
});
