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
  entryPoints: [
    "./mod.ts",
    { name: "./contracts", path: "./contracts.ts" },
    { name: "./preact", path: "./preact.ts" },
    { name: "./preact/components", path: "./preact-components.ts" },
    { name: "./react", path: "./react.ts" },
  ],
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
    lib: ["ES2022", "DOM", "DOM.Iterable"],
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
  "./contracts": {
    types: "./esm/contracts.d.ts",
    import: "./esm/contracts.js",
    require: "./script/contracts.js",
  },
  "./react": {
    types: "./esm/react.d.ts",
    import: "./esm/react.js",
    require: "./script/react.js",
  },
  "./preact": {
    types: "./esm/preact.d.ts",
    import: "./esm/preact.js",
    require: "./script/preact.js",
  },
  "./preact/components": {
    types: "./esm/preact-components.d.ts",
    import: "./esm/preact-components.js",
    require: "./script/preact-components.js",
  },
};

// dnt sees the optional React entry point and initially records its imports as
// hard dependencies. Keep the base package renderer-neutral: npm consumers
// that only import `@casys/mcp-view` must not install a UI framework. Projects
// opting into `@casys/mcp-view/react` already own these renderer dependencies.
const optionalReactPeers = [
  "react",
  "react-dom",
  "@types/react",
  "@types/react-dom",
] as const;
pkg.peerDependencies ??= {};
pkg.peerDependenciesMeta ??= {};
for (const dependency of optionalReactPeers) {
  const version = pkg.dependencies?.[dependency];
  if (!version) {
    throw new Error(`[build-npm] expected dnt dependency ${dependency}`);
  }
  delete pkg.dependencies[dependency];
  pkg.peerDependencies[dependency] = version;
  pkg.peerDependenciesMeta[dependency] = { optional: true };
}
const preactVersion = pkg.dependencies?.preact;
if (!preactVersion) {
  throw new Error("[build-npm] expected dnt dependency preact");
}
delete pkg.dependencies.preact;
pkg.peerDependencies.preact = preactVersion;
pkg.peerDependenciesMeta.preact = { optional: true };
await Deno.writeTextFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n");

for (const asset of ["README.md", "LICENSE", "CHANGELOG.md"] as const) {
  await Deno.copyFile(asset, `dist-node/${asset}`);
}
await Deno.mkdir("dist-node/docs/decision-records", { recursive: true });
await Deno.copyFile("docs/adoption.md", "dist-node/docs/adoption.md");
for await (const entry of Deno.readDir("docs/decision-records")) {
  if (!entry.isFile || !entry.name.endsWith(".md")) continue;
  await Deno.copyFile(
    `docs/decision-records/${entry.name}`,
    `dist-node/docs/decision-records/${entry.name}`,
  );
}

await smokeTestPackageImport();

console.log("\n[build-npm] Done. Output in ./dist-node/");

async function smokeTestPackageImport(): Promise<void> {
  const tempConsumer = await Deno.makeTempDir({
    prefix: "mcp-view-npm-smoke-",
  });
  try {
    await runConsumerCommand(tempConsumer, "npm", ["init", "--yes"]);
    await runConsumerCommand(tempConsumer, "npm", [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "typescript@5.9.3",
    ]);
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
          "if (typeof mod.installMcpViewTheme !== 'function') {",
          "  throw new Error('installMcpViewTheme export missing');",
          "}",
          "const contracts = await import('@casys/mcp-view/contracts');",
          "if (contracts.SEMANTIC_SELECTION_SCHEMA !== 'io.casys.semantic-selection/1.0') {",
          "  throw new Error('composition contracts export missing');",
          "}",
          "if (typeof contracts.defineViewAppManifest !== 'function' ||",
          "    contracts.VIEWER_SESSION_APPLY_ACTION !== 'viewer.session.apply') {",
          "  throw new Error('View App manifest contracts export missing');",
          "}",
          "const react = await import('@casys/mcp-view/react');",
          "if (typeof react.defineReactView !== 'function') {",
          "  throw new Error('defineReactView export missing');",
          "}",
          "const preact = await import('@casys/mcp-view/preact');",
          "if (typeof preact.definePreactComponent !== 'function') {",
          "  throw new Error('definePreactComponent export missing');",
          "}",
          "if (typeof preact.Card !== 'function' || typeof preact.DataTable !== 'function') {",
          "  throw new Error('Preact presentation kit exports missing');",
          "}",
          "const components = await import('@casys/mcp-view/preact/components');",
          "if (typeof components.Card !== 'function' || typeof components.DataTable !== 'function') {",
          "  throw new Error('Preact components-only exports missing');",
          "}",
          "if (typeof components.installMcpViewTheme !== 'function') {",
          "  throw new Error('Preact presentation theme export missing');",
          "}",
          "if ('startPreactSurfaceApp' in components || 'createMcpApp' in components) {",
          "  throw new Error('Preact components-only entry leaks MCP Apps runtime exports');",
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

    await Deno.writeTextFile(
      `${tempConsumer}/contracts-no-dom.ts`,
      [
        "import { defineViewAppManifest, VIEW_APP_MANIFEST_SCHEMA } from '@casys/mcp-view/contracts';",
        "",
        "const manifest = defineViewAppManifest({",
        "  schemaVersion: VIEW_APP_MANIFEST_SCHEMA,",
        "  app: { id: 'example.viewer', title: 'Example viewer', version: '1.0.0' },",
        "  resources: [{",
        "    uri: 'ui://example/viewer',",
        "    resultSchemas: ['example.result/1.0'],",
        "    components: {",
        "      components: { summary: { title: 'Summary' } },",
        "      defaultSurface: {",
        "        layout: { type: 'stack' },",
        "        components: [{ id: 'summary', component: 'summary' }],",
        "      },",
        "    },",
        "  }],",
        "});",
        "manifest.resources[0]?.components.defaultSurface?.components[0]?.id;",
        "",
      ].join("\n"),
    );
    await runConsumerCommand(tempConsumer, "node", [
      "node_modules/typescript/lib/tsc.js",
      "--noEmit",
      "--strict",
      "--target",
      "ES2022",
      "--module",
      "NodeNext",
      "--moduleResolution",
      "NodeNext",
      "--lib",
      "ES2022",
      "contracts-no-dom.ts",
    ]);
    console.log("[build-npm] Node no-DOM contracts type smoke passed");
  } finally {
    await Deno.remove(tempConsumer, { recursive: true });
  }
}

async function runConsumerCommand(
  cwd: string,
  command: string,
  args: readonly string[],
): Promise<void> {
  const result = await new Deno.Command(command, { cwd, args: [...args] }).output();
  if (result.success) return;

  const stderr = new TextDecoder().decode(result.stderr).trim();
  const stdout = new TextDecoder().decode(result.stdout).trim();
  throw new Error(
    [
      `[build-npm] consumer command failed: ${command} ${args.join(" ")}`,
      stdout && `stdout:\n${stdout}`,
      stderr && `stderr:\n${stderr}`,
    ].filter(Boolean).join("\n"),
  );
}
