/** @jsxImportSource preact */

import { assertEquals, assertStringIncludes } from "@std/assert";
import { render } from "preact";
import type { ComposedSemanticRef } from "@casys/mcp-view-contracts";
import {
  ElementBody,
  ElementIdent,
  ElementProvenance,
  ElementReading,
  ElementVerdict,
  SemanticElement,
  type SemanticElementDensity,
} from "./semantic-element.tsx";

const REFERENCE: ComposedSemanticRef = Object.freeze({
  domain: "simulation",
  kind: "metric",
  id: "temperature.outlet",
  basisFingerprint: "sha256:abc123",
});

Deno.test({
  name: "SemanticElement preserves one semantic identity across chip row and card densities",
  permissions: { read: true, env: true, run: true },
  async fn() {
    await withDom((root) => {
      const densities: readonly SemanticElementDensity[] = ["chip", "row", "card"];
      for (const density of densities) {
        render(
          <SemanticElement
            reference={REFERENCE}
            density={density}
            ident={<ElementIdent marker="T" label="Outlet temperature" detail="Sensor T-04" />}
            reading={<ElementReading label="Reading" value="94" unit="°C" />}
            body={<ElementBody>bounded provider content</ElementBody>}
            provenance={<ElementProvenance label="Basis" value="run-42" />}
          />,
          root,
        );

        const element = root.firstElementChild;
        assertEquals(element?.getAttribute("data-density"), density);
        assertEquals(element?.getAttribute("data-semantic-domain"), REFERENCE.domain);
        assertEquals(element?.getAttribute("data-semantic-kind"), REFERENCE.kind);
        assertEquals(element?.getAttribute("data-semantic-id"), REFERENCE.id);
        assertEquals(
          element?.getAttribute("data-basis-fingerprint"),
          REFERENCE.basisFingerprint,
        );
        assertEquals(element?.hasAttribute("data-tone"), false);
        assertEquals(element?.hasAttribute("style"), false);
        assertEquals(
          root.querySelector("[data-element-slot=ident]")?.textContent,
          "TOutlet temperatureSensor T-04",
        );
        assertEquals(root.querySelector("[data-element-slot=reading]")?.textContent, "Reading94°C");
        assertEquals(
          root.querySelector("[data-element-slot=body]")?.textContent,
          "bounded provider content",
        );
        assertEquals(root.querySelector("[data-element-slot=verdict]"), null);
        assertEquals(
          root.querySelector("[data-element-slot=provenance]")?.textContent,
          "Basisrun-42",
        );
      }
    });
  },
});

Deno.test({
  name: "SemanticElement renders only caller supplied reading unit verdict and tone",
  permissions: { read: true, env: true, run: true },
  async fn() {
    await withDom((root) => {
      render(
        <SemanticElement
          reference={{ domain: "cad", kind: "artifact", id: "part.step" }}
          density="card"
          tone="warning"
          ident={<ElementIdent label="Bracket" />}
          reading={<ElementReading value="12.5" />}
          verdict={<ElementVerdict label="Review" value="Provisional" />}
        />,
        root,
      );

      const element = root.firstElementChild;
      assertEquals(element?.getAttribute("data-tone"), "warning");
      assertStringIncludes(
        element?.getAttribute("style") ?? "",
        "border-inline-start:var(--mcp-view-semantic-verdict-border-width, 3px) solid var(--mcp-view-warning, currentColor)",
      );
      assertEquals(root.querySelector(".mcp-view-element-reading-unit"), null);
      assertEquals(
        root.querySelector("[data-element-slot=verdict]")?.textContent,
        "ReviewProvisional",
      );
      assertEquals(root.querySelector("[data-element-slot=provenance]"), null);
    });
  },
});

Deno.test({
  name: "SemanticElement activation is opt-in and keyboard accessible",
  permissions: { read: true, env: true, run: true },
  async fn() {
    await withDom((root, window) => {
      const activated: ComposedSemanticRef[] = [];
      render(
        <SemanticElement
          reference={REFERENCE}
          density="row"
          activationLabel="Open outlet temperature"
          ident={<ElementIdent label="Outlet temperature" />}
          onActivate={(reference) => activated.push(reference)}
        />,
        root,
      );

      const element = root.firstElementChild as HTMLElement;
      assertEquals(element.getAttribute("role"), "button");
      // Linkedom preserves Preact's property spelling; browsers normalize it to tabindex.
      assertEquals(element.getAttribute("tabIndex"), "0");
      assertEquals(element.getAttribute("aria-label"), "Open outlet temperature");
      assertEquals(element.getAttribute("data-interactive"), "true");

      element.dispatchEvent(new window.Event("click", { bubbles: true }));
      dispatchKey(window, element, "Enter");
      dispatchKey(window, element, " ");
      dispatchKey(window, element, "Escape");
      assertEquals(activated, [REFERENCE, REFERENCE, REFERENCE]);

      render(
        <SemanticElement
          reference={REFERENCE}
          density="chip"
          ident={<ElementIdent label="Outlet temperature" />}
        />,
        root,
      );
      const passive = root.firstElementChild;
      assertEquals(passive?.hasAttribute("role"), false);
      assertEquals(passive?.hasAttribute("tabindex"), false);
      assertEquals(passive?.hasAttribute("data-interactive"), false);
    });
  },
});

async function withDom(
  run: (root: HTMLElement, window: Window & typeof globalThis) => void | Promise<void>,
): Promise<void> {
  const documentModule = await import("npm:linkedom@0.18.12");
  const dom = documentModule.parseHTML("<html><body><div id=root></div></body></html>");
  const previousDocument = globalThis.document;
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: dom.document,
  });
  try {
    const root = dom.document.getElementById("root") as unknown as HTMLElement;
    await run(root, dom.window as unknown as Window & typeof globalThis);
  } finally {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: previousDocument,
    });
  }
}

function dispatchKey(
  window: Window & typeof globalThis,
  target: HTMLElement,
  key: string,
): void {
  const event = new window.Event("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "key", { configurable: true, value: key });
  target.dispatchEvent(event);
}
