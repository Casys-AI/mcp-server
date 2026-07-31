import { assert, assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { dirname, join } from "@std/path";

import { parseScaffoldArguments, ScaffoldError, scaffoldResultViewer } from "./scaffold.ts";

Deno.test("result-viewer scaffold creates a standalone vanilla project in a temporary directory", async () => {
  const directory = await Deno.makeTempDir({ prefix: "mcp-view-scaffold-" });
  try {
    const target = join(directory, "result-viewer");
    const files = await scaffoldResultViewer(target);

    assertEquals(files.length, 8);
    for (
      const path of [
        "deno.json",
        "index.html",
        "build.ts",
        "src/main.ts",
        "src/model.ts",
        "src/render.ts",
        "src/styles.css",
        "src/model_test.ts",
      ]
    ) {
      assert((await Deno.stat(join(target, path))).isFile);
    }
    const main = await Deno.readTextFile(join(target, "src/main.ts"));
    assertStringIncludes(main, "createMcpApp");
    assertStringIncludes(main, "onToolResult");
    assertStringIncludes(main, "before connect()");
    assertStringIncludes(main, 'aria-busy", "false');
    const styles = await Deno.readTextFile(join(target, "src/styles.css"));
    assertStringIncludes(styles, "var(--color-background-primary");
    assertStringIncludes(styles, "prefers-reduced-motion");

    const configPath = join(target, "deno.json");
    const generatedConfig = await Deno.readTextFile(configPath);
    assertStringIncludes(generatedConfig, '"@casys/mcp-view": "jsr:@casys/mcp-view@0.4.0"');
    await Deno.writeTextFile(
      configPath,
      generatedConfig.replace(
        "jsr:@casys/mcp-view@0.4.0",
        new URL("./mod.ts", import.meta.url).href,
      ),
    );

    const environment = { MCP_VIEW_MODULE: new URL("./mod.ts", import.meta.url).href };
    await runGeneratedTask(target, "test", environment);
    await runGeneratedTask(target, "check", environment);
    await runGeneratedTask(target, "build", environment);
    assert((await Deno.stat(join(target, "dist", "result-viewer", "index.html"))).isFile);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("result-viewer scaffold refuses a non-empty directory unless force is explicit", async () => {
  const directory = await Deno.makeTempDir({ prefix: "mcp-view-scaffold-" });
  try {
    await Deno.writeTextFile(join(directory, "keep.txt"), "keep");
    await assertRejects(
      () => scaffoldResultViewer(directory),
      ScaffoldError,
      "not empty",
    );
    await scaffoldResultViewer(directory, { force: true });
    assertEquals(await Deno.readTextFile(join(directory, "keep.txt")), "keep");
    assert((await Deno.stat(join(directory, "src", "main.ts"))).isFile);
  } finally {
    await Deno.remove(directory, { recursive: true });
  }
});

Deno.test("result-viewer scaffold exposes actionable CLI parsing errors", () => {
  assertEquals(parseScaffoldArguments(["result-viewer", "./viewer", "--force"]), {
    target: "./viewer",
    options: { force: true },
  });
  try {
    parseScaffoldArguments(["unknown", "./viewer"]);
    throw new Error("expected scaffold parsing to reject");
  } catch (error) {
    assert(error instanceof ScaffoldError);
    assertStringIncludes(error.message, "Usage:");
  }
});

Deno.test("result-viewer scaffold refuses protected targets even with force", async () => {
  const targets = ["/", Deno.cwd(), dirname(Deno.cwd()), Deno.env.get("HOME")]
    .filter((target): target is string => target !== undefined);
  for (const target of targets) {
    await assertRejects(
      () => scaffoldResultViewer(target, { force: true }),
      ScaffoldError,
      "Refusing to scaffold",
    );
  }
});

async function runGeneratedTask(
  cwd: string,
  task: string,
  environment: Record<string, string>,
): Promise<void> {
  const result = await new Deno.Command(Deno.execPath(), {
    cwd,
    args: ["task", task],
    env: environment,
    stdout: "piped",
    stderr: "piped",
  }).output();
  if (result.success) return;
  throw new Error(
    `Generated result-viewer task ${task} failed:\n${new TextDecoder().decode(result.stderr)}`,
  );
}
