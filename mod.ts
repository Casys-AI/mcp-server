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
 * server.registerTool(
 *   { name: "greet", description: "Greet someone", inputSchema: { type: "object" } },
 *   (args) => `Hello, ${args.name}!`,
 * );
 *
 * // STDIO transport
 * await server.start();
 *
 * // — or — HTTP transport with security-first defaults
 * const http = await server.startHttp({
 *   port: 3000,
 *   maxBodyBytes: 1_048_576,                    // 1 MB (default)
 *   corsOrigins: ["https://app.example.com"],   // allowlist
 *   requireAuth: true,                          // fail-fast without auth
 *   ipRateLimit: { maxRequests: 60, windowMs: 60_000 },
 * });
 * ```
 *
 * @module @casys/mcp-server
 */

// Main server class
export { ConcurrentMCPServer } from "./src/concurrent-server.ts";

// Concurrency primitives
export { RequestQueue } from "./src/concurrency/request-queue.ts";

// Rate limiting
export { RateLimiter } from "./src/concurrency/rate-limiter.ts";

// Schema validation
export { SchemaValidator } from "./src/validation/schema-validator.ts";
export type {
  ValidationError,
  ValidationResult,
} from "./src/validation/schema-validator.ts";

// Sampling support
export { SamplingBridge } from "./src/sampling/sampling-bridge.ts";

// Type exports
export type {
  ConcurrentServerOptions,
  HttpRateLimitContext,
  HttpRateLimitOptions,
  HttpServerInstance,
  // HTTP Server types
  HttpServerOptions,
  // MCP Apps types (SEP-1865)
  MCPResource,
  MCPTool,
  MCPToolMeta,
  McpUiToolMeta,
  QueueMetrics,
  RateLimitContext,
  RateLimitOptions,
  ResourceContent,
  ResourceHandler,
  SamplingClient,
  SamplingParams,
  SamplingResult,
  ToolHandler,
} from "./src/types.ts";

// MCP Apps constants
export { MCP_APP_MIME_TYPE } from "./src/types.ts";

// Middleware pipeline
export type {
  Middleware,
  MiddlewareContext,
  MiddlewareResult,
  NextFunction,
} from "./src/middleware/mod.ts";
export { createMiddlewareRunner } from "./src/middleware/mod.ts";

// Auth - Core
export { AuthProvider } from "./src/auth/mod.ts";
export {
  AuthError,
  createAuthMiddleware,
  createForbiddenResponse,
  createUnauthorizedResponse,
  extractBearerToken,
} from "./src/auth/mod.ts";
export { createScopeMiddleware } from "./src/auth/mod.ts";
export type {
  AuthInfo,
  AuthOptions,
  ProtectedResourceMetadata,
} from "./src/auth/mod.ts";

// Auth - JWT Provider + Presets
export { JwtAuthProvider } from "./src/auth/mod.ts";
export type { JwtAuthProviderOptions } from "./src/auth/mod.ts";
export {
  createAuth0AuthProvider,
  createGitHubAuthProvider,
  createGoogleAuthProvider,
  createOIDCAuthProvider,
} from "./src/auth/mod.ts";
export type { PresetOptions } from "./src/auth/mod.ts";

// Auth - Config (YAML + env)
export {
  createAuthProviderFromConfig,
  loadAuthConfig,
} from "./src/auth/mod.ts";
export type { AuthConfig, AuthProviderName } from "./src/auth/mod.ts";

// Observability
export {
  endToolCallSpan,
  getServerTracer,
  isOtelEnabled,
  recordAuthEvent,
  ServerMetrics,
  type ServerMetricsSnapshot,
  startToolCallSpan,
  type ToolCallSpanAttributes,
} from "./src/observability/mod.ts";

// Security - CSP utilities
export { buildCspHeader, injectCspMetaTag } from "./src/security/csp.ts";
export type { CspOptions } from "./src/security/csp.ts";

// Security - HMAC channel authentication for PostMessage (MCP Apps)
export { injectChannelAuth } from "./src/security/channel-hmac.ts";
export { MessageSigner } from "./src/security/message-signer.ts";
export type {
  SignedMessage,
  VerifyResult,
} from "./src/security/message-signer.ts";

// Runtime port (for advanced consumers who need to inspect the adapter contract)
export type {
  FetchHandler,
  RuntimePort,
  ServeHandle,
  ServeOptions,
} from "./src/runtime/types.ts";
