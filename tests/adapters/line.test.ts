import { assertEquals, assertThrows } from "@std/assert";
import { LineAdapter } from "../../src/adapters/line/adapter.ts";

Deno.test("LineAdapter - platform identifier", () => {
  const adapter = new LineAdapter();
  assertEquals(adapter.platform, "line");
});

Deno.test("LineAdapter - sendToHost throws before init", () => {
  const adapter = new LineAdapter();
  assertThrows(
    () =>
      adapter.sendToHost({
        jsonrpc: "2.0",
        id: 1,
        method: "test",
      }),
    Error,
    "Not initialized",
  );
});

Deno.test("LineAdapter - init + destroy lifecycle", async () => {
  const adapter = new LineAdapter();
  await adapter.init({ resourceBaseUrl: "http://localhost:8080" });
  adapter.destroy();
});
