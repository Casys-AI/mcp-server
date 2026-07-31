/**
 * Transport-level proof fixture for a standards-only MCP App.
 *
 * Unlike the legacy stubs, `strict-resource` deliberately does not expose an
 * HTTP `/ui` convenience endpoint. These assertions prevent compose tests from
 * passing merely because a fixture happens to implement that non-standard
 * shortcut.
 *
 * @module stubs/tests/strict-resource_test
 */

import { assertEquals, assertExists, assertStringIncludes } from "@std/assert";
import { startServer } from "../../src/runtime/cluster.ts";
import { parseManifest } from "../../src/runtime/manifest.ts";
import type { McpManifest } from "../../src/runtime/types.ts";
import {
  MCP_APPS_PROTOCOL_VERSION,
  STRICT_REFRESH_TOOL,
  STRICT_RENDER_TOOL,
  STRICT_RESOURCE_SERVER_NAME,
  STRICT_RESOURCE_URI,
} from "../strict-resource/fixture.ts";

const PROTOCOL_VERSION = "2026-07-28";
const PROTOCOL_META_KEY = "io.modelcontextprotocol/protocolVersion";
const CLIENT_INFO_META_KEY = "io.modelcontextprotocol/clientInfo";
const CLIENT_CAPABILITIES_META_KEY = "io.modelcontextprotocol/clientCapabilities";
const TEST_OPTS = { sanitizeOps: false, sanitizeResources: false };

type JsonRecord = Record<string, unknown>;

interface RpcResponse {
  result?: JsonRecord;
  error?: { code?: number; message?: string };
}

interface StartedFixture {
  baseUrl: string;
  close(): Promise<void>;
}

/** Start the strict fixture without using Compose's in-progress client layer. */
async function startStrictFixture(): Promise<StartedFixture> {
  const serverUrl = new URL("../strict-resource/server.ts", import.meta.url);
  const process = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-net",
      "--allow-read",
      "--allow-env",
      serverUrl.pathname,
      "--http",
      "--port=0",
    ],
    stdin: "null",
    stdout: "null",
    stderr: "piped",
  }).spawn();

  const baseUrl = await waitForListenUrl(process);
  return {
    baseUrl,
    async close(): Promise<void> {
      try {
        process.kill("SIGTERM");
      } catch {
        // The fixture may have already exited after an assertion failure.
      }
      await process.status.catch(() => undefined);
    },
  };
}

