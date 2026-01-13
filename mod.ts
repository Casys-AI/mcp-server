/**
 * MCP Concurrent Server Framework
 *
 * Production-ready MCP server framework with built-in concurrency control,
 * backpressure strategies, and optional sampling support.
 *
 * Built on top of the official @modelcontextprotocol/sdk with added
 * production features for reliability and performance.
 *
 * @example
 * ```typescript
 * import { ConcurrentMCPServer } from "@casys/mcp-server";
 *
 * const server = new ConcurrentMCPServer({
 *   name: "my-server",
 *   version: "1.0.0",
 *   maxConcurrent: 10,
 *   backpressureStrategy: 'queue'
 * });
 *
 * const tools = [
 *   {
 *     name: "my_tool",
 *     description: "My custom tool",
 *     inputSchema: { type: "object", properties: {} }
 *   }
 * ];
 *
 * const handlers = new Map([
 *   ["my_tool", async (args) => { return "result"; }]
 * ]);
 *
 * server.registerTools(tools, handlers);
 * await server.start();
 * ```
 *
 * @module @casys/mcp-server
 */

// Main server class
export { ConcurrentMCPServer } from "./src/concurrent-server.ts";

// Concurrency primitives
export { RequestQueue } from "./src/request-queue.ts";

// Rate limiting
export { RateLimiter } from "./src/rate-limiter.ts";

// Sampling support
export { SamplingBridge } from "./src/sampling-bridge.ts";

// Type exports
export type {
  ConcurrentServerOptions,
  MCPTool,
  ToolHandler,
  SamplingClient,
  SamplingParams,
  SamplingResult,
  QueueMetrics,
  PromiseResolver,
  QueueOptions,
  RateLimitOptions,
  RateLimitContext,
} from "./src/types.ts";
