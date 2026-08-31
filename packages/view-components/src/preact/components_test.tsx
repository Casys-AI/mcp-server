/** @jsxImportSource preact */

import { assertEquals } from "@std/assert";
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
  KeyValueList,
  Message,
  Metric,
  MetricGrid,
  Row,
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
          <Toolbar label="Qualification actions">
            <Button pressed>Pin</Button>
            <TextInput
              label="Filter qualification"
              value="thermal"
              onValueInput={() => {}}
            />
          </Toolbar>
          <CodeBlock label="Expression">self.temperature</CodeBlock>
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
      assertEquals(root.querySelector(".mcp-view-toolbar")?.getAttribute("role"), "group");
      assertEquals(root.querySelector(".mcp-view-button")?.getAttribute("aria-pressed"), "true");
      assertEquals(
        root.querySelector(".mcp-view-text-input")?.getAttribute("aria-label"),
        "Filter qualification",
      );
      assertEquals(root.querySelector(".mcp-view-code-block")?.textContent, "self.temperature");
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
