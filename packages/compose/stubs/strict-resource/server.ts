/**
 * HTTP entry point for the strict MCP Apps fixture.
 *
 * Intentionally omits `customRoutes`: `/ui` must be a 404. The only supported
 * resource path is MCP `resources/read` at `/mcp`.
 *
 * @module stubs/strict-resource/server
 */

import { createStrictResourceServer, STRICT_RESOURCE_SERVER_NAME } from "./fixture.ts";

const portArgument = Deno.args.find((argument) => argument.startsWith("--port="));
const port = portArgument === undefined
  ? 3025
  : Number.parseInt(portArgument.slice("--port=".length), 10);
const server = createStrictResourceServer();

if (Deno.args.includes("--http")) {
  await server.startHttp({
    port: Number.isFinite(port) ? port : 3025,
    cors: true,
    onListen: (info: { hostname: string; port: number }) => {
      console.error(
        `[${STRICT_RESOURCE_SERVER_NAME}] HTTP server listening on http://${info.hostname}:${info.port}`,
      );
    },
  });
} else {
  await server.start();
}
