import { assertEquals, assertThrows } from "@std/assert";

import {
  COMPOSE_EVENT_METHOD,
  type ComposeEventSource,
  type ComposeEventTarget,
  createComposeEventClient,
} from "./compose-events.ts";

class FakeSource implements ComposeEventSource {
  listener?: (event: MessageEvent) => void;
  removed = 0;

  addEventListener(_type: "message", listener: (event: MessageEvent) => void): void {
    this.listener = listener;
  }

  removeEventListener(_type: "message", listener: (event: MessageEvent) => void): void {
    if (this.listener === listener) this.listener = undefined;
    this.removed++;
  }

  dispatch(data: unknown, source: MessageEventSource | null): void {
    this.listener?.({ data, source } as MessageEvent);
  }
}

class FakeTarget implements ComposeEventTarget {
  readonly messages: unknown[] = [];

  postMessage(message: unknown, _targetOrigin: string): void {
    this.messages.push(message);
  }
}

Deno.test("ComposeEventClient emits only ui/compose/event JSON-RPC messages", () => {
  const parent = new FakeTarget();
  const events = createComposeEventClient(parent, new FakeSource());

  events.emit("selection.changed", { id: "part-1" });

  assertEquals(parent.messages, [{
    jsonrpc: "2.0",
    method: COMPOSE_EVENT_METHOD,
    id: 1,
    params: { event: "selection.changed", data: { id: "part-1" } },
  }]);
});

Deno.test("ComposeEventClient validates incoming envelopes and accepts only the parent source", () => {
  const parent = new FakeTarget();
  const source = new FakeSource();
  const events = createComposeEventClient(parent, source);
  const seen: unknown[] = [];
  events.on("filter.apply", (payload) => seen.push(payload));

  const valid = {
    jsonrpc: "2.0",
    method: COMPOSE_EVENT_METHOD,
    params: {
      action: "filter.apply",
      data: { status: "open" },
      sourceSlot: 2,
      sharedContext: { project: "cm01" },
    },
  };
  source.dispatch(valid, {} as MessageEventSource);
  source.dispatch({ ...valid, jsonrpc: "1.0" }, parent as unknown as MessageEventSource);
  source.dispatch(
    { ...valid, params: { ...valid.params, sourceSlot: -1 } },
    parent as unknown as MessageEventSource,
  );
  source.dispatch(
    { ...valid, params: { ...valid.params, sharedContext: [] } },
    parent as unknown as MessageEventSource,
  );
  source.dispatch(valid, parent as unknown as MessageEventSource);

  assertEquals(seen, [{
    data: { status: "open" },
    sourceSlot: 2,
    sharedContext: { project: "cm01" },
  }]);
});

Deno.test("ComposeEventClient unsubscribe and destroy are idempotent", () => {
  const parent = new FakeTarget();
  const source = new FakeSource();
  const events = createComposeEventClient(parent, source);
  let count = 0;
  const off = events.on("refresh", () => count++);

  off();
  off();
  source.dispatch({
    jsonrpc: "2.0",
    method: COMPOSE_EVENT_METHOD,
    params: { action: "refresh" },
  }, parent as unknown as MessageEventSource);
  events.destroy();
  events.destroy();

  assertEquals(count, 0);
  assertEquals(source.removed, 1);
  assertThrows(() => events.emit("refresh"), Error, "destroyed");
  assertThrows(() => events.on("refresh", () => {}), Error, "destroyed");
});

Deno.test("ComposeEventClient rejects invalid outgoing event and action names", () => {
  const events = createComposeEventClient(new FakeTarget(), new FakeSource());
  assertThrows(() => events.emit(""), TypeError, "non-empty");
  assertThrows(() => events.on("  ", () => {}), TypeError, "non-empty");
});
