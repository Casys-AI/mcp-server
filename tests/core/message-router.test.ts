import { assertEquals, assertThrows } from "@std/assert";
import { MessageRouter } from "../../src/core/message-router.ts";
import type {
  McpAppsNotification,
  McpAppsRequest,
  McpAppsResponse,
} from "../../src/core/types.ts";

// ---- Request dispatch ----

Deno.test("MessageRouter - dispatches request to handler", async () => {
  const router = new MessageRouter();
  router.onRequest("test/method", (params) => {
    return { echo: params };
  });

  const request: McpAppsRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "test/method",
    params: { foo: "bar" },
  };

  const response = await router.handleMessage(request);
  assertEquals(response, {
    jsonrpc: "2.0",
    id: 1,
    result: { echo: { foo: "bar" } },
  });
});

Deno.test("MessageRouter - returns method-not-found for unknown method", async () => {
  const router = new MessageRouter();

  const request: McpAppsRequest = {
    jsonrpc: "2.0",
    id: 42,
    method: "unknown/method",
  };

  const response = await router.handleMessage(request);
  assertEquals(response?.jsonrpc, "2.0");
  if (response && "error" in response) {
    assertEquals(response.error.code, -32601);
  }
});

Deno.test("MessageRouter - handles async request handler", async () => {
  const router = new MessageRouter();
  router.onRequest("async/method", async () => {
    await new Promise((r) => setTimeout(r, 10));
    return "async-result";
  });

  const request: McpAppsRequest = {
    jsonrpc: "2.0",
    id: 2,
    method: "async/method",
  };

  const response = await router.handleMessage(request);
  assertEquals(response, {
    jsonrpc: "2.0",
    id: 2,
    result: "async-result",
  });
});

Deno.test("MessageRouter - wraps handler error in error response", async () => {
  const router = new MessageRouter();
  router.onRequest("error/method", () => {
    throw new Error("Something broke");
  });

  const request: McpAppsRequest = {
    jsonrpc: "2.0",
    id: 3,
    method: "error/method",
  };

  const response = await router.handleMessage(request);
  if (response && "error" in response) {
    assertEquals(response.error.code, -32603);
    assertEquals(response.error.message, "Something broke");
  }
});

// ---- Notification dispatch ----

Deno.test("MessageRouter - dispatches notification", async () => {
  const router = new MessageRouter();
  let received = false;

  router.onNotification("notify/test", () => {
    received = true;
  });

  const notification: McpAppsNotification = {
    jsonrpc: "2.0",
    method: "notify/test",
    params: { data: 1 },
  };

  const response = await router.handleMessage(notification);
  assertEquals(response, null);
  assertEquals(received, true);
});

// ---- Response handling (pending request tracking) ----

Deno.test("MessageRouter - returns null for response messages", async () => {
  const router = new MessageRouter();

  const response: McpAppsResponse = {
    jsonrpc: "2.0",
    id: 1,
    result: "ok",
  };

  const result = await router.handleMessage(response);
  assertEquals(result, null);
});

Deno.test("MessageRouter - trackRequest resolves on success response", async () => {
  const router = new MessageRouter();

  const promise = router.trackRequest(10, "test/method", 5000);
  assertEquals(router.pendingCount, 1);

  // Simulate incoming response
  await router.handleMessage({
    jsonrpc: "2.0",
    id: 10,
    result: { data: "hello" },
  });

  const result = await promise;
  assertEquals(result, { data: "hello" });
  assertEquals(router.pendingCount, 0);
});

Deno.test("MessageRouter - trackRequest rejects on error response", async () => {
  const router = new MessageRouter();

  const promise = router.trackRequest(11, "test/method", 5000);

  await router.handleMessage({
    jsonrpc: "2.0",
    id: 11,
    error: { code: -32601, message: "Method not found" },
  });

  try {
    await promise;
    throw new Error("Should have rejected");
  } catch (err) {
    assertEquals((err as Error).message.includes("-32601"), true);
  }
});

Deno.test("MessageRouter - trackRequest times out", async () => {
  const router = new MessageRouter();

  const promise = router.trackRequest(12, "slow/method", 50);

  try {
    await promise;
    throw new Error("Should have timed out");
  } catch (err) {
    assertEquals((err as Error).message.includes("timed out"), true);
  }
});

Deno.test("MessageRouter - trackRequest rejects duplicate id", async () => {
  const router = new MessageRouter();
  // Track first request and hold the promise so we can clean it up
  const firstPromise = router.trackRequest(13, "method-a", 5000);

  assertThrows(
    () => router.trackRequest(13, "method-b", 5000),
    Error,
    "already being tracked",
  );

  // Cleanup: destroy rejects the pending promise, catch it
  router.destroy();
  try {
    await firstPromise;
  } catch {
    // Expected: Router destroyed
  }
});

// ---- Handler removal ----

Deno.test("MessageRouter - removeRequestHandler", async () => {
  const router = new MessageRouter();
  router.onRequest("removable", () => "result");

  assertEquals(router.hasRequestHandler("removable"), true);
  router.removeRequestHandler("removable");
  assertEquals(router.hasRequestHandler("removable"), false);

  // Should now return method not found
  const resp = await router.handleMessage({
    jsonrpc: "2.0",
    id: 1,
    method: "removable",
  });
  if (resp && "error" in resp) {
    assertEquals(resp.error.code, -32601);
  }
});

Deno.test("MessageRouter - removeNotificationHandler", () => {
  const router = new MessageRouter();
  router.onNotification("removable", () => {});

  assertEquals(router.hasNotificationHandler("removable"), true);
  router.removeNotificationHandler("removable");
  assertEquals(router.hasNotificationHandler("removable"), false);
});

// ---- Duplicate handler protection ----

Deno.test("MessageRouter - throws on duplicate request handler", () => {
  const router = new MessageRouter();
  router.onRequest("dup", () => "a");

  assertThrows(
    () => router.onRequest("dup", () => "b"),
    Error,
    "already registered",
  );
});

Deno.test("MessageRouter - throws on duplicate notification handler", () => {
  const router = new MessageRouter();
  router.onNotification("dup", () => {});

  assertThrows(
    () => router.onNotification("dup", () => {}),
    Error,
    "already registered",
  );
});

// ---- Destroy ----

Deno.test("MessageRouter - destroy rejects pending requests", async () => {
  const router = new MessageRouter();
  const promise = router.trackRequest(20, "pending/method", 10_000);

  router.destroy();

  try {
    await promise;
    throw new Error("Should have rejected");
  } catch (err) {
    assertEquals((err as Error).message.includes("Router destroyed"), true);
  }
});
