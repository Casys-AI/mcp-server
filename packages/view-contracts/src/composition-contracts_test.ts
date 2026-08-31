import { assertEquals, assertFalse } from "@std/assert";

import {
  defineSemanticSelection,
  SEMANTIC_SELECTION_CHANGED_EVENT,
  SEMANTIC_SELECTION_SCHEMA,
} from "../mod.ts";

Deno.test("contracts entry is reusable without the iframe runtime", async () => {
  for (
    const path of [
      `${import.meta.dirname}/../mod.ts`,
      `${import.meta.dirname}/app-manifest.ts`,
      `${import.meta.dirname}/composition-contracts.ts`,
    ]
  ) {
    const source = await Deno.readTextFile(path);
    assertFalse(source.includes("@modelcontextprotocol/ext-apps"));
    assertFalse(source.includes("@modelcontextprotocol/sdk"));
    assertFalse(source.includes("window."));
    assertFalse(source.includes("document."));
  }

  assertEquals(SEMANTIC_SELECTION_CHANGED_EVENT, "semantic.selection.changed");
  assertEquals(
    defineSemanticSelection({
      mode: "replace",
      references: [{ domain: "cad", kind: "face", id: "face-12" }],
    }).schema,
    SEMANTIC_SELECTION_SCHEMA,
  );
});
