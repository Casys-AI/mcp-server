/**
 * Build script for @casys/mcp-view npm package.
 *
 * Uses dnt (Deno to Node Transform) to produce browser-compatible ESM/CJS
 * bundles plus type declarations from the Deno source.
 *
 * Usage:
 *   deno run -A scripts/build-npm.ts
 */

import { build, emptyDir } from "@deno/dnt";

const denoJsonText = await Deno.readTextFile(
  new URL("../deno.json", import.meta.url),
);
const denoJson = JSON.parse(denoJsonText) as { version?: string };
const VERSION = denoJson.version;
if (!VERSION) {
  throw new Error(
    "[build-npm] failed to read version from packages/view/deno.json",
  );
}
console.log(`[build-npm] Version: ${VERSION}`);

await emptyDir("./dist-node");

await build({
  entryPoints: ["./mod.ts"],
  outDir: "./dist-node",
  shims: {
    deno: false,
  },
  package: {
    name: "@casys/mcp-view",
    version: VERSION,
    description: "View-side SDK for MCP Apps with in-iframe routing and host tool calls",
    license: "MIT",
    repository: {
      type: "git",
      url: "https://github.com/Casys-AI/mcp-server",
    },
    keywords: [
      "mcp",
      "model-context-protocol",
      "mcp-apps",
      "iframe",
      "ui",
      "viewer",
    ],
  },
  compilerOptions: {
    lib: ["ES2022", "DOM", "DOM.Iterable", "DOM.AsyncIterable"],
    target: "ES2022",
  },
  typeCheck: false,
  test: false,
  importMap: "./deno.json",
});

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

await smokeTestPackageImport();

console.log("\n[build-npm] Done. Output in ./dist-node/");

async function smokeTestPackageImport(): Promise<void> {
  const tempConsumer = await Deno.makeTempDir({
    prefix: "mcp-view-npm-smoke-",
  });
  try {
    const packageScope = `${tempConsumer}/node_modules/@casys`;
    await Deno.mkdir(packageScope, { recursive: true });
    await Deno.symlink(
      new URL("../dist-node", import.meta.url).pathname,
      `${packageScope}/mcp-view`,
      { type: "dir" },
    );
    const command = new Deno.Command("node", {
      cwd: tempConsumer,
      args: [
        "--input-type=module",
        "--eval",
        [
          "const mod = await import('@casys/mcp-view');",
          "if (typeof mod.createMcpApp !== 'function') {",
          "  throw new Error('createMcpApp export missing');",
          "}",
          "if (typeof mod.defineView !== 'function') {",
          "  throw new Error('defineView export missing');",
          "}",
        ].join("\n"),
      ],
    });
    const result = await command.output();
    if (!result.success) {
      const stderr = new TextDecoder().decode(result.stderr).trim();
      const stdout = new TextDecoder().decode(result.stdout).trim();
      throw new Error(
        [
          "[build-npm] npm import smoke test failed",
          stdout && `stdout:\n${stdout}`,
          stderr && `stderr:\n${stderr}`,
        ].filter(Boolean).join("\n"),
      );
    }
  } finally {
    await Deno.remove(tempConsumer, { recursive: true });
  }
}
