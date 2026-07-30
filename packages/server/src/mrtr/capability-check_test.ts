/**
 * Tests for checkInputRequestCapabilities (Track B, spec 2026-07-28 MRTR rule 7).
 *
 * Covers every capability mapping, missing-capability detection, unknown method
 * rejection, and the edge case of an absent clientCapabilities object.
 */

import { assertEquals } from "@std/assert";
import { checkInputRequestCapabilities } from "./capability-check.ts";
import type { InputRequestEntry } from "./types.ts";

// ── Helpers ───────────────────────────────────────────────────────────────────

function elicit(key: string): Record<string, InputRequestEntry> {
  return { [key]: { method: "elicitation/create", params: {} } };
}

function sample(key: string): Record<string, InputRequestEntry> {
  return { [key]: { method: "sampling/createMessage", params: {} } };
}

function roots(key: string): Record<string, InputRequestEntry> {
  return { [key]: { method: "roots/list", params: {} } };
}

// ── All capabilities present ──────────────────────────────────────────────────

Deno.test("checkInputRequestCapabilities — all capabilities present", () => {
  const requests: Record<string, InputRequestEntry> = {
    a: { method: "elicitation/create", params: {} },
    b: { method: "sampling/createMessage", params: {} },
    c: { method: "roots/list", params: {} },
  };
  const caps = { elicitation: {}, sampling: {}, roots: {} };
  const result = checkInputRequestCapabilities(requests, caps);
  assertEquals(result.ok, true);
});

// ── Single capability absent ──────────────────────────────────────────────────

Deno.test("checkInputRequestCapabilities — elicitation absent", () => {
  const result = checkInputRequestCapabilities(
    elicit("req1"),
    { sampling: {}, roots: {} },
  );
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.missingCapabilities, ["elicitation"]);
  }
});

Deno.test("checkInputRequestCapabilities — sampling absent", () => {
  const result = checkInputRequestCapabilities(
    sample("req1"),
    { elicitation: {}, roots: {} },
  );
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.missingCapabilities, ["sampling"]);
  }
});

Deno.test("checkInputRequestCapabilities — roots absent", () => {
  const result = checkInputRequestCapabilities(
    roots("req1"),
    { elicitation: {}, sampling: {} },
  );
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.missingCapabilities, ["roots"]);
  }
});

// ── Multiple capabilities absent ──────────────────────────────────────────────

Deno.test("checkInputRequestCapabilities — sampling and elicitation absent", () => {
  const requests: Record<string, InputRequestEntry> = {
    a: { method: "elicitation/create", params: {} },
    b: { method: "sampling/createMessage", params: {} },
  };
  const result = checkInputRequestCapabilities(requests, { roots: {} });
  assertEquals(result.ok, false);
  if (!result.ok) {
    // Order is Set iteration order (insertion), so sort for assertion stability.
    const sorted = [...result.missingCapabilities].sort();
    assertEquals(sorted, ["elicitation", "sampling"]);
  }
});

// ── No clientCapabilities object at all ──────────────────────────────────────

Deno.test("checkInputRequestCapabilities — undefined clientCapabilities fails for any method", () => {
  const result = checkInputRequestCapabilities(elicit("req1"), undefined);
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.missingCapabilities, ["elicitation"]);
  }
});

Deno.test("checkInputRequestCapabilities — empty clientCapabilities fails", () => {
  const result = checkInputRequestCapabilities(sample("req1"), {});
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.missingCapabilities, ["sampling"]);
  }
});

// ── Unknown method fails-safe ─────────────────────────────────────────────────
// An unknown method is a server-authoring bug. It must be caught before the
// wire response so the client never receives an illegal inputRequest type.

Deno.test("checkInputRequestCapabilities — unknown method rejected fail-safe", () => {
  const requests: Record<string, InputRequestEntry> = {
    x: {
      // Cast through unknown to simulate a handler returning an illegal method.
      method: "unknown/method" as unknown as "elicitation/create",
      params: {},
    },
  };
  // Even with all known capabilities declared, the unknown method fails.
  const result = checkInputRequestCapabilities(
    requests,
    { elicitation: {}, sampling: {}, roots: {} },
  );
  assertEquals(result.ok, false);
  if (!result.ok) {
    // Reported as an unsupported METHOD rather than as a missing capability of
    // that name. The previous behaviour mapped it to its own name, which a
    // client could "satisfy" by declaring a capability called "unknown/method" —
    // no capability at all.
    assertEquals(result.missingCapabilities, [
      "<unsupported inputRequest method: unknown/method>",
    ]);
  }
});