async function waitForListenUrl(process: Deno.ChildProcess): Promise<string> {
  const reader = process.stderr.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const listen = (async (): Promise<string> => {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error(`strict-resource exited before announcing its HTTP URL: ${buffer}`);
      buffer += decoder.decode(value, { stream: true });
      const match = buffer.match(/listening on (https?:\/\/[^\s]+)/);
      if (match) {
        reader.releaseLock();
        drain(process.stderr);
        return match[1].replace(/\/+$/, "");
      }
    }
  })();

  // Do not leave a rejected read loop behind when a server start regresses.
  listen.catch(() => undefined);
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(
      () => reject(new Error("Timed out starting strict-resource fixture")),
      10_000,
    );
  });

  try {
    return await Promise.race([listen, timeout]);
  } catch (error) {
    try {
      process.kill("SIGTERM");
    } catch {
      // Best-effort cleanup while surfacing the original startup failure.
    }
    await process.status.catch(() => undefined);
    throw error;
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function drain(stream: ReadableStream<Uint8Array>): void {
  const reader = stream.getReader();
  void (async () => {
    try {
      while (!(await reader.read()).done) {
        // Discard child stderr after the URL was detected.
      }
    } catch {
      // Stream closes when the fixture is stopped.
    } finally {
      reader.releaseLock();
    }
  })();
}

/**
 * Resolve a child-process manifest for the runtime acceptance test below.
 *
 * The main fixture test deliberately starts the server itself: that keeps it
 * green while the runtime is learning the 2026 stateless wire contract. This
 * helper is retained for the exact Compose-path test that must be enabled once
 * that client support lands.
 */
async function loadStrictManifestForRuntime(): Promise<McpManifest> {
  const manifestUrl = new URL("../strict-resource/manifest.json", import.meta.url);
  const serverUrl = new URL("../strict-resource/server.ts", import.meta.url);
  const manifest = parseManifest(await Deno.readTextFile(manifestUrl), manifestUrl.pathname);

  if (manifest.transport.type !== "stdio") {
    throw new Error("strict-resource fixture must use stdio transport in runtime acceptance");
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

/**
 * Issue a request in the 2026-07-28 stateless HTTP wire format.
 *
 * The fixture is intentionally strict about these headers and `_meta` fields;
 * using the old bare `fetch({ method: "tools/call" })` shape would hide a
 * client compatibility defect in mcp-compose.
 */
async function conformantPost(
  baseUrl: string,
  id: number,
  method: string,
  params: JsonRecord = {},
): Promise<{ response: Response; body: RpcResponse }> {
  const name = method === "resources/read"
    ? params.uri
    : method === "tools/call"
    ? params.name
    : undefined;

  const response = await fetch(`${baseUrl}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "MCP-Protocol-Version": PROTOCOL_VERSION,
      "Mcp-Method": method,
      ...(typeof name === "string" ? { "Mcp-Name": name } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params: {
        ...params,
        _meta: {
          [PROTOCOL_META_KEY]: PROTOCOL_VERSION,
          [CLIENT_INFO_META_KEY]: {
            name: "mcp-compose-strict-fixture-test",
            version: "0.1.0",
          },
          [CLIENT_CAPABILITIES_META_KEY]: {},
        },
      },
    }),
  });

  return { response, body: await response.json() as RpcResponse };
}

function asRecord(value: unknown, label: string): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonRecord;
}

Deno.test("strict resource fixture - manifest pins stateless transport and app-only allowlist", async () => {
  const manifestUrl = new URL("../strict-resource/manifest.json", import.meta.url);
  const manifest = parseManifest(await Deno.readTextFile(manifestUrl), manifestUrl.pathname);

  assertEquals(manifest.name, STRICT_RESOURCE_SERVER_NAME);
  assertEquals(manifest.transport.type, "stdio");
  assertEquals(manifest.transport.protocol, "stateless-2026-07-28");
  assertEquals(
    manifest.tools.find((tool) => tool.name === STRICT_REFRESH_TOOL)?.appCallable,
    true,
  );
});

Deno.test({
  name: "strict resource fixture - MCP resources/read is the only UI delivery path",
  ...TEST_OPTS,
  fn: async () => {
    const fixture = await startStrictFixture();

    try {
      // The historic stub shortcut must not accidentally reappear here.
      const uiShortcut = await fetch(
        `${fixture.baseUrl}/ui?uri=${encodeURIComponent(STRICT_RESOURCE_URI)}`,
      );
      assertEquals(uiShortcut.status, 404);
      await uiShortcut.body?.cancel();

      // The instantiating tool carries both the viewer URI and data that must
      // later be replayed to the App as ui/notifications/tool-result.
      const tool = await conformantPost(fixture.baseUrl, 1, "tools/call", {
        name: STRICT_RENDER_TOOL,
        arguments: { scenario: "integration" },
      });
      assertEquals(tool.response.status, 200);
      assertExists(tool.body.result);
      const toolResult = tool.body.result;
      const toolMeta = asRecord(toolResult._meta, "tool result _meta");
      const toolUi = asRecord(toolMeta.ui, "tool result _meta.ui");
      const initialData = asRecord(toolResult.structuredContent, "tool result structuredContent");
      assertEquals(toolUi.resourceUri, STRICT_RESOURCE_URI);
      assertEquals(initialData.fixture, "strict-resource");
      assertEquals(initialData.scenario, "integration");
      assertEquals(initialData.status, "ready");

      // Standard MCP resource resolution succeeds even though /ui does not.
      const resource = await conformantPost(fixture.baseUrl, 2, "resources/read", {
        uri: STRICT_RESOURCE_URI,
      });
      assertEquals(resource.response.status, 200);
      assertExists(resource.body.result);
      const contents = resource.body.result.contents;
      if (!Array.isArray(contents) || contents.length !== 1) {
        throw new Error("resources/read must return exactly one fixture resource");
      }
      const content = asRecord(contents[0], "resource content");
      assertEquals(content.uri, STRICT_RESOURCE_URI);
      assertEquals(content.mimeType, "text/html;profile=mcp-app");
      if (typeof content.text !== "string") throw new Error("fixture resource must contain HTML");

      // Future browser acceptance uses these markers to prove both parts of
      // the host bridge: initial result forwarding and app-only tools/call.
      assertStringIncludes(content.text, 'data-testid="strict-resource-app"');
      assertStringIncludes(content.text, "ui/notifications/tool-result");
      assertStringIncludes(content.text, "ui/initialize");
      assertStringIncludes(content.text, STRICT_REFRESH_TOOL);
      assertStringIncludes(content.text, MCP_APPS_PROTOCOL_VERSION);

      // The model cannot discover the refresh tool, but an MCP App can call it
      // through the host bridge. This is the capability Compose must proxy.
      const listed = await conformantPost(fixture.baseUrl, 3, "tools/list");
      assertEquals(listed.response.status, 200);
      assertExists(listed.body.result);
      const tools = listed.body.result.tools;
      if (!Array.isArray(tools)) throw new Error("tools/list must return tools");
      assertEquals(
        tools.some((entry) => asRecord(entry, "listed tool").name === STRICT_REFRESH_TOOL),
        false,
      );

      const refresh = await conformantPost(fixture.baseUrl, 4, "tools/call", {
        name: STRICT_REFRESH_TOOL,
        arguments: { requestedBy: "integration-test" },
      });
      assertEquals(refresh.response.status, 200);
      assertExists(refresh.body.result);
      const refreshData = asRecord(
        refresh.body.result.structuredContent,
        "app-only tool structuredContent",
      );
      assertEquals(refreshData.status, "refreshed");
      assertEquals(refreshData.requestedBy, "integration-test");
    } finally {
      await fixture.close();
    }
  },
});

Deno.test({
  name: "strict resource runtime - initialized MCP connection reads UI without /ui",
  ...TEST_OPTS,
  fn: async () => {
    const connection = await startServer(await loadStrictManifestForRuntime(), {
      timeoutMs: 10_000,
    });
    try {
      const initial = asRecord(
        await connection.callTool(STRICT_RENDER_TOOL, { scenario: "runtime-acceptance" }),
        "initial call result",
      );
      const initialData = asRecord(initial.structuredContent, "initial structuredContent");
      assertEquals(initialData.scenario, "runtime-acceptance");

      const tools = asRecord(await connection.listTools(), "tools/list result");
      if (!Array.isArray(tools.tools)) throw new Error("tools/list must return tools");
      assertEquals(
        tools.tools.some((tool: unknown) =>
          asRecord(tool, "listed tool").name === STRICT_RENDER_TOOL
        ),
        true,
      );
      assertEquals(
        tools.tools.some((tool: unknown) =>
          asRecord(tool, "listed tool").name === STRICT_REFRESH_TOOL
        ),
        false,
      );

      const resources = asRecord(await connection.listResources(), "resources/list result");
      if (!Array.isArray(resources.resources)) {
        throw new Error("resources/list must return resources");
      }
      assertEquals(
        resources.resources.some((resource: unknown) =>
          asRecord(resource, "listed resource").uri === STRICT_RESOURCE_URI
        ),
        true,
      );

      const resource = await connection.readResource(STRICT_RESOURCE_URI);
      assertEquals(resource.contents.length, 1);
      assertEquals(resource.contents[0].uri, STRICT_RESOURCE_URI);
      assertEquals(resource.contents[0].mimeType, "text/html;profile=mcp-app");

      const refresh = asRecord(
        await connection.callTool(STRICT_REFRESH_TOOL, { requestedBy: "runtime-acceptance" }),
        "app-only refresh result",
      );
      assertEquals(
        asRecord(refresh.structuredContent, "app-only refresh structuredContent").status,
        "refreshed",
      );
    } finally {
      await connection.close();
    }
  },
});

/*
 * Host-runtime acceptance contract, to activate once `serveComposedDashboard`
 * (or its final public name) is available:
 *
 * 1. compose strict-resource with stubs/templates/strict-resource.yaml;
 * 2. load the returned dashboard in a real browser;
 * 3. assert iframe[data-slot="0"] returns 200 through the compose-owned route,
 *    not `strict-resource`'s missing `/ui` route;
 * 4. assert `window.__strictResourceFixture.initialResult.structuredContent`
 *    is the initial render result; and
 * 5. click [data-testid="refresh"] and assert the returned app-only tool
 *    result has `{ status: "refreshed" }`.
 *
 * Keep the assertion above transport-level until the runtime's public serving
 * API settles; binding this fixture to a provisional function name would make
 * it a brittle false proof rather than an integration contract.
 */
