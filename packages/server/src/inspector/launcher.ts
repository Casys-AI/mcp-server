/**
 * MCP Inspector Launcher
 *
 * Launches the official @modelcontextprotocol/inspector to debug
 * and test MCP servers interactively in a browser.
 *
 * Usage from a server script:
 * ```typescript
 * import { launchInspector } from "@casys/mcp-server";
 *
 * if (Deno.args.includes("--inspect")) {
 *   await launchInspector("deno", ["run", "--allow-all", "server.ts"]);
 * }
 * ```
 *
 * @module lib/server/inspector/launcher
 */

/** Options for the MCP Inspector launcher. */
export interface InspectorOptions {
  /** Port for the inspector web UI (default: 6274) */
  port?: number;
  /** Automatically open the browser (default: true) */
  open?: boolean;
  /** Environment variables to pass to the MCP server process */
  env?: Record<string, string>;
}

/**
 * Launch the MCP Inspector to debug a server.
 *
 * Spawns `npx @modelcontextprotocol/inspector` which:
 * 1. Starts a web UI on the given port (default 6274)
 * 2. Proxies stdio to the MCP server subprocess
 * 3. Allows interactive tool calls, resource browsing, etc.
 *
 * @param serverCommand - Command to start the MCP server (e.g. "deno", "node")
 * @param serverArgs - Arguments for the server command (e.g. ["run", "--allow-all", "server.ts"])
 * @param options - Inspector configuration
 */
export async function launchInspector(
  serverCommand: string,
  serverArgs: string[],
  options?: InspectorOptions,
): Promise<void> {
  const port = options?.port ?? 6274;
  const shouldOpen = options?.open ?? true;

  // Filter out --inspect from args to avoid recursion
  const filteredArgs = serverArgs.filter((a) => a !== "--inspect");

  const inspectorEnv: Record<string, string> = {
    ...options?.env,
    CLIENT_PORT: String(port),
  };

  console.error(
    `[mcp-inspector] Starting inspector on http://localhost:${port}`,
  );
  console.error(
    `[mcp-inspector] Server: ${serverCommand} ${filteredArgs.join(" ")}`,
  );

  // Use npx to run the inspector
  const command = new Deno.Command("npx", {
    args: [
      "-y",
      "@modelcontextprotocol/inspector",
      serverCommand,
      ...filteredArgs,
    ],
    env: {
      ...Deno.env.toObject(),
      ...inspectorEnv,
    },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });

  const process = command.spawn();

  // Open browser after a short delay
  if (shouldOpen) {
    setTimeout(() => {
      openBrowser(`http://localhost:${port}`).catch(() => {
        // Ignore — user can open manually
      });
    }, 2000);
  }

  // Wait for the inspector process to exit
  const status = await process.status;
  if (!status.success) {
    console.error(`[mcp-inspector] Inspector exited with code ${status.code}`);
    Deno.exit(status.code);
  }
}

/**
 * Open a URL in the default browser (cross-platform).
 */
async function openBrowser(url: string): Promise<void> {
  const os = Deno.build.os;
  let cmd: string[];

  if (os === "darwin") {
    cmd = ["open", url];
  } else if (os === "windows") {
    cmd = ["cmd", "/c", "start", url];
  } else {
    cmd = ["xdg-open", url];
  }

  const process = new Deno.Command(cmd[0], {
    args: cmd.slice(1),
    stdin: "null",
    stdout: "null",
    stderr: "null",
  });

  await process.spawn().status;
}
