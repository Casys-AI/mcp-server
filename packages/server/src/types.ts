/**
 * Type definitions for the MCP Concurrent Server Framework
 *
 * This module provides TypeScript types for building high-performance
 * MCP servers with built-in concurrency control and backpressure.
 *
 * @module lib/server/types
 */

import type { McpUiToolMeta as McpUiToolMetaBase } from "@casys/mcp-compose/core";

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
  onLimitExceeded?: "reject" | "wait";
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
  backpressureStrategy?: "sleep" | "queue" | "reject";

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

  /**
   * Instructions for the LLM on how to use this server's tools.
   * Sent in the MCP initialize response. The LLM sees this before any tool call.
   */
  instructions?: string;

  /** Sampling client implementation (required if enableSampling is true) */
  samplingClient?: SamplingClient;

  /** Custom logger function (default: console.error) */
  logger?: (msg: string) => void;

  /**
   * Custom error handler for tool execution errors.
   *
   * When set, errors thrown by tool handlers are passed to this function.
   * Return a message string to produce `{ content: [{type:"text", text: msg}], isError: true }`
   * instead of re-throwing. Return null to rethrow as a JSON-RPC error.
   *
   * Default: undefined (all errors are re-thrown, existing behaviour).
   */
  toolErrorMapper?: ToolErrorMapper;

  /**
   * OAuth2/Bearer authentication configuration.
   * When provided, HTTP requests require a valid Bearer token.
   * STDIO transport is unaffected (local, no auth needed).
   */
  auth?: import("./auth/types.ts").AuthOptions;

  /**
   * Content Security Policy for HTML resources (MCP Apps).
   * When provided, injects a CSP `<meta>` tag into HTML content before serving.
   * This protects against XSS even in STDIO mode where HTTP headers are unavailable.
   *
   * @example
   * ```typescript
   * resourceCsp: { allowInline: true }
   * ```
   */
  resourceCsp?: import("./security/csp.ts").CspOptions;

  /**
   * Pre-declare the `resources` capability before transport connection.
   *
   * When true, installs `resources/list` and `resources/read` handlers at
   * construction time (before start/startHttp). Resources can then be added
   * dynamically after startup via registerResource() without hitting the
   * SDK's "Cannot register capabilities after connecting to transport" error.
   *
   * Use this when resources are discovered asynchronously (e.g., MCP relay/proxy
   * that discovers child servers after the stdio handshake).
   */
  expectResources?: boolean;
}

// ============================================
// MCP Apps Types (SEP-1865)
// ============================================

/**
 * MCP Apps UI metadata for tools (SEP-1865 + PML extensions)
 *
 * Extends the base `McpUiToolMeta` from mcp-compose/core with
 * PML-specific `emits`/`accepts` fields for cross-UI sync rules.
 * The server DECLARES capabilities; mcp-compose OWNS the contract.
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
export interface McpUiToolMeta extends McpUiToolMetaBase {
  /**
   * Resource URI for the UI. MUST use ui:// scheme.
   * Narrows the optional base field to required for server tools.
   * @example "ui://mcp-std/table-viewer"
   */
  resourceUri: string;

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

/**
 * MCP Tool metadata container.
 *
 * Carries optional UI hints and routing metadata for MCP Apps (SEP-1865).
 */
export interface MCPToolMeta {
  /** UI configuration for rendering this tool's output in an MCP App */
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
export type ResourceHandler = (
  uri: URL,
) => Promise<ResourceContent> | ResourceContent;

/** MCP Apps MIME type constant */
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app" as const;

/** URI scheme for MCP Apps resources */
export const MCP_APP_URI_SCHEME = "ui:" as const;

// ============================================
// MCP Tool Types
// ============================================

/**
 * Behavioural hints for model clients (MCP SDK 1.27 ToolAnnotations).
 * Passed through in tools/list so hosts can adapt their UI accordingly.
 */
export interface ToolAnnotations {
  /** Short human-readable title, may differ from tool name */
  title?: string;
  /** If true, tool has no side-effects and is safe to call speculatively */
  readOnlyHint?: boolean;
  /** If true, executing may produce irreversible effects */
  destructiveHint?: boolean;
  /** If true, repeated calls with same args produce same result */
  idempotentHint?: boolean;
  /** If true, tool may interact with entities outside the MCP system */
  openWorldHint?: boolean;
}

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
   * JSON Schema for the tool's structured output (MCP SDK 1.27).
   * Passed through in tools/list so hosts can validate tool results.
   */
  outputSchema?: Record<string, unknown>;

