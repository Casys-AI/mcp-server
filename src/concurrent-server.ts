/**
 * Concurrent MCP Server Framework
 *
 * High-performance MCP server with built-in concurrency control,
 * backpressure, and optional sampling support.
 *
 * Wraps the official @modelcontextprotocol/sdk with production-ready
 * concurrency features.
 *
 * @module lib/server/concurrent-server
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { RequestQueue } from "./request-queue.ts";
import { SamplingBridge } from "./sampling-bridge.ts";
import { RateLimiter } from "./rate-limiter.ts";
import { SchemaValidator } from "./schema-validator.ts";
import type {
  ConcurrentServerOptions,
  MCPTool,
  ToolHandler,
  QueueMetrics,
  RateLimitContext,
} from "./types.ts";

/**
 * Tool definition with handler
 */
interface ToolWithHandler extends MCPTool {
  handler: ToolHandler;
}

/**
 * ConcurrentMCPServer provides a high-performance MCP server
 *
 * Features:
 * - Wraps official @modelcontextprotocol/sdk
 * - Concurrency limiting (default: 10 max concurrent)
 * - Multiple backpressure strategies (sleep/queue/reject)
 * - Optional bidirectional sampling support
 * - Metrics for monitoring
 * - Graceful shutdown
 *
 * @example
 * ```typescript
 * const server = new ConcurrentMCPServer({
 *   name: "my-server",
 *   version: "1.0.0",
 *   maxConcurrent: 5,
 *   backpressureStrategy: 'queue'
 * });
 *
 * server.registerTools(myTools, myHandlers);
 * await server.start();
 * ```
 */
export class ConcurrentMCPServer {
  private mcpServer: McpServer;
  private requestQueue: RequestQueue;
  private rateLimiter: RateLimiter | null = null;
  private schemaValidator: SchemaValidator | null = null;
  private samplingBridge: SamplingBridge | null = null;
  private tools = new Map<string, ToolWithHandler>();
  private options: ConcurrentServerOptions;
  private started = false;

