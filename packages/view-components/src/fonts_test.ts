import {
  assert,
  assertEquals,
  assertFalse,
  assertNotEquals,
  assertStrictEquals,
} from "@std/assert";

import {
  installMcpViewFonts,
  MCP_VIEW_FONT_FAMILIES,
  MCP_VIEW_FONTS_CSS,
  MCP_VIEW_FONTS_STYLE_ID,
} from "./fonts.ts";
import { MCP_VIEW_THEME_CSS, MCP_VIEW_THEME_STYLE_ID, type McpViewThemeDocument } from "./theme.ts";

Deno.test("embedded fonts cover exactly the families the theme names first", () => {
  const faces = [...MCP_VIEW_FONTS_CSS.matchAll(/@font-face \{([\s\S]*?)\}/g)].map(([, body]) => ({
    family: /font-family: "([^"]+)";/.exec(body)?.[1],
    weight: /font-weight: (\d+) (\d+);/.exec(body)?.slice(1, 3).map(Number),
    src: /src: url\(([^)]+)\)/.exec(body)?.[1],
  }));
  // Upstream orders the faces; only the set is the invariant.
  assertEquals(
    [...faces.map((face) => face.family)].sort(),
    [...MCP_VIEW_FONT_FAMILIES.map((family) => family.family)].sort(),
  );
  for (const family of MCP_VIEW_FONT_FAMILIES) {
    const face = faces.find((candidate) => candidate.family === family.family);
    assertEquals(face?.weight, family.weights.split("..").map(Number));
    // The theme's role stack quotes the family so the embedded face is what renders.
    const stack = new RegExp(`--mcp-view-font-${family.role}: var\\([^;]*"${family.family}"`);
    assert(
      stack.test(MCP_VIEW_THEME_CSS),
      `${family.family} missing from the ${family.role} stack`,
    );
  }
  // Self-contained: every face is inlined, nothing is fetched at runtime.
  for (const face of faces) {
    assert(face.src?.startsWith("data:font/woff2;base64,"), `face ${face.family} is not inlined`);
  }
  assertFalse(/https?:\/\//.test(MCP_VIEW_FONTS_CSS));
  assertFalse(/@import\b/.test(MCP_VIEW_FONTS_CSS));
  assertEquals(MCP_VIEW_FONT_FAMILIES.map((family) => family.role), ["heading", "body", "mono"]);
});

Deno.test("the theme itself stays font-free so embedding remains opt-in", () => {
  assertFalse(MCP_VIEW_THEME_CSS.includes("@font-face"));
  assert(MCP_VIEW_FONTS_CSS.length > 100_000);
});

Deno.test("installMcpViewFonts is idempotent and independent of the theme style", () => {
  const appended: HTMLStyleElement[] = [];
  const target = {
    getElementById(id: string) {
      return appended.find((node) => node.id === id) ?? null;
    },
    createElement() {
      return { id: "", textContent: "" } as HTMLStyleElement;
    },
    head: {
      append(node: HTMLStyleElement) {
        appended.push(node);
      },
    },
  } as McpViewThemeDocument;

  const first = installMcpViewFonts(target);
  const second = installMcpViewFonts(target);

  assertStrictEquals(first, second);
  assertEquals(appended.length, 1);
  assertEquals(first.id, MCP_VIEW_FONTS_STYLE_ID);
  assertEquals(first.textContent, MCP_VIEW_FONTS_CSS);
  // Distinct ids: installing one never satisfies the other's idempotence check.
  assertNotEquals<string>(MCP_VIEW_FONTS_STYLE_ID, MCP_VIEW_THEME_STYLE_ID);
});
