# Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate mcp-server, mcp-compose, and mcp-bridge into a single Deno workspace monorepo under `packages/`.

**Architecture:** Move current mcp-server code into `packages/server/`, import mcp-compose and mcp-bridge via `git subtree add` into `packages/compose/` and `packages/bridge/`, create a root `deno.json` with workspace config, clean up cross-package imports, and unify CI.

**Tech Stack:** Deno workspaces, git subtree, GitHub Actions, JSR, npm

---

### Task 1: Create the `packages/server/` directory and move mcp-server code

**Files:**
- Create: `packages/server/` (directory)
- Move: `mod.ts`, `src/`, `scripts/`, `deno.json`, `deno.lock`, `README.md`, `LICENSE`, `CHANGELOG.md` → `packages/server/`
- Keep at root: `docs/`, `CLAUDE.md`, `AGENTS.md`

- [ ] **Step 1: Create `packages/server/` directory**

```bash
mkdir -p packages/server
```

- [ ] **Step 2: Move mcp-server source files into `packages/server/`**

```bash
git mv mod.ts packages/server/
git mv src/ packages/server/
git mv scripts/ packages/server/
git mv deno.json packages/server/
git mv deno.lock packages/server/
git mv README.md packages/server/
git mv LICENSE packages/server/
git mv CHANGELOG.md packages/server/
```

- [ ] **Step 3: Move `.github/` temporarily out of the way**

We'll recreate the CI later. Keep it for reference:

```bash
mkdir -p _old_ci
git mv .github/workflows/publish.yml _old_ci/publish-server.yml
```

- [ ] **Step 4: Move CLAUDE.md and AGENTS.md to root (they apply to the whole repo)**

These stay at the root — they'll be updated in a later task:

```bash
# CLAUDE.md and AGENTS.md are already at root, leave them
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: move mcp-server code into packages/server/"
```

---

### Task 2: Import mcp-compose via git subtree

**Files:**
- Create: `packages/compose/` (entire subtree from mcp-compose repo)

- [ ] **Step 1: Add mcp-compose as a subtree**

```bash
git subtree add --prefix=packages/compose https://github.com/Casys-AI/mcp-compose.git main --squash
```

The `--squash` flag creates a single merge commit instead of pulling the entire history inline (keeps the log cleaner while preserving a reference to the source).

- [ ] **Step 2: Remove mcp-compose's own CI (will be replaced by unified CI)**

```bash
rm -rf packages/compose/.github
git add packages/compose/.github
git commit -m "chore: remove mcp-compose standalone CI"
```

- [ ] **Step 3: Remove mcp-compose's `_reference/` directory if not needed**

```bash
rm -rf packages/compose/_reference
git add packages/compose/_reference
git commit -m "chore: remove _reference dir from compose"
```

---

### Task 3: Import mcp-bridge via git subtree

**Files:**
- Create: `packages/bridge/` (entire subtree from mcp-bridge repo)

- [ ] **Step 1: Add mcp-bridge as a subtree**

```bash
git subtree add --prefix=packages/bridge https://github.com/Casys-AI/mcp-bridge.git main --squash
```

- [ ] **Step 2: Remove mcp-bridge's own CI**

```bash
rm -rf packages/bridge/.github
git add packages/bridge/.github
git commit -m "chore: remove mcp-bridge standalone CI"
```

- [ ] **Step 3: Ensure `.env` is gitignored**

mcp-bridge has a `.env` file. Add it to the root `.gitignore`:

```bash
echo "packages/bridge/.env" >> .gitignore
git add .gitignore
git commit -m "chore: gitignore bridge .env"
```

---

### Task 4: Create root `deno.json` with workspace config

**Files:**
- Create: `deno.json` (root)

- [ ] **Step 1: Create root `deno.json`**

Write this file at the repo root:

```json
{
  "workspace": [
    "./packages/server",
    "./packages/compose",
    "./packages/bridge"
  ]
}
```

- [ ] **Step 2: Verify Deno detects the workspace**

