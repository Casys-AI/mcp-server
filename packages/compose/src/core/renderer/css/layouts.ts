/**
 * Layout-specific CSS generators.
 *
 * @module renderer/css/layouts
 */

import type { UiLayout } from "../../types/layout.ts";

/**
 * Generate CSS for a specific layout mode.
 *
 * @param layout - Layout mode
 * @returns CSS string for the layout
 *
 * @example
 * ```typescript
 * const css = getLayoutCss("split");
 * // Contains .layout-split { display: flex; ... }
 * ```
 */
export function getLayoutCss(layout: UiLayout): string {
  switch (layout) {
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
  }
}
