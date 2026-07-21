// deno-lint-ignore-file require-await
/**
 * Static (opaque) bearer-token auth provider.
 *
 * Validates a fixed set of pre-shared bearer tokens with no OIDC/JWT
 * infrastructure — no issuer, no JWKS endpoint, no key management. Suited to
 * same-network deployments (Docker, VPN, LAN), server-to-server integrations,
 * and CI pipelines where a full OAuth flow is disproportionate.
 *
 * All valid tokens map to the same {@link AuthInfo}: this is authentication
 * ("is this an allowed caller?"), not per-user identity. For per-user identity,
 * expiry, or scopes issued by an IdP, use {@link JwtAuthProvider} / the OIDC
 * presets instead.
 *
 * Per RFC 9728 the emitted {@link ProtectedResourceMetadata} carries an empty
 * `authorization_servers` array: there is no authorization server in a static
 * token scheme — tokens are provisioned out of band — which is the correct
 * signal for clients not to attempt AS discovery.
 *
 * @module lib/server/auth/static-token-provider
 */

import { AuthProvider } from "./provider.ts";
import {
  type AuthInfo,
  type HttpsUrl,
  httpsUrl,
  type ProtectedResourceMetadata,
} from "./types.ts";

/**
 * Options for {@link createStaticTokenAuthProvider} /
 * {@link StaticTokenAuthProvider}.
 */
export interface StaticTokenAuthProviderOptions {
  /**
   * RFC 9728 § 2 resource identifier — an absolute HTTP(S) URL identifying
   * this server, validated via {@link httpsUrl} at construction. Required: the
   * {@link AuthProvider} contract must emit Protected Resource Metadata, which
   * needs a resource URL.
   */
  resource: string;
  /**
   * `subject` reported in {@link AuthInfo} for every valid token.
   * Default `"static-token-user"`.
   */
  subject?: string;
  /**
   * `scopes` granted to every valid token. Default `[]` — a pure gate with no
   * scopes, which is the common same-network case.
   */
  scopes?: string[];
  /**
   * `scopes_supported` advertised in the metadata document (what the resource
   * accepts). Defaults to `scopes` when omitted.
   */
  scopesSupported?: string[];
  /**
   * Explicit Protected Resource Metadata URL. When omitted it is auto-derived
   * from `resource` per RFC 9728 § 3.1, identically to {@link JwtAuthProvider}.
   * Empty / whitespace-only values are treated as absent.
   */
  resourceMetadataUrl?: string;
}

/**
 * {@link AuthProvider} that accepts a fixed set of opaque bearer tokens.
 *
 * Token lookup is O(1) via a pre-built `Set`; the shared {@link AuthInfo} (and
 * its `scopes` array) is frozen at construction. Tokens are stored trimmed to
 * match the bearer value the HTTP middleware extracts. Note that `Set.has()` is
 * not constant-time — prefer long, high-entropy tokens (>= 32 random bytes) and
 * rotate them regularly.
 *
 * @example
 * ```typescript
 * const provider = new StaticTokenAuthProvider(
 *   [Deno.env.get("MCP_AUTH_TOKEN")!],
 *   { resource: "https://my-mcp.example.com", scopes: ["tools:invoke"] },
 * );
 * ```
 */
export class StaticTokenAuthProvider extends AuthProvider {
  private readonly tokens: Set<string>;
  private readonly authInfo: AuthInfo;
  private readonly resource: string;
  private readonly resourceMetadataUrl: HttpsUrl;
  private readonly scopesSupported: string[] | undefined;

