/**
 * JWT Auth Provider using JWKS for token validation.
 *
 * Validates JWT tokens against a remote JWKS endpoint,
 * checking issuer, audience, and expiration.
 *
 * @module lib/server/auth/jwt-provider
 */

import { createRemoteJWKSet, jwtVerify } from "jose";
import { AuthProvider } from "./provider.ts";
import type { AuthInfo, ProtectedResourceMetadata } from "./types.ts";
import { isOtelEnabled, recordAuthEvent } from "../observability/otel.ts";

/**
 * Configuration for JwtAuthProvider.
 */
export interface JwtAuthProviderOptions {
  /** JWT issuer (iss claim) */
  issuer: string;
  /** JWT audience (aud claim) */
  audience: string;
  /** JWKS URI for signature validation. Defaults to {issuer}/.well-known/jwks.json */
  jwksUri?: string;
  /** Resource identifier for RFC 9728 */
  resource: string;
  /** Authorization servers that issue valid tokens */
  authorizationServers: string[];
  /** Scopes supported by this server */
  scopesSupported?: string[];
  /**
   * Absolute HTTP(S) URL where the `/.well-known/oauth-protected-resource`
   * metadata document is served publicly. Used to populate the
   * `resource_metadata` parameter of the WWW-Authenticate challenge
   * (RFC 9728 § 5) and the `resource_metadata_url` field of
   * `ProtectedResourceMetadata`.
   *
   * - When omitted AND `resource` is an HTTP(S) URL, the factory
   *   auto-derives `${resource}/.well-known/oauth-protected-resource`.
   * - When omitted AND `resource` is an opaque URI (e.g., an OIDC project
   *   ID used as JWT audience — valid per RFC 9728 § 2), the factory
   *   throws at construction. Set this option explicitly in that case
   *   (fail-fast, no silent broken header).
   *
   * @example "https://my-mcp.example.com/.well-known/oauth-protected-resource"
   */
  resourceMetadataUrl?: string;
}

/**
 * JWT Auth Provider with JWKS validation.
 *
 * @example
 * ```typescript
 * const provider = new JwtAuthProvider({
 *   issuer: "https://accounts.google.com",
 *   audience: "https://my-mcp.example.com",
 *   resource: "https://my-mcp.example.com",
 *   authorizationServers: ["https://accounts.google.com"],
 * });
 * ```
 */
/**
 * Cached auth result with expiration
 */
interface CachedAuth {
  authInfo: AuthInfo;
  expiresAt: number; // ms timestamp
}

/**
 * Validate that a string is a parseable absolute HTTP(S) URL. Used by
 * `JwtAuthProvider`'s constructor to enforce the RFC 9728 § 3 invariant
 * at construction time: the `resource_metadata_url` placed in the
 * `WWW-Authenticate` challenge MUST be a URL clients can fetch. Before
 * 0.15.1 the constructor stored whatever string the caller passed and
 * trusted the type system, which silently produced broken headers when
 * the value was empty / a relative path / unparseable / contained
 * trailing whitespace — the exact class of bug that 0.15.0 was meant to
 * eliminate (see postmortem phase8-deployment.md § 7 and F.1).
 *
 * Throws with a clear error message pointing at the offending value
 * (`JSON.stringify`-ed so quotes/newlines/specials don't break log
 * parsing) and suggesting a concrete fix. The `source` parameter names
 * which input produced the bad value so operators reading the error know
 * which config key to correct.
 *
 * Returns the normalized URL string (via `URL.toString()`), which
 * lowercases the scheme and applies minor canonicalization — so a
 * caller passing `HTTPS://foo.com/` receives `https://foo.com/` back.
 */
function validateAbsoluteHttpUrl(raw: string, source: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      `[JwtAuthProvider] ${source} is not a parseable URL: ${
        JSON.stringify(raw)
      }. Expected an absolute HTTP(S) URL like ` +
        `"https://my-mcp.example.com/.well-known/oauth-protected-resource".`,
    );
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(
      `[JwtAuthProvider] ${source} must use http:// or https:// scheme, ` +
        `got ${JSON.stringify(parsed.protocol)} in ${JSON.stringify(raw)}. ` +
        `Per RFC 9728 § 3, the protected resource metadata document must ` +
        `be served over HTTP(S).`,
    );
  }
  return parsed.toString();
}

export class JwtAuthProvider extends AuthProvider {
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private options: JwtAuthProviderOptions;
  private readonly resourceMetadataUrl: string;

