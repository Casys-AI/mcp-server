/** The families the shared theme names first; the generator and the entry share them. */

export interface McpViewFontFamily {
  /** Family name as the theme's font stacks quote it. */
  readonly family: string;
  /** Variable weight range the embedded face covers, css2 syntax. */
  readonly weights: `${number}..${number}`;
  /** Theme role the family is the first choice for. */
  readonly role: "heading" | "body" | "mono";
}

/**
 * The three families `MCP_VIEW_THEME_CSS` names first in its stacks. The theme
 * falls back to system faces without them; embedding is what keeps a viewer
 * rendering the same inside a host iframe with no network or a strict CSP.
 */
export const MCP_VIEW_FONT_FAMILIES: readonly McpViewFontFamily[] = [
  { family: "Space Grotesk", weights: "500..600", role: "heading" },
  { family: "Work Sans", weights: "400..500", role: "body" },
  { family: "JetBrains Mono", weights: "400..600", role: "mono" },
];
