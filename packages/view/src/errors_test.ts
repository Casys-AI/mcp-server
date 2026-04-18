import { assertEquals, assertInstanceOf } from "@std/assert";
import { MCPViewError } from "./errors.ts";
import { missingServerToolsError } from "./capabilities.ts";

Deno.test("MCPViewError has .code, .message, .name fields", () => {
  const err = new MCPViewError("INVALID_CONFIG_ROOT", "root is required");
  assertEquals(err.code, "INVALID_CONFIG_ROOT");
  assertEquals(err.message, "root is required");
  assertEquals(err.name, "MCPViewError");
});

Deno.test("MCPViewError.data is frozen and carries extra fields", () => {
  const err = new MCPViewError("ORPHAN_INITIAL_VIEW", "orphan", {
    initialView: "missing",
    registered: ["home"],
  });
  assertEquals(err.data.initialView, "missing");
  assertEquals((err.data.registered as string[])[0], "home");
  // Frozen: assigning a new property on a frozen object throws in strict mode.
  let threw = false;
  try {
    (err.data as Record<string, unknown>).extra = "x";
  } catch {
    threw = true;
  }
  assertEquals(threw, true);
});

Deno.test("MCPViewError is instanceof Error and instanceof MCPViewError", () => {
  const err = new MCPViewError("UNKNOWN_VIEW", "nope");
  assertInstanceOf(err, Error);
  assertInstanceOf(err, MCPViewError);
});

Deno.test("MCPViewError with no data arg defaults to empty frozen object", () => {
  const err = new MCPViewError("ROUTER_NOT_INITIALIZED", "too early");
  assertEquals(Object.keys(err.data).length, 0);
});

Deno.test("missingServerToolsError returns MCPViewError with MISSING_SERVER_TOOLS_CAPABILITY", () => {
  const err = missingServerToolsError("my_tool");
  assertInstanceOf(err, MCPViewError);
  assertEquals(err.code, "MISSING_SERVER_TOOLS_CAPABILITY");
  assertEquals(err.data.tool, "my_tool");
});
