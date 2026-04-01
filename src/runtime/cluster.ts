/**
 * MCP server cluster — start, connect, call tools, and shut down MCP servers.
 *
 * Two transport modes:
 * - **stdio**: The cluster starts the server as a child process with `--http --port=0`.
 *   The server picks a free port and prints the URL on stderr. All communication
 *   then goes through HTTP (no JSON-RPC over stdio).
 * - **http**: The cluster connects to an already-running server via its URL.
 *
 * Both modes use HTTP `fetch()` for tool calls — zero custom protocol implementation.
 *
 * ## AX (Agent Experience)
 *
 * - **Fast fail**: Invalid manifests, connection failures, and tool call errors
 *   produce structured `RuntimeError` objects with machine-readable codes.
 * - **Deterministic cleanup**: `stopAll()` always runs in a `finally` block
 *   pattern. Process handles are tracked and killed on shutdown.
 * - **Timeout-aware**: Tool calls and server startup have configurable timeouts
 *   with clear error messages on expiry.
 * - **No magic**: The cluster does not retry failed calls or silently swallow
 *   errors. Callers decide retry policy.
 *
 * @module runtime/cluster
 */

import type {
  McpCluster,
  McpConnection,
  McpManifest,
  RuntimeError,
} from "./types.ts";
import { RuntimeErrorCode } from "./types.ts";

/** Default timeout for server startup (ms). */
const DEFAULT_STARTUP_TIMEOUT_MS = 15_000;

/** Default timeout for tool calls (ms). */
const DEFAULT_TOOL_CALL_TIMEOUT_MS = 30_000;

/** Pattern to detect the HTTP listening URL from server stderr.
 * Matches "listening on http://host:port" to avoid false positives
 * from warning messages containing URLs. */
const LISTEN_URL_PATTERN = /listening on (https?:\/\/[^\s]+)/;

/**
 * Connect to an already-running MCP server via HTTP.
 *
 * Verifies connectivity by hitting the `/health` endpoint.
 *
 * @param manifest - Server manifest with http transport
 * @returns Active connection
 * @throws RuntimeError if health check fails
 *
 * @example
 * ```typescript
 * const conn = await connectHttp({
 *   name: "einvoice",
 *   transport: { type: "http", url: "http://localhost:3015" },
 *   tools: [...],
 * });
 * const result = await conn.callTool("invoice_search", { customer_id: "C-1" });
 * ```
 */
export async function connectHttp(manifest: McpManifest): Promise<McpConnection> {
  if (manifest.transport.type !== "http") {
    throw {
      code: RuntimeErrorCode.PROCESS_START_FAILED,
      message: `Expected http transport for "${manifest.name}", got "${manifest.transport.type}"`,
      server: manifest.name,
    } satisfies RuntimeError;
  }

  const baseUrl = manifest.transport.url.replace(/\/+$/, "");

  // Health check
  try {
    const res = await fetch(`${baseUrl}/health`);
    if (!res.ok) {
      throw new Error(`Health check returned ${res.status}`);
    }
  } catch (cause) {
    throw {
      code: RuntimeErrorCode.PROCESS_START_FAILED,
      message: `Cannot connect to "${manifest.name}" at ${baseUrl}: ${cause instanceof Error ? cause.message : String(cause)}`,
      server: manifest.name,
      cause,
    } satisfies RuntimeError;
  }

  return createHttpConnection(manifest.name, baseUrl);
}

/**
 * Start an MCP server as a child process and connect via HTTP.
 *
 * Launches the server with `--http --port=0` (dynamic port),
 * reads stderr to detect the listening URL, then communicates via HTTP.
 *
 * @param manifest - Server manifest with stdio transport
 * @param options - Startup options
 * @returns Active connection (with process handle for cleanup)
 * @throws RuntimeError if startup times out or fails
 *
 * @example
 * ```typescript
 * const conn = await startServer({
 *   name: "einvoice",
 *   transport: { type: "stdio", command: "deno", args: ["run", "server.ts"] },
 *   tools: [...],
 * });
 * ```
 */
