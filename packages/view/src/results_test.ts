import { assertEquals, assertThrows } from "@std/assert";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import { readResultData, readStructuredContent } from "./results.ts";

interface InvoiceData extends Record<string, unknown> {
  invoiceId: string;
}

Deno.test("readStructuredContent returns structuredContent without parsing text", () => {
  const result: CallToolResult = {
    structuredContent: { invoiceId: "INV-1" },
    content: [{ type: "text", text: JSON.stringify({ invoiceId: "stale" }) }],
  };

  assertEquals(readStructuredContent<InvoiceData>(result), { invoiceId: "INV-1" });
});

Deno.test("readResultData does not parse JSON text unless fallback is explicit", () => {
  const result: CallToolResult = {
    content: [{ type: "text", text: JSON.stringify({ invoiceId: "INV-2" }) }],
  };

  assertEquals(readResultData<InvoiceData>(result), undefined);
  assertEquals(readResultData<InvoiceData>(result, { fallback: "json-text" }), {
    invoiceId: "INV-2",
  });
});

Deno.test("readResultData never falls back when structuredContent is present", () => {
  const result = {
    structuredContent: { invoiceId: "INV-3" },
    content: [{ type: "text", text: "not json" }],
  } satisfies CallToolResult;

  assertEquals(readResultData<InvoiceData>(result, { fallback: "json-text" }), {
    invoiceId: "INV-3",
  });

  const malformed = {
    structuredContent: "invalid-host-payload",
    content: [{ type: "text", text: JSON.stringify({ invoiceId: "legacy" }) }],
  } as unknown as CallToolResult;
  assertEquals(readResultData<InvoiceData>(malformed, { fallback: "json-text" }), undefined);
});

Deno.test("readResultData validates extracted data when a guard is supplied", () => {
  const result: CallToolResult = {
    structuredContent: { wrong: true },
    content: [],
  };
  const isInvoice = (value: unknown): value is InvoiceData =>
    typeof value === "object" && value !== null &&
    typeof (value as Record<string, unknown>).invoiceId === "string";

  assertEquals(readResultData(result, { validate: isInvoice }), undefined);
});

Deno.test("explicit JSON fallback ignores non-JSON text and rejects JSON primitives", () => {
  const nonJson: CallToolResult = { content: [{ type: "text", text: "summary" }] };
  const primitive: CallToolResult = { content: [{ type: "text", text: "42" }] };

  assertEquals(readResultData(nonJson, { fallback: "json-text" }), undefined);
  assertEquals(readResultData(primitive, { fallback: "json-text" }), undefined);
  assertThrows(
    () => readResultData(nonJson, { fallback: "unsupported" as "json-text" }),
    TypeError,
    "fallback",
  );
});
