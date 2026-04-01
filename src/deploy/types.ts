/**
 * Deploy types for cloud dashboard publication.
 *
 * @module deploy/types
 */

// =============================================================================
// Deploy transport
// =============================================================================

/**
 * Deploy transport — the MCP is deployed to Deno Deploy from a JSR package.
 *
 * @example
 * ```typescript
 * const transport: DeployTransport = {
 *   type: "deploy",
 *   package: "jsr:@casys/mcp-einvoice",
 *   args: ["--http"],
 * };
 * ```
 */
export interface DeployTransport {
  type: "deploy";
  /** JSR package specifier to deploy. */
  package: string;
  /** Args for the deployed server. */
  args?: string[];
}

// =============================================================================
// Deploy configuration
// =============================================================================

/**
 * Deno Deploy API credentials.
 *
 * @example
 * ```typescript
 * const credentials: DeployCredentials = {
 *   token: Deno.env.get("DENO_DEPLOY_TOKEN")!,
 *   orgId: "org-xxx",
 * };
 * ```
 */
export interface DeployCredentials {
  /** Deno Deploy API token. */
  token: string;
  /** Organization ID for project creation. */
  orgId: string;
}

/**
 * Request to deploy a dashboard to the cloud.
 *
 * @example
 * ```typescript
 * const request: DeployRequest = {
 *   html: composedHtml,
 *   manifests,
 *   envVars: { IOPOLE_CLIENT_ID: "xxx" },
 *   credentials,
 * };
 * ```
 */
export interface DeployRequest {
  /** Composed dashboard HTML. */
  html: string;
  /** Manifests for MCPs to deploy (deploy transport) or tunnel (stdio transport). */
  manifests: Map<string, DeployManifestEntry>;
  /** Environment variables for deployed MCPs (keyed by manifest name). */
  envVars?: Record<string, Record<string, string>>;
  /** Deno Deploy API credentials. */
  credentials: DeployCredentials;
}

/**
 * A manifest entry for deployment — extends the base manifest with deploy info.
 */
export interface DeployManifestEntry {
  /** Manifest name. */
  name: string;
  /** Transport: "deploy" (cloud) or "stdio" (local, needs tunnel). */
  transportType: "deploy" | "stdio";
  /** JSR package (for deploy transport). */
  package?: string;
  /** Whether this MCP needs a local tunnel. */
  needsTunnel: boolean;
}

// =============================================================================
// Deploy result
// =============================================================================

/**
 * Result of a dashboard deployment.
 */
export interface DeployResult {
  /** Shareable URL of the dashboard. */
  url: string;
  /** Relay project ID on Deno Deploy (for teardown). */
  relayProjectId: string;
  /** Deployed MCP project IDs (for teardown). */
  mcpProjectIds: string[];
  /** Teardown function — deletes all Deploy resources. */
  teardown(): Promise<void>;
}

// =============================================================================
// Tunnel types
// =============================================================================

/**
 * Active tunnel connection between a local MCP and the cloud relay.
 */
export interface TunnelConnection {
  /** Session ID for routing. */
  sessionId: string;
  /** Local MCP server name. */
  mcpName: string;
  /** WebSocket connection to the relay. */
  close(): Promise<void>;
}

// =============================================================================
// Error types
// =============================================================================

/** Deploy error codes. */
export enum DeployErrorCode {
  API_ERROR = "DEPLOY_API_ERROR",
  AUTH_ERROR = "DEPLOY_AUTH_ERROR",
  PROJECT_CREATE_FAILED = "DEPLOY_PROJECT_CREATE_FAILED",
  DEPLOYMENT_FAILED = "DEPLOY_DEPLOYMENT_FAILED",
  TUNNEL_CONNECT_FAILED = "DEPLOY_TUNNEL_CONNECT_FAILED",
  TUNNEL_DISCONNECTED = "DEPLOY_TUNNEL_DISCONNECTED",
  TEARDOWN_FAILED = "DEPLOY_TEARDOWN_FAILED",
}

/** Structured deploy error. */
export interface DeployError {
  code: DeployErrorCode;
  message: string;
  project?: string;
  cause?: unknown;
}