export async function startServer(
  manifest: McpManifest,
  options?: { timeoutMs?: number },
): Promise<McpConnection> {
  if (manifest.transport.type !== "stdio") {
    throw {
      code: RuntimeErrorCode.PROCESS_START_FAILED,
      message: `Expected stdio transport for "${manifest.name}", got "${manifest.transport.type}"`,
      server: manifest.name,
    } satisfies RuntimeError;
  }

  const transport = manifest.transport;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;

  // Validate required env vars before starting
  if (manifest.requiredEnv?.length) {
    const env = transport.env ?? {};
    const missing = manifest.requiredEnv.filter((k) => !env[k] && !Deno.env.get(k));
    if (missing.length > 0) {
      throw {
        code: RuntimeErrorCode.PROCESS_START_FAILED,
        message: `Server "${manifest.name}" requires env vars: ${missing.join(", ")}`,
        server: manifest.name,
      } satisfies RuntimeError;
    }
  }

  // Append --http --port=0 if not already present
  const args = [...(transport.args ?? [])];
  if (!args.includes("--http")) args.push("--http");
  if (!args.some((a) => a.startsWith("--port="))) args.push("--port=0");

  let process: Deno.ChildProcess;
  try {
    const command = new Deno.Command(transport.command, {
      args,
      stdin: "null",
      stdout: "piped",
      stderr: "piped",
      env: transport.env,
    });
    process = command.spawn();
  } catch (cause) {
    throw {
      code: RuntimeErrorCode.PROCESS_START_FAILED,
      message: `Failed to start "${manifest.name}": ${cause instanceof Error ? cause.message : String(cause)}`,
      server: manifest.name,
      cause,
    } satisfies RuntimeError;
  }

  // Drain stdout in background (we don't use it, prevent pipe pressure)
  drainStream(process.stdout);

  // Read stderr to find the listening URL
  const baseUrl = await detectListenUrl(
    manifest.name,
    process.stderr,
    timeoutMs,
  );

  return createStdioConnection(manifest.name, baseUrl, process);
}

/**
 * Create a cluster manager for multiple MCP servers.
 *
 * @param manifests - All available manifests (keyed by name)
 * @param serverNames - Which servers to include in the cluster
 * @returns Cluster manager with startAll/stopAll/callTool
 *
 * @example
 * ```typescript
 * const cluster = createCluster(manifests, ["mcp-einvoice", "mcp-dataviz"]);
 * await cluster.startAll();
 * try {
 *   const result = await cluster.callTool("mcp-einvoice", "invoice_search", { id: "1" });
 * } finally {
 *   await cluster.stopAll();
 * }
 * ```
 */
export function createCluster(
  manifests: Map<string, McpManifest>,
  serverNames: string[],
): McpCluster {
  const connections = new Map<string, McpConnection>();

  return {
    async startAll(): Promise<void> {
      // Validate all manifests exist before starting anything
      const resolvedManifests: McpManifest[] = [];
      for (const name of serverNames) {
        const manifest = manifests.get(name);
        if (!manifest) {
          throw {
            code: RuntimeErrorCode.MANIFEST_NOT_FOUND,
            message: `Manifest "${name}" not found`,
            server: name,
          } satisfies RuntimeError;
        }
        resolvedManifests.push(manifest);
      }

      // Start all servers in parallel
      const results = await Promise.allSettled(
        resolvedManifests.map((manifest) =>
          manifest.transport.type === "http"
            ? connectHttp(manifest).then((conn) => ({ name: manifest.name, conn }))
            : startServer(manifest).then((conn) => ({ name: manifest.name, conn }))
        ),
      );

      // Collect successes and failures
      const failures: string[] = [];
      for (const result of results) {
        if (result.status === "fulfilled") {
          connections.set(result.value.name, result.value.conn);
        } else {
          const err = result.reason as RuntimeError;
          failures.push(err.message ?? String(result.reason));
        }
      }

      // If any failed, clean up the ones that succeeded and throw
      if (failures.length > 0) {
        await Promise.allSettled(
          [...connections.values()].map((conn) => conn.close()),
        );
        connections.clear();
        throw {
          code: RuntimeErrorCode.PROCESS_START_FAILED,
          message: `Failed to start ${failures.length} server(s): ${failures.join("; ")}`,
        } satisfies RuntimeError;
      }
    },

    async callTool(
      serverName: string,
      toolName: string,
      args?: Record<string, unknown>,
    ): Promise<unknown> {
      const conn = connections.get(serverName);
      if (!conn) {
        throw {
          code: RuntimeErrorCode.TOOL_CALL_FAILED,
          message: `No connection for server "${serverName}". Did you call startAll()?`,
          server: serverName,
          tool: toolName,
        } satisfies RuntimeError;
      }
      return conn.callTool(toolName, args);
    },

    getUiBaseUrl(serverName: string): string | undefined {
      return connections.get(serverName)?.uiBaseUrl;
    },

    async stopAll(): Promise<void> {
      const results = await Promise.allSettled(
        [...connections.values()].map((conn) => conn.close()),
      );
      connections.clear();

      // Log failures but don't throw — cleanup is best-effort
      for (const result of results) {
        if (result.status === "rejected") {
          console.error("[mcp-compose] Failed to close connection:", result.reason);
        }
      }
    },
  };
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Read stderr line by line until a URL matching the listen pattern is found.
 * Times out with a RuntimeError if no URL appears.
 */
async function detectListenUrl(
  serverName: string,
  stderr: ReadableStream<Uint8Array>,
  timeoutMs: number,
): Promise<string> {
  const decoder = new TextDecoder();
  const reader = stderr.getReader();
  let buffer = "";
  let timerId: number;

  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => {
      reader.releaseLock();
      drainStream(stderr);
      reject({
        code: RuntimeErrorCode.PROCESS_START_FAILED,
        message: `Server "${serverName}" did not report a listening URL within ${timeoutMs}ms`,
        server: serverName,
      } satisfies RuntimeError);
    }, timeoutMs);
  });

  const detect = async (): Promise<string> => {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          throw {
            code: RuntimeErrorCode.PROCESS_DIED,
            message: `Server "${serverName}" exited before reporting a listening URL. Stderr: ${buffer}`,
            server: serverName,
          } satisfies RuntimeError;
        }

        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        for (const line of lines) {
          const match = line.match(LISTEN_URL_PATTERN);
          if (match) {
            reader.releaseLock();
            drainStream(stderr);
            return match[1].replace(/\/+$/, "");
          }
        }

        buffer = lines[lines.length - 1];
      }
    } finally {
      clearTimeout(timerId!);
    }
  };

  return Promise.race([detect(), timeout]);
}

