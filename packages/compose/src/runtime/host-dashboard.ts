/**
 * Interactive local MCP Apps dashboard host.
 *
 * A composed dashboard is a parent MCP Apps host, not an upstream `/ui`
 * shortcut. Each panel is served on a distinct loopback origin so the parent
 * can verify `postMessage` origins even if an iframe later navigates away.
 * The parent owns the only MCP proxy endpoint and applies the panel's
 * captured server/resource/tool allow-lists before calling the cluster.
 *
 * @module runtime/host-dashboard
 */

import { renderComposite } from "../host/renderer/html-generator.ts";
import type { RendererSlotOptions } from "../host/renderer/options.ts";
import { composeDashboard } from "./compose.ts";
import type {
  ComposeRequest,
  ComposeResult,
  McpCluster,
  McpListResourcesResult,
  McpReadResourceResult,
} from "./types.ts";
import type {
  ComposedDashboardCsp,
  ComposedDashboardHandle,
  ComposedDashboardPanel,
  ServeComposedDashboardOptions,
} from "./host-dashboard-types.ts";

const LOOPBACK_HOSTNAME = "127.0.0.1";
const MAX_LIST_PAGES = 100;

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  readonly jsonrpc: "2.0";
  readonly id: JsonRpcId;
  readonly method: string;
  readonly params: Record<string, unknown>;
}

interface HostedPanel {
  readonly panel: ComposedDashboardPanel;
  readonly origin: string;
  readonly server: Deno.HttpServer;
}

interface HostedPanelRoute {
  readonly panel: ComposedDashboardPanel;
}

interface MainHostState {
  readonly html: string;
  readonly parentCsp: string;
  readonly routes: ReadonlyMap<string, HostedPanelRoute>;
  readonly panelCount: number;
}

interface HtmlResourceDocument {
  readonly text: string;
  readonly mimeType: string;
  readonly resourceCsp?: ComposedDashboardCsp;
}

interface ValidatedCsp {
  readonly connectDomains?: readonly string[];
  readonly resourceDomains?: readonly string[];
  readonly frameDomains?: readonly string[];
  readonly baseUriDomains?: readonly string[];
}

/**
 * Compose and immediately serve an interactive local MCP Apps dashboard.
 *
 * This is the preferred lifecycle entry point. It retains the cluster only
 * while the returned handle is alive, and rolls it back if host startup fails.
 */
export async function composeAndServeDashboard(
  request: ComposeRequest,
  options?: ServeComposedDashboardOptions,
): Promise<ComposedDashboardHandle> {
  const result = await composeDashboard({ ...request, keepAlive: true });

  try {
    return await serveComposedDashboard(result, options);
  } catch (error) {
    await result.cluster?.stopAll();
    throw error;
  }
}

/**
 * Serve a previously composed, keep-alive result as an interactive dashboard.
 *
 * The returned main URL and every iframe listener bind to `127.0.0.1` only.
 * There is deliberately no hostname option: remote exposure requires an
 * authenticated, separately-designed deployment adapter.
 */
