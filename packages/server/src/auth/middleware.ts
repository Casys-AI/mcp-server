/**
 * Authentication middleware and utilities.
 *
 * Provides Bearer token extraction, 401/403 response factories,
 * and the auth middleware for the pipeline.
 *
 * @module lib/server/auth/middleware
 */

import type { AuthProvider } from "./provider.ts";
import type { Middleware } from "../middleware/types.ts";
import { isOtelEnabled, recordAuthEvent } from "../observability/otel.ts";

/**
 * Authentication error with structured information
 * for generating proper HTTP error responses.
 */
export class AuthError extends Error {
  constructor(
    public readonly code:
      | "missing_token"
      | "invalid_token"
      | "insufficient_scope",
    public readonly resourceMetadataUrl: string,
    public readonly requiredScopes?: string[],
  ) {
    super(
      code === "missing_token"
        ? "Authorization header with Bearer token required"
        : code === "invalid_token"
        ? "Invalid or expired token"
        : `Insufficient scope: requires ${requiredScopes?.join(", ")}`,
    );
    this.name = "AuthError";
  }
}

/**
 * Extract Bearer token from Authorization header.
 *
 * @param request - HTTP Request
 * @returns Token string or null if not present/invalid format
 */
export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Create a 401 Unauthorized response with WWW-Authenticate header.
 *
 * @param resourceMetadataUrl - URL to the Protected Resource Metadata endpoint
 * @param error - OAuth error code
 * @param errorDescription - Human-readable error description
 */
export function createUnauthorizedResponse(
  resourceMetadataUrl: string,
  error?: string,
  errorDescription?: string,
): Response {
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const parts = [`Bearer resource_metadata="${escape(resourceMetadataUrl)}"`];
  if (error) parts.push(`error="${escape(error)}"`);
  if (errorDescription) {
    parts.push(`error_description="${escape(errorDescription)}"`);
  }

  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: { code: -32001, message: errorDescription ?? "Unauthorized" },
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": parts.join(", "),
      },
    },
  );
}

/**
 * Create a 403 Forbidden response for insufficient scopes.
 *
 * @param requiredScopes - Scopes that were required but missing
 */
export function createForbiddenResponse(requiredScopes: string[]): Response {
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32001,
        message: `Forbidden: requires scopes ${requiredScopes.join(", ")}`,
      },
    }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    },
  );
}

/**
 * Create an authentication middleware for the MCP pipeline.
 *
 * Extracts the Bearer token from the HTTP request, validates it
 * via the AuthProvider, and injects `authInfo` into the context.
 *
 * For STDIO transport (no `ctx.request`), the middleware is skipped
 * since STDIO is a local transport with no auth needed.
 *
 * @param provider - AuthProvider implementation
 */
export function createAuthMiddleware(provider: AuthProvider): Middleware {
  return async (ctx, next) => {
    // STDIO transport: no request, skip auth
    if (!ctx.request) {
      return next();
    }

    const metadata = provider.getResourceMetadata();
    const resource = metadata.resource;
    const base = resource.endsWith("/") ? resource.slice(0, -1) : resource;
    const metadataUrl = `${base}/.well-known/oauth-protected-resource`;

    const token = extractBearerToken(ctx.request);
    if (!token) {
      if (isOtelEnabled()) {
        recordAuthEvent("reject", {
          reason: "missing_token",
          tool: ctx.toolName ?? "",
        });
      }
      throw new AuthError("missing_token", metadataUrl);
    }

    const authInfo = await provider.verifyToken(token);
    if (!authInfo) {
      if (isOtelEnabled()) {
        recordAuthEvent("reject", {
          reason: "invalid_token",
          tool: ctx.toolName ?? "",
        });
      }
      throw new AuthError("invalid_token", metadataUrl);
    }

    if (isOtelEnabled()) {
      recordAuthEvent("verify", {
        subject: authInfo.subject ?? "",
        tool: ctx.toolName ?? "",
      });
    }

    // Deep-freeze authInfo to prevent mutation by downstream middlewares
    if (authInfo.claims) Object.freeze(authInfo.claims);
    if (authInfo.scopes) Object.freeze(authInfo.scopes);
    ctx.authInfo = Object.freeze(authInfo);

    // Propagate resourceMetadataUrl for downstream middlewares (scope-middleware)
    ctx.resourceMetadataUrl = metadataUrl;

    return next();
  };
}
