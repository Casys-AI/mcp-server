# MCP Compose Clean Break Implementation Plan

> **Status: Completed (2026-03-19).** All tasks executed. Renderer has since moved to `host/`.

**Goal:** Finish the `lib/mcp-compose` refactor as a clean break, remove legacy duplicate trees, establish `core / sdk / host` as the only real structure, and make `lib/server` consume the sync/UI contract from `mcp-compose/core`.

**Architecture:** `mcp-compose` becomes the source of truth for composition semantics and sync event contracts. `server` remains a clean MCP server package that declares UI capabilities but imports the event contract types from `mcp-compose/core`. Legacy duplicate paths are deleted rather than shimmed.

**Tech Stack:** Deno, TypeScript, local `mod.ts` re-exports, colocated Deno tests, Markdown docs.

---

### Task 1: Audit the current tree and freeze the target structure

**Files:**
- Inspect: `src/`
- Inspect: `mod.ts`
- Inspect: `deno.json`
- Inspect: `src/core/**`
- Inspect: `src/sdk/**`
- Inspect: `src/host/**`

**Step 1: Write the target tree into the working notes**

Record the canonical structure:
- `src/core/types/*`
- `src/core/collector/*`
- `src/core/sync/*`
- `src/core/composer/*`
- `src/core/renderer/*`
- `src/sdk/*`
- `src/host/*`

**Step 2: Verify what legacy trees still exist**

Run: `find src -maxdepth 2 -type f | sort`
Expected: both canonical folders and legacy duplicate folders are present.

**Step 3: Verify tests/doc files missing from canonical folders**

Run: `find src/core src/sdk src/host -maxdepth 2 -type f | sort`
Expected: identify any missing `readme.md`, `contract.md`, `*_test.ts`, or `mod.ts`.

**Step 4: Commit the audit notes if you create any scratch doc**

```bash
git add <scratch-file-if-any>
git commit -m "chore: record clean-break target structure"
```

### Task 2: Remove legacy duplicate implementation trees

**Files:**
- Delete: `src/types/*`
- Delete: `src/collector/*`
- Delete: `src/sync/*`
- Delete: `src/composer/*`
- Delete: `src/renderer/*`
- Verify remaining canonical implementations in `src/core/**`

**Step 1: Confirm canonical copies exist before deletion**

Run: `test -f src/core/types/mod.ts && test -f src/core/collector/mod.ts && test -f src/core/sync/mod.ts && test -f src/core/composer/mod.ts && test -f src/core/renderer/mod.ts`
Expected: exit 0.

**Step 2: Delete the legacy duplicate trees**

Run:
```bash
rm -rf src/types src/collector src/sync src/composer src/renderer
```

**Step 3: Re-list the source tree**

Run: `find src -maxdepth 3 -type f | sort`
Expected: only `core`, `sdk`, `host`, fixtures/tests/docs, and top-level intentional files remain.

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy mcp-compose duplicate trees"
```

### Task 3: Normalize public exports to the new architecture

**Files:**
- Modify: `mod.ts`
- Modify: `src/core/mod.ts`
- Modify: `src/sdk/mod.ts`
- Modify: `src/host/mod.ts`
- Modify: `src/adapters/mod.ts` or delete it if obsolete

**Step 1: Write/adjust failing import smoke test if missing**

If no import-shape test exists, create one:
- Create: `src/architecture_test.ts`

```ts
import * as pkg from "../mod.ts";
import * as core from "./core/mod.ts";
import * as sdk from "./sdk/mod.ts";
import * as host from "./host/mod.ts";