  constructor(tokens: string[], options: StaticTokenAuthProviderOptions) {
    super();

    if (tokens.length === 0) {
      throw new Error(
        "[StaticTokenAuthProvider] `tokens` must contain at least one token",
      );
    }
    if (tokens.some((t) => t.trim().length === 0)) {
      throw new Error(
        "[StaticTokenAuthProvider] `tokens` must not contain empty entries",
      );
    }
    if (!options.resource?.trim()) {
      throw new Error("[StaticTokenAuthProvider] `resource` is required");
    }

    // Validate `resource` as an absolute HTTP(S) URL unconditionally, so the
    // documented guarantee holds even when `resourceMetadataUrl` is supplied.
    const resourceUrl = httpsUrl(options.resource);

    // Store tokens trimmed: the HTTP middleware trims the extracted bearer
    // value (`extractBearerToken`), so a padded entry would otherwise be stored
    // in a form that can never match an incoming request.
    this.tokens = new Set(tokens.map((t) => t.trim()));

    // Clone + freeze the scopes array: verifyToken returns this same AuthInfo
    // reference for every valid token, so a shared mutable array would let one
    // caller escalate scopes for all callers.
    const scopes = Object.freeze([...(options.scopes ?? [])]) as string[];
    this.authInfo = Object.freeze({
      subject: options.subject ?? "static-token-user",
      scopes,
    }) as AuthInfo;

    // Store the caller's raw resource string (RFC 9728 allows opaque URIs, and
    // JwtAuthProvider does the same); `resourceUrl` above is used only for
    // validation and metadata-URL derivation.
    this.resource = options.resource;
    this.scopesSupported = options.scopesSupported
      ? (Object.freeze([...options.scopesSupported]) as string[])
      : (scopes.length > 0 ? scopes : undefined);

    // RFC 9728 § 3.1: when `resourceMetadataUrl` is omitted, insert the
    // well-known suffix between the resource's origin and its path/query
    // (identical derivation to JwtAuthProvider).
    if (options.resourceMetadataUrl?.trim()) {
      this.resourceMetadataUrl = httpsUrl(options.resourceMetadataUrl);
    } else {
      const parsed = new URL(resourceUrl);
      const pathPart = parsed.pathname === "/" ? "" : parsed.pathname;
      this.resourceMetadataUrl = httpsUrl(
        `${parsed.origin}/.well-known/oauth-protected-resource${pathPart}${parsed.search}`,
      );
    }
  }

  async verifyToken(token: string): Promise<AuthInfo | null> {
    // Trim to match how tokens are stored (and how the HTTP middleware extracts
    // the bearer), so direct callers and the middleware path behave identically.
    return this.tokens.has(token.trim()) ? this.authInfo : null;
  }

  getResourceMetadata(): ProtectedResourceMetadata {
    // Fresh object per call (matching JwtAuthProvider) so a caller cannot
    // mutate shared metadata — e.g. the `authorization_servers` array.
    return {
      resource: this.resource,
      resource_metadata_url: this.resourceMetadataUrl,
      // No authorization server: static tokens are provisioned out of band.
      authorization_servers: [],
      scopes_supported: this.scopesSupported,
      bearer_methods_supported: ["header"],
    };
  }
}

/**
 * Create a static (opaque) bearer-token {@link AuthProvider}.
 *
 * @param tokens Non-empty list of valid bearer tokens (deduplicated, stored
 *   trimmed). Load them from env / a secrets manager — never hard-code tokens
 *   in source.
 * @param options Provider configuration; `options.resource` is required.
 *
 * @example
 * ```typescript
 * import { createStaticTokenAuthProvider, McpApp } from "@casys/mcp-server";
 *
 * const app = new McpApp({
 *   name: "my-server",
 *   version: "1.0.0",
 *   auth: {
 *     provider: createStaticTokenAuthProvider(
 *       (Deno.env.get("MCP_AUTH_TOKENS") ?? "").split(",").filter(Boolean),
 *       { resource: "https://my-mcp.example.com" },
 *     ),
 *   },
 * });
 * await app.startHttp({ port: 7654, requireAuth: true });
 * ```
 */
export function createStaticTokenAuthProvider(
  tokens: string[],
  options: StaticTokenAuthProviderOptions,
): StaticTokenAuthProvider {
  return new StaticTokenAuthProvider(tokens, options);
}