```bash
deno info
```

Expected: output mentions the 3 workspace members.

- [ ] **Step 3: Commit**

```bash
git add deno.json
git commit -m "feat: add root deno.json with workspace config"
```

---

### Task 5: Clean up import maps in each package

**Files:**
- Modify: `packages/server/deno.json`
- Modify: `packages/compose/deno.json`

- [ ] **Step 1: Remove explicit `@casys/mcp-compose` imports from server's `deno.json`**

In `packages/server/deno.json`, remove these 3 lines from `"imports"`:

```diff
  "imports": {
-   "@casys/mcp-compose": "jsr:@casys/mcp-compose@^0.3.0",
-   "@casys/mcp-compose/sdk": "jsr:@casys/mcp-compose@^0.3.0/sdk",
-   "@casys/mcp-compose/core": "jsr:@casys/mcp-compose@^0.3.0/core",
    "@modelcontextprotocol/sdk": "npm:@modelcontextprotocol/sdk@^1.27.0",
    "@std/assert": "jsr:@std/assert@^1",
    "ajv": "npm:ajv@^8.17.1",
    "hono": "npm:hono@^4",
    "hono/cors": "npm:hono@^4/cors",
    "jose": "npm:jose@^6.0.0",
    "@opentelemetry/api": "npm:@opentelemetry/api@^1.9.0",
    "@std/yaml": "jsr:@std/yaml@^1"
  }
```

- [ ] **Step 2: Remove local path hack from compose's `deno.json`**

In `packages/compose/deno.json`, remove this line from `"imports"`:

```diff
  "imports": {
    "@std/assert": "jsr:@std/assert@^1.0.0",
    "@std/yaml": "jsr:@std/yaml@^1.0.0",
-   "@casys/mcp-server": "../mcp-server/mod.ts",
    "@modelcontextprotocol/sdk": "npm:@modelcontextprotocol/sdk@^1.27.0",
    "ajv": "npm:ajv@^8.17.1",
    "hono": "npm:hono@^4",
    "hono/cors": "npm:hono@^4/cors",
    "jose": "npm:jose@^6.0.0",
    "@opentelemetry/api": "npm:@opentelemetry/api@^1.9.0"
  }
```

- [ ] **Step 3: Commit**

```bash
git add packages/server/deno.json packages/compose/deno.json
git commit -m "refactor: remove cross-package import hacks, rely on workspace resolution"
```

---

### Task 6: Verify workspace resolution works

- [ ] **Step 1: Check that server can resolve compose imports**

```bash
deno check packages/server/mod.ts
```

Expected: no errors. `@casys/mcp-compose` resolves to `packages/compose/mod.ts` via workspace.

- [ ] **Step 2: Check that compose can resolve server imports**

```bash
deno check packages/compose/mod.ts
```

Expected: no errors. `@casys/mcp-server` resolves to `packages/server/mod.ts` via workspace.

- [ ] **Step 3: Check bridge independently**

```bash
deno check packages/bridge/src/mod.ts
```

Expected: no errors.

- [ ] **Step 4: Run tests for each package**

```bash
cd packages/server && deno task test
cd ../compose && deno task test
cd ../bridge && deno task test
```

Expected: all tests pass.

- [ ] **Step 5: If any check/test fails, fix the import issue and re-run**

Common issue: workspace resolution may require the import specifier to match the package's `exports` exactly. If `@casys/mcp-compose/sdk` doesn't resolve, verify that `packages/compose/deno.json` has `"./sdk"` in its `"exports"` map.

---

### Task 7: Adapt build scripts for new paths

**Files:**
- Modify: `packages/server/scripts/build-node.sh` (if needed)
- Modify: `packages/bridge/scripts/build-npm.ts` (if needed)

- [ ] **Step 1: Verify server's `build-node.sh` still works**

The script uses `$SCRIPT_DIR/..` to find ROOT_DIR, which will resolve to `packages/server/`. This should work without changes. Verify:

