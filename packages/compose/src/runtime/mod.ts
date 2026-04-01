/**
 * Runtime module — dashboard composition from manifests + templates.
 *
 * Handles I/O: reading manifests/templates, starting MCP servers,
 * calling tools, and feeding results into the core pipeline.
 *
 * @module runtime
 */

// Types
export type {
  ComposeRequest,
  ComposeResult,
  DashboardTemplate,
  HttpTransport,
  McpCluster,
  McpConnection,
  McpManifest,
  McpToolDeclaration,
  McpTransport,
  RuntimeError,
  StdioTransport,
  TemplateSource,
  TemplateToolCall,
} from "./types.ts";
export { RuntimeErrorCode } from "./types.ts";

// Manifest
export {
  loadManifest,
  loadManifests,
  parseManifest,
  validateManifest,
} from "./manifest.ts";

// Template
export {
  injectArgs,
  loadTemplate,
  parseTemplate,
  validateTemplate,
} from "./template.ts";

// Cluster
export {
  connectHttp,
  createCluster,
  startServer,
} from "./cluster.ts";

// Compose (main entry points)
export {
  composeDashboard,
  composeDashboardFromFiles,
} from "./compose.ts";
