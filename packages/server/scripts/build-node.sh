#!/usr/bin/env bash
# Build @casys/mcp-server for Node.js distribution
#
# What this does:
# 1. Copies src/ and mod.ts to dist-node/
#    (runtime selection is handled at load time by src/runtime/runtime.ts,
#    which picks runtime.deno.ts or runtime.node.ts — no build-time swap)
# 2. Remaps Deno-ecosystem imports to npm equivalents:
#    - @std/yaml → yaml
# 3. Strips .ts extensions from relative imports (Node ESM convention)
#
# Usage:
#   cd lib/server && ./scripts/build-node.sh
#
# Output: dist-node/ ready for npm publish
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$ROOT_DIR/dist-node"

echo "[build-node] Building Node.js distribution for @casys/mcp-server..."

# Clean
rm -rf "$DIST_DIR"
mkdir -p "$DIST_DIR"

# Copy source files (exclude tests)
cp -r "$ROOT_DIR/src" "$DIST_DIR/src"
cp "$ROOT_DIR/mod.ts" "$DIST_DIR/mod.ts"

# Remove test files from dist
find "$DIST_DIR" -name "*_test.ts" -o -name "*.test.ts" -o -name "*.bench.ts" | xargs rm -f

# Portable in-place sed: GNU sed wants `-i`, BSD/macOS sed wants `-i ''`.
if sed --version >/dev/null 2>&1; then
  SED_INPLACE=(-i)
else
  SED_INPLACE=(-i '')
fi

# Remap Deno-ecosystem imports to npm equivalents
# @std/yaml → yaml (npm yaml package has same parse() API)
find "$DIST_DIR" -name "*.ts" -exec sed "${SED_INPLACE[@]}" 's|from "@std/yaml"|from "yaml"|g' {} +

# Strip .ts extensions from relative imports → .js (Node ESM)
# Matches: from "./foo.ts", from "../bar/baz.ts", import("./types.ts")
find "$DIST_DIR" -name "*.ts" -exec sed "${SED_INPLACE[@]}" \
  -e 's/from "\(\.[^"]*\)\.ts"/from "\1.js"/g' \
  -e 's/import("\(\.[^"]*\)\.ts")/import("\1.js")/g' \
  {} +

# Read versions from deno.json (single source of truth — keep specs aligned).
VERSION=$(grep '"version"' "$ROOT_DIR/deno.json" | sed 's/.*"version": *"\([^"]*\)".*/\1/')
SDK_VERSION=$(grep '"@modelcontextprotocol/sdk"' "$ROOT_DIR/deno.json" | sed 's|.*sdk@\([^"]*\)".*|\1|')
# @modelcontextprotocol/ext-apps supplies the base McpUiToolMeta type that
# src/types.ts extends; the npm package ships .ts, so consumers type-check
# against it and need it declared as a runtime dependency.
EXTAPPS_VERSION=$(grep '"@modelcontextprotocol/ext-apps"' "$ROOT_DIR/deno.json" | sed 's|.*ext-apps@\([^"]*\)".*|\1|')
echo "[build-node] Version: $VERSION"
echo "[build-node] MCP SDK version: $SDK_VERSION"

if [ -z "$SDK_VERSION" ]; then
  echo "[build-node] ERROR: failed to parse @modelcontextprotocol/sdk version from deno.json" >&2
  exit 1
fi

if [ -z "$EXTAPPS_VERSION" ]; then
  echo "[build-node] ERROR: failed to parse @modelcontextprotocol/ext-apps version from deno.json" >&2
  exit 1
fi

# Generate package.json
cat > "$DIST_DIR/package.json" <<PKGJSON
{
  "name": "@casys/mcp-server",
  "version": "$VERSION",
  "description": "Production-ready MCP server framework with concurrency control, auth, and observability",
  "type": "module",
  "main": "mod.ts",
  "types": "mod.ts",
  "scripts": {
    "build": "tsc",
    "test": "tsx --test src/**/*_test.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "$SDK_VERSION",
    "@modelcontextprotocol/ext-apps": "$EXTAPPS_VERSION",
    "hono": "^4.0.0",
    "ajv": "^8.17.1",
    "jose": "^6.0.0",
    "yaml": "^2.7.0",
    "@opentelemetry/api": "^1.9.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "tsx": "^4.0.0"
  },
  "engines": {
    "node": ">=20.0.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/Casys-AI/mcp-server"
  },
  "license": "MIT"
}
PKGJSON

# Copy README for npm
cp "$ROOT_DIR/README.md" "$DIST_DIR/README.md" 2>/dev/null || true

echo "[build-node] Done! Output: $DIST_DIR"
echo ""
echo "Next steps:"
echo "  cd $DIST_DIR"
echo "  npm install"
echo "  npm test"
