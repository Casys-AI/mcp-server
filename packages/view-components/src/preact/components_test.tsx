/** @jsxImportSource preact */

import { assert, assertEquals, assertStrictEquals, assertThrows } from "@std/assert";
import { render } from "preact";
import {
  Badge,
  BadgeGroup,
  Button,
  Card,
  CodeBlock,
  CrossSelection,
  DataTable,
  EmptyState,
  InlineCode,
  KeyValueList,
  Message,
  Metric,
  MetricGrid,
  NoticeGroup,
  renderStatusMessage,
  Row,
  Skeleton,
  Stack,
  StateMessage,
  TextInput,
  Toolbar,
} from "./components.tsx";

Deno.test({
  name: "shared Preact components render one consistent semantic vocabulary",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML(
      "<html><body><div id=root></div></body></html>",
    );
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: dom.document,
    });
    try {
      const root = dom.document.getElementById("root") as unknown as HTMLElement;
      render(
        <Card
          eyebrow="MCP / TEST"
          title="Qualification"
          actions={<Badge tone="success">Ready</Badge>}
        >
          <Stack gap="sm">
            <MetricGrid
              items={[{
                id: "temperature",
                label: "Temperature",
                value: "94",
                unit: "°C",
              }]}
            />
            <Metric label="Duration" value="148" unit="s" tone="info" />
          </Stack>
          <Row label="Execution state" responsive>
            <span>Simulation</span>
            <BadgeGroup label="Execution labels">
              <Badge tone="info">recorded</Badge>
              <Badge>read-only</Badge>
            </BadgeGroup>
          </Row>
          <KeyValueList
            items={[{ id: "model", label: "Model", value: "CM-01" }]}
          />
          <KeyValueList
            layout="facts"
            items={[{ id: "engine", label: "Engine", value: "ngspice 44" }]}
          />
          <Toolbar label="Qualification actions">
            <Button pressed>Pin</Button>
            <TextInput
              label="Filter qualification"
              value="thermal"
              onValueInput={() => {}}
            />
          </Toolbar>
          <CodeBlock label="Expression">self.temperature</CodeBlock>
          <InlineCode title="Recorded fingerprint">sha256:abc123</InlineCode>
          <CrossSelection label="Selection" value="MotorAssembly" status="linked" />
          <Message tone="warning">Recorded values may be stale</Message>
          <EmptyState>No secondary evidence</EmptyState>
          <StateMessage busy tone="danger" title="Invalid result">
            Check the solver log
          </StateMessage>
        </Card>,
        root,
      );

      assertEquals(root.querySelectorAll(".mcp-view-card").length, 1);
      assertEquals(root.querySelector(".mcp-view-card-title")?.textContent, "Qualification");
      assertEquals(root.querySelector(".mcp-view-badge")?.getAttribute("data-tone"), "success");
      assertEquals(root.querySelector("[data-metric=temperature]")?.textContent, "Temperature94°C");
      assertEquals(root.querySelector(".mcp-view-key-value")?.textContent, "ModelCM-01");
      // The inspector layout is the unmarked default; facts opt in by attribute.
      const [inspector, facts] = root.querySelectorAll(".mcp-view-key-values");
      assertEquals(inspector.getAttribute("data-layout"), null);
      assertEquals(facts.getAttribute("data-layout"), "facts");
      assertEquals(root.querySelector(".mcp-view-toolbar")?.getAttribute("role"), "group");
      assertEquals(root.querySelector(".mcp-view-button")?.getAttribute("aria-pressed"), "true");
      assertEquals(
        root.querySelector(".mcp-view-text-input")?.getAttribute("aria-label"),
        "Filter qualification",
      );
      assertEquals(root.querySelector(".mcp-view-code-block")?.textContent, "self.temperature");
      assertEquals(root.querySelector(".mcp-view-inline-code")?.textContent, "sha256:abc123");
      assertEquals(root.querySelector(".mcp-view-stack")?.getAttribute("data-gap"), "sm");
      assertEquals(root.querySelector(".mcp-view-row")?.getAttribute("role"), "group");
      assertEquals(
        root.querySelector(".mcp-view-row")?.classList.contains("mcp-view-row-responsive"),
        true,
      );
      assertEquals(
        root.querySelector(".mcp-view-badges")?.getAttribute("aria-label"),
        "Execution labels",
      );
      assertEquals(root.querySelectorAll(".mcp-view-metric").length, 2);
      assertEquals(root.querySelector(".mcp-view-cross-selection")?.getAttribute("role"), "status");
      assertEquals(root.querySelector(".mcp-view-message")?.getAttribute("data-tone"), "warning");
      assertEquals(root.querySelector(".mcp-view-empty")?.textContent, "No secondary evidence");
      assertEquals(root.querySelector(".mcp-view-state")?.getAttribute("role"), "alert");
      assertEquals(root.querySelector(".mcp-view-state")?.getAttribute("aria-busy"), "true");
      assertEquals(root.querySelectorAll(".mcp-view-state-busy").length, 1);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

Deno.test({
  name: "DataTable only advertises interactive rows when selection exists",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML(
      "<html><body><div id=root></div></body></html>",
    );
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: dom.document,
    });
    try {
      const root = dom.document.getElementById("root") as unknown as HTMLElement;
      const rows = [{ id: "boiler", name: "Boiler" }];
      render(
        <DataTable
          className="domain-table"
          label="Empty materials"
          rows={[] as typeof rows}
          columns={[{ id: "name", label: "Name", render: (row) => row.name }]}
          rowKey={(row) => row.id}
        />,
        root,
      );
      assertEquals(root.firstElementChild?.getAttribute("role"), "status");
      assertEquals(root.firstElementChild?.getAttribute("aria-label"), "Empty materials");
      assertEquals(root.firstElementChild?.classList.contains("domain-table"), true);

      render(
        <DataTable
          label="Materials"
          rows={rows}
          columns={[{ id: "name", label: "Name", render: (row) => row.name }]}
          rowKey={(row) => row.id}
        />,
        root,
      );
      assertEquals(root.querySelector("tbody tr")?.hasAttribute("data-interactive"), false);

      render(
        <DataTable
          label="Materials"
          rows={rows}
          columns={[{ id: "name", label: "Name", render: (row) => row.name }]}
          rowKey={(row) => row.id}
          selected={() => true}
          onSelect={() => {}}
        />,
        root,
      );
      assertEquals(
        root.querySelector("tbody tr")?.getAttribute("data-interactive"),
        "true",
      );
      assertEquals(root.querySelector("tbody tr")?.getAttribute("aria-selected"), "true");
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

Deno.test({
  name: "Skeleton renders role=status aria-busy=true with caller label and N aria-hidden lines",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML(
      "<html><body><div id=root></div></body></html>",
    );
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: dom.document,
    });
    try {
      const root = dom.document.getElementById("root") as unknown as HTMLElement;

      // Default: 3 lines
      render(<Skeleton label="Loading qualification results" />, root);

      const el = root.querySelector(".mcp-view-skeleton");
      assertEquals(el?.getAttribute("role"), "status");
      assertEquals(el?.getAttribute("aria-busy"), "true");
      assertEquals(el?.getAttribute("aria-label"), "Loading qualification results");
      const defaultLines = root.querySelectorAll(".mcp-view-skeleton-line");
      assertEquals(defaultLines.length, 3);
      assertEquals(defaultLines[0].getAttribute("aria-hidden"), "true");
      assertEquals(defaultLines[1].getAttribute("aria-hidden"), "true");
      assertEquals(defaultLines[2].getAttribute("aria-hidden"), "true");

      // Explicit line count
      render(<Skeleton label="Loading" lines={5} />, root);
      assertEquals(root.querySelectorAll(".mcp-view-skeleton-line").length, 5);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

Deno.test("Skeleton rejects non-integer or sub-one lines count", () => {
  assertThrows(() => Skeleton({ label: "Loading", lines: 0 }), RangeError, "positive integer");
  assertThrows(() => Skeleton({ label: "Loading", lines: -1 }), RangeError, "positive integer");
  assertThrows(() => Skeleton({ label: "Loading", lines: 1.5 }), RangeError, "positive integer");
});

Deno.test("NoticeGroup renders null when items is empty and omittedLabel is absent", () => {
  const result = NoticeGroup({ label: "Warnings", items: [] });
  assertEquals(result, null);
});

Deno.test({
  name: "NoticeGroup renders a section with label, data-tone, and one Message per item",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML("<html><body><div id=root></div></body></html>");
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
    try {
      const root = dom.document.getElementById("root") as unknown as HTMLElement;
      render(
        <NoticeGroup
          label="Validation warnings"
          items={["First notice", "Second notice"]}
          tone="warning"
        />,
        root,
      );

      const section = root.querySelector("section");
      assertEquals(section?.getAttribute("aria-label"), "Validation warnings");
      assertEquals(section?.getAttribute("data-tone"), "warning");
      assertEquals(
        root.querySelector(".mcp-view-notice-group-label")?.textContent,
        "Validation warnings",
      );
      const notices = root.querySelectorAll(".mcp-view-notice-group-item");
      assertEquals(notices.length, 2);
      const messages = root.querySelectorAll(".mcp-view-message");
      // Les notices ne sont plus des Message : le ton vit sur le groupe.
      assertEquals(messages.length, 0);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

Deno.test({
  name: "NoticeGroup renders the section when items is empty but omittedLabel is provided",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML("<html><body><div id=root></div></body></html>");
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
    try {
      const root = dom.document.getElementById("root") as unknown as HTMLElement;
      render(
        <NoticeGroup label="Errors" items={[]} omittedLabel="3 more not shown" />,
        root,
      );

      assertEquals(root.querySelector("section") !== null, true);
      assertEquals(root.querySelector("section")?.getAttribute("data-tone"), "neutral");
      assertEquals(root.querySelectorAll(".mcp-view-message").length, 0);
      assertEquals(
        root.querySelector(".mcp-view-notice-group-omitted")?.textContent,
        "3 more not shown",
      );
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

Deno.test({
  name: "renderStatusMessage without container returns the StateMessage node itself",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML("<html><body></body></html>");
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
    try {
      const node = renderStatusMessage("Loading results");
      // The node IS the state, not a wrapper around it: a caller handing this
      // to `defineView` must get an element carrying the class and the role.
      assertEquals(node.classList.contains("mcp-view-state"), true);
      assertEquals(node.getAttribute("aria-live"), null);
      assertEquals(
        node.querySelector(".mcp-view-state-detail")?.textContent,
        "Loading results",
      );
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

Deno.test({
  name: "renderStatusMessage with container renders into it and returns the same node",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML("<html><body></body></html>");
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
    try {
      const container = dom.document.createElement("div") as unknown as HTMLElement;
      const result = renderStatusMessage("Solver running", { container });
      assertStrictEquals(result, container);
      assertEquals(container.querySelector(".mcp-view-state") !== null, true);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

Deno.test({
  name: "renderStatusMessage passes tone title busy and className to StateMessage",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML("<html><body></body></html>");
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
    try {
      const node = renderStatusMessage("Solver running", {
        tone: "info",
        title: "Processing",
        busy: true,
        className: "my-status",
      });
      // className lands on the node that comes back, so a viewer can style the
      // element it mounts rather than an anonymous wrapper it never sees.
      assertEquals(node.getAttribute("data-tone"), "info");
      assertEquals(node.querySelector("strong")?.textContent, "Processing");
      assertEquals(node.querySelector(".mcp-view-state-busy") !== null, true);
      assertEquals(node.classList.contains("my-status"), true);
      assertEquals(node.classList.contains("mcp-view-state"), true);
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

Deno.test({
  name: "NoticeGroup announces one live region for the group, not one per notice",
  permissions: { read: true, env: true, run: true },
  async fn() {
    const documentModule = await import("npm:linkedom@0.18.12");
    const dom = documentModule.parseHTML("<html><body><div id=root></div></body></html>");
    const previousDocument = globalThis.document;
    Object.defineProperty(globalThis, "document", { configurable: true, value: dom.document });
    try {
      const root = dom.document.getElementById("root") as unknown as HTMLElement;
      render(
        <NoticeGroup
          label="Overruns"
          tone="danger"
          items={["REQ-014 over margin", "REQ-021 over margin", "REQ-033 over margin"]}
        />,
        root,
      );
      // Wrapping each notice in Message gave one alert per item: a reader heard
      // three alerts for what is drawn as a single severity heading.
      assertEquals(root.querySelectorAll("[role=alert]").length, 1);
      assertEquals(root.querySelector("section")?.getAttribute("role"), "alert");
      assertEquals(root.querySelectorAll(".mcp-view-notice-group-item").length, 3);

      render(<NoticeGroup label="Notes" items={["a"]} />, root);
      assertEquals(root.querySelectorAll("[role=alert]").length, 0);
      assertEquals(root.querySelector("section")?.getAttribute("role"), "status");
    } finally {
      Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: previousDocument,
      });
    }
  },
});

Deno.test("NoticeGroup treats a falsy omittedLabel as nothing left out", () => {
  // `{count && `${count} more`}` yields 0 and `{text && text}` yields "".
  for (const omittedLabel of [0, "", false, null, undefined]) {
    assertEquals(
      NoticeGroup({ label: "Warnings", items: [], omittedLabel }),
      null,
      `omittedLabel ${JSON.stringify(omittedLabel)} must not render the group`,
    );
  }
  assert(NoticeGroup({ label: "Warnings", items: [], omittedLabel: "+ 3 more" }) !== null);
});
