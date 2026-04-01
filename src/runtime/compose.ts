/**
 * Dashboard composition orchestrator.
 *
 * Wires together manifest loading, template parsing, arg injection,
 * server startup, tool calling, and the core pipeline to produce
 * a self-contained composite dashboard.
 *
 * ## AX (Agent Experience)
 *
 * - **Single entry point**: `composeDashboard()` does everything.
 *   `composeDashboardFromFiles()` adds file loading on top.
 * - **Structured warnings**: Non-fatal issues (tool without UI metadata)
 *   are collected as warnings, not thrown. The dashboard renders with
 *   whatever UIs were successfully collected.
 * - **Guaranteed cleanup**: Server processes are always stopped in `finally`,
 *   even on errors.
 * - **URI resolution**: `ui://server/...` URIs are automatically resolved
 *   to the server's actual HTTP base URL before rendering.
 *
 * @module runtime/compose
 */

import type { ComposeRequest, ComposeResult } from "./types.ts";
import { loadManifests } from "./manifest.ts";
import { injectArgs, loadTemplate, validateTemplate } from "./template.ts";
import { createCluster } from "./cluster.ts";
import { createCollector } from "../core/collector/collector.ts";
import { buildCompositeUi } from "../core/composer/composer.ts";
import { renderComposite } from "../host/renderer/html-generator.ts";
import { RuntimeErrorCode } from "./types.ts";
import type { RuntimeError } from "./types.ts";

/**
 * Compose a dashboard from a template + manifests + runtime args.
 *
 * Full flow:
 * 1. Validate template against manifests
 * 2. Start/connect MCP server cluster
 * 3. Call tools with injected args, collect UI resources
 * 4. Resolve `ui://` URIs to real HTTP URLs
 * 5. Build composite descriptor + render HTML (core pipeline)
 * 6. Shut down cluster
 *
 * @param request - Template, manifests, and runtime args
 * @returns Composite descriptor, rendered HTML, and warnings
 *
 * @example
 * ```typescript
 * const result = await composeDashboard({
 *   template,
 *   manifests,
 *   args: { customer_id: "CUST-001" },
 * });
 * // result.html is a complete dashboard
 * ```
 */
export async function composeDashboard(
  request: ComposeRequest,
): Promise<ComposeResult> {
  const { template, manifests, args, keepAlive } = request;
  const warnings: string[] = [];

  // 1. Validate template against manifests
  const validation = validateTemplate(template, manifests);
  if (!validation.valid) {
    throw {
      code: RuntimeErrorCode.TEMPLATE_PARSE_ERROR,
      message: `Template validation failed: ${validation.errors.join("; ")}`,
    } satisfies RuntimeError;
  }

  // 2. Start cluster
  const serverNames = template.sources.map((s) => s.manifest);
  const cluster = createCluster(manifests, serverNames);
  await cluster.startAll();

  try {
    // 3. Call tools and collect UI resources
    const collector = createCollector();

    // Call tools in parallel across sources, sequential within each source
    await Promise.all(
      template.sources.map(async (source) => {
        const resolvedCalls = injectArgs(source.calls, args ?? {});

        for (const call of resolvedCalls) {
          const qualifiedName = `${source.manifest}:${call.tool}`;

          try {
            const result = await cluster.callTool(
              source.manifest,
              call.tool,
              call.args,
            );
            const collected = collector.collect(qualifiedName, result, call.args);
            if (!collected) {
              warnings.push(
                `Tool "${qualifiedName}" did not return UI metadata (_meta.ui.resourceUri)`,
              );
            }
          } catch (e) {
            const err = e as RuntimeError;
            warnings.push(
              `Tool "${qualifiedName}" call failed: ${err.message ?? String(e)}`,
            );
          }
        }
      }),
    );

    // 4. Resolve ui:// URIs to real HTTP URLs
    const resources = collector.getResources().map((resource) => {
      const resolved = resolveResourceUri(
        resource.resourceUri,
        (name) => cluster.getUiBaseUrl(name),
      );
      return { ...resource, resourceUri: resolved };
    });

    // 5. Build area map (source qualified name → area id)
    const areaMap: Record<string, string> = {};
    for (const source of template.sources) {
      if (source.id) {
        for (const call of source.calls) {
          areaMap[`${source.manifest}:${call.tool}`] = source.id;
        }
      }
    }

    // 6. Build composite + render
    const orchestration = {
      layout: template.orchestration.layout,
      sync: template.orchestration.sync,
      sharedContext: template.orchestration.sharedContext,
    };

    const descriptor = buildCompositeUi(resources, orchestration);
    if (Object.keys(areaMap).length > 0) {
      descriptor.areaMap = areaMap;
    }
    const html = renderComposite(descriptor);

    return {
      descriptor,
      html,
      warnings,
      cluster: keepAlive ? cluster : undefined,
    };
  } finally {
    // Stop cluster unless keepAlive was requested
    if (!keepAlive) {
      await cluster.stopAll();
    }
  }
}

/**
 * Convenience: load manifests + template from files, then compose.
 *
 * @param manifestDir - Directory containing `.json` manifest files
 * @param templatePath - Path to `.yaml` template file
 * @param args - Runtime arguments (injected into `{{placeholder}}` values)
 * @returns Composite result
 *
 * @example
 * ```typescript
 * const result = await composeDashboardFromFiles(
 *   "./manifests/",
 *   "./dashboards/sales.yaml",
 *   { customer_id: "CUST-001" },
 * );
 * await Deno.writeTextFile("dashboard.html", result.html);
 * ```
 */
export async function composeDashboardFromFiles(
  manifestDir: string,
  templatePath: string,
  args?: Record<string, unknown>,
): Promise<ComposeResult> {
  const manifests = await loadManifests(manifestDir);
  const template = await loadTemplate(templatePath);
  return composeDashboard({ template, manifests, args });
}

/**
 * Resolve a `ui://server-name/path` URI to an HTTP URL.
 *
 * Uses the cluster's uiBaseUrl for the server to replace the `ui://` scheme.
 * Non-`ui://` URIs pass through unchanged.
 *
 * @example
 * ```typescript
 * resolveResourceUri("ui://mcp-einvoice/invoice-viewer", getUrl);
 * // → "http://localhost:54321/ui?uri=ui://mcp-einvoice/invoice-viewer"
 * ```
 */
function resolveResourceUri(
  uri: string,
  getBaseUrl: (serverName: string) => string | undefined,
): string {
  if (!uri.startsWith("ui://")) return uri;

  // Extract server name: ui://server-name/path → "server-name"
  const withoutScheme = uri.slice("ui://".length);
  const slashIndex = withoutScheme.indexOf("/");
  const serverName = slashIndex >= 0 ? withoutScheme.slice(0, slashIndex) : withoutScheme;

  const baseUrl = getBaseUrl(serverName);
  if (!baseUrl) return uri; // can't resolve, pass through

  return `${baseUrl}/ui?uri=${encodeURIComponent(uri)}`;
}
