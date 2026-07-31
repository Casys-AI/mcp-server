/** End-to-end HTTP proof for the local interactive MCP Apps host. */

import { assertEquals, assertExists, assertMatch, assertStringIncludes } from "@std/assert";
import { buildCompositeUi } from "../core/composer/composer.ts";
import { composeAndServeDashboard, serveComposedDashboard } from "./host-dashboard.ts";
import { parseManifest } from "./manifest.ts";
import { parseTemplate } from "./template.ts";
import type { ComposeResult, McpCluster, McpManifest, McpReadResourceResult } from "./types.ts";
import {
  STRICT_REFRESH_TOOL,
  STRICT_RENDER_TOOL,
  STRICT_RESOURCE_URI,
} from "../../stubs/strict-resource/fixture.ts";

const TEST_OPTS = { sanitizeOps: false, sanitizeResources: false };

async function strictManifest(): Promise<McpManifest> {
  const manifestUrl = new URL("../../stubs/strict-resource/manifest.json", import.meta.url);
  const serverUrl = new URL("../../stubs/strict-resource/server.ts", import.meta.url);
  const manifest = parseManifest(await Deno.readTextFile(manifestUrl), manifestUrl.pathname);

  if (manifest.transport.type !== "stdio") {
    throw new Error("Strict resource fixture must use stdio transport");
  }
  manifest.transport.args = [
    "run",
    "--allow-net",
    "--allow-read",
    "--allow-env",
    serverUrl.pathname,
  ];
  return manifest;
}

async function strictTemplate() {
  const templateUrl = new URL("../../stubs/templates/strict-resource.yaml", import.meta.url);
  return parseTemplate(await Deno.readTextFile(templateUrl), templateUrl.pathname);
}

