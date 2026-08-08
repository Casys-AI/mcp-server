/**
 * The stdio transport, end to end, through a real subprocess.
 *
 * `stdio-discover_test.ts` drives the SDK `Server` directly over an in-memory
 * transport, which is fast but reaches into a private field and never calls
 * `start()`. Two independent reviews flagged the same gap: those tests stay
 * green if `start()` connects the wrong instance, or stops installing handlers
 * altogether. This one spawns `deno run` on a fixture server and talks JSON-RPC
 * down its stdin, so nothing between `McpApp.start()` and the wire is mocked.
 *
 * One process for the whole file — spawning is the expensive part, and the
 * transport is stateless, so the requests are independent anyway.
 */

import { assertEquals, assertExists } from "@std/assert";

const FIXTURE = new URL("./testdata/stdio-e2e-server.ts", import.meta.url)
  .pathname;

interface Response {
  readonly id?: number;
  readonly result?: Record<string, unknown>;
  readonly error?: { code: number; message: string };
}

/**
 * Send every request down one stdin, then read every response.
 *
 * Batching avoids interleaving reads with writes: the SDK answers out of order
 * (its `initialize` reply arrived after a later response in practice), so the
 * responses are matched by id rather than by position.
 */
async function exchange(
  requests: ReadonlyArray<Record<string, unknown>>,
): Promise<Map<number, Response>> {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-all", "--no-check", FIXTURE],
    stdin: "piped",
    stdout: "piped",
    stderr: "null",
  });

  const child = command.spawn();
  const writer = child.stdin.getWriter();
  const encoder = new TextEncoder();

  for (const request of requests) {
    await writer.write(encoder.encode(`${JSON.stringify(request)}\n`));
  }
  await writer.close();

  const { stdout } = await child.output();

  const byId = new Map<number, Response>();
  for (const line of new TextDecoder().decode(stdout).split("\n")) {
    if (line.trim().length === 0) continue;
    const message = JSON.parse(line) as Response;
    if (typeof message.id === "number") byId.set(message.id, message);
  }
  return byId;
}

function request(
  id: number,
  method: string,
  params: Record<string, unknown> = {},
): Record<string, unknown> {
  return { jsonrpc: "2.0", id, method, params };
}

const HANDSHAKE = [
  request(1, "initialize", {
    protocolVersion: "2026-07-28",
    capabilities: {},
    clientInfo: { name: "e2e", version: "1.0.0" },
  }),
  { jsonrpc: "2.0", method: "notifications/initialized" },
];

Deno.test("stdio e2e - a spawned server answers server/discover", async () => {
  const responses = await exchange([
    ...HANDSHAKE,
    request(2, "server/discover"),
    request(3, "tools/list"),
  ]);

  const discover = responses.get(2);
  assertExists(discover, "server/discover got no response at all");
  assertEquals(
    discover.error,
    undefined,
    `server/discover failed: ${JSON.stringify(discover.error)}`,
  );

  const result = discover.result;
  assertExists(result);
  assertEquals(result.supportedVersions, ["2026-07-28"]);
  assertEquals(result.serverInfo, { name: "e2e-stdio", version: "9.9.9" });
  assertEquals(result.instructions, "fixture server");
  assertEquals(result.resultType, "complete");

  // The rest of the server still works through the same process.
  const tools = responses.get(3);
  assertExists(tools?.result);
  assertEquals(
    (tools.result.tools as Array<{ name: string }>).map((t) => t.name),
    ["echo"],
  );
});

Deno.test("stdio e2e - an unknown method is MethodNotFound, not a crash", async () => {
  const responses = await exchange([
    ...HANDSHAKE,
    request(2, "server/undiscover"),
    // Proves the process survived the thrown McpError and keeps serving.
    request(3, "tools/call", { name: "echo", arguments: { value: "alive" } }),
  ]);

  assertEquals(responses.get(2)?.error?.code, -32601);

  const call = responses.get(3);
  assertExists(call?.result, "the server stopped serving after the error");
  assertEquals(
    (call.result.content as Array<{ text: string }>)[0].text,
    "alive",
  );
});
