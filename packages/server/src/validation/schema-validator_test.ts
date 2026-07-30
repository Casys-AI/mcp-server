/**
 * Unit tests for SchemaValidator
 */

import { assertEquals, assertThrows } from "@std/assert";
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

Deno.test("SchemaValidator - collection bounds report a message and a structured expected", () => {
  // These keywords were always enforced — ajv validates the whole schema. What
  // was missing is the formatted output: they fell through to `default` and
  // surfaced ajv's bare prose with no `expected`, unlike every other keyword.
  // A caller building a recovery hint reads `expected`, not the sentence.
  const validator = new SchemaValidator();

  validator.addSchema("bounded", {
    type: "object",
    properties: {
      tags: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4,
      },
    },
  });

  const tooFew = validator.validate("bounded", { tags: ["a"] });
  assertEquals(tooFew.valid, false);
  assertEquals(
    tooFew.errors[0].message,
    "Property /tags must have at least 2 items",
  );
  assertEquals(tooFew.errors[0].expected, "items >= 2");
  assertEquals(tooFew.errors[0].path, "/tags");

  const tooMany = validator.validate("bounded", {
    tags: ["a", "b", "c", "d", "e"],
  });
  assertEquals(tooMany.valid, false);
  assertEquals(
    tooMany.errors[0].message,
    "Property /tags must have at most 4 items",
  );
  assertEquals(tooMany.errors[0].expected, "items <= 4");

  // The boundaries themselves are inside the contract.
  assertEquals(validator.validate("bounded", { tags: ["a", "b"] }).valid, true);
  assertEquals(
    validator.validate("bounded", { tags: ["a", "b", "c", "d"] }).valid,
    true,
  );
});

Deno.test("SchemaValidator - a bound of one reads as singular", () => {
  // `minItems: 1` is an ordinary schema, and "must have at least 1 items" reads
  // as a defect in the server rather than a problem with the caller's input.
  const validator = new SchemaValidator();

  validator.addSchema("single", {
    type: "object",
    properties: {
      tags: { type: "array", items: { type: "string" }, minItems: 1 },
      one: { type: "array", items: { type: "string" }, maxItems: 1 },
      opts: { type: "object", minProperties: 1 },
    },
  });

  assertEquals(
    validator.validate("single", { tags: [] }).errors[0].message,
    "Property /tags must have at least 1 item",
  );
  assertEquals(
    validator.validate("single", { one: ["a", "b"] }).errors[0].message,
    "Property /one must have at most 1 item",
  );
  assertEquals(
    validator.validate("single", { opts: {} }).errors[0].message,
    "Property /opts must have at least 1 property",
  );

  // …and plurals still agree above one.
  assertEquals(
    validator.validate("single", { one: ["a", "b"] }).errors[0].expected,
    "items <= 1",
  );
});

Deno.test("SchemaValidator - uniqueItems names the items, not the indices", () => {
  // ajv reports two zero-based indices, in either order depending on how it
  // optimised the scan. What is equal is the items AT those indices — saying
  // "positions 2 and 0 are equal" states something false about the positions.
  const validator = new SchemaValidator();

  validator.addSchema("uniq", {
    type: "object",
    properties: {
      ids: { type: "array", items: { type: "string" }, uniqueItems: true },
    },
  });

  const dupes = validator.validate("uniq", { ids: ["x", "y", "x"] });
  assertEquals(dupes.valid, false);

  const msg = dupes.errors[0].message;
  assertEquals(
    msg.includes("items at indices"),
    true,
    `should attribute equality to the items, got: ${msg}`,
  );
  // The duplicate pair here is index 0 and index 2, in whichever order ajv
  // reports them — both must appear.
  assertEquals(msg.includes("0"), true);
  assertEquals(msg.includes("2"), true);
});

Deno.test("SchemaValidator - uniqueItems and object-size bounds are reported too", () => {
  const validator = new SchemaValidator();

  validator.addSchema("misc", {
    type: "object",
    properties: {
      ids: { type: "array", items: { type: "string" }, uniqueItems: true },
      opts: { type: "object", minProperties: 1, maxProperties: 2 },
    },
  });

  const dupes = validator.validate("misc", { ids: ["x", "x"] });
  assertEquals(dupes.valid, false);
  assertEquals(dupes.errors[0].expected, "unique items");

  const empty = validator.validate("misc", { opts: {} });
  assertEquals(empty.valid, false);
  assertEquals(empty.errors[0].expected, "properties >= 1");

  const crowded = validator.validate("misc", { opts: { a: 1, b: 2, c: 3 } });
  assertEquals(crowded.valid, false);
  assertEquals(crowded.errors[0].expected, "properties <= 2");
});
