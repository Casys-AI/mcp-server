/**
 * Layout-specific CSS generators.
 *
 * Supports preset layouts (split, tabs, grid, stack) and
 * agent-composed area grids.
 *
 * @module renderer/css/layouts
 */

import type { UiLayout, UiLayoutAreas, UiLayoutGap } from "../../../core/types/layout.ts";
import { isLayoutAreas } from "../../../core/types/layout.ts";

/** Map gap tokens to CSS values. */
const GAP_MAP: Record<UiLayoutGap, string> = {
  none: "0",
  compact: "4px",
  normal: "8px",
  spacious: "16px",
};

/**
 * Generate CSS for a layout configuration.
 *
 * @param layout - Layout preset or areas grid
 * @returns CSS string
 *
 * @example Preset
 * ```typescript
 * getLayoutCss("split");
 * ```
 *
 * @example Areas grid
 * ```typescript
 * getLayoutCss({
 *   areas: [["filter", "list"], ["filter", "chart"]],
 *   columns: [1, 3],
 *   gap: "compact",
 * });
 * ```
 */
export function getLayoutCss(layout: UiLayout): string {
  if (isLayoutAreas(layout)) {
    return getAreasCss(layout);
  }

  const preset = layout;
  switch (preset) {
    case "split":
      return `
        .layout-split { display: flex; height: 100vh; }
        .layout-split > iframe { flex: 1; border: none; }
      `;
    case "tabs":
      return `
        .layout-tabs { height: 100vh; display: flex; flex-direction: column; }
        .tab-bar { display: flex; border-bottom: 1px solid var(--mcc-border-color); background: var(--mcc-bg-secondary); }
        .tab { padding: 12px 24px; cursor: pointer; border: none; background: transparent; font-size: 14px; color: inherit; }
        .tab:hover { background: var(--mcc-bg-hover); }
        .tab.active { background: var(--mcc-bg-primary); border-bottom: 2px solid var(--mcc-accent-color); }
        .tab-content { flex: 1; position: relative; }
        .layout-tabs iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; display: none; }
        .layout-tabs iframe.active { display: block; }
      `;
    case "grid":
      return `
        .layout-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          grid-auto-rows: 1fr;
          gap: 8px;
          height: 100vh;
          padding: 8px;
          box-sizing: border-box;
        }
        .layout-grid > iframe { border: 1px solid var(--mcc-border-color); border-radius: 4px; width: 100%; height: 100%; }
      `;
    case "stack":
      return `
        .layout-stack { display: flex; flex-direction: column; height: 100vh; }
        .layout-stack > iframe { flex: 1; border: none; border-bottom: 1px solid var(--mcc-border-color); min-height: 200px; }
        .layout-stack > iframe:last-child { border-bottom: none; }
      `;
    default: {
      const _exhaustive: never = preset;
      return _exhaustive;
    }
  }
}

/**
 * Generate CSS for an agent-composed areas grid.
 *
 * Converts the declarative grid into CSS grid-template-areas,
 * grid-template-columns, and grid-template-rows.
 */
function getAreasCss(layout: UiLayoutAreas): string {
  const gap = GAP_MAP[layout.gap ?? "normal"];

  // Build grid-template-areas
  const templateAreas = layout.areas
    .map((row) => `"${row.join(" ")}"`)
    .join("\n          ");

  // Build grid-template-columns from proportions
  const columns = layout.columns
    ? layout.columns.map((n) => `${n}fr`).join(" ")
    : `repeat(${layout.areas[0].length}, 1fr)`;

  // Build grid-template-rows from proportions
  const rows = layout.rows
    ? layout.rows.map((n) => `${n}fr`).join(" ")
    : `repeat(${layout.areas.length}, 1fr)`;

  // Collect unique area names for per-area styles
  const areaNames = new Set(layout.areas.flat());
  const areaStyles = [...areaNames]
    .map((name) => `        .layout-areas > [data-area="${name}"] { grid-area: ${name}; }`)
    .join("\n");

  return `
        .layout-areas {
          display: grid;
          grid-template-areas:
          ${templateAreas};
          grid-template-columns: ${columns};
          grid-template-rows: ${rows};
          gap: ${gap};
          height: 100vh;
          padding: ${gap};
          box-sizing: border-box;
        }
        .layout-areas > iframe {
          border: 1px solid var(--mcc-border-color);
          border-radius: 4px;
          width: 100%;
          height: 100%;
        }
${areaStyles}
      `;
}
