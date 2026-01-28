/**
 * Unit tests for _meta field in tools registration
 *
 * Tests MCP Apps (SEP-1865) tool metadata support including:
 * - Tools with _meta.ui are stored correctly
 * - emits/accepts fields preserved
 * - Tools without _meta work normally
 *
 * @module lib/server/src/tools-meta_test
 */

import { assertEquals } from "jsr:@std/assert";
import { ConcurrentMCPServer } from "./concurrent-server.ts";
import type { MCPTool } from "./types.ts";

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

Deno.test("registerTool - stores _meta when present", () => {
  const server = createTestServer();
  const tool: MCPTool = {
    name: "test_tool",
    description: "A test tool",
    inputSchema: { type: "object" },
    _meta: {
      ui: {
        resourceUri: "ui://test/tool-ui",
        emits: ["filter", "select"],
        accepts: ["setData"],
      },
    },
  };

  server.registerTool(tool, () => "result");

  assertEquals(server.getToolCount(), 1);
  assertEquals(server.getToolNames(), ["test_tool"]);
});

Deno.test("registerTool - works without _meta", () => {
  const server = createTestServer();
  const tool: MCPTool = {
    name: "basic_tool",
    description: "A basic tool without meta",
    inputSchema: { type: "object" },
  };

  server.registerTool(tool, () => "result");

  assertEquals(server.getToolCount(), 1);
});

Deno.test("registerTools - preserves _meta for multiple tools", () => {
  const server = createTestServer();
  const tools: MCPTool[] = [
    {
      name: "tool_with_ui",
      description: "Tool with UI",
      inputSchema: { type: "object" },
      _meta: {
        ui: {
          resourceUri: "ui://test/viewer",
          visibility: ["model"],
        },
      },
    },
    {
      name: "tool_without_ui",
      description: "Tool without UI",
      inputSchema: { type: "object" },
    },
    {
      name: "tool_with_events",
      description: "Tool with events",
      inputSchema: { type: "object" },
      _meta: {
        ui: {
          resourceUri: "ui://test/events",
          emits: ["click", "hover"],
          accepts: ["highlight", "scrollTo"],
        },
      },
    },
  ];

  const handlers = new Map([
    ["tool_with_ui", () => "result"],
    ["tool_without_ui", () => "result"],
    ["tool_with_events", () => "result"],
  ]);

  server.registerTools(tools, handlers);

  assertEquals(server.getToolCount(), 3);
  assertEquals(server.getToolNames().sort(), [
    "tool_with_events",
    "tool_with_ui",
    "tool_without_ui",
  ]);
});

Deno.test("registerTool - _meta.ui with visibility array", () => {
  const server = createTestServer();
  const tool: MCPTool = {
    name: "hidden_tool",
    description: "Hidden from model",
    inputSchema: { type: "object" },
    _meta: {
      ui: {
        resourceUri: "ui://test/hidden",
        visibility: ["app"], // Only visible to app, not model
      },
    },
  };

  server.registerTool(tool, () => "result");

  assertEquals(server.getToolCount(), 1);
});
