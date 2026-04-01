/**
 * Shared utilities for stub MCP servers.
 *
 * @module stubs/shared
 */

import type { ConcurrentMCPServer } from "@casys/mcp-server";

/** MCP Apps MIME type for HTML UI resources. */
export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

/**
 * Browser-compatible composeEvents() function, inlined into stub HTML UIs.
 * This is a minified version of src/sdk/compose-events.ts that runs in iframes.
 */
export const COMPOSE_EVENTS_JS = `
function composeEvents() {
  var METHOD = "ui/compose/event";
  var handlers = new Map();
  var nextId = 1;
  var onMessage = function(e) {
    var msg = e.data;
    if (!msg || typeof msg !== "object") return;
    if (msg.jsonrpc !== "2.0" || msg.method !== METHOD) return;
    var p = msg.params;
    if (!p || typeof p.action !== "string") return;
    var set = handlers.get(p.action);
    if (!set) return;
    var payload = { data: p.data, sourceSlot: p.sourceSlot, sharedContext: p.sharedContext };
    set.forEach(function(h) { h(payload); });
  };
  window.addEventListener("message", onMessage);
  return {
    emit: function(event, data) {
      window.parent.postMessage({ jsonrpc: "2.0", method: METHOD, id: nextId++, params: { event: event, data: data } }, "*");
    },
    on: function(action, handler) {
      if (!handlers.has(action)) handlers.set(action, new Set());
      handlers.get(action).add(handler);
      return function() { var s = handlers.get(action); if (s) { s.delete(handler); if (s.size === 0) handlers.delete(action); } };
    },
    destroy: function() { window.removeEventListener("message", onMessage); handlers.clear(); }
  };
}`;

/**
 * Start a stub server with HTTP + /ui route.
 * Shared boilerplate for all stubs.
 */
export async function startStubServer(
  server: ConcurrentMCPServer,
  defaultPort: number,
): Promise<void> {
  const cliArgs = Deno.args;
  const portArg = cliArgs.find((a) => a.startsWith("--port="));
  const port = portArg ? parseInt(portArg.split("=")[1], 10) : defaultPort;

  if (cliArgs.includes("--http")) {
    await server.startHttp({
      port,
      cors: true,
      customRoutes: [{
        method: "get" as const,
        path: "/ui",
        handler: async (req: Request) => {
          const uri = new URL(req.url).searchParams.get("uri");
          if (!uri) return new Response("Missing uri", { status: 400 });
          const content = await server.readResourceContent(uri);
          if (!content) return new Response("Not found", { status: 404 });
          return new Response(content.text, { headers: { "Content-Type": "text/html" } });
        },
      }],
      onListen: (info: { hostname: string; port: number }) => {
        console.error(`[${server.name}] HTTP server listening on http://${info.hostname}:${info.port}`);
      },
    });
  } else {
    await server.start();
  }
}

/**
 * Wrap HTML body content into a complete HTML5 document with composeEvents inlined.
 *
 * NOTE: COMPOSE_EVENTS_JS is a browser-compatible copy of src/sdk/compose-events.ts.
 * Keep in sync manually — see SYNC marker below.
 */
export function buildStubHtml(title: string, bodyHtml: string, script: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; color: #333; }
    @media (prefers-color-scheme: dark) {
      body { background: #1a1a1a; color: #e0e0e0; }
    }
  </style>
</head>
<body>
  ${bodyHtml}
  <script>
    ${COMPOSE_EVENTS_JS}
    ${script}
  </script>
</body>
</html>`;
}