Deno.test("public module structure exports canonical entrypoints", () => {
  if (!pkg || !core || !sdk || !host) throw new Error("missing exports");
});
```

**Step 2: Run the smoke test and capture failures**

Run: `deno test src/architecture_test.ts`
Expected: FAIL until all exports are fixed.

**Step 3: Update export files**

Rules:
- root `mod.ts` re-exports the intended public API only
- `src/core/mod.ts` re-exports composition primitives
- `src/sdk/mod.ts` re-exports SDK adapters only
- `src/host/mod.ts` re-exports host contracts only
- delete or stop exporting legacy alias entrypoints not aligned with the new architecture

**Step 4: Re-run the smoke test**

Run: `deno test src/architecture_test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add mod.ts src/architecture_test.ts src/core/mod.ts src/sdk/mod.ts src/host/mod.ts src/adapters/mod.ts
git commit -m "refactor: normalize mcp-compose public exports"
```

### Task 4: Make `core` the single source of truth for sync/UI contracts

**Files:**
- Modify: `src/core/types/*.ts`
- Modify: `src/core/sync/*.ts`
- Modify: `src/core/renderer/js/event-bus.ts`
- Inspect: `src/core/types/sync-rules.ts`
- Inspect: `src/core/types/orchestration.ts`
- Inspect: `src/core/types/resources.ts`

**Step 1: Write a failing test for the shared contract if missing**

Preferred location:
- Create/Modify: `src/core/sync/sync_test.ts`

Add a test ensuring the sync/event contract is imported from one canonical module and used by resolution/renderer without local duplication.

**Step 2: Run the targeted test**

Run: `deno test src/core/sync/sync_test.ts src/core/renderer/renderer_test.ts`
Expected: FAIL if any stale local type path or duplicated contract remains.

**Step 3: Refactor the core contract**

Rules:
- keep sync event vocabulary and shape in `src/core/**`
- ensure renderer/event-bus consumes the same canonical types
- remove any duplicate or dangling type definitions elsewhere in `mcp-compose`

**Step 4: Re-run targeted tests**

Run: `deno test src/core/sync/sync_test.ts src/core/renderer/renderer_test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/core/types src/core/sync src/core/renderer
git commit -m "refactor: centralize sync contract in mcp-compose core"
```

### Task 5: Update SDK adapter imports and tests after the clean break

**Files:**
- Modify: `src/sdk/mcp-sdk.ts`
- Modify: `src/sdk/mcp-sdk_test.ts`
- Inspect: `src/sdk/mod.ts`

**Step 1: Write or update failing SDK adapter test**

Ensure imports come from canonical `core` modules only.

Example assertion target:
```ts
Deno.test("sdk adapter delegates to core collector", () => {
  // Existing adapter tests should validate canonical delegation.
});
```

**Step 2: Run SDK tests**

Run: `deno test src/sdk/mcp-sdk_test.ts`
Expected: FAIL if stale paths remain.

**Step 3: Fix SDK imports**

Rules:
- SDK layer imports only from `src/core/**`
- no references to removed legacy paths

**Step 4: Re-run SDK tests**

Run: `deno test src/sdk/mcp-sdk_test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/sdk
git commit -m "refactor: align sdk adapter with canonical core layout"
```

### Task 6: Fill in docs and contracts for every major folder

**Files:**
- Create/Modify: `src/readme.md`
- Create/Modify: `src/contract.md`
- Create/Modify: `src/core/readme.md`
- Create/Modify: `src/core/contract.md`
- Create/Modify: `src/core/types/readme.md`
- Create/Modify: `src/core/types/contract.md`
- Create/Modify: `src/core/collector/readme.md`
- Create/Modify: `src/core/collector/contract.md`
- Create/Modify: `src/core/sync/readme.md`
- Create/Modify: `src/core/sync/contract.md`
- Create/Modify: `src/core/composer/readme.md`
- Create/Modify: `src/core/composer/contract.md`
- Create/Modify: `src/core/renderer/readme.md`
- Create/Modify: `src/core/renderer/contract.md`
- Create/Modify: `src/sdk/readme.md`
- Create/Modify: `src/sdk/contract.md`
- Create/Modify: `src/host/readme.md`
- Create/Modify: `src/host/contract.md`

**Step 1: Write missing docs first**

Each doc should state:
- role of the folder
- inputs
- outputs
- invariants
- dependency constraints

**Step 2: Verify every major folder has both docs**

Run:
```bash
for d in src src/core src/core/types src/core/collector src/core/sync src/core/composer src/core/renderer src/sdk src/host; do
  test -f "$d/readme.md" && test -f "$d/contract.md" || { echo "missing docs in $d"; exit 1; }
done
```
Expected: exit 0.

**Step 3: Commit**

```bash
git add src/readme.md src/contract.md src/core src/sdk src/host
git commit -m "docs: add canonical module contracts for mcp-compose"
```

### Task 7: Update `lib/server` to consume the shared UI/sync contract

**Files:**
- Modify: `../server/src/types.ts`
- Modify: `../server/src/tools-meta_test.ts`
- Modify: `../server/mod.ts` if re-exports need adjustment
- Inspect: `../server/deno.json`
- Inspect: `../server/README.md`

**Step 1: Write a failing test in server**

Update or add a test proving that UI metadata still accepts the same shape after importing the contract from `mcp-compose/core`.

Example target:
```ts
Deno.test("server MCP UI metadata uses shared contract types", () => {
  const meta = {
    ui: {
      resourceUri: "ui://test/viewer",
      emits: ["filter"],
      accepts: ["setData"],
    },
  };
  if (!meta.ui) throw new Error("missing ui meta");
});
```

**Step 2: Run the targeted server test**

Run: `cd ../server && deno test src/tools-meta_test.ts`
Expected: FAIL until imports/types are updated.

**Step 3: Replace local sync/UI event typing with imports from `mcp-compose/core`**

Rules:
- keep server semantics the same from the caller perspective
- avoid importing renderer/host/runtime code
- prefer the narrowest possible import surface from `mcp-compose/core`

**Step 4: Re-run targeted server tests**

Run: `cd ../server && deno test src/tools-meta_test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
cd ../server
git add src/types.ts src/tools-meta_test.ts mod.ts deno.json README.md
git commit -m "refactor: import UI sync contract from mcp-compose core"
```

### Task 8: Verify ERP MCP Next dependency impact

**Files:**
- Inspect: consumer package imports in ERP MCP Next
- Inspect: any local package manifest / workspace config that resolves `server` and `mcp-compose`

**Step 1: Identify current ERP MCP Next import pattern**

Run a search in the consumer repo for imports from `lib/server` and `lib/mcp-compose`.

**Step 2: Verify the new `server -> mcp-compose/core` dependency does not pull unexpected runtime code**

Run the consumer typecheck/build command.
Expected: builds continue to pass or fail with a clear import-resolution problem.

**Step 3: Fix only genuine breakage**

Allowed fixes:
- package export path updates
- workspace path/reference updates
- type-only import cleanup

Not allowed:
- extracting a new shared package unless clearly necessary

**Step 4: Commit**

```bash
git add <consumer-files-if-changed>
git commit -m "build: align ERP MCP Next with mcp-compose core dependency"
```

### Task 9: Run the full test suite and final repo audit

**Files:**
- Verify: `mod.ts`
- Verify: `src/**`
- Verify: `../server/src/**`

**Step 1: Run mcp-compose tests**

Run: `deno test`
Expected: PASS.

**Step 2: Run server targeted tests or full suite as appropriate**

Run: `cd ../server && deno test`
Expected: PASS, or at minimum all tests touched by this refactor pass.

**Step 3: Audit the final tree**

Run:
```bash
find src -maxdepth 3 -type f | sort
```
Expected:
- only canonical folders remain
- tests are colocated
- docs/contracts exist in major folders
- no legacy duplicate trees remain

**Step 4: Inspect git diff for accidental churn**

Run: `git diff --stat HEAD~1..HEAD`
Expected: changes map cleanly to the refactor intent.

**Step 5: Final commit**

```bash
git add -A
git commit -m "refactor: finish mcp-compose clean break"
```
