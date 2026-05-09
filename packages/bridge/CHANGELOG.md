# Changelog

All notable changes to `@casys/mcp-bridge` will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
the project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **`scripts/build-npm.ts` no longer hardcodes the package version.** The script
  now reads `version` from `packages/bridge/deno.json` (single source of truth —
  same pattern as `packages/compose/scripts/build-npm.ts`). Previously every npm
  publish would have shipped `0.2.0` regardless of the value in `deno.json`.
  Pure build-time fix; no runtime impact.

## [0.2.0] - 2026-03-XX

Initial workspace release. The package was imported into the monorepo from a
standalone repository (`packages/bridge` was added via `git subtree`), and the
standalone CI was retired in favour of the central
`.github/workflows/publish.yml`.

Detailed history before the workspace import is preserved in the upstream
repository's git history. Future bumps will use scoped conventional commits
(`feat(bridge):`, `fix(bridge):`) so subsequent entries can be machine-extracted
via `git-cliff`.

### Public API surface (frozen)

`@casys/mcp-bridge` ships protocol utilities for bridging MCP Apps interactive
UIs to messaging platforms (Telegram Mini Apps, LINE LIFF). Server-side helpers
run under Deno; the npm package exposes the runtime-agnostic client and protocol
utilities (the resource server piece needs Deno because it uses `Deno.serve` /
`Deno.readTextFile`).

See `README.md` and `docs/` for usage.