// ── Empty inputRequests (edge case) ──────────────────────────────────────────

Deno.test("checkInputRequestCapabilities — empty inputRequests always passes", () => {
  const result = checkInputRequestCapabilities({}, undefined);
  assertEquals(result.ok, true);
});

// ── Deduplication: same capability required by multiple slots ─────────────────

Deno.test("checkInputRequestCapabilities — two elicitation slots deduped in missing list", () => {
  const requests: Record<string, InputRequestEntry> = {
    a: { method: "elicitation/create", params: { prompt: "name?" } },
    b: { method: "elicitation/create", params: { prompt: "email?" } },
  };
  const result = checkInputRequestCapabilities(requests, {});
  assertEquals(result.ok, false);
  if (!result.ok) {
    // "elicitation" appears only once even though two slots require it.
    assertEquals(result.missingCapabilities, ["elicitation"]);
  }
});

// ── Capability declared as any truthy value ───────────────────────────────────

Deno.test("checkInputRequestCapabilities — capability declared as true passes", () => {
  const result = checkInputRequestCapabilities(
    elicit("req1"),
    { elicitation: true },
  );
  assertEquals(result.ok, true);
});

Deno.test("checkInputRequestCapabilities — capability declared as empty object passes", () => {
  const result = checkInputRequestCapabilities(
    elicit("req1"),
    { elicitation: {} },
  );
  assertEquals(result.ok, true);
});

// ── Sub-capabilities (round-2 finding) ───────────────────────────────────────

Deno.test("checkInputRequestCapabilities — URL elicitation needs elicitation.url", () => {
  // Declaring `elicitation` does not grant URL mode. Checking only the top-level
  // key let a server ask for a mode the client cannot service, stranding the
  // request exactly as an undeclared capability would.
  const requests: Record<string, InputRequestEntry> = {
    login: {
      method: "elicitation/create",
      params: { mode: "url", message: "Sign in", url: "https://example.test" },
    },
  };
  const withoutUrl = checkInputRequestCapabilities(requests, {
    elicitation: {},
  });
  assertEquals(withoutUrl.ok, false);
  if (!withoutUrl.ok) {
    assertEquals(withoutUrl.missingCapabilities, ["elicitation.url"]);
  }

  const withUrl = checkInputRequestCapabilities(requests, {
    elicitation: { url: {} },
  });
  assertEquals(withUrl.ok, true);

  // Form mode is unaffected by the url sub-capability.
  const formMode = checkInputRequestCapabilities({
    ask: { method: "elicitation/create", params: { mode: "form" } },
  }, { elicitation: {} });
  assertEquals(formMode.ok, true);
});

Deno.test("checkInputRequestCapabilities — tool-using sampling needs sampling.tools", () => {
  const requests: Record<string, InputRequestEntry> = {
    summary: {
      method: "sampling/createMessage",
      params: { messages: [], maxTokens: 10, tools: [{ name: "search" }] },
    },
  };
  const withoutTools = checkInputRequestCapabilities(requests, {
    sampling: {},
  });
  assertEquals(withoutTools.ok, false);
  if (!withoutTools.ok) {
    assertEquals(withoutTools.missingCapabilities, ["sampling.tools"]);
  }

  const withTools = checkInputRequestCapabilities(requests, {
    sampling: { tools: {} },
  });
  assertEquals(withTools.ok, true);

  // Plain sampling still only needs the top-level capability.
  const plain = checkInputRequestCapabilities({
    s: {
      method: "sampling/createMessage",
      params: { messages: [], maxTokens: 5 },
    },
  }, { sampling: {} });
  assertEquals(plain.ok, true);
});

// ── Round-3: the check must inspect what will actually be sent ────────────────

