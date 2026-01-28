/**
 * Unit tests for resource registration in ConcurrentMCPServer
 *
 * Tests MCP Apps (SEP-1865) resource support including:
 * - registerResource() single registration
 * - registerResources() batch registration
 * - Duplicate URI rejection
 * - Fail-fast on missing handlers
 * - Introspection methods
 *
 * @module lib/server/src/resource-registration_test
 */

import { assertEquals, assertThrows } from "jsr:@std/assert";
import { ConcurrentMCPServer } from "./concurrent-server.ts";
import type { MCPResource, ResourceHandler } from "./types.ts";
import { MCP_APP_MIME_TYPE } from "./types.ts";

/**
 * Helper to create test server instance
 */
function createTestServer(): ConcurrentMCPServer {
  return new ConcurrentMCPServer({
    name: "test-server",
    version: "1.0.0",
    // Suppress logging during tests
    logger: () => {},
  });
}

Deno.test("registerResource - registers a resource", () => {
  const server = createTestServer();
  const resource: MCPResource = {
    uri: "ui://test/viewer",
    name: "Test Viewer",
    description: "A test viewer",
  };
  const handler: ResourceHandler = () => ({
    uri: resource.uri,
    mimeType: MCP_APP_MIME_TYPE,
    text: "<html></html>",
  });

  server.registerResource(resource, handler);

  assertEquals(server.getResourceCount(), 1);
  assertEquals(server.getResourceUris(), ["ui://test/viewer"]);
  assertEquals(server.hasResource("ui://test/viewer"), true);
});

Deno.test("registerResource - throws on duplicate URI", () => {
  const server = createTestServer();
  const resource: MCPResource = { uri: "ui://test/dup", name: "Dup" };
  const handler: ResourceHandler = () => ({
    uri: resource.uri,
    mimeType: MCP_APP_MIME_TYPE,
    text: "",
  });

  server.registerResource(resource, handler);

  assertThrows(
    () => server.registerResource(resource, handler),
    Error,
    "Resource already registered",
  );
});

Deno.test("registerResources - registers multiple resources", () => {
  const server = createTestServer();
  const resources: MCPResource[] = [
    { uri: "ui://test/a", name: "A" },
    { uri: "ui://test/b", name: "B" },
  ];
  const handlers = new Map<string, ResourceHandler>([
    [
      "ui://test/a",
      () => ({ uri: "ui://test/a", mimeType: MCP_APP_MIME_TYPE, text: "A" }),
    ],
    [
      "ui://test/b",
      () => ({ uri: "ui://test/b", mimeType: MCP_APP_MIME_TYPE, text: "B" }),
    ],
  ]);

  server.registerResources(resources, handlers);

  assertEquals(server.getResourceCount(), 2);
});

Deno.test("registerResources - throws if duplicate exists (atomic, no partial registration)", () => {
  const server = createTestServer();

  // Pre-register one resource
  server.registerResource(
    { uri: "ui://test/existing", name: "Existing" },
    () => ({ uri: "ui://test/existing", mimeType: MCP_APP_MIME_TYPE, text: "" }),
  );

  // Try to batch register including the duplicate
  const resources: MCPResource[] = [
    { uri: "ui://test/new-a", name: "New A" },
    { uri: "ui://test/existing", name: "Duplicate" }, // Already exists!
    { uri: "ui://test/new-b", name: "New B" },
  ];
  const handlers = new Map<string, ResourceHandler>([
    ["ui://test/new-a", () => ({ uri: "ui://test/new-a", mimeType: MCP_APP_MIME_TYPE, text: "" })],
    ["ui://test/existing", () => ({ uri: "ui://test/existing", mimeType: MCP_APP_MIME_TYPE, text: "" })],
    ["ui://test/new-b", () => ({ uri: "ui://test/new-b", mimeType: MCP_APP_MIME_TYPE, text: "" })],
  ]);

  assertThrows(
    () => server.registerResources(resources, handlers),
    Error,
    "Resources already registered",
  );

  // Verify atomic behavior: only the pre-existing resource remains
  assertEquals(server.getResourceCount(), 1);
  assertEquals(server.hasResource("ui://test/existing"), true);
  assertEquals(server.hasResource("ui://test/new-a"), false);
  assertEquals(server.hasResource("ui://test/new-b"), false);
});

Deno.test("registerResources - throws if handler missing (fail-fast)", () => {
  const server = createTestServer();
  const resources: MCPResource[] = [
    { uri: "ui://test/a", name: "A" },
    { uri: "ui://test/b", name: "B" },
  ];
  const handlers = new Map<string, ResourceHandler>([
    [
      "ui://test/a",
      () => ({ uri: "ui://test/a", mimeType: MCP_APP_MIME_TYPE, text: "A" }),
    ],
    // Missing handler for "ui://test/b"
  ]);

  assertThrows(
    () => server.registerResources(resources, handlers),
    Error,
    "Missing handlers for resources",
  );

  // Verify no resources were registered (atomic fail)
  assertEquals(server.getResourceCount(), 0);
});

Deno.test("getResourceInfo - returns resource details", () => {
  const server = createTestServer();
  const resource: MCPResource = {
    uri: "ui://test/info",
    name: "Info Test",
    description: "Description",
  };
  server.registerResource(resource, () => ({
    uri: resource.uri,
    mimeType: MCP_APP_MIME_TYPE,
    text: "",
  }));

  const info = server.getResourceInfo("ui://test/info");

  assertEquals(info?.name, "Info Test");
  assertEquals(info?.description, "Description");
});

Deno.test("getResourceInfo - returns undefined for unknown URI", () => {
  const server = createTestServer();

  assertEquals(server.getResourceInfo("ui://unknown"), undefined);
});

Deno.test("hasResource - returns false for unregistered URI", () => {
  const server = createTestServer();

  assertEquals(server.hasResource("ui://not-registered"), false);
});

Deno.test("getResourceUris - returns empty array when no resources", () => {
  const server = createTestServer();

  assertEquals(server.getResourceUris(), []);
  assertEquals(server.getResourceCount(), 0);
});

Deno.test("registerResource - handles URI edge cases (trailing slash, query params)", () => {
  const server = createTestServer();

  // Test various URI formats
  const uriVariants = [
    "ui://test/path/",          // trailing slash
    "ui://test/path?query=1",   // query params
    "ui://test/path#anchor",    // anchor
    "ui://test/path%20space",   // encoded space
  ];

  for (const uri of uriVariants) {
    const resource: MCPResource = { uri, name: `Resource ${uri}` };
    const handler: ResourceHandler = (receivedUri) => ({
      uri: receivedUri.toString(),
      mimeType: MCP_APP_MIME_TYPE,
      text: `Content for ${uri}`,
    });

    server.registerResource(resource, handler);
    assertEquals(server.hasResource(uri), true);
  }

  assertEquals(server.getResourceCount(), uriVariants.length);
});

Deno.test("registerResource - accepts non-ui:// URI with warning (soft validation)", () => {
  // Using separate server with custom logger to capture warning
  let warnLogged = false;
  const warnServer = new ConcurrentMCPServer({
    name: "warn-test",
    version: "1.0.0",
    logger: (msg) => {
      if (msg.includes("[WARN]")) warnLogged = true;
    },
  });

  const resource: MCPResource = {
    uri: "file://local/path",
    name: "Local File",
  };

  // Should not throw, but logs warning
  warnServer.registerResource(resource, () => ({
    uri: resource.uri,
    mimeType: "text/plain",
    text: "content",
  }));

  assertEquals(warnServer.hasResource("file://local/path"), true);
  assertEquals(warnLogged, true);
});
