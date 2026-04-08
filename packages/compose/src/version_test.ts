/**
 * Drift test for the package version constant.
 *
 * Asserts that `COMPOSE_VERSION` in `version.ts` matches the `version`
 * field in `packages/compose/deno.json`. If this test fails, it means
 * someone bumped the package version in `deno.json` but forgot to update
 * `version.ts` (or vice versa) — both must move in lockstep because
 * `version.ts` is imported by runtime code that needs the value.
 *
 * @module lib/version_test
 */

import { assertEquals } from "@std/assert";
import { COMPOSE_VERSION } from "./version.ts";

Deno.test("COMPOSE_VERSION matches packages/compose/deno.json", async () => {
  // Resolve deno.json relative to this test file so it works regardless of cwd.
  const denoJsonUrl = new URL("../deno.json", import.meta.url);
  const denoJsonText = await Deno.readTextFile(denoJsonUrl);
  const denoJson = JSON.parse(denoJsonText) as { version: string };

  assertEquals(
    COMPOSE_VERSION,
    denoJson.version,
    `Drift detected: src/version.ts has COMPOSE_VERSION="${COMPOSE_VERSION}" ` +
      `but deno.json has version="${denoJson.version}". ` +
      `Both files must be bumped together.`,
  );
});
