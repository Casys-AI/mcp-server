/**
 * Runtime types for mcp-compose dashboard composition.
 *
 * These types define manifests (static MCP server metadata),
 * dashboard templates (YAML), and the compose request/result contract.
 *
 * @module runtime/types
 */

import type { UiLayout } from "../core/types/layout.ts";
import type { UiSyncRule } from "../core/types/sync-rules.ts";
import type { CompositeUiDescriptor } from "../core/types/descriptor.ts";

// =============================================================================
// Transport types
// =============================================================================

/**
 * Stdio transport — the cluster starts the MCP server as a child process.
 *
 * @example
 * ```typescript
 * const transport: StdioTransport = {
 *   type: "stdio",
 *   command: "deno",
 *   args: ["run", "--allow-net", "server.ts"],
 *   env: { DATABASE_URL: "postgres://localhost" },
 * };
 * ```
 */
export interface StdioTransport {
  type: "stdio";
  /** Command to start the server. */
  command: string;
  /** Command arguments. */
  args?: string[];
  /** Environment variables for the process. */
  env?: Record<string, string>;
}

/**
 * HTTP transport — connect to an already-running MCP server.
 *
 * @example
 * ```typescript
 * const transport: HttpTransport = {
 *   type: "http",
 *   url: "http://localhost:3001",
 * };
 * ```
 */
export interface HttpTransport {
  type: "http";
  /** Base URL of the running MCP server. */
  url: string;
}

/** Transport configuration for connecting to an MCP server. */
export type McpTransport = StdioTransport | HttpTransport;

// =============================================================================
// Manifest types (static MCP server metadata, read from JSON)
// =============================================================================

/**
 * A tool declared by an MCP server in its manifest.
 *
 * @example
 * ```typescript
 * const tool: McpToolDeclaration = {
 *   name: "invoice_search",
 *   description: "Search invoices",
 *   emits: ["invoice.selected"],
 *   accepts: ["filter.apply"],
 * };
 * ```
 */
export interface McpToolDeclaration {
  /** Tool name. */
  name: string;
  /** Human-readable description. */
  description?: string;
  /** JSON Schema for tool arguments. */
  inputSchema?: Record<string, unknown>;
  /** UI events this tool's UI emits. */
  emits?: string[];
  /** UI events this tool's UI accepts. */
  accepts?: string[];
  /** UI resource URI pattern. */
  resourceUri?: string;
}

/**
 * Static manifest describing an MCP server.
 *
 * Generated at build time (no server startup needed).
 * One JSON file per MCP server.
 *
 * @example Stdio (cluster starts the server)
 * ```typescript
 * const manifest: McpManifest = {
 *   name: "mcp-einvoice",
 *   transport: { type: "stdio", command: "deno", args: ["run", "jsr:@casys/mcp-einvoice", "--http"] },
 *   requiredEnv: ["IOPOLE_CLIENT_ID", "IOPOLE_CLIENT_SECRET", "IOPOLE_CUSTOMER_ID"],
 *   tools: [{ name: "invoice_search", emits: ["invoice.selected"] }],
 * };
 * ```
 *
 * @example HTTP (connect to existing server)
 * ```typescript
 * const manifest: McpManifest = {
 *   name: "mcp-einvoice",
 *   transport: { type: "http", url: "http://localhost:3001" },
 *   tools: [{ name: "invoice_search" }],
 * };
 * ```
 */
export interface McpManifest {
  /** Unique server name (used as namespace in sync rules). */
  name: string;
  /** Human-readable description. */
  description?: string;
  /** Transport configuration (stdio or http). */
  transport: McpTransport;
  /** Environment variable names required to run this server (names only, no values). */
  requiredEnv?: string[];
  /** Tools this server exposes. */
  tools: McpToolDeclaration[];
}

// =============================================================================
// Connection types
// =============================================================================

/**
 * An active MCP server connection.
 *
 * For stdio: wraps the child process.
 * For http: wraps the base URL.
 * Both provide a uiBaseUrl once resolved (from handshake or URL).
 */
