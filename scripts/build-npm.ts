/**
 * Build script for @casys/mcp-bridge npm package.
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
  entryPoints: ["./src/mod.ts"],
  outDir: "./dist-node",
  shims: {
    deno: false,
  },
  package: {
    name: "@casys/mcp-bridge",
    version: "0.2.0",
    description:
      "Bridge MCP Apps interactive UIs to messaging platforms (Telegram Mini Apps, LINE LIFF)",
    license: "MIT",
    repository: {
      type: "git",
      url: "https://github.com/Casys-AI/mcp-bridge",
    },
    keywords: [
      "mcp",
      "model-context-protocol",
      "telegram",
      "mini-apps",
      "line",
      "liff",
      "bridge",
      "messaging",
    ],
  },
  compilerOptions: {
    lib: ["ES2022", "DOM"],
    target: "ES2022",
  },
  // server.ts uses Deno.serve / Deno.readTextFile / Deno.readFile —
  // type-checking would fail for those. Consumers who need the resource
  // server should run it with Deno; the npm package exposes client-side
  // and protocol utilities that are runtime-agnostic.
  typeCheck: false,
  test: false,
  importMap: "./deno.json",
});

// Copy bridge.js client script to dist so npm consumers can serve it
const bridgeSrc = "src/client/bridge.js";

async function ensureDir(path: string): Promise<void> {
  try {
    await Deno.mkdir(path, { recursive: true });
  } catch (err) {
    if (!(err instanceof Deno.errors.AlreadyExists)) throw err;
  }
}

await ensureDir("dist-node/esm/client");
await ensureDir("dist-node/script/client");

await Deno.copyFile(bridgeSrc, "dist-node/esm/client/bridge.js");
await Deno.copyFile(bridgeSrc, "dist-node/script/client/bridge.js");

// Patch package.json: add "types" field and types conditions in exports
// for broader TypeScript compatibility (moduleResolution: node, bundler, etc.)
const pkgPath = "dist-node/package.json";
const pkg = JSON.parse(await Deno.readTextFile(pkgPath));
pkg.types = "./esm/mod.d.ts";
pkg.exports = {
  ".": {
    types: "./esm/mod.d.ts",
    import: "./esm/mod.js",
    require: "./script/mod.js",
  },
};
await Deno.writeTextFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

console.log("\n[build-npm] Done. Output in ./dist-node/");
