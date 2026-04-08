/**
 * Auth module for McpApp.
 *
 * @module lib/server/auth
 */

// Types
export type {
  AuthInfo,
  AuthOptions,
  ProtectedResourceMetadata,
} from "./types.ts";

// Provider base class
export { AuthProvider } from "./provider.ts";

// Middleware and utilities
export {
  AuthError,
  createAuthMiddleware,
  createForbiddenResponse,
  createUnauthorizedResponse,
  extractBearerToken,
} from "./middleware.ts";

// Scope enforcement
export { createScopeMiddleware } from "./scope-middleware.ts";

// Multi-tenant resolution (tenant enforcement on top of auth)
export { createMultiTenantMiddleware } from "./multi-tenant-middleware.ts";
export type {
  MultiTenantMiddlewareOptions,
  TenantResolution,
  TenantResolver,
} from "./multi-tenant-middleware.ts";

// JWT Provider
export { JwtAuthProvider } from "./jwt-provider.ts";
export type { JwtAuthProviderOptions } from "./jwt-provider.ts";

// OIDC Presets
export {
  createAuth0AuthProvider,
  createGitHubAuthProvider,
  createGoogleAuthProvider,
  createOIDCAuthProvider,
} from "./presets.ts";
export type { PresetOptions } from "./presets.ts";

// Config loader (YAML + env)
export { createAuthProviderFromConfig, loadAuthConfig } from "./config.ts";
export type { AuthConfig, AuthProviderName } from "./config.ts";
