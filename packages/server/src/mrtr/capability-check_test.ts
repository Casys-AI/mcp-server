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
    // The missing key is the method name itself (since no mapping exists).
    assertEquals(result.missingCapabilities, ["unknown/method"]);
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