  // Token verification cache: hash(token) → AuthInfo with TTL
  // Prevents redundant JWKS fetches (network round-trip per tool call)
  private tokenCache = new Map<string, CachedAuth>();
  private static readonly MAX_CACHE_SIZE = 1000;
  private static readonly DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(options: JwtAuthProviderOptions) {
    super();

    if (!options.issuer) {
      throw new Error("[JwtAuthProvider] issuer is required");
    }
    if (!options.audience) {
      throw new Error("[JwtAuthProvider] audience is required");
    }
    if (!options.resource) {
      throw new Error("[JwtAuthProvider] resource is required");
    }
    if (!options.authorizationServers?.length) {
      throw new Error(
        "[JwtAuthProvider] at least one authorizationServer is required",
      );
    }

    // Resolve resource_metadata_url: explicit > auto-derive (if URL) > throw.
    // Per RFC 9728 § 2, `resource` is an URI identifier and MAY be opaque
    // (e.g., an OIDC project ID used as JWT audience). The metadata document
    // URL is a separate concept — always an HTTP(S) URL. We used to derive
    // it from `resource` by string concatenation, which produced a broken
    // URL when `resource` was not itself an HTTP(S) URL. 0.15.0+ requires
    // the caller to provide the URL explicitly whenever `resource` is opaque.
    //
    // 0.15.1 hardening: both branches now run through `validateAbsoluteHttpUrl`
    // which `new URL()`-parses the result and rejects non-HTTP(S) schemes.
    // Empty / whitespace-only `resourceMetadataUrl` is treated as absent
    // (so a YAML key with no value falls through to the derivation branch
    // instead of silently producing `"://host"`). The scheme regex is now
    // case-insensitive — `HTTPS://foo.com` is a valid URL per RFC 3986
    // and we accept it (normalization happens in validateAbsoluteHttpUrl).
    // `options.resource` is `.trim()`-ed before derivation so trailing
    // whitespace doesn't produce an unparseable URL.
    const explicitUrl = options.resourceMetadataUrl?.trim();
    if (explicitUrl) {
      this.resourceMetadataUrl = validateAbsoluteHttpUrl(
        explicitUrl,
        "options.resourceMetadataUrl",
      );
    } else {
      const isUrl = /^https?:\/\//i.test(options.resource);
      if (!isUrl) {
        throw new Error(
          `[JwtAuthProvider] resourceMetadataUrl is required when 'resource' ` +
            `is not an HTTP(S) URL (got resource=${
              JSON.stringify(options.resource)
            }). Per RFC 9728 § 2, 'resource' is an URI identifier that can ` +
            `be opaque (e.g., an OIDC project ID used as JWT audience). The ` +
            `metadata document URL is a separate concept. Set 'resourceMetadataUrl' ` +
            `to the HTTPS URL where your /.well-known/oauth-protected-resource ` +
            `endpoint is served publicly (e.g., ` +
            `"https://my-mcp.example.com/.well-known/oauth-protected-resource").`,
        );
      }
      const base = options.resource.trim().replace(/\/$/, "");
      const derived = `${base}/.well-known/oauth-protected-resource`;
      this.resourceMetadataUrl = validateAbsoluteHttpUrl(
        derived,
        "derived from options.resource",
      );
    }

    // Normalize `resource` at store time so `getResourceMetadata()` returns
    // the trimmed value in the RFC 9728 Protected Resource Metadata JSON
    // payload. Prior to 0.15.1 the derivation branch trimmed `resource` for
    // URL construction BUT `this.options` kept the raw value, so clients
    // fetching `/.well-known/oauth-protected-resource` would see
    // `"resource": "https://api.example.com   "` with trailing whitespace
    // in the JSON body. The WWW-Authenticate header was always clean
    // (middleware only reads `resource_metadata_url` which went through
    // `validateAbsoluteHttpUrl` + `new URL().toString()` normalization),
    // so runtime was never broken — just the PRM doc body was polluted.
    this.options = { ...options, resource: options.resource.trim() };
    const jwksUri = options.jwksUri ??
      `${options.issuer}/.well-known/jwks.json`;
    this.jwks = createRemoteJWKSet(new URL(jwksUri));
  }

  async verifyToken(token: string): Promise<AuthInfo | null> {
    // Check cache first (avoids JWKS network round-trip)
    const cacheKey = await this.hashToken(token);
    const cached = this.tokenCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      if (isOtelEnabled()) {
        recordAuthEvent("cache_hit", {
          subject: cached.authInfo.subject ?? "",
        });
      }
      return cached.authInfo;
    }
    // Evict expired entry if present
    if (cached) this.tokenCache.delete(cacheKey);

    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.options.issuer,
        audience: this.options.audience,
      });

      const authInfo: AuthInfo = {
        subject: payload.sub ?? "unknown",
        clientId: (payload.azp as string | undefined) ??
          (payload.client_id as string | undefined),
        scopes: this.extractScopes(payload),
        claims: payload as Record<string, unknown>,
        expiresAt: payload.exp,
      };

      // Cache with TTL = min(token remaining lifetime, 5 minutes)
      const tokenExpiresMs = payload.exp ? payload.exp * 1000 : Infinity;
      const cacheTtl = Math.min(
        tokenExpiresMs - Date.now(),
        JwtAuthProvider.DEFAULT_CACHE_TTL_MS,
      );
      if (cacheTtl > 0) {
        // Evict oldest entries if cache is full
        if (this.tokenCache.size >= JwtAuthProvider.MAX_CACHE_SIZE) {
          const oldestKey = this.tokenCache.keys().next().value;
          if (oldestKey) this.tokenCache.delete(oldestKey);
        }
        this.tokenCache.set(cacheKey, {
          authInfo: Object.freeze(authInfo) as AuthInfo,
          expiresAt: Date.now() + cacheTtl,
        });
      }

      return authInfo;
    } catch {
      return null;
    }
  }

  /**
   * Hash a token for cache key (avoids storing raw tokens in memory)
   */
  private async hashToken(token: string): Promise<string> {
    const data = new TextEncoder().encode(token);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(hash)).map((b) =>
      b.toString(16).padStart(2, "0")
    ).join("");
  }

  getResourceMetadata(): ProtectedResourceMetadata {
    return {
      resource: this.options.resource,
      resource_metadata_url: this.resourceMetadataUrl,
      authorization_servers: this.options.authorizationServers,
      scopes_supported: this.options.scopesSupported,
      bearer_methods_supported: ["header"],
    };
  }

  /**
   * Extract scopes from JWT payload.
   * Supports: "scope" claim (space-separated string) and "scp" claim (array).
   */
  private extractScopes(payload: Record<string, unknown>): string[] {
    if (typeof payload.scope === "string") {
      return payload.scope.split(" ").filter(Boolean);
    }
    if (Array.isArray(payload.scp)) {
      return payload.scp.filter((s): s is string => typeof s === "string");
    }
    return [];
  }
}
