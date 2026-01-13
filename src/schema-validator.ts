/**
 * Schema Validator
 *
 * JSON Schema validation using ajv for MCP tool arguments.
 * Compiles schemas once for optimal performance.
 *
 * @module lib/server/schema-validator
 */

// deno-lint-ignore-file no-explicit-any
import AjvDefault from "ajv";

// Get the Ajv constructor (handles ESM/CJS differences)
const Ajv = (AjvDefault as any).default ?? AjvDefault;

// Type definitions for ajv
interface AjvErrorObject {
  keyword: string;
  instancePath: string;
  schemaPath: string;
  params: Record<string, any>;
  message?: string;
  data?: unknown;
}

interface AjvValidateFunction {
  (data: unknown): boolean;
  errors?: AjvErrorObject[] | null;
}

/**
 * Validation error with formatted message
 */
export interface ValidationError {
  /** Error message */
  message: string;
  /** Path to invalid property */
  path: string;
  /** Invalid value */
  value?: unknown;
  /** Expected type or constraint */
  expected?: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Schema validator with compiled schema caching
 *
 * @example
 * ```typescript
 * const validator = new SchemaValidator();
 *
 * // Register tool schema
 * validator.addSchema("my_tool", {
 *   type: "object",
 *   properties: { count: { type: "number" } },
 *   required: ["count"]
 * });
 *
 * // Validate arguments
 * const result = validator.validate("my_tool", { count: 5 });
 * if (!result.valid) {
 *   console.error(result.errors);
 * }
 * ```
 */
export class SchemaValidator {
  private ajv: any;
  private validators = new Map<string, AjvValidateFunction>();

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,      // Report all errors, not just first
      strict: false,        // Allow additional keywords
      useDefaults: true,    // Apply default values
      coerceTypes: false,   // Don't coerce types (strict validation)
    });
  }

  /**
   * Add a schema for a tool
   *
   * @param toolName - Name of the tool
   * @param schema - JSON Schema for tool arguments
   */
  addSchema(toolName: string, schema: Record<string, unknown>): void {
    // Compile and cache the validator
    const validate = this.ajv.compile(schema);
    this.validators.set(toolName, validate);
  }

  /**
   * Remove a schema
   */
  removeSchema(toolName: string): void {
    this.validators.delete(toolName);
  }

  /**
   * Check if a schema exists
   */
  hasSchema(toolName: string): boolean {
    return this.validators.has(toolName);
  }

  /**
   * Validate arguments against a tool's schema
   *
   * @param toolName - Name of the tool
   * @param args - Arguments to validate
   * @returns Validation result with errors if invalid
   */
  validate(toolName: string, args: Record<string, unknown>): ValidationResult {
    const validate = this.validators.get(toolName);

    if (!validate) {
      // No schema registered - pass through
      return { valid: true, errors: [] };
    }

    const valid = validate(args);

    if (valid) {
      return { valid: true, errors: [] };
    }

    // Format errors
    const errors = this.formatErrors(validate.errors || []);
    return { valid: false, errors };
  }

  /**
   * Validate and throw if invalid
   *
   * @throws Error with formatted validation message
   */
  validateOrThrow(toolName: string, args: Record<string, unknown>): void {
    const result = this.validate(toolName, args);

    if (!result.valid) {
      const messages = result.errors.map((e) => e.message).join("; ");
      throw new Error(`Invalid arguments for ${toolName}: ${messages}`);
    }
  }

  /**
   * Format ajv errors into readable messages
   */
  private formatErrors(errors: AjvErrorObject[]): ValidationError[] {
    return errors.map((error) => {
      const path = error.instancePath || "/";
      const param = error.params;

      let message: string;
      let expected: string | undefined;

      switch (error.keyword) {
        case "required":
          message = `Missing required property: ${param.missingProperty}`;
          break;

        case "type":
          message = `Property ${path} must be ${param.type}`;
          expected = param.type;
          break;

        case "enum":
          message = `Property ${path} must be one of: ${param.allowedValues?.join(", ")}`;
          expected = param.allowedValues?.join(" | ");
          break;

        case "minimum":
          message = `Property ${path} must be >= ${param.limit}`;
          expected = `>= ${param.limit}`;
          break;

        case "maximum":
          message = `Property ${path} must be <= ${param.limit}`;
          expected = `<= ${param.limit}`;
          break;

        case "minLength":
          message = `Property ${path} must have at least ${param.limit} characters`;
          expected = `length >= ${param.limit}`;
          break;

        case "maxLength":
          message = `Property ${path} must have at most ${param.limit} characters`;
          expected = `length <= ${param.limit}`;
          break;

        case "pattern":
          message = `Property ${path} must match pattern: ${param.pattern}`;
          expected = param.pattern;
          break;

        case "additionalProperties":
          message = `Unknown property: ${param.additionalProperty}`;
          break;

        default:
          message = error.message || `Validation failed at ${path}`;
      }

      return {
        message,
        path,
        value: error.data,
        expected,
      };
    });
  }

  /**
   * Get number of registered schemas
   */
  get count(): number {
    return this.validators.size;
  }

  /**
   * Clear all schemas
   */
  clear(): void {
    this.validators.clear();
  }
}
