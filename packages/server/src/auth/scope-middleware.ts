/**
 * Scope enforcement middleware.
 *
 * Verifies that the authenticated user has the required scopes
 * for the tool being called. Placed after the auth middleware.
 *
 * @module lib/server/auth/scope-middleware
 */

import type { AuthInfo } from "./types.ts";
import { AuthError } from "./middleware.ts";
import type { Middleware } from "../middleware/types.ts";

/**
 * Create a scope enforcement middleware.
 *
 * Checks `requiredScopes` for the called tool against `ctx.authInfo.scopes`.
 * If auth is not configured (no authInfo), the middleware passes through.
 * If the tool has no requiredScopes, the middleware passes through.
 *
 * @param toolScopes - Map of tool name to required scopes
 */
export function createScopeMiddleware(
  toolScopes: Map<string, string[]>,
): Middleware {
  // deno-lint-ignore require-await
  return async (ctx, next) => {
    const requiredScopes = toolScopes.get(ctx.toolName);

    // No scopes required for this tool
    if (!requiredScopes?.length) return next();

    // No auth configured: STDIO (no request) is fine, HTTP without authInfo is a misconfiguration
    const authInfo = ctx.authInfo as AuthInfo | undefined;
    if (!authInfo) {
      if (!ctx.request) return next(); // STDIO: local transport, no auth needed
      // HTTP request with required scopes but no authInfo = auth middleware is missing
      throw new Error(
        `[ScopeMiddleware] Tool "${ctx.toolName}" requires scopes [${
          requiredScopes.join(", ")
        }] ` +
          "but no authInfo found on HTTP request. Ensure auth middleware is configured in the pipeline.",
      );
    }

    const hasAll = requiredScopes.every((s) => authInfo.scopes.includes(s));
    if (!hasAll) {
      const missingScopes = requiredScopes.filter((s) =>
        !authInfo.scopes.includes(s)
      );
      // resourceMetadataUrl is not critical for 403 responses (only used in 401),
      // but we populate it from context if available for consistency
      const metadataUrl = (ctx.resourceMetadataUrl as string | undefined) ?? "";
      throw new AuthError("insufficient_scope", metadataUrl, missingScopes);
    }

    return next();
  };
}
