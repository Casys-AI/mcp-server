/**
 * Type definitions for the MCP Concurrent Server Framework
 *
 * This module provides TypeScript types for building high-performance
 * MCP servers with built-in concurrency control and backpressure.
 *
 * @module lib/server/types
 */

/**
 * Rate limit configuration
 */
export interface RateLimitOptions {
  /** Maximum requests per window */
  maxRequests: number;

  /** Time window in milliseconds */
  windowMs: number;

  /**
   * Function to extract client identifier from request context
   * Default: uses "default" for all requests (global rate limit)
   */
  keyExtractor?: (context: RateLimitContext) => string;

  /**
   * Behavior when rate limit is exceeded
   * - 'reject': Return error immediately
   * - 'wait': Wait for slot with backoff (default)
   */
  onLimitExceeded?: 'reject' | 'wait';
}

/**
 * Context passed to rate limit key extractor
 */
export interface RateLimitContext {
  /** Tool being called */
  toolName: string;

  /** Tool arguments */
  args: Record<string, unknown>;
}

/**
 * Configuration options for ConcurrentMCPServer
 */
export interface ConcurrentServerOptions {
  /** Server name (shown in MCP protocol) */
  name: string;

  /** Server version */
  version: string;

  /** Maximum concurrent requests (default: 10) */
  maxConcurrent?: number;

  /** Backpressure strategy when at capacity (default: 'sleep') */
  backpressureStrategy?: 'sleep' | 'queue' | 'reject';

  /** Sleep duration in ms for 'sleep' strategy (default: 10) */
  backpressureSleepMs?: number;

  /**
   * Rate limiting configuration
   * If provided, requests will be rate limited per client
   */
  rateLimit?: RateLimitOptions;

  /**
   * Enable JSON Schema validation for tool arguments (default: false)
   * When enabled, validates arguments against tool's inputSchema before execution
   */
  validateSchema?: boolean;

  /** Enable sampling support for agentic tools (default: false) */
  enableSampling?: boolean;

  /** Sampling client implementation (required if enableSampling is true) */
  samplingClient?: SamplingClient;

  /** Custom logger function (default: console.error) */
  logger?: (msg: string) => void;
}

// ============================================
// MCP Apps Types (SEP-1865)
// ============================================

/**
 * MCP Apps UI metadata for tools (SEP-1865 + PML extensions)
 *
 * @example
 * ```typescript
 * const tool: MCPTool = {
 *   name: "query_table",
 *   description: "Query database table",
 *   inputSchema: { ... },
 *   _meta: {
 *     ui: {
 *       resourceUri: "ui://mcp-std/table-viewer",
 *       emits: ["filter", "select"],
 *       accepts: ["setData", "highlight"]
 *     }
 *   }
 * };
 * ```
 */
export interface McpUiToolMeta {
  /**
   * Resource URI for the UI. MUST use ui:// scheme.
   * @example "ui://mcp-std/table-viewer"
   */
  resourceUri: string;

  /**
   * Visibility control: who can see/call this tool
   * - "model": Only the AI model can see/call
   * - "app": Only the UI app can call (hidden from model)
   * - Default (both): Visible to model and app
   */
  visibility?: Array<"model" | "app">;

  /**
   * Events this UI can emit (PML extension for sync rules)
   * Used by PML orchestrator to build cross-UI event routing
   * @example ["filter", "select", "sort", "paginate"]
   */
  emits?: string[];

  /**
   * Events this UI can accept (PML extension for sync rules)
   * Used by PML orchestrator to build cross-UI event routing
   * @example ["setData", "highlight", "scrollTo"]
   */
  accepts?: string[];
}

/** MCP Tool metadata container */
export interface MCPToolMeta {
  ui?: McpUiToolMeta;
}

/**
 * MCP Resource definition for registration
 */
export interface MCPResource {
  /**
   * Resource URI. SHOULD use ui:// scheme for MCP Apps.
   * @example "ui://mcp-std/table-viewer"
   */
  uri: string;

  /** Human-readable name */
  name: string;

