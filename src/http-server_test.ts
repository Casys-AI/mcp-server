/**
 * Tests for HTTP server support (startHttp)
 *
 * @module lib/server/http-server_test
 */

import { assertEquals, assertExists } from "@std/assert";
import { ConcurrentMCPServer } from "./concurrent-server.ts";
import { MCP_APP_MIME_TYPE } from "./types.ts";

Deno.test("startHttp - starts server and handles initialize", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-server",
    version: "1.0.0",
    logger: () => {}, // Silence logs
  });

  // Find a free port
  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {},
      }),
    });

    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.jsonrpc, "2.0");
    assertEquals(data.id, 1);
    assertEquals(data.result.serverInfo.name, "test-server");
    assertEquals(data.result.serverInfo.version, "1.0.0");
    assertExists(data.result.capabilities);
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - handles tools/list", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  server.registerTool(
    { name: "greet", description: "Greet someone", inputSchema: { type: "object" } },
    () => "Hello!",
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });

    const data = await res.json();
    assertEquals(data.result.tools.length, 1);
    assertEquals(data.result.tools[0].name, "greet");
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - handles tools/call", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  server.registerTool(
    { name: "add", description: "Add numbers", inputSchema: { type: "object" } },
    (args) => ({ sum: (args.a as number) + (args.b as number) }),
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "add", arguments: { a: 2, b: 3 } },
      }),
    });

    const data = await res.json();
    assertEquals(data.result.content[0].type, "text");
    const result = JSON.parse(data.result.content[0].text);
    assertEquals(result.sum, 5);
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - handles resources/list", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  server.registerResource(
    { uri: "ui://test/viewer", name: "Test Viewer", description: "A test viewer" },
    () => ({ uri: "ui://test/viewer", mimeType: MCP_APP_MIME_TYPE, text: "<html></html>" }),
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "resources/list" }),
    });

    const data = await res.json();
    assertEquals(data.result.resources.length, 1);
    assertEquals(data.result.resources[0].uri, "ui://test/viewer");
    assertEquals(data.result.resources[0].mimeType, MCP_APP_MIME_TYPE);
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - handles resources/read", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  const htmlContent = "<html><body>Hello World</body></html>";
  server.registerResource(
    { uri: "ui://test/page", name: "Test Page" },
    () => ({ uri: "ui://test/page", mimeType: MCP_APP_MIME_TYPE, text: htmlContent }),
  );

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: { uri: "ui://test/page" },
      }),
    });

    const data = await res.json();
    assertEquals(data.result.contents.length, 1);
    assertEquals(data.result.contents[0].text, htmlContent);
    assertEquals(data.result.contents[0].mimeType, MCP_APP_MIME_TYPE);
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - returns error for unknown resource", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "resources/read",
        params: { uri: "ui://unknown/resource" },
      }),
    });

    const data = await res.json();
    assertEquals(data.error.code, -32602);
    assertEquals(data.error.message, "Resource not found: ui://unknown/resource");
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - health endpoint works", async () => {
  const server = new ConcurrentMCPServer({
    name: "health-test",
    version: "2.0.0",
    logger: () => {},
  });

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/health`);
    const data = await res.json();
    assertEquals(data.status, "ok");
    assertEquals(data.server, "health-test");
    assertEquals(data.version, "2.0.0");
  } finally {
    await http.shutdown();
  }
});

Deno.test("startHttp - GET returns 405", async () => {
  const server = new ConcurrentMCPServer({
    name: "test-server",
    version: "1.0.0",
    logger: () => {},
  });

  const listener = Deno.listen({ port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const http = await server.startHttp({ port, onListen: () => {} });

  try {
    const res = await fetch(`http://localhost:${port}/mcp`);
    assertEquals(res.status, 405);
    await res.text(); // Consume body to avoid leak
  } finally {
    await http.shutdown();
  }
});
