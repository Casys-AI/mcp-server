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

export class JwtAuthProvider extends AuthProvider {
  private jwks: ReturnType<typeof createRemoteJWKSet>;
  private options: JwtAuthProviderOptions;

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
