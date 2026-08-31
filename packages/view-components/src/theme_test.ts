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
      ".mcp-view-state-busy",
      ".mcp-view-inline-code",
      ".mcp-view-path-bar",
      ".mcp-view-limit-gauge",
      ".mcp-view-artifact-row",
      ".mcp-view-semantic-element",
      ".mcp-view-collection-card",
      ".mcp-view-collection-card > .mcp-view-card-header",
      ".mcp-view-collection-card > .mcp-view-semantic-list",
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

Deno.test("shared theme exposes offline heading body and mono typography roles", () => {
  assertEquals(MCP_VIEW_THEME_TOKENS.fontHeading, "--mcp-view-font-heading");
  assertEquals(MCP_VIEW_THEME_TOKENS.fontBody, "--mcp-view-font-body");
  assertEquals(MCP_VIEW_THEME_TOKENS.fontMono, "--mcp-view-font-mono");

  assertStringIncludes(MCP_VIEW_THEME_CSS, "--mcp-view-font-heading: var(");
  assertStringIncludes(MCP_VIEW_THEME_CSS, '"Space Grotesk"');
  assertStringIncludes(MCP_VIEW_THEME_CSS, '"Avenir Next"');
  assertStringIncludes(MCP_VIEW_THEME_CSS, "--mcp-view-font-body: var(");
  assertStringIncludes(MCP_VIEW_THEME_CSS, '"Work Sans"');
  assertStringIncludes(MCP_VIEW_THEME_CSS, "--font-sans,");
  assertStringIncludes(MCP_VIEW_THEME_CSS, "--mcp-view-font-mono: var(");
  assertStringIncludes(MCP_VIEW_THEME_CSS, '"JetBrains Mono"');
  assertStringIncludes(MCP_VIEW_THEME_CSS, '"SFMono-Regular"');
  assertStringIncludes(MCP_VIEW_THEME_CSS, "font-family: var(--mcp-view-font-body);");
  assertStringIncludes(MCP_VIEW_THEME_CSS, ".mcp-view-card-title,");
  assertStringIncludes(MCP_VIEW_THEME_CSS, ".mcp-view-element-reading-value,");
  assertStringIncludes(MCP_VIEW_THEME_CSS, ".mcp-view-element-limit {");
  assertStringIncludes(MCP_VIEW_THEME_CSS, ".mcp-view-element-limit-operator {");
  assertStringIncludes(
    MCP_VIEW_THEME_CSS,
    '.mcp-view-semantic-element[data-density="row"] .mcp-view-element-limit,',
  );
  assertStringIncludes(MCP_VIEW_THEME_CSS, "font-family: var(--mcp-view-font-heading);");
  assertStringIncludes(MCP_VIEW_THEME_CSS, ".mcp-view-card-eyebrow,");
  assertStringIncludes(MCP_VIEW_THEME_CSS, ".mcp-view-element-provenance {");
  assertStringIncludes(MCP_VIEW_THEME_CSS, "font-family: var(--mcp-view-font-mono);");
  assertEquals(
    MCP_VIEW_THEME_CSS.indexOf("Type is role-based") >
      MCP_VIEW_THEME_CSS.indexOf(".mcp-view-button {"),
    true,
  );

  assertFalse(/@import\b/i.test(MCP_VIEW_THEME_CSS));
  assertFalse(/@font-face\b/i.test(MCP_VIEW_THEME_CSS));
  assertFalse(/url\s*\(/i.test(MCP_VIEW_THEME_CSS));

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

Deno.test("collection card keeps one outer border by flattening the nested list", () => {
  const cardStart = MCP_VIEW_THEME_CSS.indexOf(".mcp-view-collection-card {");
  const cardEnd = MCP_VIEW_THEME_CSS.indexOf("}", cardStart);
  const collectionCard = MCP_VIEW_THEME_CSS.slice(cardStart, cardEnd);
  assertStringIncludes(collectionCard, "padding: 0;");
  assertStringIncludes(collectionCard, "overflow: hidden;");
  assertFalse(collectionCard.includes("box-shadow"));

  const headerStart = MCP_VIEW_THEME_CSS.indexOf(
    ".mcp-view-collection-card > .mcp-view-card-header {",
  );
  const headerEnd = MCP_VIEW_THEME_CSS.indexOf("}", headerStart);
  const header = MCP_VIEW_THEME_CSS.slice(headerStart, headerEnd);
  assertStringIncludes(header, "border-bottom: 1px solid var(--mcp-view-border);");
  assertStringIncludes(header, "padding:");

  const listStart = MCP_VIEW_THEME_CSS.indexOf(
    ".mcp-view-collection-card > .mcp-view-semantic-list {",
  );
  const listEnd = MCP_VIEW_THEME_CSS.indexOf("}", listStart);
  const nestedList = MCP_VIEW_THEME_CSS.slice(listStart, listEnd);
  assertStringIncludes(nestedList, "border: 0;");
  assertStringIncludes(nestedList, "border-radius: 0;");
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
