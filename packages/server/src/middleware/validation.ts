/**
 * Schema validation middleware.
 *
 * Validates tool arguments against JSON Schema before execution.
 *
 * @module lib/server/middleware/validation
 */

import type { SchemaValidator } from "../validation/schema-validator.ts";
import type { Middleware } from "./types.ts";

/**
 * Create a schema validation middleware.
 *
 * Validates `ctx.args` against the registered schema for `ctx.toolName`.
 * Throws with a descriptive error if validation fails.
 *
 * @param validator - SchemaValidator instance with pre-registered schemas
 */
export function createValidationMiddleware(
  validator: SchemaValidator,
): Middleware {
  // deno-lint-ignore require-await
  return async (ctx, next) => {
    validator.validateOrThrow(ctx.toolName, ctx.args);
    return next();
  };
}
