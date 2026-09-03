/** Opt-in embedded webfaces for the shared theme. */

import { MCP_VIEW_FONT_FAMILIES, type McpViewFontFamily } from "./font-families.ts";
import { MCP_VIEW_FONTS_CSS } from "./fonts-data.ts";
import type { McpViewThemeDocument } from "./theme.ts";

export { MCP_VIEW_FONT_FAMILIES, MCP_VIEW_FONTS_CSS, type McpViewFontFamily };

export const MCP_VIEW_FONTS_STYLE_ID = "mcp-view-fonts";

/**
 * Install the embedded `@font-face` rules once per document. Independent of
 * `installMcpViewTheme`: call both, in either order, for a fully offline viewer.
 */
export function installMcpViewFonts(
  target: McpViewThemeDocument = document,
): HTMLStyleElement {
  const existing = target.getElementById(MCP_VIEW_FONTS_STYLE_ID);
  if (existing) return existing as HTMLStyleElement;

  const style = target.createElement("style");
  style.id = MCP_VIEW_FONTS_STYLE_ID;
  style.textContent = MCP_VIEW_FONTS_CSS;
  target.head.append(style);
  return style;
}
