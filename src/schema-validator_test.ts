/**
 * Unit tests for SchemaValidator
 */

import { assertEquals, assertThrows } from "jsr:@std/assert";
import { SchemaValidator } from "./schema-validator.ts";

Deno.test("SchemaValidator - validates correct arguments", () => {
  const validator = new SchemaValidator();

  validator.addSchema("test_tool", {
    type: "object",
    properties: {
      count: { type: "number" },
      name: { type: "string" },
    },
    required: ["count"],
  });

  const result = validator.validate("test_tool", { count: 5, name: "test" });

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("SchemaValidator - detects missing required property", () => {
  const validator = new SchemaValidator();

  validator.addSchema("test_tool", {
    type: "object",
    properties: {
      count: { type: "number" },
    },
    required: ["count"],
  });

  const result = validator.validate("test_tool", {});

  assertEquals(result.valid, false);
  assertEquals(result.errors.length, 1);
  assertEquals(result.errors[0].message, "Missing required property: count");
});

Deno.test("SchemaValidator - detects wrong type", () => {
  const validator = new SchemaValidator();

  validator.addSchema("test_tool", {
    type: "object",
    properties: {
      count: { type: "number" },
    },
  });

  const result = validator.validate("test_tool", { count: "not a number" });

  assertEquals(result.valid, false);
  assertEquals(result.errors.length, 1);
  assertEquals(result.errors[0].path, "/count");
  assertEquals(result.errors[0].expected, "number");
});

Deno.test("SchemaValidator - validates enum values", () => {
  const validator = new SchemaValidator();

  validator.addSchema("test_tool", {
    type: "object",
    properties: {
      status: { type: "string", enum: ["active", "inactive", "pending"] },
    },
  });

  // Valid enum value
  const r1 = validator.validate("test_tool", { status: "active" });
  assertEquals(r1.valid, true);

  // Invalid enum value
  const r2 = validator.validate("test_tool", { status: "unknown" });
  assertEquals(r2.valid, false);
  assertEquals(r2.errors[0].message.includes("must be one of"), true);
});

Deno.test("SchemaValidator - validateOrThrow throws on invalid", () => {
  const validator = new SchemaValidator();

  validator.addSchema("test_tool", {
    type: "object",
    properties: {
      count: { type: "number" },
    },
    required: ["count"],
  });

  // Should not throw for valid args
  validator.validateOrThrow("test_tool", { count: 5 });

  // Should throw for invalid args
  assertThrows(
    () => validator.validateOrThrow("test_tool", {}),
    Error,
    "Invalid arguments for test_tool",
  );
});

Deno.test("SchemaValidator - passes through unknown tools", () => {
  const validator = new SchemaValidator();

  // No schema registered for this tool
  const result = validator.validate("unknown_tool", { anything: "goes" });

  assertEquals(result.valid, true);
  assertEquals(result.errors.length, 0);
});

Deno.test("SchemaValidator - hasSchema and removeSchema", () => {
  const validator = new SchemaValidator();

  assertEquals(validator.hasSchema("test_tool"), false);

  validator.addSchema("test_tool", { type: "object" });
  assertEquals(validator.hasSchema("test_tool"), true);
  assertEquals(validator.count, 1);

  validator.removeSchema("test_tool");
  assertEquals(validator.hasSchema("test_tool"), false);
  assertEquals(validator.count, 0);
});

Deno.test("SchemaValidator - clear removes all schemas", () => {
  const validator = new SchemaValidator();

  validator.addSchema("tool1", { type: "object" });
  validator.addSchema("tool2", { type: "object" });
  validator.addSchema("tool3", { type: "object" });

  assertEquals(validator.count, 3);

  validator.clear();

  assertEquals(validator.count, 0);
});

Deno.test("SchemaValidator - reports all errors when multiple issues", () => {
  const validator = new SchemaValidator();

  validator.addSchema("test_tool", {
    type: "object",
    properties: {
      count: { type: "number" },
      name: { type: "string" },
    },
    required: ["count", "name"],
  });

  const result = validator.validate("test_tool", {});

  assertEquals(result.valid, false);
  assertEquals(result.errors.length, 2); // Both required fields missing
});

Deno.test("SchemaValidator - validates nested objects", () => {
  const validator = new SchemaValidator();

  validator.addSchema("test_tool", {
    type: "object",
    properties: {
      config: {
        type: "object",
        properties: {
          timeout: { type: "number" },
        },
        required: ["timeout"],
      },
    },
    required: ["config"],
  });

  // Valid nested object
  const r1 = validator.validate("test_tool", { config: { timeout: 5000 } });
  assertEquals(r1.valid, true);

  // Missing nested required
  const r2 = validator.validate("test_tool", { config: {} });
  assertEquals(r2.valid, false);
});

Deno.test("SchemaValidator - validates arrays", () => {
  const validator = new SchemaValidator();

  validator.addSchema("test_tool", {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: { type: "string" },
      },
    },
  });

  // Valid array
  const r1 = validator.validate("test_tool", { items: ["a", "b", "c"] });
  assertEquals(r1.valid, true);

  // Invalid array item type
  const r2 = validator.validate("test_tool", { items: ["a", 123, "c"] });
  assertEquals(r2.valid, false);
});