  constructor(options: ConcurrentServerOptions) {
    this.options = options;

    // Create SDK MCP server
    this.mcpServer = new McpServer(
      {
        name: options.name,
        version: options.version,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Create request queue with concurrency control
    this.requestQueue = new RequestQueue({
      maxConcurrent: options.maxConcurrent ?? 10,
      strategy: options.backpressureStrategy ?? "sleep",
      sleepMs: options.backpressureSleepMs ?? 10,
    });

    // Optional rate limiting
    if (options.rateLimit) {
      this.rateLimiter = new RateLimiter({
        maxRequests: options.rateLimit.maxRequests,
        windowMs: options.rateLimit.windowMs,
      });
    }

    // Optional schema validation
    if (options.validateSchema) {
      this.schemaValidator = new SchemaValidator();
    }

    // Optional sampling support
    if (options.enableSampling && options.samplingClient) {
      this.samplingBridge = new SamplingBridge(options.samplingClient);
    }

    // Setup MCP protocol handlers
    this.setupHandlers();
  }

  /**
   * Setup MCP protocol request handlers
   */
  private setupHandlers(): void {
    const server = this.mcpServer.server;

    // tools/list handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: Array.from(this.tools.values()).map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      };
    });

    // tools/call handler (with concurrency control and rate limiting)
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args = request.params.arguments || {};

      // Apply rate limiting if configured
      if (this.rateLimiter && this.options.rateLimit) {
        const context: RateLimitContext = { toolName, args };
        const key = this.options.rateLimit.keyExtractor?.(context) ?? "default";

        if (this.options.rateLimit.onLimitExceeded === "reject") {
          // Reject immediately if rate limited
          if (!this.rateLimiter.checkLimit(key)) {
            const waitTime = this.rateLimiter.getTimeUntilSlot(key);
            throw new Error(
              `Rate limit exceeded. Retry after ${Math.ceil(waitTime / 1000)}s`
            );
          }
        } else {
          // Wait for slot (default behavior)
          await this.rateLimiter.waitForSlot(key);
        }
      }

      // Validate arguments if schema validation is enabled
      if (this.schemaValidator) {
        this.schemaValidator.validateOrThrow(toolName, args);
      }

      // Apply backpressure before execution
      await this.requestQueue.acquire();

      try {
        const tool = this.tools.get(toolName);

        if (!tool) {
          throw new Error(`Unknown tool: ${toolName}`);
        }

        // Execute tool handler
        const result = await tool.handler(args);

        // Format response according to MCP protocol
        return {
          content: [
            {
              type: "text",
              text: typeof result === "string"
                ? result
                : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        // Log error and re-throw for MCP error response
        this.log(
          `Error executing tool ${request.params.name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        throw error;
      } finally {
        // Always release slot
        this.requestQueue.release();
      }
    });
  }

  /**
   * Register tools with their handlers
   *
   * @param tools - Array of tool definitions (MCP format)
   * @param handlers - Map of tool name to handler function
   */
  registerTools(
    tools: MCPTool[],
    handlers: Map<string, ToolHandler>,
  ): void {
    for (const tool of tools) {
      const handler = handlers.get(tool.name);
      if (!handler) {
        throw new Error(`No handler provided for tool: ${tool.name}`);
      }

      this.tools.set(tool.name, {
        ...tool,
        handler,
      });

      // Register schema for validation if enabled
      if (this.schemaValidator) {
        this.schemaValidator.addSchema(tool.name, tool.inputSchema);
      }
    }

    this.log(`Registered ${tools.length} tools`);
  }

  /**
   * Register a single tool
   *
   * @param tool - Tool definition
   * @param handler - Tool handler function
   */
  registerTool(tool: MCPTool, handler: ToolHandler): void {
    this.tools.set(tool.name, {
      ...tool,
      handler,
    });

    // Register schema for validation if enabled
    if (this.schemaValidator) {
      this.schemaValidator.addSchema(tool.name, tool.inputSchema);
    }

    this.log(`Registered tool: ${tool.name}`);
  }

  /**
   * Start the MCP server with stdio transport
   */
  async start(): Promise<void> {
    if (this.started) {
      throw new Error("Server already started");
    }

    const transport = new StdioServerTransport();
    await this.mcpServer.server.connect(transport);

    this.started = true;

    const rateLimitInfo = this.options.rateLimit
      ? `, rate limit: ${this.options.rateLimit.maxRequests}/${this.options.rateLimit.windowMs}ms`
      : "";
    const validationInfo = this.options.validateSchema ? ", schema validation: on" : "";

    this.log(
      `Server started (max concurrent: ${
        this.options.maxConcurrent ?? 10
      }, strategy: ${this.options.backpressureStrategy ?? "sleep"}${rateLimitInfo}${validationInfo})`,
    );
    this.log(`Tools available: ${this.tools.size}`);
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }

    // Cancel pending sampling requests
    if (this.samplingBridge) {
      this.samplingBridge.cancelAll();
    }

    await this.mcpServer.server.close();
    this.started = false;

    this.log("Server stopped");
  }

  /**
   * Get sampling bridge (if enabled)
   */
  getSamplingBridge(): SamplingBridge | null {
    return this.samplingBridge;
  }

  /**
   * Get queue metrics for monitoring
   */
  getMetrics(): QueueMetrics {
    return this.requestQueue.getMetrics();
  }

  /**
   * Get rate limiter metrics (if rate limiting is enabled)
   */
  getRateLimitMetrics(): { keys: number; totalRequests: number } | null {
    return this.rateLimiter?.getMetrics() ?? null;
  }

  /**
   * Get rate limiter instance (for advanced use cases)
   */
  getRateLimiter(): RateLimiter | null {
    return this.rateLimiter;
  }

  /**
   * Get schema validator instance (for advanced use cases)
   */
  getSchemaValidator(): SchemaValidator | null {
    return this.schemaValidator;
  }

  /**
   * Check if server is started
   */
  isStarted(): boolean {
    return this.started;
  }

  /**
   * Get number of registered tools
   */
  getToolCount(): number {
    return this.tools.size;
  }

  /**
   * Get tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Log message using custom logger or stderr
   */
  private log(msg: string): void {
    if (this.options.logger) {
      this.options.logger(msg);
    } else {
      console.error(`[${this.options.name}] ${msg}`);
    }
  }
}
