/**
 * Authentication types for ConcurrentMCPServer.
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
  /** Resource identifier (URL of this MCP server) */
  resource: string;

  /** Authorization servers that can issue valid tokens */
  authorization_servers: string[];

  /** Scopes this resource supports */
  scopes_supported?: string[];

  /** How bearer tokens can be presented (always ["header"]) */
  bearer_methods_supported: string[];
}
