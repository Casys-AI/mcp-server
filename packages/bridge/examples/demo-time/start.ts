/**
 * Demo: MCP Apps Bridge — Time Server
 *
 * Launches the resource server with a simple "get_time" tool handler.
 * Open the Mini App in Telegram (via ngrok) to see it in action.
 *
 * Usage:
 *   deno run --allow-net --allow-read examples/demo-time/start.ts
 */

import { startResourceServer } from "../../src/resource-server/server.ts";
import type { BridgeSession } from "../../src/resource-server/session.ts";
import type { McpAppsMessage, McpAppsRequest } from "../../src/core/types.ts";

const PORT = 4000;

// Resolve asset directory relative to this script
const assetDir = new URL(".", import.meta.url).pathname;

const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
if (!botToken) {
  console.error(`
  ERROR: TELEGRAM_BOT_TOKEN environment variable is required.

  Usage:
    TELEGRAM_BOT_TOKEN=123456:ABC-DEF deno run --allow-net --allow-read --allow-env examples/demo-time/start.ts
  `);
  Deno.exit(1);
}

const server = startResourceServer({
  assetDirectories: {
    "demo-time": assetDir,
  },
  platform: "telegram",
  telegramBotToken: botToken,
  csp: {
    scriptSources: ["https://telegram.org"],
    connectSources: ["ws://localhost:4000"],
    frameAncestors: [
      "https://web.telegram.org",
      "https://desktop-app.telegram.org",
    ],
  },
  options: {
    resourceServerPort: PORT,
    debug: true,
  },
  onMessage: async (
    session: BridgeSession,
    message: McpAppsMessage,
  ): Promise<McpAppsMessage | null> => {
    // Only handle requests (method + id)
    if (!("method" in message) || !("id" in message)) {
      return null;
    }

    const req = message as McpAppsRequest;

    if (req.method === "tools/call") {
      const toolName = req.params?.name as string | undefined;

      if (toolName === "get_time") {
        const now = new Date();
        const time = now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        });
        const date = now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        });

        console.log(
          `[Demo] Session ${
            session.id.slice(0, 8)
          }... called get_time -> ${time}`,
        );

        return {
          jsonrpc: "2.0",
          id: req.id,
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  time,
                  date,
                  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
              },
            ],
          },
        };
      }

      // Unknown tool
      return {
        jsonrpc: "2.0",
        id: req.id,
        error: {
          code: -32601,
          message: `Unknown tool: ${toolName}`,
        },
      };
    }

    // Unhandled method
    return {
      jsonrpc: "2.0",
      id: req.id,
      error: {
        code: -32601,
        message: `Method not supported: ${req.method}`,
      },
    };
  },
});

console.log(`
====================================
  MCP Apps Bridge - Time Demo
====================================

  Server running at: ${server.baseUrl}
  App URL:           ${server.baseUrl}/app/demo-time/index.html

  To test in Telegram:

  1. Expose with ngrok:
     ngrok http ${PORT}

  2. Create a bot via @BotFather on Telegram

  3. Configure the Menu Button:
     /setmenubutton -> select your bot -> enter URL:
     https://<ngrok-id>.ngrok-free.app/app/demo-time/index.html

  4. Open your bot on Telegram mobile -> tap Menu Button

====================================
`);

// Keep the process alive
await new Promise(() => {});
