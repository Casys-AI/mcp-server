/** @jsxImportSource preact */

import { assertEquals, assertStrictEquals } from "@std/assert";
import { render } from "preact";
import { act } from "preact/test-utils";
import type { LayoutHostHints, ViewerLayout } from "./viewer-layout.ts";
import { useViewerLayout } from "./hooks.ts";

type ResizeCallback = (entries: { contentRect: { width: number } }[]) => void;

/** A ResizeObserver double the test drives by hand. */
class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed: Element[] = [];
  disconnected = false;
  constructor(readonly callback: ResizeCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe(element: Element): void {
    this.observed.push(element);
  }
  disconnect(): void {
    this.disconnected = true;
  }
  resize(width: number): void {
    this.callback([{ contentRect: { width } }]);
  }
}

class FakeMediaQueryList extends EventTarget {
  /** Live change listeners, to prove an unmount removes what the mount added. */
  listeners = 0;
  constructor(public matches: boolean) {
    super();
  }
  override addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners += 1;
    super.addEventListener(type, listener);
  }
  override removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    this.listeners -= 1;
    super.removeEventListener(type, listener);
  }
  change(matches: boolean): void {
    this.matches = matches;
    const event = new Event("change") as Event & { matches: boolean };
    Object.defineProperty(event, "matches", { value: matches });
    this.dispatchEvent(event);
  }
}

/**
 * A document with the browser APIs the hooks use, or — `apis: false` — a bare
 * one where `ResizeObserver`, `matchMedia` and `location` are all undefined.
 */
async function withDom(
  fn: (root: HTMLElement, coarse: FakeMediaQueryList) => Promise<void> | void,
  { apis = true }: { apis?: boolean } = {},
): Promise<void> {
  const documentModule = await import("npm:linkedom@0.18.12");
  const dom = documentModule.parseHTML("<html><body><div id=root></div></body></html>");
  const coarse = new FakeMediaQueryList(false);
  const previous = {
    document: globalThis.document,
    ResizeObserver: (globalThis as { ResizeObserver?: unknown }).ResizeObserver,
    matchMedia: (globalThis as { matchMedia?: unknown }).matchMedia,
    location: (globalThis as { location?: unknown }).location,
  };
  FakeResizeObserver.instances = [];
  Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: apis ? FakeResizeObserver : undefined,
  });
  Object.defineProperty(globalThis, "matchMedia", {
    configurable: true,
    value: apis ? () => coarse : undefined,
  });
  Object.defineProperty(globalThis, "location", {
    configurable: true,
    value: apis ? { search: "" } : undefined,
  });
  try {
    await fn(dom.document.getElementById("root") as HTMLElement, coarse);
  } finally {
    render(null, dom.document.getElementById("root") as HTMLElement);
    for (const [key, value] of Object.entries(previous)) {
      Object.defineProperty(globalThis, key, { configurable: true, value });
    }
  }
}

function Viewer({ hints, forced }: { hints?: LayoutHostHints; forced?: ViewerLayout | null }) {
  const { ref, layout, width, boundsStyle } = useViewerLayout<HTMLDivElement>(
    hints,
    forced === undefined ? {} : { forced },
  );
  return (
    <div
      ref={ref}
      data-layout={layout}
      data-width={width === null ? "" : String(width)}
      style={boundsStyle}
    />
  );
}

Deno.test({
  name: "useViewerLayout measures its own element and re-decides on every resize",
  permissions: { read: true, env: true, run: true },
  async fn() {
    await withDom(async (root, coarse) => {
      act(() => render(<Viewer />, root));
      const element = root.firstElementChild as HTMLElement;
      // Unmeasured: wide, and the width is unknown rather than zero.
      assertEquals(element.dataset.layout, "wide");
      assertEquals(element.dataset.width, "");
      const [observer] = FakeResizeObserver.instances;
      assertStrictEquals(observer.observed[0], element);

      act(() => observer.resize(380));
      assertEquals(element.dataset.layout, "panel");
      assertEquals(element.dataset.width, "380");

      // A coarse pointer turns the same narrow width into the mobile treatment.
      act(() => coarse.change(true));
      assertEquals(element.dataset.layout, "mobile");

      act(() => observer.resize(1024));
      assertEquals(element.dataset.layout, "wide");

      await act(() => render(null, root));
      assertEquals(observer.disconnected, true);
      assertEquals(coarse.listeners, 0);
    });
  },
});

Deno.test({
  name: "without ResizeObserver, matchMedia or location the hooks measure once and detect",
  permissions: { read: true, env: true, run: true },
  async fn() {
    await withDom((root) => {
      // linkedom lays nothing out; the one-shot measure is what the hook reads.
      const proto = Object.getPrototypeOf(root) as {
        getBoundingClientRect: () => { width: number };
      };
      const previous = proto.getBoundingClientRect;
      proto.getBoundingClientRect = () => ({ width: 320 });
      try {
        act(() => render(<Viewer />, root));
        const element = root.firstElementChild as HTMLElement;
        // No coarse-pointer query: a fine pointer is assumed, so panel, not mobile.
        assertEquals(element.dataset.layout, "panel");
        assertEquals(element.dataset.width, "320");
        assertEquals(FakeResizeObserver.instances.length, 0);
        act(() => render(null, root));
      } finally {
        proto.getBoundingClientRect = previous;
      }
    }, { apis: false });
  },
});

Deno.test({
  name: "the host's declared context outranks the browser's measure and pointer",
  permissions: { read: true, env: true, run: true },
  async fn() {
    await withDom((root, coarse) => {
      const hints: LayoutHostHints = {
        deviceCapabilities: { touch: true, hover: false },
        containerDimensions: { width: 390, height: 640 },
      };
      act(() => render(<Viewer hints={hints} />, root));
      const element = root.firstElementChild as HTMLElement;
      assertEquals(element.dataset.layout, "mobile");
      assertEquals(element.dataset.width, "390");
      assertEquals(element.style.height, "640px");

      // The browser measuring a wide iframe and a fine pointer changes nothing.
      const [observer] = FakeResizeObserver.instances;
      act(() => observer.resize(1400));
      act(() => coarse.change(false));
      assertEquals(element.dataset.layout, "mobile");

      // A host context patch is a new value: the decision follows it.
      act(() =>
        render(
          <Viewer
            hints={{ deviceCapabilities: { touch: true, hover: true }, containerDimensions: {} }}
          />,
          root,
        )
      );
      assertEquals(element.dataset.layout, "wide");
      assertEquals(element.dataset.width, "1400");
      assertEquals(element.style.height, "");
    });
  },
});

Deno.test({
  name: "an explicit treatment wins, and null ignores the page query string",
  permissions: { read: true, env: true, run: true },
  async fn() {
    await withDom((root) => {
      (globalThis as { location: { search: string } }).location.search = "?layout=mobile";
      act(() => render(<Viewer />, root));
      const element = root.firstElementChild as HTMLElement;
      assertEquals(element.dataset.layout, "mobile");

      act(() => render(<Viewer forced={null} />, root));
      assertEquals(element.dataset.layout, "wide");

      for (const forced of ["mobile", "panel", "wide"] as const) {
        act(() =>
          render(<Viewer forced={forced} hints={{ containerDimensions: { width: 1200 } }} />, root)
        );
        assertEquals(element.dataset.layout, forced);
      }
    });
  },
});
