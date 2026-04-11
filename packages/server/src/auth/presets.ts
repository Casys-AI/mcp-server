/**
 * OIDC auth provider presets.
 *
 * Factory functions for common OIDC providers. Each preset pre-configures
 * the issuer, JWKS URI, and authorization server for the provider.
 *
 * Bridge layer (0.16.0): presets accept raw `string` fields for `resource`,
 * `resourceMetadataUrl`, and `authorizationServers`, then wrap them through
 * {@link httpsUrl} before passing to the branded {@link JwtAuthProviderOptions}
 * constructor. This keeps the YAML/env config pipeline (`createAuthProviderFromConfig`)
 * working with raw strings while the core `JwtAuthProvider` API enforces the
 * `HttpsUrl` brand at the type level.
 *
 * @module lib/server/auth/presets
 */

import { JwtAuthProvider } from "./jwt-provider.ts";
import { type HttpsUrl, httpsUrl, tryHttpsUrl } from "./types.ts";

/**
 * Base options shared by all presets.
 */
export interface PresetOptions {
  /** JWT audience (aud claim) */
  audience: string;
  /**
   * RFC 9728 § 2 resource identifier, as a raw string. Presets detect
   * whether this is an HTTP(S) URL or an opaque URI and pick the correct
   * {@link JwtAuthProviderOptions} branch internally. When opaque, you
   * MUST also supply {@link resourceMetadataUrl}.
   */
  resource: string;
  /** Scopes supported by this server */
  scopesSupported?: string[];
  /**
   * Absolute HTTP(S) URL where the `/.well-known/oauth-protected-resource`
   * metadata document is served publicly (RFC 9728 § 3). Required when
   * `resource` is an opaque URI; optional when `resource` is itself an
   * HTTP(S) URL (in which case the preset auto-derives). Empty and
   * whitespace-only values are treated as absent.
   */
  resourceMetadataUrl?: string;
}

/**
 * Options for {@link createOIDCAuthProvider}. Unlike 0.15.x where this
 * function accepted `JwtAuthProviderOptions` directly, 0.16.0 exposes a
 * preset-style interface with raw string fields — the preset wraps them
 * through {@link httpsUrl} internally.
 *
 * BREAKING: callers that previously passed a pre-built
 * `JwtAuthProviderOptions` to `createOIDCAuthProvider` must now pass
 * raw strings. Migration: just drop the `httpsUrl()` wrappers you'd
 * otherwise need at the call site.
 */
export interface OIDCPresetOptions extends PresetOptions {
  /** OIDC issuer (typically an HTTPS URL) */
  issuer: string;
  /**
   * JWKS URI for signature validation. Defaults to
   * `{issuer}/.well-known/jwks.json`.
   */
  jwksUri?: string;
  /**
   * Authorization servers, as raw strings. Defaults to `[issuer]` when
   * omitted. Each entry must be a valid absolute HTTP(S) URL — the preset
   * validates via {@link httpsUrl}.
   */
  authorizationServers?: string[];
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
  return buildJwtProvider({
    issuer: "https://token.actions.githubusercontent.com",
    audience: options.audience,
    authorizationServers: ["https://token.actions.githubusercontent.com"],
    scopesSupported: options.scopesSupported,
    resource: options.resource,
    resourceMetadataUrl: options.resourceMetadataUrl,
  }, "createGitHubAuthProvider");
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
  return buildJwtProvider({
    issuer: "https://accounts.google.com",
    audience: options.audience,
    authorizationServers: ["https://accounts.google.com"],
    jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
    scopesSupported: options.scopesSupported,
    resource: options.resource,
    resourceMetadataUrl: options.resourceMetadataUrl,
  }, "createGoogleAuthProvider");
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
  return buildJwtProvider({
    issuer,
    audience: options.audience,
    authorizationServers: [issuer],
    jwksUri: `${issuer}.well-known/jwks.json`,
    scopesSupported: options.scopesSupported,
    resource: options.resource,
    resourceMetadataUrl: options.resourceMetadataUrl,
  }, "createAuth0AuthProvider");
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
  options: OIDCPresetOptions,
): JwtAuthProvider {
  return buildJwtProvider({
    issuer: options.issuer,
    audience: options.audience,
    jwksUri: options.jwksUri,
    authorizationServers: options.authorizationServers ?? [options.issuer],
    scopesSupported: options.scopesSupported,
    resource: options.resource,
    resourceMetadataUrl: options.resourceMetadataUrl,
  }, "createOIDCAuthProvider");
}

