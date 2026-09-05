import { assertEquals, assertThrows } from "@std/assert";
import { createTranslator, mcpViewMessages } from "./i18n.ts";

Deno.test("message dictionaries select exact locale, language and per-key fallbacks", () => {
  const messages = createTranslator({
    messages: { title: "Model", details: "Technical details", revision: "Revision {revision}" },
    translations: {
      fr: { title: "Modèle", details: "Détails techniques" },
      "fr-CA": { title: "Modèle canadien" },
    },
  });
  assertEquals(messages("fr-CA")("title"), "Modèle canadien");
  assertEquals(messages("fr-CA")("details"), "Détails techniques");
  assertEquals(messages("fr-FR")("title"), "Modèle");
  assertEquals(messages("fr")("revision", { revision: 17 }), "Revision 17");
  assertEquals(messages("ja")("title"), "Model");
  assertEquals(messages("not a locale")("title"), "Model");
  assertEquals(messages()("title"), "Model");
});

Deno.test("messages remain plain text and do not translate caller values", () => {
  const messages = createTranslator({ messages: { status: "Status: {value}", missing: "{name}" } });
  assertEquals(messages()("status", { value: "unresolved" }), "Status: unresolved");
  assertEquals(messages()("status", { value: "<b>$&</b>" }), "Status: <b>$&</b>");
  assertEquals(messages()("missing"), "{name}");
  assertThrows(() => messages()("toString" as "status"), RangeError);
});

Deno.test("catalogs reject ambiguous locale keys and keep independent dictionaries", () => {
  assertThrows(() => createTranslator({ defaultLocale: "bad locale", messages: { title: "x" } }));
  assertThrows(() =>
    createTranslator({ messages: { title: "x" }, translations: { "bad locale": {} } })
  );
  assertThrows(() =>
    createTranslator({ messages: { title: "x" }, translations: { fr: {}, FR: {} } })
  );
  assertEquals(mcpViewMessages("fr-CA")("loadingTitle"), "Chargement");
  assertEquals(mcpViewMessages("en-US")("loadingTitle"), "Loading");
});