```bash
cd packages/server && bash scripts/build-node.sh
```

Expected: `dist-node/` created inside `packages/server/`.

- [ ] **Step 2: Verify bridge's `build-npm.ts` still works**

The script uses relative paths (`./dist-node`, `./src/mod.ts`). It should work when run from `packages/bridge/`. Verify:

```bash
cd packages/bridge && deno run -A scripts/build-npm.ts
```

Expected: `dist-node/` created inside `packages/bridge/`.

- [ ] **Step 3: Update bridge's `build-npm.ts` repository URL**

In `packages/bridge/scripts/build-npm.ts`, the repo URL still points to the old repo. Update:

```diff
    repository: {
      type: "git",
-     url: "https://github.com/Casys-AI/mcp-bridge",
+     url: "https://github.com/Casys-AI/mcp-server",
    },
```

- [ ] **Step 4: Commit if any changes were made**

```bash
git add packages/bridge/scripts/build-npm.ts
git commit -m "chore: update bridge build script repo URL"
```

---

### Task 8: Create unified CI workflow

**Files:**
- Create: `.github/workflows/publish.yml`
- Delete: `_old_ci/` (reference no longer needed)

- [ ] **Step 1: Create `.github/workflows/publish.yml`**

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
          cd packages/server
          bash scripts/build-node.sh
          cd dist-node
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
          cd packages/bridge
          deno run -A scripts/build-npm.ts
          cd dist-node
          npm publish --access public || echo "Version already published, skipping"
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 2: Remove old CI reference**

```bash
rm -rf _old_ci
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/publish.yml
git rm -rf _old_ci
git commit -m "ci: unified publish workflow for all workspace packages"
```

---

### Task 9: Update root CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update CLAUDE.md to reflect the monorepo structure**

Key changes:
- Update project overview to mention all 3 packages
- Update commands section with per-package test commands
- Update architecture section with workspace layout
- Update file paths to use `packages/server/`, `packages/compose/`, `packages/bridge/` prefixes
- Remove the "local sibling dependency" note (replaced by workspace)

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for monorepo structure"
```

---

### Task 10: Dry-run publish and final verification

- [ ] **Step 1: Verify JSR publish with dry-run**

```bash
npx jsr publish --dry-run
```

Expected: lists all 3 packages with their versions, no errors.

- [ ] **Step 2: Verify npm build for server**

```bash
cd packages/server && bash scripts/build-node.sh
ls dist-node/package.json
```

Expected: `package.json` with name `@casys/mcp-server`.

- [ ] **Step 3: Verify npm build for bridge**

```bash
cd packages/bridge && deno run -A scripts/build-npm.ts
ls dist-node/package.json
```

Expected: `package.json` with name `@casys/mcp-bridge`.

- [ ] **Step 4: Run all tests one final time**

```bash
cd packages/server && deno task test
cd ../compose && deno task test
cd ../bridge && deno task test
```

Expected: all green.

- [ ] **Step 5: Clean up dist-node directories**

```bash
rm -rf packages/server/dist-node packages/bridge/dist-node
```

---

### Task 11: Archive old repos

- [ ] **Step 1: Update README on mcp-compose repo**

On the `mcp-compose` repo, add a notice at the top of README.md:

```markdown
> **This repository has been archived.** Development continues in the monorepo: [Casys-AI/mcp-server](https://github.com/Casys-AI/mcp-server/tree/main/packages/compose)
```

- [ ] **Step 2: Update README on mcp-bridge repo**

Same treatment for mcp-bridge:

```markdown
> **This repository has been archived.** Development continues in the monorepo: [Casys-AI/mcp-server](https://github.com/Casys-AI/mcp-server/tree/main/packages/bridge)
```

- [ ] **Step 3: Archive both repos on GitHub**

```bash
gh repo archive Casys-AI/mcp-compose --yes
gh repo archive Casys-AI/mcp-bridge --yes
```

- [ ] **Step 4: Final commit on monorepo if needed, then push**

```bash
git push origin main
```