// ============================================================================
// Internal bridge: raw strings → branded JwtAuthProviderOptions
// ============================================================================

/**
 * Internal options for the bridge helper.
 */
interface BuildJwtProviderOptions {
  issuer: string;
  audience: string;
  jwksUri?: string;
  authorizationServers: string[];
  scopesSupported?: string[];
  resource: string;
  resourceMetadataUrl?: string;
}

/**
 * Bridge raw-string preset options to the branded {@link JwtAuthProviderOptions}
 * discriminated union used by the core `JwtAuthProvider` constructor.
 *
 * This helper centralizes the preset → constructor translation so:
 *   1. All four presets share one validation pathway.
 *   2. Error messages name the preset that failed (via `presetName`).
 *   3. The DU branch choice (URL resource vs opaque) happens in exactly
 *      one place.
 *
 * Rules:
 * - `authorizationServers[]`: every entry must be a valid HTTP(S) URL.
 * - `resource`: if parseable as HTTP(S) URL → UrlResource branch (metadata
 *   URL derivable). Otherwise → OpaqueResource branch requiring explicit
 *   `resourceMetadataUrl`.
 * - `resourceMetadataUrl`: empty or whitespace-only strings are treated as
 *   absent (matches YAML-key-with-no-value semantics from 0.15.1).
 */
function buildJwtProvider(
  opts: BuildJwtProviderOptions,
  presetName: string,
): JwtAuthProvider {
  const wrappedAuthServers: HttpsUrl[] = opts.authorizationServers.map(
    (raw, i) => {
      try {
        return httpsUrl(raw);
      } catch (err) {
        throw new Error(
          `[${presetName}] authorizationServers[${i}] is not a valid ` +
            `HTTP(S) URL: ${(err as Error).message}`,
        );
      }
    },
  );

  const explicitMetadata: HttpsUrl | undefined = opts.resourceMetadataUrl &&
      opts.resourceMetadataUrl.trim().length > 0
    ? httpsUrl(opts.resourceMetadataUrl)
    : undefined;

  const base = {
    issuer: opts.issuer,
    audience: opts.audience,
    jwksUri: opts.jwksUri,
    authorizationServers: wrappedAuthServers,
    scopesSupported: opts.scopesSupported,
  };

  const resourceUrl = tryHttpsUrl(opts.resource);
  if (resourceUrl !== null) {
    // URL resource branch — metadata URL optional (derivable)
    return new JwtAuthProvider({
      ...base,
      resource: resourceUrl,
      resourceMetadataUrl: explicitMetadata,
    });
  }

  // Opaque resource branch — metadata URL required
  if (!explicitMetadata) {
    throw new Error(
      `[${presetName}] resourceMetadataUrl is required when 'resource' is ` +
        `not an HTTP(S) URL (got resource=${JSON.stringify(opts.resource)}). ` +
        `Per RFC 9728 § 2, 'resource' can be an opaque URI (e.g., an OIDC ` +
        `project ID used as JWT audience); in that case the metadata ` +
        `document URL is a separate concept and must be provided explicitly. ` +
        `Set 'resourceMetadataUrl' to the HTTPS URL where your ` +
        `/.well-known/oauth-protected-resource endpoint is served publicly.`,
    );
  }
  return new JwtAuthProvider({
    ...base,
    resource: opts.resource,
    resourceMetadataUrl: explicitMetadata,
  });
}
