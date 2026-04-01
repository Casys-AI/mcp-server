/**
 * Telegram Mini App adapter for MCP Apps Bridge.
 *
 * Uses `postMessage` / `message` events to communicate with the Telegram
 * host WebView.
 */

import { BasePostMessageAdapter } from "../base-adapter.ts";

export class TelegramAdapter extends BasePostMessageAdapter {
  readonly platform = "telegram" as const;
}
