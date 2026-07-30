/**
 * Capability check for MRTR inputRequests (spec 2026-07-28, SEP-2322).
 *
 * Rule 7 (MUST NOT): "Servers MUST NOT emit an inputRequest for a capability
 * the client has not declared in io.modelcontextprotocol/clientCapabilities."
 *
 * In the stateless transport model, `clientCapabilities` is per-request: it
 * arrives in `params._meta["io.modelcontextprotocol/clientCapabilities"]` and
 * is therefore already parsed by the time this check runs. There is no session
 * to cache it from — each call carries its own capability declaration.
 *
 * The function is pure: it takes the data it needs and returns a typed result.
 * No network, no server state, no side effects.
 *
 * @module lib/server/mrtr/capability-check
 */

import type { InputRequestEntry } from "./types.ts";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Successful capability check — all methods map to declared capabilities. */
export interface CapabilityCheckOk {
  readonly ok: true;
}

/** Failed capability check — one or more capabilities are missing. */
export interface CapabilityCheckFail {
  readonly ok: false;
  /**
   * Top-level `ClientCapabilities` keys the client did not declare but the
   * `inputRequests` map requires.
   *
   * Forward these directly into `-32021 MissingRequiredClientCapabilityError`
   * as `data.requiredCapabilities` (spec 2026-07-28 §per-request protocol fields).
   *
   * Example: `["sampling", "elicitation"]` if both are absent.
   */
  readonly missingCapabilities: string[];
}

export type CapabilityCheckResult = CapabilityCheckOk | CapabilityCheckFail;

// ── Method → capability mapping ───────────────────────────────────────────────
//
// Spec 2026-07-28: only these three methods are legal in `inputRequests`.
// Any unrecognised method is treated as a missing capability (fail-safe): an
// unknown method is a server-authoring error, and the spec forbids emitting it
// on the wire. Rejecting it here prevents that wire violation.

const METHOD_TO_CAPABILITY: Readonly<Record<string, string>> = {
  "elicitation/create": "elicitation",
  "sampling/createMessage": "sampling",
  "roots/list": "roots",
};

// ── checkInputRequestCapabilities ─────────────────────────────────────────────

/**
 * Verify that every `inputRequest` entry maps to a capability the client declared.
 *
 * Mapping (spec 2026-07-28):
 *   elicitation/create   → clientCapabilities.elicitation
 *   sampling/createMessage → clientCapabilities.sampling
 *   roots/list           → clientCapabilities.roots
 *
 * Unknown methods fail-safe: the spec only permits the three methods above.
 * An unknown method in `inputRequests` is a server-authoring bug and is
 * rejected here before it reaches the wire.
 *
 * @param inputRequests       - The map from the handler's `InputRequiredSignal`.
 * @param clientCapabilities  - Parsed from `params._meta[STATELESS_CLIENT_CAPABILITIES_KEY]`.
 *                               `undefined` when the client sent no `_meta` at all —
 *                               treated as "no capabilities declared".
 * @returns `{ ok: true }` or `{ ok: false, missingCapabilities: string[] }`.
 */
export function checkInputRequestCapabilities(
  inputRequests: Record<string, InputRequestEntry>,
  clientCapabilities: Record<string, unknown> | undefined,
): CapabilityCheckResult {
  // Collect every capability key that is required by the inputRequests.
  // Use a Set to deduplicate: multiple slots may require the same capability.
  const required = new Set<string>();
  for (const entry of Object.values(inputRequests)) {
    const capKey = METHOD_TO_CAPABILITY[entry.method];
    if (capKey === undefined) {
      // Unknown method — conservatively map to the method name itself so the
      // error response identifies which unrecognised method caused the failure.
      required.add(entry.method);
    } else {
      required.add(capKey);
    }
  }

  if (required.size === 0) {
    // Empty inputRequests map — nothing to check
    return { ok: true };
  }

  const missing: string[] = [];
  for (const capKey of required) {
    // The client "declared" the capability when its key is present in
    // `clientCapabilities` with any value (including `{}`). An absent key or
    // an undefined `clientCapabilities` object means "not declared".
    const declared = clientCapabilities !== undefined &&
      Object.hasOwn(clientCapabilities, capKey);
    if (!declared) missing.push(capKey);
  }

  if (missing.length > 0) {
    return { ok: false, missingCapabilities: missing };
  }
  return { ok: true };
}
