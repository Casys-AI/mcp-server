/**
 * A real stdio server, started the way a consumer starts one.
 *
 * Spawned as a subprocess by `stdio-e2e_test.ts`. Kept as a fixture rather than
 * written to a temp file at run time so the thing under test is readable and
 * versioned: this is exactly the five lines from the README.
 */

import { McpApp } from "../mcp-app.ts";

const app = new McpApp({
  name: "e2e-stdio",
  version: "9.9.9",
  logger: () => {},
  instructions: "fixture server",
});

app.registerTool(
  {
    name: "echo",
    description: "Echo the input",
    inputSchema: {
      type: "object",
      properties: { value: { type: "string" } },
    },
  },
  (args) => args.value ?? "empty",
);

await app.start();
