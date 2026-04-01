# Monorepo Migration Design

**Date:** 2026-04-01
**Status:** Draft
**Scope:** Consolidate `mcp-server`, `mcp-compose`, and `mcp-bridge` into a single monorepo using Deno workspaces.

## Context

The three packages (`@casys/mcp-server`, `@casys/mcp-compose`, `@casys/mcp-bridge`) currently live in separate GitHub repos under `Casys-AI/`. They have fragile cross-dependencies via local paths (`../mcp-server/mod.ts` in compose, JSR import in server). This migration unifies them into a single repo with Deno workspace support, eliminating path hacks while keeping independent versioning and publishing.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Target repo | `Casys-AI/mcp-server` (existing) | Keeps GitHub stars, issues, links intact |
| Directory layout | `packages/` subfolder | Standard monorepo structure, no ambiguity |
| Migration strategy | `git subtree add` | Preserves full git history of all repos |
| Old repos | Archive (read-only) | Links stay valid, reversible |
| Package names | Unchanged | No breaking change for consumers |

## Target Structure

```
mcp-server/
├── deno.json                     # workspace root (no name/version)
├── packages/
│   ├── server/
│   │   ├── deno.json             # @casys/mcp-server v0.12.0
│   │   ├── mod.ts
│   │   ├── src/
│   │   └── scripts/build-node.sh
│   ├── compose/
│   │   ├── deno.json             # @casys/mcp-compose v0.3.0
│   │   ├── mod.ts
│   │   └── src/
│   └── bridge/
│       ├── deno.json             # @casys/mcp-bridge v0.2.0
│       ├── src/
│       └── scripts/build-npm.ts
```

## Root `deno.json`

```json
{
  "workspace": [
    "./packages/server",
    "./packages/compose",
    "./packages/bridge"
  ]
}
```

No `name`, `version`, or `imports` at the root. Each package owns its own config. Deno workspace resolution means `@casys/mcp-server` imported from compose resolves to `packages/server/mod.ts` automatically.

## Import Map Changes

### `packages/server/deno.json`

Remove the explicit `@casys/mcp-compose` imports — the workspace resolves them:

```diff
- "@casys/mcp-compose": "jsr:@casys/mcp-compose@^0.3.0",
- "@casys/mcp-compose/sdk": "jsr:@casys/mcp-compose@^0.3.0/sdk",
- "@casys/mcp-compose/core": "jsr:@casys/mcp-compose@^0.3.0/core",
```

### `packages/compose/deno.json`

Remove the local path hack — the workspace resolves it:

```diff
- "@casys/mcp-server": "../mcp-server/mod.ts",
```

### `packages/bridge/deno.json`

No changes needed — no cross-dependencies.

## CI: Unified `publish.yml`

Single workflow replaces three separate ones:

```yaml
name: Publish

on:
  push:
    branches: [main]

jobs:
  publish-jsr:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v5
      - name: Publish all packages to JSR
        run: npx jsr publish
        # Publishes all workspace members whose version isn't already on JSR.
        # Already-published versions are skipped automatically.

  publish-npm-server:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          registry-url: "https://registry.npmjs.org"
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
      - name: Build and publish @casys/mcp-server to npm
        run: |
          bash packages/server/scripts/build-node.sh
          cd packages/server/dist-node
          npm install
          npm publish --access public || echo "Version already published, skipping"
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

  publish-npm-bridge:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          registry-url: "https://registry.npmjs.org"
      - uses: denoland/setup-deno@v2
        with:
          deno-version: v2.x
      - name: Build and publish @casys/mcp-bridge to npm
        run: |
          deno run -A packages/bridge/scripts/build-npm.ts
          cd packages/bridge/dist-node
          npm publish --access public || echo "Version already published, skipping"
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Note: `@casys/mcp-compose` is JSR-only — no npm job needed.

## Migration Steps

1. **Move** current `mcp-server` code into `packages/server/`
2. **Git subtree add** `mcp-compose` into `packages/compose/`
3. **Git subtree add** `mcp-bridge` into `packages/bridge/`
4. **Create** root `deno.json` with workspace config
5. **Clean up** import maps in each package's `deno.json`
6. **Adapt** build scripts (paths relative to new locations)
7. **Unify** CI into single `publish.yml`
8. **Update** CLAUDE.md for new structure
9. **Verify** `deno task test` from each package + `npx jsr publish --dry-run`
10. **Archive** old `mcp-compose` and `mcp-bridge` repos with redirect README

## What Does NOT Change

- Package names: `@casys/mcp-server`, `@casys/mcp-compose`, `@casys/mcp-bridge`
- Package versions: each keeps its own semver
- Publishing targets: JSR for all, npm for server + bridge
- Public API surface of any package
- License (MIT)

## Risks

| Risk | Mitigation |
|------|------------|
| `npx jsr publish` workspace support | Test with `--dry-run` before merging |
| Build scripts assume root-level paths | Audit and fix relative paths in step 6 |
| CLAUDE.md references become stale | Update in step 8 |
| Open PRs/issues on old repos | Close/migrate before archiving |
