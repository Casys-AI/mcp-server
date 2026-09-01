/** Files emitted by the intentionally small component result-viewer scaffold. */

export const resultViewerTemplates: Readonly<Record<string, string>> = {
  "deno.json": `{
  "compilerOptions": {
    "lib": ["deno.ns", "deno.window", "dom", "dom.iterable", "dom.asynciterable", "esnext"]
  },
  "imports": {
    "@casys/mcp-view": "jsr:@casys/mcp-view@0.9.2",
    "@casys/mcp-view-components": "jsr:@casys/mcp-view-components@0.5.0"
  },
  "minimumDependencyAge": {
    "age": "P1D",
    "exclude": [
      "jsr:@casys/mcp-view",
      "jsr:@casys/mcp-view-components",
      "jsr:@casys/mcp-view-contracts"
    ]
  },
  "tasks": {
    "build": "deno run -A build.ts",
    "check": "deno check src/main.ts",
    "test": "deno test --allow-read src",
    "fmt": "deno fmt --check index.html build.ts src"
  }
}
`,
  "index.html": `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Result viewer</title>
    <style>
    /* STYLES_PLACEHOLDER */
    </style>
  </head>
  <body>
    <main id="root" aria-live="polite" aria-busy="true">Loading result…</main>
    <script type="module">
    /* BUNDLE_PLACEHOLDER */
    </script>
  </body>
</html>
`,
  "build.ts": `import { dirname, fromFileUrl, join } from "jsr:@std/path@^1.1.0";

const here = dirname(fromFileUrl(import.meta.url));
const mcpViewModule = Deno.env.get("MCP_VIEW_MODULE") ?? "jsr:@casys/mcp-view@0.9.2";
const mcpViewComponentsModule = Deno.env.get("MCP_VIEW_COMPONENTS_MODULE") ??
  "jsr:@casys/mcp-view-components@0.5.0";
const temporaryDirectory = await Deno.makeTempDir({ prefix: "mcp-view-result-viewer-" });
const importMap = join(temporaryDirectory, "import-map.json");
const bundlePath = join(temporaryDirectory, "result-viewer.js");

try {
  await Deno.writeTextFile(importMap, JSON.stringify({
    compilerOptions: {
      lib: ["deno.ns", "deno.window", "dom", "dom.iterable", "dom.asynciterable", "esnext"]
    },
    imports: {
      "@casys/mcp-view": mcpViewModule,
      "@casys/mcp-view-components": mcpViewComponentsModule,
      "@modelcontextprotocol/ext-apps": "npm:@modelcontextprotocol/ext-apps@^1.7.4",
      "@modelcontextprotocol/sdk": "npm:@modelcontextprotocol/sdk@^1.29.0",
      "@modelcontextprotocol/sdk/types.js": "npm:@modelcontextprotocol/sdk@^1.29.0/types.js"
    }
  }));
  const command = new Deno.Command(Deno.execPath(), {
    args: [
      "bundle", "--config", importMap, "--check", "--platform=browser", "--minify",
      join(here, "src", "main.ts"), "--output", bundlePath
    ],
    stdout: "piped",
    stderr: "piped"
  });
  const result = await command.output();
  if (!result.success) {
    throw new Error(new TextDecoder().decode(result.stderr));
  }
  const template = await Deno.readTextFile(join(here, "index.html"));
  const css = await Deno.readTextFile(join(here, "src", "styles.css"));
  const js = await Deno.readTextFile(bundlePath);
  const html = template
    .replace("/* STYLES_PLACEHOLDER */", () => css)
    .replace("/* BUNDLE_PLACEHOLDER */", () => js);
  const output = join(here, "dist", "result-viewer", "index.html");
  await Deno.mkdir(dirname(output), { recursive: true });
  await Deno.writeTextFile(output, html);
  console.log("[result-viewer] wrote " + output);
} finally {
  await Deno.remove(temporaryDirectory, { recursive: true });
}
`,
  "src/model.ts": `export interface Metric {
  label: string;
  value: string;
}

export interface Artifact {
  label: string;
  uri: string;
  sha256?: string;
  bytes?: number;
}

export interface ResultModel {
  title: string;
  summary?: string;
  status?: string;
  metrics: Metric[];
  artifacts: Artifact[];
  details: Metric[];
}

export type DisplayState =
  | { kind: "loading" }
  | { kind: "empty" }
  | { kind: "error"; message: string; stale?: ResultModel; recordedAt?: string }
  | { kind: "result"; result: ResultModel };

/**
 * The values a failed refresh must keep showing. A viewer that blanks its
 * panels on error replaces the last recorded truth with a hole.
 */
export function shownResult(display: DisplayState): ResultModel | undefined {
  if (display.kind === "result") return display.result;
  if (display.kind === "error") return display.stale;
  return undefined;
}

export function parseStructuredResult(value: unknown): ResultModel {
  if (!isRecord(value)) throw new TypeError("Expected structuredContent to be an object.");
  const title = stringValue(value.title) ?? stringValue(value.name) ?? "Result";
  const summary = stringValue(value.summary) ?? stringValue(value.description);
  const status = stringValue(value.status);
  const metrics = metricsFrom(value.metrics);
  const artifacts = artifactsFrom(value.artifacts);
  const details = Object.entries(value)
    .filter(([key, item]) => !["title", "name", "summary", "description", "status", "metrics", "artifacts"].includes(key) && isScalar(item))
    .map(([label, item]) => ({ label: humanize(label), value: String(item) }));
  return { title, summary, status, metrics, artifacts, details };
}

export function isEmptyResult(result: ResultModel): boolean {
  return result.title === "Result" && !result.summary && !result.status &&
    result.metrics.length === 0 && result.artifacts.length === 0 && result.details.length === 0;
}

export function toolErrorMessage(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.content)) return "The tool reported an error.";
  const text = value.content.find((item) => isRecord(item) && item.type === "text")?.text;
  return typeof text === "string" && text.trim() ? text : "The tool reported an error.";
}

function metricsFrom(value: unknown): Metric[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (!isRecord(item)) return [];
      const label = stringValue(item.label) ?? stringValue(item.name);
      const metric = formatMetricValue(item.value, item.unit);
      return label && metric ? [{ label, value: metric }] : [];
    });
  }
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([label, metric]) => {
    const formatted = isRecord(metric)
      ? formatMetricValue(metric.value, metric.unit)
      : formatMetricValue(metric, undefined);
    return formatted ? [{ label: humanize(label), value: formatted }] : [];
  });
}

function artifactsFrom(value: unknown): Artifact[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!isRecord(item) || !stringValue(item.uri)) return [];
    const bytes = typeof item.bytes === "number" && Number.isSafeInteger(item.bytes) && item.bytes >= 0
      ? item.bytes
      : undefined;
    return [{
      label: stringValue(item.label) ?? stringValue(item.name) ?? stringValue(item.kind) ?? "Artifact",
      uri: stringValue(item.uri)!,
      sha256: stringValue(item.sha256),
      bytes,
    }];
  });
}

function formatMetricValue(value: unknown, unit: unknown): string | undefined {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return undefined;
  const formatted = typeof value === "number"
    ? new Intl.NumberFormat(undefined, { maximumFractionDigits: 4 }).format(value)
    : String(value);
  const suffix = stringValue(unit);
  return suffix ? formatted + " " + suffix : formatted;
}

function humanize(value: string): string {
  return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isScalar(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
`,
  "src/render.ts": `import type { DisplayState, Metric, ResultModel } from "./model.ts";

export function renderDisplay(display: DisplayState): string {
  if (display.kind === "loading") return shell("Loading result", '<div class="mcp-view-skeleton" role="status" aria-busy="true" aria-label="Loading the recorded result"><span class="mcp-view-skeleton-line" aria-hidden="true"></span><span class="mcp-view-skeleton-line" aria-hidden="true"></span><span class="mcp-view-skeleton-line" aria-hidden="true"></span></div>');
  if (display.kind === "empty") return shell("No result data", '<div class="mcp-view-state"><strong>Nothing to display</strong><p class="mcp-view-state-detail">The tool completed without displayable fields.</p></div>');
  if (display.kind === "error") {
    const banner = '<div class="mcp-view-stale-banner" data-tone="danger" role="alert"><span class="mcp-view-stale-banner-message">' + escapeHtml(display.message) + (display.recordedAt ? " — values recorded at " + escapeHtml(display.recordedAt) : "") + "</span></div>";
    // The kept values stay on the page underneath the failure.
    return display.stale ? shell(escapeHtml(display.stale.title), banner + renderBody(display.stale)) : shell("Result unavailable", banner);
  }
  return renderResult(display.result);
}

export function renderResult(result: ResultModel): string {
  return shell(escapeHtml(result.title), renderBody(result));
}

function renderBody(result: ResultModel): string {
  const status = result.status ? '<span class="mcp-view-badge">' + escapeHtml(result.status) + "</span>" : "";
  const summary = result.summary ? '<p class="mcp-view-card-eyebrow">' + escapeHtml(result.summary) + "</p>" : "";
  return '<header class="mcp-view-card-header"><div class="mcp-view-card-heading">' + summary + "</div>" + status + "</header>" +
    renderMetrics("Metrics", result.metrics, "No metrics were supplied.") +
    renderMetrics("Details", result.details, "No additional scalar details were supplied.") +
    renderArtifacts(result);
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function shell(title: string, content: string): string {
  return '<section class="viewer" aria-label="Structured result"><h1>' + title + "</h1>" + content + "</section>";
}

function renderMetrics(title: string, metrics: Metric[], empty: string): string {
  const rows = metrics.length
    ? '<dl class="mcp-view-metrics">' + metrics.map((metric) => '<div class="mcp-view-metric"><dt class="mcp-view-metric-label">' + escapeHtml(metric.label) + '</dt><dd class="mcp-view-metric-value">' + escapeHtml(metric.value) + "</dd></div>").join("") + "</dl>"
    : '<p class="mcp-view-empty">' + escapeHtml(empty) + "</p>";
  return '<section class="mcp-view-card"><h2 class="mcp-view-card-title">' + title + "</h2>" + rows + "</section>";
}

function renderArtifacts(result: ResultModel): string {
  const rows = result.artifacts.length
    ? '<div class="mcp-view-stack">' + result.artifacts.map((artifact) => '<article class="mcp-view-artifact-row"><span class="mcp-view-artifact-row-identity"><strong class="mcp-view-artifact-row-label">' + escapeHtml(artifact.label) + '</strong></span><code class="mcp-view-artifact-row-uri">' + escapeHtml(artifact.uri) + "</code>" + (artifact.sha256 ? '<span class="mcp-view-artifact-row-fingerprint"><span>sha256</span><code>' + escapeHtml(artifact.sha256) + "</code></span>" : "") + (artifact.bytes === undefined ? "" : '<span class="mcp-view-artifact-row-size">' + artifact.bytes.toLocaleString() + " bytes</span>") + "</article>").join("") + "</div>"
    : '<p class="mcp-view-empty">No artifacts were supplied.</p>';
  return '<section class="mcp-view-card"><h2 class="mcp-view-card-title">Artifacts</h2>' + rows + "</section>";
}
`,
  "src/styles.css": `/*
 * The kit owns the component vocabulary through installMcpViewTheme(); this
 * file only frames the page around it.
 */
:root { color-scheme: light dark; }
* { box-sizing: border-box; }
html, body {
  min-width: 0;
  margin: 0;
  background: var(--color-background-primary, #ffffff);
  color: var(--mcp-view-text, #101519);
}
body { font: 14px/1.5 var(--mcp-view-font-body, system-ui, sans-serif); }
#root { max-width: 1040px; margin: 0 auto; padding: 16px; }
.viewer { display: grid; gap: 12px; min-width: 0; }
.viewer h1 {
  margin: 0;
  font-family: var(--mcp-view-font-heading, system-ui, sans-serif);
  font-size: clamp(20px, 4vw, 28px);
  letter-spacing: -.02em;
}
.viewer p { margin: 0; }
@media (max-width: 480px) { #root { padding: 8px; } }
@media (prefers-reduced-motion: reduce) { .mcp-view-skeleton-line { animation: none; } }
`,
  "src/main.ts": `import {
  createMcpApp,
  defineView,
  type AppContext,
} from "@casys/mcp-view";
import {
  componentCatalogCapabilities,
  defineComponentRegistry,
  defineCustomComponent,
  defineKeyValueComponent,
  defineMetricGridComponent,
  installMcpViewTheme,
  mountComponentSurface,
  type MountedComponentSurface,
} from "@casys/mcp-view-components";
import { isEmptyResult, parseStructuredResult, shownResult, toolErrorMessage, type DisplayState, type ResultModel } from "./model.ts";
import { escapeHtml } from "./render.ts";

interface ViewerState {
  display: DisplayState;
  /** Last successfully parsed result, kept so a failed refresh can still show it. */
  lastResult?: ResultModel;
  /** When that kept result was recorded, so the banner can date it. */
  recordedAt?: string;
}

type ViewerContext = AppContext<ViewerState>;
let mountedSurface: MountedComponentSurface | undefined;
let mountGeneration = 0;

const components = defineComponentRegistry<ViewerState, ViewerContext>({
  components: {
    "result.identity": defineCustomComponent({
      title: "Result identity",
      mount(target, { data }) {
        const display = data.display;
        if (display.kind === "loading") {
          // Frame first: the structure appears before the values, so nothing
          // shifts once they arrive.
          target.className = "mcp-view-skeleton";
          target.setAttribute("role", "status");
          target.setAttribute("aria-busy", "true");
          target.setAttribute("aria-label", "Loading the recorded result");
          for (let line = 0; line < 3; line++) {
            const placeholder = document.createElement("span");
            placeholder.className = "mcp-view-skeleton-line";
            placeholder.setAttribute("aria-hidden", "true");
            target.append(placeholder);
          }
          return;
        }
        target.className = "mcp-view-card";
        const header = document.createElement("header");
        header.className = "mcp-view-card-header";
        const heading = document.createElement("div");
        heading.className = "mcp-view-card-heading";
        const title = document.createElement("h1");
        title.className = "mcp-view-card-title";
        const summary = document.createElement("p");
        summary.className = "mcp-view-card-eyebrow";
        const shown = shownResult(display);
        if (display.kind === "empty") {
          title.textContent = "Nothing to display";
          summary.textContent = "The tool completed without displayable fields.";
        } else if (display.kind === "error") {
          title.textContent = shown ? shown.title : "Result unavailable";
          summary.textContent = shown ? shown.summary ?? "Recorded earlier" : display.message;
        } else {
          title.textContent = display.result.title;
          summary.textContent = display.result.summary ?? display.result.status ?? "Structured result";
        }
        heading.append(summary, title);
        header.append(heading);
        target.append(header);
        if (display.kind !== "error") return;
        // The failure is announced beside the values it could not refresh,
        // never in place of them.
        const banner = document.createElement("div");
        banner.className = "mcp-view-stale-banner";
        banner.setAttribute("role", "alert");
        banner.setAttribute("data-tone", "danger");
        const message = document.createElement("span");
        message.className = "mcp-view-stale-banner-message";
        message.textContent = display.recordedAt
          ? display.message + " — values recorded at " + display.recordedAt
          : display.message;
        banner.append(message);
        target.append(banner);
      },
    }),
    "result.metrics": defineMetricGridComponent({
      title: "Metrics",
      select: (data) =>
        (shownResult(data.display)?.metrics ?? []).map((metric, index) => ({
          id: "metric-" + index,
          label: metric.label,
          value: metric.value,
        })),
    }),
    "result.details": defineKeyValueComponent({
      title: "Details",
      select: (data) =>
        (shownResult(data.display)?.details ?? []).map((detail, index) => ({
          key: "detail-" + index,
          label: detail.label,
          value: detail.value,
        })),
    }),
    "result.artifacts": defineCustomComponent({
      title: "Artifacts",
      mount(target, { data }) {
        target.className = "mcp-view-stack";
        const artifacts = shownResult(data.display)?.artifacts ?? [];
        if (artifacts.length === 0) {
          const empty = document.createElement("p");
          empty.className = "mcp-view-empty";
          empty.textContent = "No artifacts were supplied.";
          target.append(empty);
          return;
        }
        for (const artifact of artifacts) {
          // Identity, address and digest are displayed exactly as supplied;
          // this starter verifies nothing on its own.
          const item = document.createElement("article");
          item.className = "mcp-view-artifact-row";
          const identity = document.createElement("span");
          identity.className = "mcp-view-artifact-row-identity";
          const label = document.createElement("strong");
          label.className = "mcp-view-artifact-row-label";
          label.textContent = artifact.label;
          identity.append(label);
          const uri = document.createElement("code");
          uri.className = "mcp-view-artifact-row-uri";
          uri.textContent = artifact.uri;
          item.append(identity, uri);
          if (artifact.sha256) {
            const fingerprint = document.createElement("span");
            fingerprint.className = "mcp-view-artifact-row-fingerprint";
            const algorithm = document.createElement("span");
            algorithm.textContent = "sha256";
            const digest = document.createElement("code");
            digest.textContent = artifact.sha256;
            fingerprint.append(algorithm, digest);
            item.append(fingerprint);
          }
          target.append(item);
        }
      },
    }),
  },
  defaultSurface: {
    layout: { type: "stack", gap: "sm" },
    components: [
      { id: "identity", component: "result.identity" },
      { id: "metrics", component: "result.metrics" },
      { id: "details", component: "result.details" },
      { id: "artifacts", component: "result.artifacts" },
    ],
  },
});

const resultView = defineView<ViewerState>({
  async onLeave() {
    await disposeSurface();
  },
  render(ctx) {
    const host = document.createElement("section");
    host.className = "viewer component-surface-host";
    host.setAttribute("aria-label", "Structured result");
    const generation = ++mountGeneration;
    queueMicrotask(async () => {
      if (generation !== mountGeneration) return;
      await disposeSurface(false);
      if (generation !== mountGeneration) return;
      mountedSurface = await mountComponentSurface({
        root: host,
        registry: components,
        data: ctx.state,
        appContext: ctx,
        hostContext: ctx.hostContext,
      });
    });
    return host;
  },
});

async function disposeSurface(invalidate = true): Promise<void> {
  if (invalidate) mountGeneration++;
  const current = mountedSurface;
  mountedSurface = undefined;
  await current?.dispose();
}

async function boot(): Promise<void> {
  const root = document.getElementById("root");
  if (!root) throw new Error("The result viewer root is missing.");
  installMcpViewTheme();
  await createMcpApp<ViewerState>({
    info: { name: "Result Viewer", version: "0.1.0" },
    root,
    views: { result: resultView },
    initialView: "result",
    initialState: { display: { kind: "loading" } },
    capabilities: {
      experimental: componentCatalogCapabilities(components),
    },
    // Registered by mcp-view before connect(), so the initiating tool result
    // cannot be lost during the MCP Apps handshake.
    async onToolInput(_input, app) {
      root.setAttribute("aria-busy", "true");
      app.ctx.state.display = { kind: "loading" };
      await app.navigate("result");
    },
    async onToolResult(result, app) {
      const kept = app.ctx.state.lastResult;
      const recordedAt = app.ctx.state.recordedAt;
      if (result.isError) {
        app.ctx.state.display = {
          kind: "error",
          message: toolErrorMessage(result),
          stale: kept,
          recordedAt,
        };
      } else {
        try {
          const parsed = parseStructuredResult(result.structuredContent);
          if (isEmptyResult(parsed)) {
            app.ctx.state.display = { kind: "empty" };
          } else {
            app.ctx.state.display = { kind: "result", result: parsed };
            app.ctx.state.lastResult = parsed;
            app.ctx.state.recordedAt = new Date().toISOString();
          }
        } catch (error) {
          app.ctx.state.display = {
            kind: "error",
            message: error instanceof Error ? error.message : "The result could not be read.",
            stale: kept,
            recordedAt,
          };
        }
      }
      root.setAttribute("aria-busy", "false");
      await app.navigate("result");
    },
    async onTeardown() {
      await disposeSurface();
    },
  });
}

void boot().catch((error) => {
  const root = document.getElementById("root");
  if (root) root.innerHTML = '<section class="viewer"><div class="mcp-view-state" data-tone="danger" role="alert"><strong>Viewer unavailable</strong><p class="mcp-view-state-detail">' + escapeHtml(error instanceof Error ? error.message : "The viewer could not start.") + "</p></div></section>";
  console.error(error);
});
`,
  "src/model_test.ts": `import { assertEquals, assertThrows } from "jsr:@std/assert@^1.0.0";
import { isEmptyResult, parseStructuredResult, toolErrorMessage } from "./model.ts";
import { escapeHtml, renderResult } from "./render.ts";

Deno.test("result viewer parses generic metrics and artifacts", () => {
  const result = parseStructuredResult({
    title: "Report",
    status: "complete",
    metrics: { total: { value: 12.5, unit: "ms" } },
    artifacts: [{ name: "Output", uri: "casys://result.json", bytes: 42 }],
  });
  assertEquals(result.metrics, [{ label: "total", value: "12.5 ms" }]);
  assertEquals(result.artifacts[0]?.uri, "casys://result.json");
  assertEquals(renderResult(result).includes("12.5 ms"), true);
});

Deno.test("result viewer distinguishes empty and invalid structured content", () => {
  assertEquals(isEmptyResult(parseStructuredResult({})), true);
  assertThrows(() => parseStructuredResult([]), TypeError, "structuredContent");
  assertEquals(toolErrorMessage({ content: [{ type: "text", text: "Unavailable" }] }), "Unavailable");
  assertEquals(escapeHtml("<unsafe>"), "&lt;unsafe&gt;");
  const hostile = renderResult(parseStructuredResult({ title: '<img src=x onerror=alert(1)>', metrics: { value: '<script>' } }));
  assertEquals(hostile.includes("<img"), false);
  assertEquals(hostile.includes("&lt;script&gt;"), true);
});
`,
};
