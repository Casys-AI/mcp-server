/**
 * Tests for compose-events SDK helper.
 *
 * @module sdk/compose-events_test
 */

import { assertEquals, assertThrows } from "@std/assert";
import {
  COMPOSE_EVENT_METHOD,
  composeEvents,
} from "./compose-events.ts";
import type { ComposeSource, ComposeTarget } from "./compose-events.ts";

/** Create a mock parent window that records postMessage calls. */
function createMockParent(): ComposeTarget & { messages: unknown[] } {
  const messages: unknown[] = [];
  return {
    messages,
    postMessage(message: unknown, _targetOrigin: string) {
      messages.push(message);
    },
  };
}

/** Create a mock source window that manages message listeners. */
function createMockSource(): ComposeSource & {
  dispatch(data: unknown): void;
} {
  const listeners: Array<(e: MessageEvent) => void> = [];
  return {
    addEventListener(_type: "message", listener: (e: MessageEvent) => void) {
      listeners.push(listener);
    },
    removeEventListener(
      _type: "message",
      listener: (e: MessageEvent) => void,
    ) {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    dispatch(data: unknown) {
      const event = { data } as MessageEvent;
      for (const listener of listeners) {
        listener(event);
      }
    },
  };
}

/** Helper: create a valid compose event message. */
function composeMsg(
  action: string,
  data?: unknown,
  sourceSlot?: number,
  sharedContext?: Record<string, unknown>,
) {
  return {
    jsonrpc: "2.0",
    method: COMPOSE_EVENT_METHOD,
    params: { action, data, sourceSlot, sharedContext },
  };
}

// =============================================================================
// emit() tests
// =============================================================================

Deno.test("composeEvents.emit - sends ui/compose/event via postMessage", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  events.emit("invoice.selected", { invoiceId: "INV-001" });

  assertEquals(parent.messages.length, 1);
  const msg = parent.messages[0] as Record<string, unknown>;
  assertEquals(msg.jsonrpc, "2.0");
  assertEquals(msg.method, COMPOSE_EVENT_METHOD);
  assertEquals(
    (msg.params as Record<string, unknown>).event,
    "invoice.selected",
  );
  assertEquals((msg.params as Record<string, unknown>).data, {
    invoiceId: "INV-001",
  });
});

Deno.test("composeEvents.emit - sends event without data", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  events.emit("refresh");

  const msg = parent.messages[0] as Record<string, unknown>;
  const params = msg.params as Record<string, unknown>;
  assertEquals(params.event, "refresh");
  assertEquals(params.data, undefined);
});

Deno.test("composeEvents.emit - increments message IDs", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  events.emit("a", 1);
  events.emit("b", 2);

  const id1 = (parent.messages[0] as Record<string, unknown>).id as number;
  const id2 = (parent.messages[1] as Record<string, unknown>).id as number;
  assertEquals(id2 > id1, true);
});

Deno.test("composeEvents.emit - throws without parent", () => {
  const source = createMockSource();
  const events = composeEvents(undefined, source);

  assertThrows(
    () => events.emit("test"),
    Error,
    "No parent window available",
  );
});

// =============================================================================
// on() tests
// =============================================================================

Deno.test("composeEvents.on - receives matching action", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  const received: unknown[] = [];
  events.on("data.update", (payload) => received.push(payload));

  source.dispatch(composeMsg("data.update", { chart: "bar" }, 0, { wf: "1" }));

  assertEquals(received.length, 1);
  assertEquals(received[0], {
    data: { chart: "bar" },
    sourceSlot: 0,
    sharedContext: { wf: "1" },
  });
});

Deno.test("composeEvents.on - ignores non-matching action", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  const received: unknown[] = [];
  events.on("filter.apply", (payload) => received.push(payload));

  source.dispatch(composeMsg("data.update", {}));

  assertEquals(received.length, 0);
});

Deno.test("composeEvents.on - multiple handlers for same action", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  const a: unknown[] = [];
  const b: unknown[] = [];
  events.on("update", (p) => a.push(p));
  events.on("update", (p) => b.push(p));

  source.dispatch(composeMsg("update", "hello"));

  assertEquals(a.length, 1);
  assertEquals(b.length, 1);
});

Deno.test("composeEvents.on - different actions route independently", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  const aEvents: unknown[] = [];
  const bEvents: unknown[] = [];
  events.on("action-a", (p) => aEvents.push(p));
  events.on("action-b", (p) => bEvents.push(p));

  source.dispatch(composeMsg("action-a", 1));
  source.dispatch(composeMsg("action-b", 2));

  assertEquals(aEvents.length, 1);
  assertEquals(bEvents.length, 1);
});

// =============================================================================
// off (unsubscribe) tests
// =============================================================================

Deno.test("composeEvents.on - returns unsubscribe function", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  const received: unknown[] = [];
  const off = events.on("update", (p) => received.push(p));

  source.dispatch(composeMsg("update", 1));
  assertEquals(received.length, 1);

  off();

  source.dispatch(composeMsg("update", 2));
  assertEquals(received.length, 1); // unchanged
});

Deno.test("composeEvents.on - unsubscribe one handler keeps others", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  const a: unknown[] = [];
  const b: unknown[] = [];
  const offA = events.on("update", (p) => a.push(p));
  events.on("update", (p) => b.push(p));

  offA();

  source.dispatch(composeMsg("update", 1));

  assertEquals(a.length, 0);
  assertEquals(b.length, 1);
});

// =============================================================================
// destroy() tests
// =============================================================================

Deno.test("composeEvents.destroy - removes message listener", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  const received: unknown[] = [];
  events.on("update", (p) => received.push(p));

  events.destroy();

  source.dispatch(composeMsg("update", 1));
  assertEquals(received.length, 0);
});

// =============================================================================
// Edge cases / filtering
// =============================================================================

Deno.test("composeEvents.on - ignores non-object messages", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  const received: unknown[] = [];
  events.on("update", (p) => received.push(p));

  source.dispatch("not an object");
  source.dispatch(null);
  source.dispatch(42);

  assertEquals(received.length, 0);
});

Deno.test("composeEvents.on - ignores non-jsonrpc messages", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  const received: unknown[] = [];
  events.on("update", (p) => received.push(p));

  source.dispatch({ method: "ui/compose/event", params: { action: "update" } });

  assertEquals(received.length, 0);
});

Deno.test("composeEvents.on - ignores other JSON-RPC methods", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  const received: unknown[] = [];
  events.on("update", (p) => received.push(p));

  source.dispatch({
    jsonrpc: "2.0",
    method: "ui/notifications/tool-result",
    params: { action: "update" },
  });

  assertEquals(received.length, 0);
});

Deno.test("composeEvents.on - ignores compose events without action", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  const received: unknown[] = [];
  events.on("update", (p) => received.push(p));

  source.dispatch({
    jsonrpc: "2.0",
    method: COMPOSE_EVENT_METHOD,
    params: { data: "no action" },
  });

  assertEquals(received.length, 0);
});

Deno.test("composeEvents.on - ignores compose events with non-string action", () => {
  const parent = createMockParent();
  const source = createMockSource();
  const events = composeEvents(parent, source);

  const received: unknown[] = [];
  events.on("update", (p) => received.push(p));

  source.dispatch({
    jsonrpc: "2.0",
    method: COMPOSE_EVENT_METHOD,
    params: { action: 42, data: "wrong type" },
  });

  assertEquals(received.length, 0);
});