async function callProxy(
  dashboardUrl: string,
  route: string,
  id: string,
  method: string,
  params: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const response = await fetch(`${dashboardUrl}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  assertEquals(response.status, 200);
  return await response.json() as Record<string, unknown>;
}

Deno.test({
  name: "composeAndServeDashboard hosts MCP resources and filters every local proxy capability",
  ...TEST_OPTS,
  fn: async () => {
    const manifest = await strictManifest();
    const template = await strictTemplate();
    const handle = await composeAndServeDashboard({
      template,
      manifests: new Map([[manifest.name, manifest]]),
      args: { scenario: "host-acceptance" },
    }, { open: false });

    try {
      assertEquals(handle.result.panels.length, 1);
      assertEquals(handle.result.panels[0].serverName, manifest.name);
      assertEquals(handle.result.panels[0].toolName, STRICT_RENDER_TOOL);
      assertEquals(handle.result.panels[0].resourceUri, STRICT_RESOURCE_URI);
      assertEquals(handle.result.panels[0].allowedToolNames, [STRICT_REFRESH_TOOL]);

      const dashboard = await fetch(handle.url);
      assertEquals(dashboard.status, 200);
      assertStringIncludes(
        dashboard.headers.get("content-security-policy") ?? "",
        "frame-src http://127.0.0.1:",
      );
      assertStringIncludes(
        dashboard.headers.get("content-security-policy") ?? "",
        "frame-ancestors 'none'",
      );
      const html = await dashboard.text();
      assertStringIncludes(html, 'sandbox="allow-scripts allow-same-origin"');

      const iframeMatch = html.match(/src="(http:\/\/127\.0\.0\.1:\d+\/ui)"/);
      assertExists(iframeMatch);
      const appResource = await fetch(iframeMatch[1]);
      assertEquals(appResource.status, 200);
      assertStringIncludes(await appResource.text(), "Strict MCP resource");

      const routeMatch = html.match(/\/api\/slots\/0\/[a-f0-9]+\/mcp/);
      assertExists(routeMatch);
      const route = routeMatch[0];

      const allowed = await callProxy(handle.url, route, "allowed", "tools/call", {
        name: STRICT_REFRESH_TOOL,
        arguments: { requestedBy: "host-dashboard-test" },
      });
      assertEquals(
        (allowed.result as Record<string, unknown>).structuredContent,
        {
          fixture: "strict-resource",
          status: "refreshed",
          requestedBy: "host-dashboard-test",
        },
      );

      const denied = await callProxy(handle.url, route, "denied", "tools/call", {
        name: STRICT_RENDER_TOOL,
      });
      assertEquals((denied.error as Record<string, unknown>).code, -32601);

      const tools = await callProxy(handle.url, route, "tools", "tools/list", {});
      assertEquals(
        ((tools.result as Record<string, unknown>).tools as Array<Record<string, unknown>>)
          .map((tool) => tool.name),
        [STRICT_REFRESH_TOOL],
      );

      const resource = await callProxy(handle.url, route, "resource", "resources/read", {
        uri: STRICT_RESOURCE_URI,
      });
      assertEquals(
        ((resource.result as Record<string, unknown>).contents as Array<Record<string, unknown>>)[0]
          .uri,
        STRICT_RESOURCE_URI,
      );

      const rejectedResource = await callProxy(
        handle.url,
        route,
        "resource-denied",
        "resources/read",
        { uri: "ui://strict-resource/not-allowed" },
      );
      assertEquals((rejectedResource.error as Record<string, unknown>).code, -32601);

      const resources = await callProxy(handle.url, route, "resources", "resources/list", {});
      assertEquals(
        ((resources.result as Record<string, unknown>).resources as Array<Record<string, unknown>>)
          .map((entry) => entry.uri),
        [STRICT_RESOURCE_URI],
      );

      const guessed = await fetch(`${handle.url}/api/slots/0/mcp`, { method: "POST" });
      assertEquals(guessed.status, 404);
    } finally {
      await handle.shutdown();
    }
  },
});

Deno.test({
  name: "serveComposedDashboard narrows resource contents and intersects child CSP metadata",
  ...TEST_OPTS,
  fn: async () => {
    const resourceUri = "ui://mock-secure/dashboard";
    const privateUri = "ui://mock-secure/private";
    const cluster: McpCluster = {
      startAll() {
        return Promise.resolve();
      },
      stopAll() {
        return Promise.resolve();
      },
      callTool() {
        return Promise.resolve({});
      },
      readResource(_serverName, uri): Promise<McpReadResourceResult> {
        assertEquals(uri, resourceUri);
        return Promise.resolve({
          contents: [
            {
              uri: resourceUri,
              mimeType: "text/html;profile=mcp-app",
              text: "<main>secure mock panel</main>",
              _meta: {
                ui: {
                  csp: {
                    connectDomains: [
                      "https://shared.example.test",
                      "https://resource-only.example.test",
                    ],
                    resourceDomains: ["https://cdn.shared.example.test"],
                  },
                },
              },
            },
            {
              uri: privateUri,
              mimeType: "text/html",
              text: "<main>private resource must never reach this App</main>",
            },
          ],
        } as McpReadResourceResult);
      },
      listTools() {
        return Promise.resolve({ tools: [] });
      },
      listResources() {
        return Promise.resolve({ resources: [{ uri: resourceUri }, { uri: privateUri }] });
      },
      getUiBaseUrl() {
        return undefined;
      },
    };
    const descriptor = buildCompositeUi([
      { source: "mock-secure:render", resourceUri, slot: 0 },
    ], { layout: "stack" });
    const result: ComposeResult = {
      descriptor,
      html: "",
      warnings: [],
      panels: [{
        slot: 0,
        serverName: "mock-secure",
        toolName: "render",
        resourceUri,
        initialToolResult: {},
        allowedToolNames: [],
        allowedTools: [],
        resourceCsp: {
          connectDomains: [
            "https://shared.example.test",
            "https://tool-only.example.test",
          ],
          resourceDomains: ["https://cdn.shared.example.test"],
        },
      }],
      cluster,
    };
    const handle = await serveComposedDashboard(result, { open: false });

    try {
      const html = await (await fetch(handle.url)).text();
      const iframeMatch = html.match(/src="(http:\/\/127\.0\.0\.1:\d+\/ui)"/);
      assertExists(iframeMatch);
      const iframe = await fetch(iframeMatch[1]);
      assertEquals(iframe.status, 200);
      const csp = iframe.headers.get("content-security-policy") ?? "";
      assertStringIncludes(csp, "connect-src 'self' https://shared.example.test");
      assertStringIncludes(csp, "cdn.shared.example.test");
      assertStringIncludes(csp, `frame-ancestors ${handle.url}`);
      assertEquals(csp.includes("tool-only.example.test"), false);
      assertEquals(csp.includes("resource-only.example.test"), false);

      const routeMatch = html.match(/\/api\/slots\/0\/[a-f0-9]+\/mcp/);
      assertExists(routeMatch);
      const resource = await callProxy(handle.url, routeMatch[0], "resource", "resources/read", {
        uri: resourceUri,
      });
      assertEquals(
        (resource.result as { contents: Array<{ uri: string }> }).contents.map((content) =>
          content.uri
        ),
        [resourceUri],
      );
      assertEquals(JSON.stringify(resource).includes("private resource"), false);
    } finally {
      await handle.shutdown();
    }
  },
});

Deno.test({
  name: "composeAndServeDashboard gives every iframe a distinct loopback origin",
  ...TEST_OPTS,
  fn: async () => {
    const manifest = await strictManifest();
    const template = await strictTemplate();
    template.sources[0].calls.push({
      tool: STRICT_RENDER_TOOL,
      args: { scenario: "second-panel" },
    });

    const handle = await composeAndServeDashboard({
      template,
      manifests: new Map([[manifest.name, manifest]]),
      args: { scenario: "first-panel" },
    }, { open: false });

    try {
      const html = await (await fetch(handle.url)).text();
      const origins = [...html.matchAll(/src="(http:\/\/127\.0\.0\.1:\d+)\/ui"/g)]
        .map((match) => match[1]);
      assertEquals(origins.length, 2);
      assertEquals(new Set(origins).size, 2);
      for (const origin of origins) {
        assertMatch(origin, /^http:\/\/127\.0\.0\.1:\d+$/);
      }
    } finally {
      await handle.shutdown();
    }
  },
});

Deno.test({
  name: "composeAndServeDashboard permits one reviewed embedding origin",
  ...TEST_OPTS,
  fn: async () => {
    const manifest = await strictManifest();
    const template = await strictTemplate();
    const embeddingOrigin = "http://127.0.0.1:60060";
    const embeddedOptions = {
      open: false,
      frameAncestors: [embeddingOrigin, "not-a-csp-origin"],
    };
    const handle = await composeAndServeDashboard({
      template,
      manifests: new Map([[manifest.name, manifest]]),
      args: { scenario: "embedded-workbench" },
    }, embeddedOptions);

    try {
      const response = await fetch(handle.url);
      assertEquals(response.status, 200);
      const csp = response.headers.get("content-security-policy") ?? "";
      assertStringIncludes(csp, `frame-ancestors ${embeddingOrigin}`);
      assertEquals(csp.includes("not-a-csp-origin"), false);
    } finally {
      await handle.shutdown();
    }
  },
});
