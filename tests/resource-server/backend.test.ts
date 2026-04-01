import { assertEquals, assertStringIncludes } from "@std/assert";
import { JsonRpcMcpBackend } from "../../src/resource-server/backend.ts";
import { startResourceServer } from "../../src/resource-server/server.ts";
import type { BridgeSession } from "../../src/resource-server/session.ts";

function makeSession(): BridgeSession {
  return {
    id: "session-test",
    platform: "generic",
    createdAt: Date.now(),
    lastActivity: Date.now(),
    authenticated: true,
  };
}

Deno.test("JsonRpcMcpBackend - forwards JSON-RPC requests over HTTP", async () => {
  let receivedMethod = "";
  let receivedParams: Record<string, unknown> | undefined;

  // deno-lint-ignore no-explicit-any
  const httpServer = (Deno as any).serve({
    port: 0,
    handler: async (request: Request) => {
      const rpc = await request.json();
      receivedMethod = rpc.method;
      receivedParams = rpc.params;
      return Response.json({
        jsonrpc: "2.0",
        id: rpc.id,
        result: { content: [{ type: "text", text: "ok" }] },
      });
    },
  });

  try {
    const backend = new JsonRpcMcpBackend({
      endpointUrl: `http://localhost:${httpServer.addr.port}/mcp`,
    });

    const response = await backend.handleMessage(makeSession(), {
      jsonrpc: "2.0",
      id: 7,
      method: "tools/call",
      params: { name: "echo", arguments: { value: 1 } },
    });

    assertEquals(receivedMethod, "tools/call");
    assertEquals(receivedParams, { name: "echo", arguments: { value: 1 } });
    assertEquals(response, {
      jsonrpc: "2.0",
      id: 7,
      result: { content: [{ type: "text", text: "ok" }] },
    });
  } finally {
    await httpServer.shutdown();
  }
});

Deno.test("JsonRpcMcpBackend - readResource extracts text content", async () => {
  // deno-lint-ignore no-explicit-any
  const httpServer = (Deno as any).serve({
    port: 0,
    handler: async (request: Request) => {
      const rpc = await request.json();
      assertEquals(rpc.method, "resources/read");
      assertEquals(rpc.params, { uri: "ui://demo/index.html" });
      return Response.json({
        jsonrpc: "2.0",
        id: rpc.id,
        result: {
          contents: [
            {
              uri: "ui://demo/index.html",
              mimeType: "text/html",
              text: "<html><body>demo</body></html>",
            },
          ],
        },
      });
    },
  });

  try {
    const backend = new JsonRpcMcpBackend({
      endpointUrl: `http://localhost:${httpServer.addr.port}/mcp`,
    });

    const html = await backend.readResource("ui://demo/index.html");
    assertEquals(html, "<html><body>demo</body></html>");
  } finally {
    await httpServer.shutdown();
  }
});

Deno.test("resource-server - built-in ui proxy serves backend resources", async () => {
  const server = startResourceServer({
    assetDirectories: {},
    platform: "generic-webview",
    backend: {
      handleMessage() {
        return Promise.resolve(null);
      },
      readResource(uri: string) {
        assertEquals(uri, "ui://demo/index.html");
        return Promise.resolve({
          html: "<html><head><title>Demo</title></head><body><h1>Hello</h1></body></html>",
        });
      },
    },
  });

  try {
    const response = await fetch(
      `${server.baseUrl}/ui?uri=${encodeURIComponent("ui://demo/index.html")}`,
    );
    const html = await response.text();

    assertEquals(response.status, 200);
    assertStringIncludes(html, "<h1>Hello</h1>");
    assertStringIncludes(html, "/bridge.js?platform=generic-webview");
    assertEquals(html.includes("auth=1"), false);
  } finally {
    await server.stop();
  }
});
