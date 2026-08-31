import { assertEquals, assertFalse, assertStrictEquals, assertStringIncludes } from "@std/assert";

import {
  installMcpViewTheme,
  MCP_VIEW_THEME_CSS,
  MCP_VIEW_THEME_STYLE_ID,
  MCP_VIEW_THEME_TOKENS,
  type McpViewThemeDocument,
} from "./theme.ts";

Deno.test("shared theme exposes the MCP View v2 component vocabulary", () => {
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
      ".mcp-view-path-bar",
      ".mcp-view-limit-gauge",
      ".mcp-view-artifact-row",
      ".mcp-view-semantic-element",
      '[data-density="chip"]',
      '[data-density="row"]',
      '[data-density="card"]',
      ":focus-visible",
      '[data-tone="danger"]',
    ]
  ) {
    assertStringIncludes(MCP_VIEW_THEME_CSS, className);
  }
});

Deno.test("shared theme inherits host typography and keeps flat cards and neutral badges", () => {
  assertStringIncludes(MCP_VIEW_THEME_CSS, "font-family: var(");
  assertStringIncludes(MCP_VIEW_THEME_CSS, "--font-sans,");
  assertFalse(MCP_VIEW_THEME_CSS.includes("font-family: Inter"));

  assertFalse(MCP_VIEW_THEME_CSS.includes("box-shadow:"));
  assertFalse(MCP_VIEW_THEME_CSS.includes("0 8px 28px"));

  const badgeStart = MCP_VIEW_THEME_CSS.indexOf(".mcp-view-badge {");
  const badgeEnd = MCP_VIEW_THEME_CSS.indexOf("}", badgeStart);
  const neutralBadge = MCP_VIEW_THEME_CSS.slice(badgeStart, badgeEnd);
  assertStringIncludes(neutralBadge, "var(--mcp-view-muted)");
  assertFalse(neutralBadge.includes("var(--mcp-view-success)"));
  assertFalse(MCP_VIEW_THEME_CSS.includes(".mcp-view-badge:not([data-tone])"));
  assertStringIncludes(MCP_VIEW_THEME_CSS, '.mcp-view-badge[data-tone="success"]');
});

Deno.test("shared theme has readable explicit light and dark fallbacks", () => {
  assertStringIncludes(MCP_VIEW_THEME_CSS, "--mcp-view-text: var(--color-text-primary, #101519);");
  assertStringIncludes(
    MCP_VIEW_THEME_CSS,
    "--mcp-view-panel: var(--color-background-primary, #ffffff);",
  );
  assertEquals(MCP_VIEW_THEME_TOKENS.accent, "--mcp-view-accent");
  assertEquals(MCP_VIEW_THEME_TOKENS.brand, "--mcp-view-brand");
  assertStringIncludes(MCP_VIEW_THEME_CSS, ':root[data-theme="dark"]');
  assertStringIncludes(MCP_VIEW_THEME_CSS, "--mcp-view-text: var(--color-text-primary, #e6ecf0);");
  assertStringIncludes(MCP_VIEW_THEME_CSS, ':root:not([data-theme="light"])');
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