export async function serveComposedDashboard(
  result: ComposeResult,
  options?: ServeComposedDashboardOptions,
): Promise<ComposedDashboardHandle> {
  const cluster = result.cluster;
  if (!cluster) {
    throw new Error(
      "serveComposedDashboard requires composeDashboard({ keepAlive: true }) or composeAndServeDashboard()",
    );
  }

  assertInteractivePanelBinding(result);

  const hostedPanels: HostedPanel[] = [];
  let mainState: MainHostState | undefined;
  let mainServer: { origin: string; server: Deno.HttpServer } | undefined;

  try {
    // Bind the parent first so every child CSP can name this precise origin in
    // frame-ancestors. The handler stays unavailable until the child origins,
    // routes, and rendered document are configured below.
    mainServer = await serveLoopback(async (request) => {
      const state = mainState;
      if (!state) return new Response("Dashboard is starting", { status: 503 });

      const url = new URL(request.url);
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
        return new Response(state.html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy": state.parentCsp,
            "Referrer-Policy": "no-referrer",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return jsonResponse({ status: "ok", panels: state.panelCount });
      }

      if (request.method === "POST") {
        const route = state.routes.get(url.pathname);
        if (route) return await handlePanelProxy(cluster, route.panel, request);
      }

      return new Response("Not found", { status: 404 });
    }, options?.port ?? 0);
    const dashboardServer = mainServer;

    // A distinct loopback origin per child makes postMessage origin checks
    // durable across iframe navigation. A WindowProxy alone is insufficient:
    // it survives navigation to another document.
    for (const panel of result.panels) {
      hostedPanels.push(await servePanelResource(cluster, panel, dashboardServer.origin));
    }

    const routes = new Map<string, HostedPanelRoute>();
    const rendererSlots: Record<number, RendererSlotOptions> = {};
    for (const hostedPanel of hostedPanels) {
      const routePath = `/api/slots/${hostedPanel.panel.slot}/${randomRouteToken()}/mcp`;
      routes.set(routePath, { panel: hostedPanel.panel });
      rendererSlots[hostedPanel.panel.slot] = {
        iframeSrc: `${hostedPanel.origin}/ui`,
        expectedOrigin: hostedPanel.origin,
        rpcEndpoint: routePath,
        capabilities: {
          serverTools: hostedPanel.panel.allowedToolNames.length > 0,
          serverResources: true,
        },
        initialToolResult: hostedPanel.panel.initialToolResult,
      };
    }

    const html = renderComposite(result.descriptor, { slots: rendererSlots });
    mainState = {
      html,
      parentCsp: dashboardCsp(hostedPanels, options?.frameAncestors),
      routes,
      panelCount: hostedPanels.length,
    };

    const shouldOpen = options?.open ?? true;
    if (shouldOpen) await openBrowser(dashboardServer.origin);

    let shutdownPromise: Promise<void> | undefined;
    return {
      url: dashboardServer.origin,
      result,
      shutdown(): Promise<void> {
        shutdownPromise ??= shutdownInteractiveHost(dashboardServer.server, hostedPanels, cluster);
        return shutdownPromise;
      },
    };
  } catch (error) {
    await Promise.allSettled([
      ...(mainServer === undefined ? [] : [mainServer.server.shutdown()]),
      ...hostedPanels.map((hostedPanel) => hostedPanel.server.shutdown()),
    ]);
    await cluster.stopAll();
    throw error;
  }
}

/**
 * Reject hand-built or stale results that would make renderer slots fall back
 * to legacy URI iframe sources. An interactive host has exactly one captured
 * provenance record for every descriptor child and never reconstructs it from
 * the resource URI.
 */
function assertInteractivePanelBinding(result: ComposeResult): void {
  const childSlots = new Set(result.descriptor.children.map((child) => child.slot));
  const panelSlots = new Set(result.panels.map((panel) => panel.slot));

  if (
    childSlots.size !== result.descriptor.children.length ||
    panelSlots.size !== result.panels.length ||
    childSlots.size !== panelSlots.size
  ) {
    throw new Error("Interactive dashboard has an invalid slot-to-panel binding");
  }
  for (const slot of childSlots) {
    if (!panelSlots.has(slot)) {
      throw new Error("Interactive dashboard has an invalid slot-to-panel binding");
    }
  }
}