export interface McpConnection {
  /** Server name from manifest. */
  name: string;
  /** Transport type used. */
  transportType: "stdio" | "http";
  /** Base URL for resolving ui:// resource URIs. */
  uiBaseUrl: string;
  /** Close the connection (kill process or cleanup). */
  close(): Promise<void>;
  /** Call a tool on this server. */
  callTool(
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<unknown>;
}

/**
 * Manage a cluster of MCP server connections.
 */
export interface McpCluster {
  /** Start/connect all servers referenced by the template. */
  startAll(): Promise<void>;
  /** Call a tool on a specific server. */
  callTool(
    serverName: string,
    toolName: string,
    args?: Record<string, unknown>,
  ): Promise<unknown>;
  /** Get the uiBaseUrl for a server (for uri resolution). */
  getUiBaseUrl(serverName: string): string | undefined;
  /** Stop all servers. */
  stopAll(): Promise<void>;
}

// =============================================================================
// Dashboard template types (read from YAML)
// =============================================================================

/**
 * A tool call within a dashboard source.
 *
 * @example
 * ```typescript
 * const call: TemplateToolCall = {
 *   tool: "invoice_search",
 *   args: { customer_id: "{{customer_id}}" },
 * };
 * ```
 */
export interface TemplateToolCall {
  /** Tool name (bare, scoped to the source's manifest). */
  tool: string;
  /** Static arguments. `{{key}}` placeholders are replaced at compose time. */
  args?: Record<string, unknown>;
}

/**
 * A source MCP server referenced by a dashboard template.
 */
export interface TemplateSource {
  /** Short ID for use in layout areas grid. */
  id?: string;
  /** Manifest name (must match an McpManifest.name). */
  manifest: string;
  /** Tools to call on this server. */
  calls: TemplateToolCall[];
}

/**
 * Dashboard template (read from YAML, no runtime args).
 *
 * Defines which MCP servers to start, which tools to call,
 * and how to arrange the resulting UIs.
 *
 * @example
 * ```yaml
 * name: Sales Dashboard
 * sources:
 *   - manifest: mcp-einvoice
 *     calls:
 *       - tool: invoice_search
 *         args: { customer_id: "{{customer_id}}" }
 * orchestration:
 *   layout: split
 *   sharedContext: [customer_id]
 * ```
 */
export interface DashboardTemplate {
  /** Human-readable dashboard name. */
  name: string;
  /** Source MCP servers and their tool calls. */
  sources: TemplateSource[];
  /** Layout, sync rules, shared context. Maps to UiOrchestration. */
  orchestration: {
    layout: UiLayout;
    sync?: UiSyncRule[];
    sharedContext?: string[];
  };
}

// =============================================================================
// Compose request / result
// =============================================================================

/**
 * Request to compose a dashboard (template + runtime args).
 *
 * @example
 * ```typescript
 * const request: ComposeRequest = {
 *   template,
 *   manifests,
 *   args: { customer_id: "CUST-001" },
 * };
 * ```
 */
export interface ComposeRequest {
  /** Parsed dashboard template. */
  template: DashboardTemplate;
  /** Resolved manifests keyed by name. */
  manifests: Map<string, McpManifest>;
  /** Runtime arguments injected into `{{placeholder}}` values. */
  args?: Record<string, unknown>;
  /** Keep the cluster alive after composition (for serving). Default: false. */
  keepAlive?: boolean;
}

/**
 * Result of a compose operation.
 */
export interface ComposeResult {
  /** The composite descriptor (from core pipeline). */
  descriptor: CompositeUiDescriptor;
  /** Rendered HTML string. */
  html: string;
  /** Warnings generated during composition. */
  warnings: string[];
  /** Cluster handle (only present if keepAlive was true). Call stopAll() when done. */
  cluster?: McpCluster;
}

// =============================================================================
// Error types
// =============================================================================

/** Runtime error codes. */
export enum RuntimeErrorCode {
  MANIFEST_PARSE_ERROR = "MANIFEST_PARSE_ERROR",
  TEMPLATE_PARSE_ERROR = "TEMPLATE_PARSE_ERROR",
  MANIFEST_NOT_FOUND = "MANIFEST_NOT_FOUND",
  PROCESS_START_FAILED = "PROCESS_START_FAILED",
  TOOL_CALL_FAILED = "TOOL_CALL_FAILED",
  TOOL_CALL_TIMEOUT = "TOOL_CALL_TIMEOUT",
  PROCESS_DIED = "PROCESS_DIED",
}

/** Structured runtime error. */
export interface RuntimeError {
  code: RuntimeErrorCode;
  message: string;
  server?: string;
  tool?: string;
  cause?: unknown;
}
