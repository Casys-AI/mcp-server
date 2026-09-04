/**
 * Preact hooks over the layout decision. They measure the DOM and query the
 * browser, but they take the host context as a parameter: nothing here
 * imports `@casys/mcp-view` or the MCP Apps runtime.
 */

import type { RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  layoutFromSearch,
  type LayoutHostHints,
  layoutWidth,
  resolveViewerLayout,
  touchInput,
  type ViewerBoundsStyle,
  viewerBoundsStyle,
  type ViewerLayout,
} from "./viewer-layout.ts";

/**
 * The observed width of one container, to choose a layout.
 *
 * The container is measured, not the window: a `matchMedia` on the window
 * would call a 380px panel opened in a full-screen browser "wide". The width
 * is `null` until measured, so a caller can tell an unmeasured root from a
 * real width; the decision reads an unknown width as wide — the usual case —
 * rather than flashing the narrow treatment on every first paint.
 */
export function useContainerWidth<T extends HTMLElement>(): [RefObject<T>, number | null] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof ResizeObserver === "undefined") {
      setWidth(element.getBoundingClientRect().width);
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

/**
 * Whether the browser reports a coarse pointer — a finger or a stylus.
 *
 * Browser fallback only: `matchMedia` describes the device showing the
 * window, not the context the host gives the iframe. The host's
 * `deviceCapabilities` win whenever they are declared (see `useViewerLayout`).
 */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const query = matchMedia("(pointer: coarse)");
    setCoarse(query.matches);
    const onChange = (event: MediaQueryListEvent) => setCoarse(event.matches);
    // A hybrid device switches when the user moves from trackpad to screen.
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return coarse;
}

export interface UseViewerLayoutOptions {
  /**
   * An explicit treatment: `null` detects. When omitted the page query string
   * is consulted (`?layout=mobile`) so a treatment can be reviewed without the
   * matching device; pass `null` to ignore the URL.
   */
  readonly forced?: ViewerLayout | null;
}

export interface ViewerLayoutState<T extends HTMLElement> {
  /** Attach to the element whose width is the layout's; the shell is the container. */
  readonly ref: RefObject<T>;
  /** The width judged: the host's declared width, else the measured one, else `null`. */
  readonly width: number | null;
  readonly layout: ViewerLayout;
  /** Inline style bounding the root on the host's declared height, if any. */
  readonly boundsStyle: ViewerBoundsStyle | undefined;
}

/**
 * One layout decision for one viewer root: the host's word first, the
 * browser's measure as fallback, an explicit override on top.
 */
export function useViewerLayout<T extends HTMLElement>(
  hints: LayoutHostHints | undefined,
  options: UseViewerLayoutOptions = {},
): ViewerLayoutState<T> {
  const [ref, measured] = useContainerWidth<T>();
  const coarse = useCoarsePointer();
  const forced = options.forced !== undefined
    ? options.forced
    : typeof location === "undefined"
    ? null
    : layoutFromSearch(location.search);
  const width = layoutWidth(hints, measured);
  const layout = resolveViewerLayout({
    width,
    touch: touchInput(hints, coarse),
    forced,
  });
  return { ref, width, layout, boundsStyle: viewerBoundsStyle(hints?.containerDimensions) };
}