/** Start one intentionally tiny origin that can serve exactly one App resource. */
async function servePanelResource(
  cluster: McpCluster,
  panel: ComposedDashboardPanel,
  parentOrigin: string,
): Promise<HostedPanel> {
  const listener = await serveLoopback(async (request) => {
    const url = new URL(request.url);
    if (request.method !== "GET" || (url.pathname !== "/" && url.pathname !== "/ui")) {
      return new Response("Not found", { status: 404 });
    }

    try {
      const resource = await cluster.readResource(panel.serverName, panel.resourceUri);
      const document = extractHtmlResource(resource, panel.resourceUri);
      return new Response(document.text, {
        headers: {
          "Content-Type": htmlContentType(document.mimeType),
          "Cache-Control": "no-store",
          "Content-Security-Policy": childCsp(
            parentOrigin,
            intersectCsp(panel.resourceCsp, document.resourceCsp),
          ),
          "Permissions-Policy": "camera=(), microphone=(), geolocation=(), clipboard-write=()",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      console.error(`[mcp-compose] Failed to load panel ${panel.slot}:`, error);
      return new Response(panelLoadErrorHtml(), {
        status: 502,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
          "Content-Security-Policy": childCsp(parentOrigin),
          "Permissions-Policy": "camera=(), microphone=(), geolocation=(), clipboard-write=()",
          "Referrer-Policy": "no-referrer",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  });

  return { panel, origin: listener.origin, server: listener.server };
}

/** Apply the narrow local MCP proxy contract for exactly one iframe panel. */
async function handlePanelProxy(
  cluster: McpCluster,
  panel: ComposedDashboardPanel,
  request: Request,
): Promise<Response> {
  const parsed = await parseJsonRpcRequest(request);
  if ("error" in parsed) return jsonResponse(parsed.error);

  const rpc = parsed.request;
  try {
    switch (rpc.method) {
      case "tools/call":
        return jsonResponse(await proxyToolCall(cluster, panel, rpc));
      case "tools/list":
        return jsonResponse(proxyToolList(panel, rpc));
      case "resources/read":
        return jsonResponse(await proxyResourceRead(cluster, panel, rpc));
      case "resources/list":
        return jsonResponse(await proxyResourceList(cluster, panel, rpc));
      default:
        return jsonResponse(jsonRpcError(
          rpc.id,
          -32601,
          `[mcp-compose] ${rpc.method} is not available for this panel`,
        ));
    }
  } catch (error) {
    console.error(`[mcp-compose] Panel ${panel.slot} local MCP proxy failed:`, error);
    return jsonResponse(jsonRpcError(
      rpc.id,
      -32603,
      "[mcp-compose] The source MCP request failed",
    ));
  }
}

async function proxyToolCall(
  cluster: McpCluster,
  panel: ComposedDashboardPanel,
  rpc: JsonRpcRequest,
): Promise<Record<string, unknown>> {
  const name = rpc.params.name;
  if (typeof name !== "string" || name === "") {
    return jsonRpcError(rpc.id, -32602, "[mcp-compose] tools/call requires a tool name");
  }
  if (!panel.allowedToolNames.includes(name)) {
    return jsonRpcError(rpc.id, -32601, "[mcp-compose] Tool is not allowed for this panel");
  }

  const args = rpc.params.arguments;
  if (args !== undefined && !isRecord(args)) {
    return jsonRpcError(rpc.id, -32602, "[mcp-compose] tools/call arguments must be an object");
  }

  const result = await cluster.callTool(panel.serverName, name, args);
  return jsonRpcResult(rpc.id, result);
}

function proxyToolList(
  panel: ComposedDashboardPanel,
  rpc: JsonRpcRequest,
): Record<string, unknown> {
  if (typeof rpc.params.cursor === "string" && rpc.params.cursor !== "") {
    return jsonRpcError(rpc.id, -32602, "[mcp-compose] tools/list pagination is not available");
  }

  const result = listAllowedTools(panel);
  return jsonRpcResult(rpc.id, result);
}

async function proxyResourceRead(
  cluster: McpCluster,
  panel: ComposedDashboardPanel,
  rpc: JsonRpcRequest,
): Promise<Record<string, unknown>> {
  if (rpc.params.uri !== panel.resourceUri) {
    return jsonRpcError(rpc.id, -32601, "[mcp-compose] Resource is not allowed for this panel");
  }

  const result = await cluster.readResource(panel.serverName, panel.resourceUri);
  return jsonRpcResult(rpc.id, restrictReadResource(result, panel.resourceUri));
}

async function proxyResourceList(
  cluster: McpCluster,
  panel: ComposedDashboardPanel,
  rpc: JsonRpcRequest,
): Promise<Record<string, unknown>> {
  if (typeof rpc.params.cursor === "string" && rpc.params.cursor !== "") {
    return jsonRpcError(rpc.id, -32602, "[mcp-compose] resources/list pagination is not available");
  }

  const result = await listAllowedResources(cluster, panel);
  return jsonRpcResult(rpc.id, result);
}

/**
 * Return the manifest-owned App-only tool surface.
 *
 * MCP App-only tools deliberately do not appear in an upstream public
 * `tools/list`; asking the source server would return an empty list and would
 * also unnecessarily disclose its pagination behaviour. The manifest is the
 * explicit, reviewed capability grant for this browser slot.
 */
function listAllowedTools(panel: ComposedDashboardPanel): { tools: unknown[] } {
  return {
    tools: panel.allowedTools.map((tool) => ({
      name: tool.name,
      ...(tool.description === undefined ? {} : { description: tool.description }),
      inputSchema: tool.inputSchema ?? { type: "object", additionalProperties: true },
    })),
  };
}

/** Filter every server resources/list page to the exact collected URI. */
async function listAllowedResources(
  cluster: McpCluster,
  panel: ComposedDashboardPanel,
): Promise<{ resources: unknown[] }> {
  const resources: unknown[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_LIST_PAGES; page++) {
    const result: McpListResourcesResult = await cluster.listResources(panel.serverName, cursor);
    for (const resource of result.resources) {
      if (resource.uri === panel.resourceUri) resources.push(resource);
    }
    if (!result.nextCursor) return { resources };
    cursor = result.nextCursor;
  }

  throw new Error("resources/list exceeded the local pagination limit");
}

/** Parse only JSON-RPC requests; notifications never receive a proxy capability. */
async function parseJsonRpcRequest(
  request: Request,
): Promise<{ request: JsonRpcRequest } | { error: Record<string, unknown> }> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return { error: jsonRpcError(null, -32700, "[mcp-compose] Invalid JSON") };
  }

  if (!isRecord(payload) || payload.jsonrpc !== "2.0" || !hasOwn(payload, "id")) {
    return { error: jsonRpcError(null, -32600, "[mcp-compose] Invalid JSON-RPC request") };
  }
  if (!isJsonRpcId(payload.id) || typeof payload.method !== "string" || payload.method === "") {
    return { error: jsonRpcError(null, -32600, "[mcp-compose] Invalid JSON-RPC request") };
  }
  if (payload.params !== undefined && !isRecord(payload.params)) {
    return {
      error: jsonRpcError(payload.id, -32602, "[mcp-compose] Request params must be an object"),
    };
  }

  return {
    request: {
      jsonrpc: "2.0",
      id: payload.id,
      method: payload.method,
      params: payload.params ?? {},
    },
  };
}

function jsonRpcResult(id: JsonRpcId, result: unknown): Record<string, unknown> {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(id: JsonRpcId, code: number, message: string): Record<string, unknown> {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function jsonResponse(payload: unknown): Response {
  return Response.json(payload, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function extractHtmlResource(
  resource: McpReadResourceResult,
  expectedUri: string,
): HtmlResourceDocument {
  const contents = resourceContents(resource);
  const content = contents.find((entry) => entry.uri === expectedUri);
  if (!content) {
    throw new Error(`resources/read did not return the requested resource ${expectedUri}`);
  }
  if (typeof content.text !== "string") {
    throw new Error(`MCP App resource ${expectedUri} must contain text/html content`);
  }
  if (
    typeof content.mimeType !== "string" || !content.mimeType.toLowerCase().startsWith("text/html")
  ) {
    throw new Error(`MCP App resource ${expectedUri} must have a text/html MIME type`);
  }
  const resourceCsp = extractResourceCsp(content._meta);
  return {
    text: content.text,
    mimeType: content.mimeType,
    ...(resourceCsp === undefined ? {} : { resourceCsp }),
  };
}

/** Return only the content entries that belong to this panel's original URI. */
function restrictReadResource(
  resource: McpReadResourceResult,
  expectedUri: string,
): McpReadResourceResult {
  const contents = resourceContents(resource).filter((content) => content.uri === expectedUri);
  if (contents.length === 0) {
    throw new Error(`resources/read did not return the requested resource ${expectedUri}`);
  }
  return { ...resource, contents } as McpReadResourceResult;
}

function resourceContents(resource: McpReadResourceResult): Array<{
  uri?: unknown;
  text?: unknown;
  mimeType?: unknown;
  _meta?: unknown;
}> {
  return resource.contents as Array<{
    uri?: unknown;
    text?: unknown;
    mimeType?: unknown;
    _meta?: unknown;
  }>;
}

function extractResourceCsp(metadata: unknown): ComposedDashboardCsp | undefined {
  if (!isRecord(metadata) || !isRecord(metadata.ui) || !isRecord(metadata.ui.csp)) {
    return undefined;
  }
  const csp = metadata.ui.csp;
  const connectDomains = stringArray(csp.connectDomains);
  const resourceDomains = stringArray(csp.resourceDomains);
  const frameDomains = stringArray(csp.frameDomains);
  const baseUriDomains = stringArray(csp.baseUriDomains);
  const policy: ComposedDashboardCsp = {
    ...(connectDomains === undefined ? {} : { connectDomains }),
    ...(resourceDomains === undefined ? {} : { resourceDomains }),
    ...(frameDomains === undefined ? {} : { frameDomains }),
    ...(baseUriDomains === undefined ? {} : { baseUriDomains }),
  };
  return Object.keys(policy).length === 0 ? undefined : policy;
}

function stringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : undefined;
}

/**
 * Intersect matching metadata declarations. If only the tool result or the
 * resource declares a field, preserve that declaration; if both do, a child
 * receives only their shared validated origins. Missing fields remain a
 * restrictive no-external-domain default in childCsp().
 */
function intersectCsp(
  toolCsp: ComposedDashboardCsp | undefined,
  resourceCsp: ComposedDashboardCsp | undefined,
): ValidatedCsp {
  const tool = validateCsp(toolCsp);
  const resource = validateCsp(resourceCsp);
  const connectDomains = intersectDomains(tool.connectDomains, resource.connectDomains);
  const resourceDomains = intersectDomains(tool.resourceDomains, resource.resourceDomains);
  const frameDomains = intersectDomains(tool.frameDomains, resource.frameDomains);
  const baseUriDomains = intersectDomains(tool.baseUriDomains, resource.baseUriDomains);
  return {
    ...(connectDomains === undefined ? {} : { connectDomains }),
    ...(resourceDomains === undefined ? {} : { resourceDomains }),
    ...(frameDomains === undefined ? {} : { frameDomains }),
    ...(baseUriDomains === undefined ? {} : { baseUriDomains }),
  };
}

function validateCsp(csp: ComposedDashboardCsp | undefined): ValidatedCsp {
  if (!csp) return {};
  return {
    ...(csp.connectDomains === undefined
      ? {}
      : { connectDomains: validateCspDomains(csp.connectDomains) }),
    ...(csp.resourceDomains === undefined
      ? {}
      : { resourceDomains: validateCspDomains(csp.resourceDomains) }),
    ...(csp.frameDomains === undefined
      ? {}
      : { frameDomains: validateCspDomains(csp.frameDomains) }),
    ...(csp.baseUriDomains === undefined
      ? {}
      : { baseUriDomains: validateCspDomains(csp.baseUriDomains) }),
  };
}

function validateCspDomains(domains: readonly string[]): string[] {
  const valid = new Set<string>();
  for (const domain of domains) {
    const normalized = normalizeCspDomain(domain);
    if (normalized !== undefined) valid.add(normalized);
  }
  return [...valid];
}

/** CSP metadata accepts origin-like HTTP(S) sources, never arbitrary tokens. */
function normalizeCspDomain(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username !== "" || url.password !== "" || url.pathname !== "/" ||
    url.search !== "" || url.hash !== "" || url.hostname === "" ||
    (url.hostname.includes("*") && !url.hostname.startsWith("*."))
  ) {
    return undefined;
  }
  return url.origin;
}

function intersectDomains(
  left: readonly string[] | undefined,
  right: readonly string[] | undefined,
): string[] | undefined {
  if (left === undefined) return right === undefined ? undefined : [...right];
  if (right === undefined) return [...left];
  const allowed = new Set(right);
  return left.filter((domain) => allowed.has(domain));
}

function childCsp(parentOrigin: string, csp: ValidatedCsp = {}): string {
  const resourceDomains = csp.resourceDomains ?? [];
  const connectDomains = csp.connectDomains ?? [];
  const frameDomains = csp.frameDomains ?? [];
  const baseUriDomains = csp.baseUriDomains ?? [];
  return [
    "default-src 'none'",
    `script-src 'self' 'unsafe-inline'${cspSources(resourceDomains)}`,
    `style-src 'self' 'unsafe-inline'${cspSources(resourceDomains)}`,
    `img-src 'self' data:${cspSources(resourceDomains)}`,
    `font-src 'self' data:${cspSources(resourceDomains)}`,
    `media-src 'self'${cspSources(resourceDomains)}`,
    `connect-src 'self'${cspSources(connectDomains)}`,
    frameDomains.length === 0 ? "frame-src 'none'" : `frame-src 'self'${cspSources(frameDomains)}`,
    `base-uri 'self'${cspSources(baseUriDomains)}`,
    "object-src 'none'",
    "form-action 'none'",
    `frame-ancestors ${parentOrigin}`,
  ].join("; ");
}

function cspSources(domains: readonly string[]): string {
  return domains.length === 0 ? "" : ` ${domains.join(" ")}`;
}

function htmlContentType(mimeType: string): string {
  return /(?:^|;)\s*charset=/i.test(mimeType) ? mimeType : `${mimeType}; charset=utf-8`;
}

function panelLoadErrorHtml(): string {
  return '<!doctype html><meta charset="utf-8"><title>Panel unavailable</title>' +
    "<p>The MCP App resource could not be loaded. Check the local Compose host logs.</p>";
}

function dashboardCsp(
  panels: readonly HostedPanel[],
  frameAncestors: readonly string[] | undefined,
): string {
  const frameSources = panels.length === 0
    ? "'none'"
    : panels.map((panel) => panel.origin).join(" ");
  const embeddingSources = frameAncestors === undefined ? [] : validateCspDomains(frameAncestors);
  return [
    "default-src 'none'",
    "script-src 'unsafe-inline'",
    "style-src 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `frame-src ${frameSources}`,
    "connect-src 'self'",
    "base-uri 'none'",
    "object-src 'none'",
    "form-action 'none'",
    embeddingSources.length === 0
      ? "frame-ancestors 'none'"
      : `frame-ancestors ${embeddingSources.join(" ")}`,
  ].join("; ");
}

function randomRouteToken(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

async function serveLoopback(
  handler: (request: Request) => Response | Promise<Response>,
  port = 0,
): Promise<{ origin: string; server: Deno.HttpServer }> {
  let resolveReady: (address: Deno.NetAddr) => void;
  const ready = new Promise<Deno.NetAddr>((resolve) => {
    resolveReady = resolve;
  });

  const server = Deno.serve({
    hostname: LOOPBACK_HOSTNAME,
    port,
    onListen(address) {
      resolveReady(address);
    },
  }, handler);
  const address = await ready;
  return { origin: `http://${LOOPBACK_HOSTNAME}:${address.port}`, server };
}

async function shutdownInteractiveHost(
  mainServer: Deno.HttpServer,
  panels: readonly HostedPanel[],
  cluster: McpCluster,
): Promise<void> {
  const results = await Promise.allSettled([
    mainServer.shutdown(),
    ...panels.map((panel) => panel.server.shutdown()),
  ]);
  await cluster.stopAll();

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[mcp-compose] Failed to close a local dashboard listener:", result.reason);
    }
  }
}

async function openBrowser(url: string): Promise<void> {
  const command = Deno.build.os === "darwin"
    ? ["open", url]
    : Deno.build.os === "windows"
    ? ["cmd", "/c", "start", url]
    : ["xdg-open", url];

  try {
    const process = new Deno.Command(command[0], {
      args: command.slice(1),
      stdout: "null",
      stderr: "null",
    }).spawn();
    await process.status;
  } catch {
    console.error(`[mcp-compose] Could not open browser. Dashboard available at ${url}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonRpcId(value: unknown): value is JsonRpcId {
  return value === null || typeof value === "string" || typeof value === "number";
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}
