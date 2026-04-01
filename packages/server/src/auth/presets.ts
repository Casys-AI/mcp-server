/**
 * OIDC auth provider presets.
 *
 * Factory functions for common OIDC providers.
 * Each preset pre-configures the issuer, JWKS URI, and
 * authorization server for the provider.
 *
 * @module lib/server/auth/presets
 */

import {
  JwtAuthProvider,
  type JwtAuthProviderOptions,
} from "./jwt-provider.ts";

/**
 * Base options shared by all presets.
 */
export interface PresetOptions {
  /** JWT audience (aud claim) */
  audience: string;
  /** Resource identifier for RFC 9728 */
  resource: string;
  /** Scopes supported by this server */
  scopesSupported?: string[];
}

/**
 * GitHub Actions OIDC provider.
 *
 * Validates tokens issued by GitHub Actions workflows.
 * Issuer: https://token.actions.githubusercontent.com
 *
 * @example
 * ```typescript
 * const provider = createGitHubAuthProvider({
 *   audience: "https://my-mcp.example.com",
 *   resource: "https://my-mcp.example.com",
 * });
 * ```
 */
export function createGitHubAuthProvider(
  options: PresetOptions,
): JwtAuthProvider {
  return new JwtAuthProvider({
    issuer: "https://token.actions.githubusercontent.com",
    audience: options.audience,
    resource: options.resource,
    authorizationServers: ["https://token.actions.githubusercontent.com"],
    scopesSupported: options.scopesSupported,
  });
}

/**
 * Google OIDC provider.
 *
 * Validates tokens issued by Google accounts.
 * Issuer: https://accounts.google.com
 *
 * @example
 * ```typescript
 * const provider = createGoogleAuthProvider({
 *   audience: "https://my-mcp.example.com",
 *   resource: "https://my-mcp.example.com",
 * });
 * ```
 */
export function createGoogleAuthProvider(
  options: PresetOptions,
): JwtAuthProvider {
  return new JwtAuthProvider({
    issuer: "https://accounts.google.com",
    audience: options.audience,
    resource: options.resource,
    authorizationServers: ["https://accounts.google.com"],
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
    scopesSupported: options.scopesSupported,
  });
}

/**
 * Auth0 OIDC provider.
 *
 * Validates tokens issued by an Auth0 tenant.
 * Issuer: https://{domain}/
 *
 * @example
 * ```typescript
 * const provider = createAuth0AuthProvider({
 *   domain: "my-tenant.auth0.com",
 *   audience: "https://my-mcp.example.com",
 *   resource: "https://my-mcp.example.com",
 * });
 * ```
 */
export function createAuth0AuthProvider(
  options: PresetOptions & { domain: string },
): JwtAuthProvider {
  const issuer = `https://${options.domain}/`;
  return new JwtAuthProvider({
    issuer,
    audience: options.audience,
    resource: options.resource,
    authorizationServers: [issuer],
    jwksUri: `${issuer}.well-known/jwks.json`,
    scopesSupported: options.scopesSupported,
  });
}

/**
 * Generic OIDC provider.
 *
 * For any OIDC-compliant provider not covered by presets.
 *
 * @example
 * ```typescript
 * const provider = createOIDCAuthProvider({
 *   issuer: "https://my-idp.example.com",
 *   audience: "https://my-mcp.example.com",
 *   resource: "https://my-mcp.example.com",
 *   authorizationServers: ["https://my-idp.example.com"],
 * });
 * ```
 */
export function createOIDCAuthProvider(
  options: JwtAuthProviderOptions,
): JwtAuthProvider {
  return new JwtAuthProvider(options);
}
