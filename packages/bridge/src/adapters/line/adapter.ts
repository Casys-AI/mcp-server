/**
 * LINE LIFF adapter for MCP Apps Bridge.
 *
 * Uses `postMessage` / `message` events to communicate with the LINE
 * host WebView.
 */

import { BasePostMessageAdapter } from "../base-adapter.ts";

export class LineAdapter extends BasePostMessageAdapter {
  readonly platform = "line" as const;
}
