import { assertEquals } from "@std/assert";
import { SessionStore } from "../../src/resource-server/session.ts";

Deno.test("SessionStore - create and get session", () => {
  const store = new SessionStore();
  const session = store.create("telegram");

  assertEquals(typeof session.id, "string");
  assertEquals(session.id.length, 32); // 16 bytes = 32 hex chars
  assertEquals(session.platform, "telegram");
  assertEquals(typeof session.createdAt, "number");

  const retrieved = store.get(session.id);
  assertEquals(retrieved?.id, session.id);
  assertEquals(store.size, 1);
});

Deno.test("SessionStore - get returns undefined for unknown id", () => {
  const store = new SessionStore();
  assertEquals(store.get("nonexistent"), undefined);
});

Deno.test("SessionStore - remove session", () => {
  const store = new SessionStore();
  const session = store.create("line");

  assertEquals(store.size, 1);
  assertEquals(store.remove(session.id), true);
  assertEquals(store.size, 0);
  assertEquals(store.get(session.id), undefined);
});

Deno.test("SessionStore - touch updates lastActivity", async () => {
  const store = new SessionStore();
  const session = store.create("telegram");
  const original = session.lastActivity;

  await new Promise((r) => setTimeout(r, 10));
  store.touch(session.id);

  const updated = store.get(session.id);
  assertEquals(updated!.lastActivity > original, true);
});

Deno.test("SessionStore - expired sessions are not returned", () => {
  // 1ms TTL for testing
  const store = new SessionStore(1);
  const session = store.create("telegram");

  // Manually set lastActivity to the past
  session.lastActivity = Date.now() - 100;

  assertEquals(store.get(session.id), undefined);
});

Deno.test("SessionStore - cleanup removes expired sessions", () => {
  const store = new SessionStore(1);
  const s1 = store.create("telegram");
  const s2 = store.create("line");

  // Expire both
  s1.lastActivity = Date.now() - 100;
  s2.lastActivity = Date.now() - 100;

  assertEquals(store.size, 2);
  const removed = store.cleanup();
  assertEquals(removed, 2);
  assertEquals(store.size, 0);
});

Deno.test("SessionStore - clear removes all sessions", () => {
  const store = new SessionStore();
  store.create("telegram");
  store.create("line");
  store.create("telegram");

  assertEquals(store.size, 3);
  store.clear();
  assertEquals(store.size, 0);
});

Deno.test("SessionStore - unique session IDs", () => {
  const store = new SessionStore();
  const ids = new Set<string>();

  for (let i = 0; i < 100; i++) {
    const session = store.create("telegram");
    ids.add(session.id);
  }

  // All 100 IDs should be unique
  assertEquals(ids.size, 100);
});
