/**
 * Bridge between the Telegram WebApp SDK and the MCP Apps protocol.
 *
 * Wraps `window.Telegram.WebApp` to provide send/receive capabilities
 * for JSON-RPC messages.
 */

import type { TelegramWebApp } from "./types.ts";

/**
 * Attempt to get the Telegram WebApp instance from the global scope.
 *
 * @throws {Error} if running outside a Telegram Mini App context.
 */
export function getTelegramWebApp(): TelegramWebApp {
  // deno-lint-ignore no-explicit-any
  const global = globalThis as any;
  const tg = global?.Telegram?.WebApp as TelegramWebApp | undefined;
  if (!tg) {
    throw new Error(
      "[TelegramSdkBridge] Telegram.WebApp not found. " +
        "This code must run inside a Telegram Mini App WebView.",
    );
  }
  return tg;
}