Deno.test("checkInputRequestCapabilities — a boxed String cannot smuggle url mode", () => {
  // `new String("url")` is not `=== "url"` but serialises to `"url"`. Checking the
  // live object while shipping the serialised one meant the check and the payload
  // could disagree — the gap a caller would use to obtain an input request the
  // client cannot service.
  const result = checkInputRequestCapabilities({
    login: {
      method: "elicitation/create",
      // deno-lint-ignore no-explicit-any
      params: { mode: new String("url") as any, message: "Sign in" },
    },
  }, { elicitation: {} });
  assertEquals(result.ok, false);
});

Deno.test("checkInputRequestCapabilities — a toJSON that adds tools cannot bypass sampling.tools", () => {
  // The field exists only after serialisation, so a live-value check never saw it.
  const params = {
    messages: [],
    maxTokens: 10,
    toJSON() {
      return { messages: [], maxTokens: 10, tools: [{ name: "search" }] };
    },
  };
  const result = checkInputRequestCapabilities({
    // deno-lint-ignore no-explicit-any
    s: { method: "sampling/createMessage", params: params as any },
  }, { sampling: {} });
  assertEquals(result.ok, false);
});

Deno.test("checkInputRequestCapabilities — unserialisable params are refused", () => {
  const circular: Record<string, unknown> = { mode: "form" };
  circular.self = circular;
  const result = checkInputRequestCapabilities({
    // deno-lint-ignore no-explicit-any
    k: { method: "elicitation/create", params: circular as any },
  }, { elicitation: {} });
  assertEquals(result.ok, false);
});

Deno.test("checkInputRequestCapabilities — a nested capability is reported nested", () => {
  // A flat "elicitation.url" key deserialises to {} on a typed client — it reads
  // as "nothing missing", the opposite of the message.
  const result = checkInputRequestCapabilities({
    login: {
      method: "elicitation/create",
      params: { mode: "url", message: "Sign in" },
    },
  }, { elicitation: {} });
  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.requiredCapabilities, { elicitation: { url: {} } });
  }
});

Deno.test("checkInputRequestCapabilities — a STATEFUL toJSON cannot differ between check and emit", () => {
  // The previous fix canonicalised for the check but the transport serialised the
  // original a second time — two serialisations, and a toJSON that returns
  // different values per call slips between them. A deterministic toJSON could not
  // detect this, which is why the earlier probe passed.
  let calls = 0;
  const params = {
    mode: "form",
    toJSON() {
      calls++;
      // Benign on the first call (the check), tool-using sampling on the second.
      return calls === 1
        ? { mode: "form", message: "hi" }
        : { mode: "form", message: "hi", tools: [{ name: "exec" }] };
    },
  };
  const result = checkInputRequestCapabilities({
    // deno-lint-ignore no-explicit-any
    k: { method: "sampling/createMessage", params: params as any },
  }, { sampling: {} });

  // Whatever the verdict, the caller must emit the clone the check inspected — so
  // the check is authoritative and a second serialisation never happens.
  assertEquals(result.ok, true, "first serialisation is benign");
  if (result.ok) {
    const emitted = result.canonicalRequests as Record<
      string,
      { params: Record<string, unknown> }
    >;
    assertEquals(
      emitted.k.params.tools,
      undefined,
      "the emitted payload must be the checked one, not a fresh serialisation",
    );
  }
});

Deno.test("checkInputRequestCapabilities — params: null is refused, absent params is not", () => {
  // The two are not equivalent: omitting `params` says the request needs none,
  // while `params: null` asserts a value the schema types as an object. Accepting
  // null would mean the sub-capability checks silently do not run for a request
  // that looks like it declared something.
  const withNull = checkInputRequestCapabilities({
    // deno-lint-ignore no-explicit-any
    k: { method: "elicitation/create", params: null as any },
  }, { elicitation: {} });
  assertEquals(withNull.ok, false);

  const withoutParams = checkInputRequestCapabilities({
    // deno-lint-ignore no-explicit-any
    k: { method: "elicitation/create" } as any,
  }, { elicitation: {} });
  assertEquals(withoutParams.ok, true);
});
