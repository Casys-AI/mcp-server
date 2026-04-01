/**
 * Build script for @casys/mcp-compose npm package.
 *
 * Uses dnt (Deno to Node Transform) to produce ESM + CJS + type declarations
 * from the Deno source.
 *
 * Usage:
 *   deno run -A scripts/build-npm.ts
 */

import { build, emptyDir } from "@deno/dnt";

await emptyDir("./dist-node");

await build({
  entryPoints: [
    "./mod.ts",
    { name: "./core", path: "./src/core/mod.ts" },
    { name: "./sdk", path: "./src/sdk/mod.ts" },
    { name: "./host", path: "./src/host/mod.ts" },
    { name: "./runtime", path: "./src/runtime/mod.ts" },
    { name: "./deploy", path: "./src/deploy/mod.ts" },
  ],
  outDir: "./dist-node",
  shims: {
    deno: false,
  },
  package: {
    name: "@casys/mcp-compose",
    version: "0.3.0",
    description:
      "Compose and synchronize multiple MCP Apps UIs into composite dashboards",
    license: "MIT",
    repository: {
      type: "git",
      url: "https://github.com/Casys-AI/mcp-server",
    },
    keywords: [
      "mcp",
      "model-context-protocol",
      "compose",
      "dashboard",
      "ui",
      "orchestration",
    ],
  },
  compilerOptions: {
    lib: ["ES2022", "DOM"],
    target: "ES2022",
  },
  typeCheck: false,
  test: false,
  importMap: "./deno.json",
});

// Patch package.json: add "types" field for broader TS compatibility
const pkgPath = "dist-node/package.json";
const pkg = JSON.parse(await Deno.readTextFile(pkgPath));
pkg.types = "./esm/mod.d.ts";
await Deno.writeTextFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log("\n[build-npm] Done. Output in ./dist-node/");
