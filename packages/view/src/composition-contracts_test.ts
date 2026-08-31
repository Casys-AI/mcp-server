import { assertEquals, assertFalse } from "@std/assert";

import {
  defineSemanticSelection,
  SEMANTIC_SELECTION_CHANGED_EVENT,
  SEMANTIC_SELECTION_SCHEMA,
} from "../contracts.ts";

Deno.test("contracts entry is reusable without the iframe runtime", async () => {
  const source = await Deno.readTextFile(
    new URL("./composition-contracts.ts", import.meta.url),
  );
  assertFalse(source.includes("@modelcontextprotocol/ext-apps"));
  assertFalse(source.includes("window."));
  assertFalse(source.includes("document."));

  assertEquals(SEMANTIC_SELECTION_CHANGED_EVENT, "semantic.selection.changed");
  assertEquals(
    defineSemanticSelection({
      mode: "replace",
      references: [{ domain: "cad", kind: "face", id: "face-12" }],
    }).schema,
    SEMANTIC_SELECTION_SCHEMA,
  );
});
