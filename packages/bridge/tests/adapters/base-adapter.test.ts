import { assertEquals, assertThrows } from "@std/assert";
import { BasePostMessageAdapter } from "../../src/adapters/base-adapter.ts";

/** Concrete test adapter. */
class TestAdapter extends BasePostMessageAdapter {
  readonly platform = "test-platform";
}

Deno.test("BasePostMessageAdapter - platform identifier from subclass", () => {
  const adapter = new TestAdapter();
  assertEquals(adapter.platform, "test-platform");
});

Deno.test("BasePostMessageAdapter - sendToHost throws before init", () => {
  const adapter = new TestAdapter();
  assertThrows(
    () => adapter.sendToHost({ jsonrpc: "2.0", id: 1, method: "test" }),
    Error,
    "Not initialized",
  );
});

Deno.test("BasePostMessageAdapter - init + destroy lifecycle", async () => {
  const adapter = new TestAdapter();
  await adapter.init({ resourceBaseUrl: "http://localhost:9090" });
  // Should not throw after init
  adapter.destroy();
});

Deno.test("BasePostMessageAdapter - double init throws", async () => {
  const adapter = new TestAdapter();
  await adapter.init({ resourceBaseUrl: "http://localhost:9090" });
  try {
    await adapter.init({ resourceBaseUrl: "http://localhost:9090" });
    throw new Error("Should have thrown");
  } catch (e) {
    assertEquals((e as Error).message.includes("Already initialized"), true);
  } finally {
    adapter.destroy();
  }
});

Deno.test("BasePostMessageAdapter - onMessageFromHost accepts handlers", async () => {
  const adapter = new TestAdapter();
  const received: unknown[] = [];
  adapter.onMessageFromHost((msg) => received.push(msg));
  await adapter.init({ resourceBaseUrl: "http://localhost:9090" });

  // Handler registered but no messages dispatched in this test
  assertEquals(received.length, 0);
  adapter.destroy();
});

Deno.test("BasePostMessageAdapter - error message includes platform name", () => {
  const adapter = new TestAdapter();
  try {
    adapter.sendToHost({ jsonrpc: "2.0", id: 1, method: "x" });
  } catch (e) {
    assertEquals((e as Error).message.includes("test-platform"), true);
  }
});