  /** Description of the resource */
  description?: string;

  /** MIME type. Defaults to MCP_APP_MIME_TYPE if not specified */
  mimeType?: string;
}

/**
 * Content returned by a resource handler
 */
export interface ResourceContent {
  /** URI of the resource (should match request) */
  uri: string;
  /** MIME type of the content */
  mimeType: string;
  /** The actual content (HTML for MCP Apps) */
  text: string;
}

/**
 * Resource handler callback
 *
 * @param uri - The requested resource URI as URL object
 * @returns ResourceContent with uri, mimeType, and text
 *
 * @example
 * ```typescript
 * const handler: ResourceHandler = async (uri) => ({
 *   uri: uri.toString(),
 *   mimeType: MCP_APP_MIME_TYPE,
 *   text: "<html>...</html>"
 * });
 * ```
 */
export type ResourceHandler = (uri: URL) => Promise<ResourceContent> | ResourceContent;

/** MCP Apps MIME type constant */
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app" as const;

/** URI scheme for MCP Apps resources */
export const MCP_APP_URI_SCHEME = "ui:" as const;

// ============================================
// MCP Tool Types
// ============================================

/**
 * MCP Tool definition (compatible with MCP protocol)
 */
export interface MCPTool {
  /** Tool name */
  name: string;

  /** Human-readable description */
  description: string;

  /** JSON Schema for tool input */
  inputSchema: Record<string, unknown>;

  /**
   * Tool metadata including UI configuration for MCP Apps
   * @see McpUiToolMeta
   */
  _meta?: MCPToolMeta;
}

/**
 * Tool handler function
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown> | unknown;

/**
 * Sampling client interface for bidirectional LLM delegation
 * Compatible with the agentic sampling protocol (SEP-1577)
 */
export interface SamplingClient {
  /**
   * Request LLM completion from the client
   * @param params - Sampling parameters (messages, tools, etc.)
   * @returns Completion result with content and stop reason
   */
  createMessage(params: SamplingParams): Promise<SamplingResult>;
}

/**
 * Parameters for sampling request
 * Compatible with MCP sampling protocol
 */
export interface SamplingParams {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** Tools available for the agent to use. Client handles execution. */
  tools?: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
  /** "auto" = LLM decides, "required" = must use tool, "none" = no tools */
  toolChoice?: "auto" | "required" | "none";
  maxTokens?: number;
  /** Hint for client: max agentic loop iterations */
  maxIterations?: number;
  /** Tool name patterns to filter (e.g., ['git_*', 'vfs_*']) */
  allowedToolPatterns?: string[];
}

/**
 * Result from sampling request
 * Compatible with MCP sampling protocol
 */
export interface SamplingResult {
  content: Array<{
    type: string;
    text?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  stopReason: "end_turn" | "tool_use" | "max_tokens";
}

/**
 * Queue metrics for monitoring
 */
export interface QueueMetrics {
  /** Number of requests currently executing */
  inFlight: number;

  /** Number of requests waiting in queue */
  queued: number;
}

/**
 * Promise resolver for pending requests
 */
export interface PromiseResolver<T = unknown> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * Request queue options
 */
export interface QueueOptions {
  maxConcurrent: number;
  strategy: 'sleep' | 'queue' | 'reject';
  sleepMs: number;
}

// ============================================
// HTTP Server Types
// ============================================

/**
 * Options for starting an HTTP server
 */
export interface HttpServerOptions {
  /** Port to listen on */
  port: number;

  /** Hostname to bind to (default: "0.0.0.0") */
  hostname?: string;

  /** Enable CORS (default: true) */
  cors?: boolean;

  /**
   * Callback when server is ready
   * @param info - Server address info
   */
  onListen?: (info: { hostname: string; port: number }) => void;
}

/**
 * HTTP server instance returned by startHttp
 */
export interface HttpServerInstance {
  /** Shutdown the HTTP server */
  shutdown(): Promise<void>;

  /** Server address info */
  addr: { hostname: string; port: number };
}
