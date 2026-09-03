import { assertEquals, assertStrictEquals } from "@std/assert";
import type { McpViewHostContext } from "../components.ts";
import {
  isNarrow,
  layoutFromSearch,
  type LayoutHostHints,
  layoutWidth,
  NARROW_BREAKPOINT,
  resolveViewerLayout,
  touchInput,
  viewerBoundsStyle,
} from "./viewer-layout.ts";

Deno.test("the MCP Apps host context is accepted as layout hints without a cast", () => {
  const context = {
    deviceCapabilities: { touch: true, hover: false },
    containerDimensions: { width: 390, maxHeight: 700 },
  } as McpViewHostContext;
  const hints: LayoutHostHints = context;
  assertEquals(layoutWidth(hints, null), 390);
  assertEquals(viewerBoundsStyle(hints.containerDimensions), { maxHeight: "700px" });
});

Deno.test("a width is narrow only once measured and under the breakpoint", () => {
  assertEquals(isNarrow(null), false);
  assertEquals(isNarrow(NARROW_BREAKPOINT), false);
  assertEquals(isNarrow(NARROW_BREAKPOINT - 1), true);
  assertEquals(isNarrow(0), true);
});

Deno.test("the declared host width wins over the measure, then maxWidth, then the measure", () => {
  assertEquals(layoutWidth({ containerDimensions: { width: 380, maxWidth: 900 } }, 1200), 380);
  assertEquals(layoutWidth({ containerDimensions: { maxWidth: 900 } }, 1200), 900);
  assertEquals(layoutWidth({ containerDimensions: {} }, 1200), 1200);
  assertEquals(layoutWidth(undefined, null), null);
  // A zero, negative or non-finite declaration is no declaration.
  assertEquals(layoutWidth({ containerDimensions: { width: 0, maxWidth: -1 } }, 640), 640);
  assertEquals(layoutWidth({ containerDimensions: { width: Number.NaN } }, 640), 640);
});

Deno.test("touch input is the host's word first, and touch without hover only", () => {
  assertEquals(touchInput({ deviceCapabilities: { touch: true } }, false), true);
  assertEquals(touchInput({ deviceCapabilities: { touch: true, hover: false } }, false), true);
  // A touch-screen laptop driven by a mouse is not a phone.
  assertEquals(touchInput({ deviceCapabilities: { touch: true, hover: true } }, true), false);
  assertEquals(touchInput({ deviceCapabilities: { touch: false } }, true), false);
  // Without a host declaration the browser's coarse-pointer query decides.
  assertEquals(touchInput({ deviceCapabilities: {} }, true), true);
  assertEquals(touchInput(undefined, false), false);
});

Deno.test("the three treatments are two contexts under one breakpoint, not a width scale", () => {
  assertEquals(resolveViewerLayout({ width: 1200, touch: false }), "wide");
  // A tablet under a finger with room keeps the wide layout.
  assertEquals(resolveViewerLayout({ width: 1024, touch: true }), "wide");
  assertEquals(resolveViewerLayout({ width: 380, touch: false }), "panel");
  assertEquals(resolveViewerLayout({ width: 390, touch: true }), "mobile");
  // Unmeasured renders wide rather than flickering narrow on the first paint.
  assertEquals(resolveViewerLayout({ width: null, touch: true }), "wide");
  assertEquals(resolveViewerLayout({ width: 1200, touch: false, forced: "mobile" }), "mobile");
  assertEquals(resolveViewerLayout({ width: 390, touch: true, forced: null }), "mobile");
});

Deno.test("?layout= is honoured only for a known treatment", () => {
  assertEquals(layoutFromSearch("?layout=mobile"), "mobile");
  assertEquals(layoutFromSearch("?theme=dark&layout=panel"), "panel");
  assertStrictEquals(layoutFromSearch("?layout=tablet"), null);
  assertStrictEquals(layoutFromSearch(""), null);
});

Deno.test("the bounds style follows a positive height, else maxHeight, else nothing", () => {
  assertEquals(viewerBoundsStyle({ height: 480, maxHeight: 900 }), { height: "480px" });
  assertEquals(viewerBoundsStyle({ maxHeight: 900 }), { maxHeight: "900px" });
  assertEquals(viewerBoundsStyle({ height: 0, maxHeight: Number.POSITIVE_INFINITY }), undefined);
  assertEquals(viewerBoundsStyle(undefined), undefined);
});
