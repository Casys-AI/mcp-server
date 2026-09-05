/** @jsxImportSource preact */

import { assertEquals } from "@std/assert";
import { render } from "preact";
import { act } from "preact/test-utils";
import { Disclosure, FocusedView } from "./focused-view.tsx";

Deno.test({
  name: "Disclosure starts closed with a native named summary and reports toggle state",
  permissions: { read: true, env: true, run: true },
  async fn() {
    await withDom((root, window) => {
      const toggles: boolean[] = [];
      render(
        <Disclosure label="Détails techniques" onToggle={(open) => toggles.push(open)}>
          <code>sha256:recorded-value</code>
        </Disclosure>,
        root,
      );
      const details = root.firstElementChild as HTMLDetailsElement;
      assertEquals(details.tagName.toLowerCase(), "details");
      assertEquals(details.hasAttribute("open"), false);
      assertEquals(details.firstElementChild?.tagName.toLowerCase(), "summary");
      assertEquals(details.firstElementChild?.textContent, "Détails techniques");
      // Native details owns expanded state and keyboard behavior: no competing ARIA role.
      assertEquals(details.firstElementChild?.hasAttribute("role"), false);
      assertEquals(details.firstElementChild?.hasAttribute("aria-expanded"), false);
      details.open = true;
      details.dispatchEvent(new window.Event("toggle"));
      details.open = false;
      details.dispatchEvent(new window.Event("toggle"));
      assertEquals(toggles, [true, false]);
    });
  },
});

Deno.test({
  name:
    "FocusedView keeps critical state and primary data outside collapsed details at panel width",
  permissions: { read: true, env: true, run: true },
  async fn() {
    await withDom((root) => {
      act(() =>
        render(
          <FocusedView
            label="Bracket"
            hostContext={{ containerDimensions: { width: 420, maxHeight: 540 } }}
            status={<p>documentary · unverified</p>}
            primary={<div>Recorded geometry</div>}
            detailsLabel="Technical details"
            details={<code>artifact:recorded-fingerprint</code>}
          />,
          root,
        )
      );
      const group = root.firstElementChild as HTMLElement;
      assertEquals(group.getAttribute("role"), "group");
      assertEquals(group.getAttribute("aria-label"), "Bracket");
      assertEquals(group.dataset.layout, "panel");
      assertEquals(group.style.maxHeight, "540px");
      assertEquals(
        group.querySelector(".mcp-view-focused-status")?.textContent,
        "documentary · unverified",
      );
      assertEquals(
        group.querySelector(".mcp-view-focused-primary")?.textContent,
        "Recorded geometry",
      );
      const details = group.querySelector("details")!;
      assertEquals(details.hasAttribute("open"), false);
      assertEquals(details.querySelector(".mcp-view-focused-status"), null);
      assertEquals(details.querySelector(".mcp-view-focused-primary"), null);
      assertEquals(details.querySelector("code")?.textContent, "artifact:recorded-fingerprint");
    });
  },
});

Deno.test({
  name: "FocusedView follows touch layout and renders no empty technical control",
  permissions: { read: true, env: true, run: true },
  async fn() {
    await withDom((root) => {
      act(() =>
        render(
          <FocusedView
            label="Result"
            primary="Reading"
            hostContext={{
              containerDimensions: { width: 420 },
              deviceCapabilities: { touch: true, hover: false },
            }}
          />,
          root,
        )
      );
      assertEquals((root.firstElementChild as HTMLElement).dataset.layout, "mobile");
      assertEquals(root.querySelector("details"), null);
      assertEquals(root.querySelector(".mcp-view-focused-status"), null);
    });
  },
});

async function withDom(
  run: (root: HTMLElement, window: Window & typeof globalThis) => void,
): Promise<void> {
  const { parseHTML } = await import("npm:linkedom@0.18.12");
  const dom = parseHTML("<html><body><div id=root></div></body></html>");
  const previous = globalThis.document;
  const root = dom.document.getElementById("root") as unknown as HTMLElement;
  Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
  try {
    run(root, dom.window as unknown as Window & typeof globalThis);
  } finally {
    act(() => render(null, root));
    Object.defineProperty(globalThis, "document", { configurable: true, value: previous });
  }
}
