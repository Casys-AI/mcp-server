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
import {
  type AuthInfo,
  type HttpsUrl,
  httpsUrl,
  type ProtectedResourceMetadata,
} from "./types.ts";
import { isOtelEnabled, recordAuthEvent } from "../observability/otel.ts";

// ============================================================================
// JwtAuthProviderOptions — discriminated union (0.16.0)
// ============================================================================

/**
 * Fields shared by both branches of {@link JwtAuthProviderOptions}.
 */
interface JwtAuthProviderOptionsBase {
  /** JWT issuer (iss claim) */
  issuer: string;
  /** JWT audience (aud claim) */
  audience: string;
  /**
   * JWKS URI for signature validation. Defaults to
   * `{issuer}/.well-known/jwks.json` when omitted.
   */
  jwksUri?: string;
  /**
   * Authorization servers that issue valid tokens. Each entry is a branded
   * {@link HttpsUrl} — raw strings are rejected at compile time. Construct
   * via {@link httpsUrl}.
   */
  authorizationServers: HttpsUrl[];
  /** Scopes supported by this server */
  scopesSupported?: string[];
}

/**
 * Options where `resource` is a verified HTTP(S) URL. The metadata URL is
 * auto-derived when `resourceMetadataUrl` is omitted, by appending
 * `/.well-known/oauth-protected-resource` to `resource`.
 */
export interface JwtAuthProviderOptionsUrlResource
  extends JwtAuthProviderOptionsBase {
  /** RFC 9728 § 2 resource identifier, pre-validated as HTTP(S) URL. */
  resource: HttpsUrl;
  /**
   * Metadata URL, optional — auto-derived from `resource` when omitted.
   */
  resourceMetadataUrl?: HttpsUrl;
}

/**
 * Options where `resource` is an opaque URI (per RFC 9728 § 2 — e.g., an
 * OIDC project ID used as JWT audience). The metadata URL is MANDATORY
 * because it cannot be derived from an opaque identifier.
 */
export interface JwtAuthProviderOptionsOpaqueResource
  extends JwtAuthProviderOptionsBase {
  /** RFC 9728 § 2 opaque resource identifier (NOT an URL). */
  resource: string;
  /**
   * Metadata URL, REQUIRED — cannot be derived from opaque `resource`.
   * Construct via {@link httpsUrl}.
   */
  resourceMetadataUrl: HttpsUrl;
}

/**
 * Configuration for JwtAuthProvider.
 *
 * 0.16.0: discriminated union enforcing at compile time that callers with an
 * opaque `resource` MUST supply `resourceMetadataUrl` explicitly. TypeScript
 * narrows based on which branch accepts the given fields:
 *
 * - `resource: HttpsUrl` (via {@link httpsUrl}) → {@link
 *   JwtAuthProviderOptionsUrlResource} branch, `resourceMetadataUrl`
 *   optional (auto-derived from `resource`).
 * - `resource: string` (raw) → {@link JwtAuthProviderOptionsOpaqueResource}
 *   branch, `resourceMetadataUrl: HttpsUrl` REQUIRED.
 *
 * A caller forgetting to wrap an HTTP(S) URL in `httpsUrl()` gets a compile
 * error telling them to either wrap the resource or supply an explicit
 * metadata URL — structurally closing the bug class that 0.15.x fixed with
 * runtime guards (see `postmortems/phase8-deployment.md` § 7 and
 * `CHANGELOG.md` 0.15.0 / 0.15.1 for the motivating history).
 */
export type JwtAuthProviderOptions =
  | JwtAuthProviderOptionsUrlResource
  | JwtAuthProviderOptionsOpaqueResource;

// ============================================================================
// JwtAuthProvider
// ============================================================================

/**
 * Cached auth result with expiration
 */
interface CachedAuth {
  authInfo: AuthInfo;
  expiresAt: number; // ms timestamp
}

/**
 * JWT Auth Provider with JWKS validation.
 *
 * @example
 * ```typescript
 * import { httpsUrl, JwtAuthProvider } from "@casys/mcp-server";
 *
 * const provider = new JwtAuthProvider({
 *   issuer: "https://accounts.google.com",
 *   audience: "https://my-mcp.example.com",
 *   resource: httpsUrl("https://my-mcp.example.com"),
 *   authorizationServers: [httpsUrl("https://accounts.google.com")],
 * });
 * ```
 */
export class JwtAuthProvider extends AuthProvider {
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private options: JwtAuthProviderOptions;
  private readonly resourceMetadataUrl: HttpsUrl;

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

    // DU invariant: the `OpaqueResource` branch requires `resourceMetadataUrl`,
    // so at runtime the `else` branch below can only be reached when the
    // caller constructed via the `UrlResource` branch — meaning
    // `options.resource` is, by construction at input time, a valid
    // `HttpsUrl`. TypeScript does NOT narrow this at the function-body level
    // (because `HttpsUrl extends string`, the union `HttpsUrl | string`
    // collapses to `string`, and there is no tag field to discriminate on),
    // so the type-checker sees `options.resource: string` here — but the
    // runtime value is guaranteed parseable because it came through
    // `httpsUrl()` at the call site. The `new URL()` call below is therefore
    // sound, and the `httpsUrl()` wrapper on the derived value acts as
    // defense-in-depth.
    //
    // Derivation follows RFC 9728 § 3.1 exactly: when the resource has a
    // path or query component, the well-known path suffix is inserted
    // BETWEEN the host and the path, not appended after it:
    //
    //   resource  = https://api.example.com/v1/mcp
    //   metadata  = https://api.example.com/.well-known/oauth-protected-resource/v1/mcp
    //
    // Prior to 0.16.0 the derivation was a naive `${resource}/.well-known/...`
    // concat which produced `.../v1/mcp/.well-known/oauth-protected-resource`
    // — a 404 for RFC 9728-compliant discovery clients. Root-path resources
    // (`pathname === "/"`) are the only case the old code happened to get
    // right; everything else was silently broken. All current tests exercise
    // root-path resources which is why the bug survived until the 0.16.0
    // review (see `code-reviewer` findings).
    //
    // Fragments (`#...`) are intentionally dropped — they're client-side-only
    // per RFC 3986 § 3.5 and never part of a server-side metadata endpoint.
    if (options.resourceMetadataUrl !== undefined) {
      this.resourceMetadataUrl = options.resourceMetadataUrl;
    } else {
      const parsed = new URL(options.resource);
      const pathPart = parsed.pathname === "/" ? "" : parsed.pathname;
      this.resourceMetadataUrl = httpsUrl(
        `${parsed.origin}/.well-known/oauth-protected-resource${pathPart}${parsed.search}`,
      );
    }

    this.options = options;
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
