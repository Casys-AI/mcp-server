/**
 * Layout types for composite UI arrangement.
 *
 * Supports simple presets (a single string) and agent-composed
 * area grids (a structured object with named regions).
 *
 * @module types/layout
 */

/**
 * Simple layout presets.
 *
 * - `"split"` — Side-by-side panels
 * - `"tabs"` — Tabbed interface
 * - `"grid"` — Auto-fit grid
 * - `"stack"` — Vertical stack
 */
export type UiLayoutPreset = "split" | "tabs" | "grid" | "stack";

/**
 * Gap between panels.
 *
 * - `"none"` — 0
 * - `"compact"` — 4px
 * - `"normal"` — 8px
 * - `"spacious"` — 16px
 */
export type UiLayoutGap = "none" | "compact" | "normal" | "spacious";

/**
 * Agent-composed area grid layout.
 *
 * The agent describes the dashboard as a 2D grid of named regions
 * with optional proportional sizing. No CSS knowledge required.
 *
 * @example
 * ```typescript
 * const layout: UiLayoutAreas = {
 *   areas: [
 *     ["filter", "list",  "detail"],
 *     ["filter", "chart", "chart" ],
 *   ],
 *   columns: [1, 2, 2],
 *   rows: [3, 1],
 *   gap: "normal",
 * };
 * ```
 */
export interface UiLayoutAreas {
  /** 2D grid of source IDs. Repeated names span multiple cells. */
  areas: string[][];
  /** Column proportions (default: equal). */
  columns?: number[];
  /** Row proportions (default: equal). */
  rows?: number[];
  /** Gap between panels (default: "normal"). */
  gap?: UiLayoutGap;
}

/**
 * Layout configuration — either a simple preset or an agent-composed grid.
 *
 * @example Simple preset
 * ```typescript
 * const layout: UiLayout = "split";
 * ```
 *
 * @example Agent-composed grid
 * ```typescript
 * const layout: UiLayout = {
 *   areas: [
 *     ["sidebar", "main"],
 *     ["sidebar", "bottom"],
 *   ],
 *   columns: [1, 3],
 *   gap: "compact",
 * };
 * ```
 */
export type UiLayout = UiLayoutPreset | UiLayoutAreas;

/**
 * All valid layout preset values for runtime validation.
 */
export const UI_LAYOUT_PRESETS: readonly UiLayoutPreset[] = [
  "split",
  "tabs",
  "grid",
  "stack",
] as const;


/**
 * Check if a value is a valid UiLayout (preset string or areas object).
 *
 * @example
 * ```typescript
 * isValidLayout("split"); // true
 * isValidLayout({ areas: [["a", "b"]] }); // true
 * isValidLayout("unknown"); // false
 * ```
 */
export function isValidLayout(value: unknown): value is UiLayout {
  if (typeof value === "string") {
    return UI_LAYOUT_PRESETS.includes(value as UiLayoutPreset);
  }
  if (typeof value === "object" && value !== null && "areas" in value) {
    const areas = (value as UiLayoutAreas).areas;
    return Array.isArray(areas) && areas.length > 0 && areas.every(Array.isArray);
  }
  return false;
}

/**
 * Check if a layout is a preset string.
 */
export function isLayoutPreset(layout: UiLayout): layout is UiLayoutPreset {
  return typeof layout === "string";
}

/**
 * Check if a layout is an areas grid.
 */
export function isLayoutAreas(layout: UiLayout): layout is UiLayoutAreas {
  return typeof layout === "object" && "areas" in layout;
}
