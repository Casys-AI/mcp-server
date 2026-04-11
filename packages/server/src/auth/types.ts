/**
 * Authentication types for McpApp.
 *
 * Types follow RFC 9728 (OAuth Protected Resource Metadata)
 * and MCP Auth spec (draft 2025-11-25).
 *
 * @module lib/server/auth/types
 */

/**
 * Information extracted from a validated token.
 * Frozen (Object.freeze) before being passed to tool handlers.
 */
export interface AuthInfo {
  /** User ID (sub claim from JWT) */
  subject: string;

  /** OAuth client ID (optional - azp or client_id claim) */
  clientId?: string;

  /** Granted scopes */
  scopes: string[];

  /** Additional JWT claims */
  claims?: Record<string, unknown>;

  /** Token expiration timestamp (Unix epoch seconds) */
  expiresAt?: number;

  /**
   * Tenant identifier for multi-tenant servers.
   *
   * Populated by `createMultiTenantMiddleware` when a `TenantResolver`
   * is configured. Undefined on single-tenant servers.
   *
   * Tool handlers in multi-tenant servers should read this (never trust
   * raw JWT claims directly) to scope data access to the current tenant.
   */
  tenantId?: string;
}

/**
 * Auth configuration for the server.
 */
export interface AuthOptions {
  /** Authorization servers that issue valid tokens */
  authorizationServers: string[];

  /** Resource identifier for this MCP server (used in WWW-Authenticate header) */
  resource: string;

  /** Scopes supported by this server */
  scopesSupported?: string[];

  /** Custom auth provider (overrides default JWT validation) */
  provider: AuthProvider;
}

// Forward reference - actual class is in provider.ts
import type { AuthProvider } from "./provider.ts";

/**
 * RFC 9728 Protected Resource Metadata.
 * Returned by /.well-known/oauth-protected-resource
 *
 * @see https://datatracker.ietf.org/doc/html/rfc9728
 */
export interface ProtectedResourceMetadata {
  /**
   * RFC 9728 § 2 resource identifier. URI that identifies the protected
   * resource — used as the JWT `aud` claim. Can be an HTTP(S) URL OR an
   * opaque URI (e.g., an OIDC project ID). Do NOT assume it's an URL.
   */
  resource: string;

  /**
   * Absolute HTTP(S) URL where this metadata document is served publicly.
   * Per RFC 9728 § 3, this is the URL a client discovers via the
   * WWW-Authenticate challenge. Always an HTTP(S) URL, regardless of
   * whether `resource` itself is an URL or an opaque URI.
   *
   * REQUIRED as of 0.15.0 — previously derived at the middleware level
   * from `resource`, which produced a broken URL when `resource` was not
   * itself an HTTP(S) URL. Callers using the `createOIDCAuthProvider`
   * factory or `JwtAuthProvider` can omit the explicit value when their
   * `resource` IS an HTTP(S) URL (the factory auto-derives). Custom
   * `AuthProvider` subclasses must always set it explicitly.
   */
  resource_metadata_url: string;

  /** Authorization servers that can issue valid tokens */
  authorization_servers: string[];

  /** Scopes this resource supports */
  scopes_supported?: string[];

  /** How bearer tokens can be presented (always ["header"]) */
  bearer_methods_supported: string[];
}