  /** Behavioural hints passed to model clients */
  annotations?: ToolAnnotations;

  /**
   * Tool metadata including UI configuration for MCP Apps
   * @see McpUiToolMeta
   */
  _meta?: MCPToolMeta;

  /**
   * Required OAuth scopes to call this tool.
   * Only enforced when auth is configured on the server.
   * If empty or undefined, no scope check is performed.
   */
  requiredScopes?: string[];
}

/**
 * Tool handler function.
 *
 * Receives validated arguments and returns a result (or throws).
 * The return value is serialised as JSON inside a `text` content block.
 *
 * **Security**: Never pass `args` values directly to shell commands or SQL.
 * Always validate / sanitise inside the handler or via `inputSchema`.
 *
 * @param args - Validated tool arguments from the MCP client
 * @returns Tool result (string, object, or Promise thereof)
 *
 * @example
 * ```typescript
 * const handler: ToolHandler = async (args) => {
 *   const rows = await db.query(args.sql as string);
 *   return { rows, count: rows.length };
 * };
 * ```
 */
export type ToolHandler = (
  args: Record<string, unknown>,
) => Promise<unknown> | unknown;

/**
 * Structured tool result: separates the LLM text summary (content)
 * from the machine-readable payload (structuredContent).
 *
 * When a ToolHandler returns this shape, the framework produces a
 * CallToolResult with both `content` and `structuredContent` set,
 * keeping heavy data out of the LLM context.
 */
export interface StructuredToolResult {
  /** Human-readable summary shown in content[0].text */
  content: string;
  /** Structured data conforming to the tool's outputSchema */
  structuredContent: Record<string, unknown>;
}

/**
 * Maps a thrown error to either a business error result (isError: true)
 * or signals that the error should be re-thrown as a JSON-RPC error.
 *
 * @returns A message string to produce `{ isError: true }`, or null to rethrow.
 */
export type ToolErrorMapper = (
  error: unknown,
  toolName: string,
) => string | null;

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
  strategy: "sleep" | "queue" | "reject";
  sleepMs: number;
}

// ============================================
// HTTP Server Types
// ============================================

/**
 * Context passed to HTTP rate limit key extractor
 */
export interface HttpRateLimitContext {
  /** Client IP address (from x-forwarded-for/x-real-ip) */
  ip: string;

  /** HTTP method */
  method: string;

  /** HTTP path (e.g. /mcp) */
  path: string;

  /** HTTP headers */
  headers: Headers;

  /** MCP session ID, if present */
  sessionId?: string;
}

/**
 * HTTP rate limit configuration
 */
export interface HttpRateLimitOptions {
  /** Maximum requests per window */
  maxRequests: number;

  /** Time window in milliseconds */
  windowMs: number;

  /**
   * Function to extract client identifier from HTTP context
   * Default: uses IP address
   */
  keyExtractor?: (context: HttpRateLimitContext) => string;

  /**
   * Behavior when rate limit is exceeded
   * - 'reject': Return error immediately
   * - 'wait': Wait for slot with backoff
   */
  onLimitExceeded?: "reject" | "wait";
}

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
   * Allowed CORS origins (default: "*")
   * Use an allowlist in production.
   */
  corsOrigins?: "*" | string[];

  /**
   * Maximum request body size in bytes (default: 1_000_000).
   * Set to null to disable the limit.
   */
  maxBodyBytes?: number | null;

  /**
   * Require auth for HTTP mode. If true and auth is not configured, startHttp throws.
   */
  requireAuth?: boolean;

  /**
   * IP-based rate limiting for HTTP endpoints.
   */
  ipRateLimit?: HttpRateLimitOptions;

  /**
   * Custom HTTP routes registered alongside MCP protocol routes.
   * Uses Web standard Request/Response (no framework dependency).
   */
  customRoutes?: Array<{
    method: "get" | "post";
    path: string;
    handler: (req: Request) => Response | Promise<Response>;
  }>;

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
