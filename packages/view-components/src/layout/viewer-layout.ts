/**
 * Responsive layout decision for one MCP App viewer, without Preact or the
 * MCP Apps runtime: every input is a value the caller already holds.
 *
 * A viewer renders inside a host iframe whose width says nothing about the
 * screen, so the decision starts from the width the host grants (or the
 * measured container), never from `matchMedia` on the window. Three
 * treatments exist and they are not a scale of widths: a 380px desktop side
 * panel stacks its rows, a 390px phone keeps its table with 40px touch rows.
 * What separates the two narrow treatments is the pointer, not the space.
 */

/** `wide` keeps every column; `panel` stacks rows; `mobile` keeps a compact touch table. */
export type ViewerLayout = "wide" | "panel" | "mobile";

export const VIEWER_LAYOUTS: readonly ViewerLayout[] = Object.freeze(["wide", "panel", "mobile"]);

/** Below this container width the wide treatment gives way to a narrow one. */
export const NARROW_BREAKPOINT = 480;

/**
 * The host-context fields the layout decision reads. Structurally a subset of
 * the MCP Apps `McpUiHostContext`, so `ctx.hostContext` is passed as is; a
 * viewer with its own host-context store passes that store's value instead.
 */
export interface LayoutHostHints {
  readonly deviceCapabilities?: {
    readonly touch?: boolean;
    readonly hover?: boolean;
  };
  readonly containerDimensions?: LayoutContainerDimensions;
}

/** Dimensions a host may announce; each one is optional and only trusted when positive. */
export interface LayoutContainerDimensions {
  readonly width?: number;
  readonly maxWidth?: number;
  readonly height?: number;
  readonly maxHeight?: number;
}

/** The inputs of one layout decision. */
export interface ViewerLayoutInputs {
  /** The width to judge: `null` while nothing has been measured yet. */
  readonly width: number | null;
  /** Whether the viewer is driven by a finger rather than a fine pointer. */
  readonly touch: boolean;
  /** An explicit override (`?layout=`, a host declaration); `null` or `undefined` to detect. */
  readonly forced?: ViewerLayout | null;
}

/** True once a width is known and it is under the breakpoint. */
export function isNarrow(width: number | null): boolean {
  return width !== null && width < NARROW_BREAKPOINT;
}

/** `?layout=mobile` in a query string, for reviewing a treatment without the matching device. */
export function layoutFromSearch(search: string): ViewerLayout | null {
  const value = new URLSearchParams(search).get("layout");
  return VIEWER_LAYOUTS.includes(value as ViewerLayout) ? (value as ViewerLayout) : null;
}

/**
 * The width to judge: what the host grants, else what was measured.
 *
 * A declared width describes the room actually given, where a
 * `ResizeObserver` only measures what the iframe happened to take.
 */
export function layoutWidth(
  hints: LayoutHostHints | undefined,
  measured: number | null,
): number | null {
  return positive(hints?.containerDimensions?.width) ??
    positive(hints?.containerDimensions?.maxWidth) ?? measured;
}

/**
 * Whether a finger drives the viewer, by the host's word or the browser's.
 *
 * `touch` alone is not enough: a laptop with a touch screen driven by a mouse
 * declares `touch: true, hover: true` and is no phone. Only a finger without
 * hover justifies 40px targets. When the host says nothing, the browser's
 * coarse-pointer query decides.
 */
export function touchInput(
  hints: LayoutHostHints | undefined,
  browserCoarsePointer: boolean,
): boolean {
  const capabilities = hints?.deviceCapabilities;
  if (capabilities?.touch !== undefined) {
    return capabilities.touch && capabilities.hover !== true;
  }
  return browserCoarsePointer;
}

/**
 * The treatment for these inputs. A tablet under a finger but with room keeps
 * the wide layout: room is what mobile lacks; the finger only chooses between
 * the two narrow treatments.
 */
export function resolveViewerLayout(inputs: ViewerLayoutInputs): ViewerLayout {
  if (inputs.forced) return inputs.forced;
  if (!isNarrow(inputs.width)) return "wide";
  return inputs.touch ? "mobile" : "panel";
}

/** The inline style that bounds a viewer root on the host's declared height. */
export type ViewerBoundsStyle = { readonly height: string } | { readonly maxHeight: string };

/**
 * Bound the root on the host's real container instead of `100vh`. Without a
 * declared height the viewer stays intrinsic and lets the host auto-resize.
 */
export function viewerBoundsStyle(
  dimensions: LayoutContainerDimensions | undefined,
): ViewerBoundsStyle | undefined {
  const height = positive(dimensions?.height);
  if (height !== undefined) return { height: `${height}px` };
  const maxHeight = positive(dimensions?.maxHeight);
  return maxHeight !== undefined ? { maxHeight: `${maxHeight}px` } : undefined;
}

function positive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
