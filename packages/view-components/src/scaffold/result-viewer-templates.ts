/** Files emitted by the intentionally small component result-viewer scaffold. */

export const resultViewerTemplates: Readonly<Record<string, string>> = {
  "deno.json": `{
  "compilerOptions": {
    "lib": ["deno.ns", "deno.window", "dom", "dom.iterable", "dom.asynciterable", "esnext"]
  },
  "imports": {
    "@casys/mcp-view": "jsr:@casys/mcp-view@0.9.1",
    "@casys/mcp-view-components": "jsr:@casys/mcp-view-components@0.2.0"
  },
  "minimumDependencyAge": {
    "age": "P1D",
    "exclude": ["jsr:@casys/mcp-view", "jsr:@casys/mcp-view-components"]
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
const mcpViewModule = Deno.env.get("MCP_VIEW_MODULE") ?? "jsr:@casys/mcp-view@0.9.1";
const mcpViewComponentsModule = Deno.env.get("MCP_VIEW_COMPONENTS_MODULE") ??
  "jsr:@casys/mcp-view-components@0.2.0";
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
  | { kind: "error"; message: string }
  | { kind: "result"; result: ResultModel };

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
  if (display.kind === "loading") return shell("Loading result", '<div class="state loading"><span class="spinner" aria-hidden="true"></span><p>Waiting for a structured tool result…</p></div>');
  if (display.kind === "empty") return shell("No result data", '<div class="state empty"><h2>Nothing to display</h2><p>The tool completed without displayable fields.</p></div>');
  if (display.kind === "error") return shell("Result unavailable", '<div class="state error" role="alert"><h2>Unable to display this result</h2><p>' + escapeHtml(display.message) + "</p></div>");
  return renderResult(display.result);
}

export function renderResult(result: ResultModel): string {
  const status = result.status ? '<span class="status">' + escapeHtml(result.status) + "</span>" : "";
  const summary = result.summary ? '<p class="summary">' + escapeHtml(result.summary) + "</p>" : "";
  return shell(escapeHtml(result.title), '<header class="result-header"><div>' + summary + "</div>" + status + "</header>" +
    renderMetrics("Metrics", result.metrics, "No metrics were supplied.") +
    renderMetrics("Details", result.details, "No additional scalar details were supplied.") +
    renderArtifacts(result));
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function shell(title: string, content: string): string {
  return '<section class="viewer" aria-label="Structured result"><header class="masthead"><div><p class="kicker">MCP RESULT</p><h1>' + title + "</h1></div></header>" + content + "</section>";
}

function renderMetrics(title: string, metrics: Metric[], empty: string): string {
  const rows = metrics.length
    ? '<dl class="metric-grid">' + metrics.map((metric) => '<div><dt>' + escapeHtml(metric.label) + "</dt><dd>" + escapeHtml(metric.value) + "</dd></div>").join("") + "</dl>"
    : '<p class="muted">' + escapeHtml(empty) + "</p>";
  return '<section class="panel"><h2>' + title + "</h2>" + rows + "</section>";
}

function renderArtifacts(result: ResultModel): string {
  const rows = result.artifacts.length
    ? '<div class="artifact-list">' + result.artifacts.map((artifact) => '<article class="artifact"><strong>' + escapeHtml(artifact.label) + "</strong><code>" + escapeHtml(artifact.uri) + "</code>" + (artifact.sha256 ? '<small>SHA-256: <code>' + escapeHtml(artifact.sha256) + "</code></small>" : "") + (artifact.bytes === undefined ? "" : "<small>" + artifact.bytes.toLocaleString() + " bytes</small>") + "</article>").join("") + "</div>"
    : '<p class="muted">No artifacts were supplied.</p>';
  return '<section class="panel"><h2>Artifacts</h2>' + rows + "</section>";
}
`,
  "src/styles.css": `:root {
  color-scheme: light dark;
  --surface: var(--color-background-primary, #101413);
  --panel: var(--color-background-secondary, #18201e);
  --text: var(--color-text-primary, #edf2ef);
  --muted: var(--color-text-secondary, #a6b3ac);
  --line: var(--color-border-primary, #405049);
  --accent: var(--color-accent, #8bc7a5);
  --danger: #df827b;
  --font-body: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
  --font-data: var(--font-mono, ui-monospace, "SFMono-Regular", Menlo, monospace);
}
* { box-sizing: border-box; }
html, body { min-width: 0; margin: 0; background: var(--surface); color: var(--text); }
body { font: 14px/1.5 var(--font-body); }
#root { max-width: 1040px; margin: 0 auto; padding: 16px; }
.viewer { overflow: hidden; border: 1px solid var(--line); background: var(--panel); }
.masthead { padding: 20px; border-bottom: 1px solid var(--line); background: color-mix(in srgb, var(--panel) 92%, var(--accent)); }
.kicker { margin: 0 0 4px; color: var(--accent); font: 700 11px/1.2 var(--font-data); letter-spacing: .12em; }
h1, h2, p { margin-top: 0; }
h1 { margin-bottom: 0; font-size: clamp(22px, 5vw, 32px); letter-spacing: -.03em; }
h2 { margin-bottom: 12px; font-size: 15px; }
.result-header, .panel, .state { margin: 16px 20px; }
.result-header { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
.summary, .muted { color: var(--muted); }
.status { border: 1px solid currentColor; color: var(--accent); padding: 3px 7px; font: 700 11px var(--font-data); text-transform: uppercase; }
.panel { padding: 14px; border: 1px solid var(--line); background: color-mix(in srgb, var(--panel) 88%, var(--surface)); }
.metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin: 0; }
.metric-grid div { min-width: 0; border-left: 2px solid var(--line); padding-left: 9px; }
dt, small { color: var(--muted); font-size: 11px; }
dd { margin: 2px 0 0; overflow-wrap: anywhere; font: 600 13px var(--font-data); }
.artifact-list { display: grid; gap: 8px; }
.artifact { display: grid; gap: 5px; padding: 11px; border: 1px solid var(--line); }
.artifact strong { color: var(--accent); font: 700 11px var(--font-data); text-transform: uppercase; }
code { overflow-wrap: anywhere; font-family: var(--font-data); }
.state { min-height: 120px; display: grid; place-content: center; text-align: center; }
.error { color: var(--danger); }
.spinner { width: 22px; height: 22px; margin: 0 auto 10px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(1turn); } }
@media (prefers-reduced-motion: reduce) { .spinner { animation: none; } }
@media (max-width: 480px) { #root { padding: 8px; } .result-header { display: block; } .status { display: inline-block; margin-top: 8px; } }
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
  mountComponentSurface,
  type MountedComponentSurface,
} from "@casys/mcp-view-components";
import { isEmptyResult, parseStructuredResult, toolErrorMessage, type DisplayState } from "./model.ts";
import { escapeHtml } from "./render.ts";

interface ViewerState {
  display: DisplayState;
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
        const title = document.createElement("h1");
        const summary = document.createElement("p");
        if (display.kind === "loading") {
          title.textContent = "Loading result";
          summary.textContent = "Waiting for a structured tool result…";
        } else if (display.kind === "empty") {
          title.textContent = "Nothing to display";
          summary.textContent = "The tool completed without displayable fields.";
        } else if (display.kind === "error") {
          title.textContent = "Result unavailable";
          summary.textContent = display.message;
          target.setAttribute("role", "alert");
        } else {
          title.textContent = display.result.title;
          summary.textContent = display.result.summary ?? display.result.status ?? "Structured result";
        }
        target.className = "masthead";
        target.append(title, summary);
      },
    }),
    "result.metrics": defineMetricGridComponent({
      title: "Metrics",
      select: (data) => data.display.kind === "result"
        ? data.display.result.metrics.map((metric, index) => ({
          id: "metric-" + index,
          label: metric.label,
          value: metric.value,
        }))
        : [],
    }),
    "result.details": defineKeyValueComponent({
      title: "Details",
      select: (data) => data.display.kind === "result"
        ? data.display.result.details.map((detail, index) => ({
          key: "detail-" + index,
          label: detail.label,
          value: detail.value,
        }))
        : [],
    }),
    "result.artifacts": defineCustomComponent({
      title: "Artifacts",
      mount(target, { data }) {
        target.className = "panel artifact-list";
        if (data.display.kind !== "result" || data.display.result.artifacts.length === 0) {
          const empty = document.createElement("p");
          empty.className = "muted";
          empty.textContent = "No artifacts were supplied.";
          target.append(empty);
          return;
        }
        for (const artifact of data.display.result.artifacts) {
          const item = document.createElement("article");
          item.className = "artifact";
          const label = document.createElement("strong");
          label.textContent = artifact.label;
          const uri = document.createElement("code");
          uri.textContent = artifact.uri;
          item.append(label, uri);
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
      if (result.isError) {
        app.ctx.state.display = { kind: "error", message: toolErrorMessage(result) };
      } else {
        try {
          const parsed = parseStructuredResult(result.structuredContent);
          app.ctx.state.display = isEmptyResult(parsed)
            ? { kind: "empty" }
            : { kind: "result", result: parsed };
        } catch (error) {
          app.ctx.state.display = {
            kind: "error",
            message: error instanceof Error ? error.message : "The result could not be read.",
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
  if (root) root.innerHTML = '<section class="viewer"><div class="state error" role="alert"><h1>Viewer unavailable</h1><p>' + escapeHtml(error instanceof Error ? error.message : "The viewer could not start.") + "</p></div></section>";
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