/** Drain a stream in background to prevent pipe backpressure. */
function drainStream(stream: ReadableStream<Uint8Array>): void {
  const reader = stream.getReader();
  (async () => {
    try {
      while (!(await reader.read()).done) { /* discard */ }
    } catch { /* stream closed */ }
    finally { reader.releaseLock(); }
  })();
}

/** Create an McpConnection backed by HTTP fetch. */
function createHttpConnection(
  name: string,
  baseUrl: string,
): McpConnection {
  return {
    name,
    transportType: "http",
    uiBaseUrl: baseUrl,
    async close() { /* no-op for http connections */ },
    async callTool(
      toolName: string,
      args?: Record<string, unknown>,
    ): Promise<unknown> {
      return httpCallTool(name, baseUrl, toolName, args);
    },
  };
}

/** Create an McpConnection backed by a child process + HTTP. */
function createStdioConnection(
  name: string,
  baseUrl: string,
  process: Deno.ChildProcess,
): McpConnection {
  return {
    name,
    transportType: "stdio",
    uiBaseUrl: baseUrl,
    async close() {
      try {
        process.kill("SIGTERM");
      } catch { /* already dead */ }
      try {
        await process.status;
      } catch { /* ignore */ }
    },
    async callTool(
      toolName: string,
      args?: Record<string, unknown>,
    ): Promise<unknown> {
      return httpCallTool(name, baseUrl, toolName, args);
    },
  };
}

/** Per-connection JSON-RPC request ID counter. */
let _nextRpcId = 1;

/** Call a tool via HTTP POST to the MCP server. */
async function httpCallTool(
  serverName: string,
  baseUrl: string,
  toolName: string,
  args?: Record<string, unknown>,
  timeoutMs = DEFAULT_TOOL_CALL_TIMEOUT_MS,
): Promise<unknown> {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: _nextRpcId++,
    method: "tools/call",
    params: { name: toolName, arguments: args ?? {} },
  });

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "TimeoutError") {
      throw {
        code: RuntimeErrorCode.TOOL_CALL_TIMEOUT,
        message: `Tool call "${toolName}" on "${serverName}" timed out after ${timeoutMs}ms`,
        server: serverName,
        tool: toolName,
        cause,
      } satisfies RuntimeError;
    }
    throw {
      code: RuntimeErrorCode.TOOL_CALL_FAILED,
      message: `Tool call "${toolName}" on "${serverName}" failed: ${cause instanceof Error ? cause.message : String(cause)}`,
      server: serverName,
      tool: toolName,
      cause,
    } satisfies RuntimeError;
  }

  if (!res.ok) {
    throw {
      code: RuntimeErrorCode.TOOL_CALL_FAILED,
      message: `Tool call "${toolName}" on "${serverName}" returned HTTP ${res.status}`,
      server: serverName,
      tool: toolName,
    } satisfies RuntimeError;
  }

  const json = await res.json();

  if (json.error) {
    throw {
      code: RuntimeErrorCode.TOOL_CALL_FAILED,
      message: `Tool call "${toolName}" on "${serverName}" returned error: ${json.error.message ?? JSON.stringify(json.error)}`,
      server: serverName,
      tool: toolName,
      cause: json.error,
    } satisfies RuntimeError;
  }

  return json.result;
}
