/** @jsxImportSource preact */

import { assertEquals, assertThrows } from "@std/assert";
import { render } from "preact";
import { ArtifactRow, LimitGauge, PathBar } from "./structural.tsx";

Deno.test({
  name: "PathBar exposes controlled, accessible local navigation",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML("<html><body><div id=root></div></body></html>");
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
    try {
      const selected: string[] = [];
      const root = dom.document.getElementById("root") as unknown as HTMLElement;
      const items = [
        { id: "project", label: "Project" },
        { id: "thread", label: "Thread" },
        { id: "artifact", label: "Artifact" },
      ];
      render(
        <PathBar
          label="Recorded evidence path"
          items={items}
          currentId="artifact"
          onSelect={(id) => selected.push(id)}
        />,
        root,
      );

      assertEquals(root.querySelector("nav")?.getAttribute("aria-label"), "Recorded evidence path");
      assertEquals(root.querySelectorAll("ol > li").length, 3);
      assertEquals(root.querySelector("[aria-current=page]")?.textContent, "Artifact");
      assertEquals(root.querySelectorAll("button").length, 2);
      (root.querySelector("button") as unknown as HTMLButtonElement).click();
      assertEquals(selected, ["project"]);

      render(
        <PathBar
          label="Recorded evidence path"
          items={items}
          currentId="thread"
          onSelect={(id) => selected.push(id)}
        />,
        root,
      );
      assertEquals(root.querySelector("[aria-current=page]")?.textContent, "Thread");
      assertEquals(selected, ["project"]);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

Deno.test({
  name: "LimitGauge renders only caller-supplied status on one finite meter",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML("<html><body><div id=root></div></body></html>");
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
    try {
      const root = dom.document.getElementById("root") as unknown as HTMLElement;
      render(
        <LimitGauge
          label="Minimum thickness"
          min={0}
          max={2}
          value={0.84}
          valueLabel="0.84 mm"
          statusLabel="Recorded outside limit"
          tone="danger"
          limit={{ value: 1.2, label: "Recorded limit 1.20 mm" }}
        />,
        root,
      );

      const meter = root.querySelector("meter");
      assertEquals(meter?.getAttribute("aria-label"), "Minimum thickness");
      assertEquals(meter?.getAttribute("aria-valuetext"), "0.84 mm; Recorded outside limit");
      assertEquals(meter?.getAttribute("min"), "0");
      assertEquals(meter?.getAttribute("max"), "2");
      assertEquals(meter?.getAttribute("value"), "0.84");
      assertEquals(root.firstElementChild?.getAttribute("data-tone"), "danger");
      assertEquals(
        root.querySelector(".mcp-view-limit-gauge-status")?.textContent,
        "Recorded outside limit",
      );
      assertEquals(
        root.querySelector(".mcp-view-limit-gauge-limit")?.textContent,
        "Recorded limit 1.20 mm",
      );
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

Deno.test("LimitGauge rejects non-finite or incoherent scales", () => {
  const valid = {
    label: "Envelope",
    min: 0,
    max: 100,
    value: 57,
    valueLabel: "57 %",
    statusLabel: "Recorded nominal",
    tone: "success" as const,
  };
  assertThrows(() => LimitGauge({ ...valid, min: Number.NaN }), TypeError, "finite");
  assertThrows(() => LimitGauge({ ...valid, max: Number.POSITIVE_INFINITY }), TypeError, "finite");
  assertThrows(() => LimitGauge({ ...valid, max: 0 }), RangeError, "greater than min");
  assertThrows(() => LimitGauge({ ...valid, value: 101 }), RangeError, "within min and max");
  assertThrows(
    () => LimitGauge({ ...valid, limit: { value: Number.NaN, label: "limit" } }),
    TypeError,
    "limit must be finite",
  );
});

Deno.test({
  name: "ArtifactRow becomes a button only with an explicit callback",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML("<html><body><div id=root></div></body></html>");
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
    try {
      const root = dom.document.getElementById("root") as unknown as HTMLElement;
      const base = {
        label: "Module geometry",
        kind: "GLB",
        uri: "casys://build123d/artifacts/a.glb",
        fingerprint: { algorithm: "sha256", digest: "a".repeat(64) },
        sizeLabel: "6,336 bytes",
        verification: { label: "Digest verified by host", tone: "success" as const },
      };
      render(<ArtifactRow {...base} />, root);

      assertEquals(root.querySelectorAll("article").length, 1);
      assertEquals(root.querySelectorAll("button").length, 0);
      assertEquals(
        root.querySelector(".mcp-view-artifact-row-verification")?.textContent,
        "Digest verified by host",
      );
      assertEquals(root.textContent?.includes("rehash"), false);

      let activations = 0;
      render(
        <ArtifactRow
          {...base}
          actionLabel="Open recorded module geometry"
          onActivate={() => activations++}
        />,
        root,
      );
      const button = root.querySelector("button") as unknown as HTMLButtonElement;
      assertEquals(root.querySelectorAll("article").length, 0);
      assertEquals(button.getAttribute("type"), "button");
      assertEquals(button.getAttribute("aria-label"), "Open recorded module geometry");
      button.click();
      assertEquals(activations, 1);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});
