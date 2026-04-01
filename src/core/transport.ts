/**
 * Transport abstraction for the MCP Apps Bridge.
 *
 * Defines how JSON-RPC messages travel between the bridge adapter
 * (client-side, in the webview) and the resource server.
 *
 * The primary implementation is WebSocket, with HTTP POST as a fallback.
 */

import type { McpAppsMessage } from "./types.ts";

/** Handler invoked when the transport receives a message. */
export type TransportMessageHandler = (message: McpAppsMessage) => void;

/** Handler invoked when the transport connection state changes. */
export type TransportStateHandler = (connected: boolean) => void;

/**
 * Transport layer for bidirectional JSON-RPC communication between
 * the bridge adapter and the resource server.
 */
export interface BridgeTransport {
  /** Send a JSON-RPC message to the resource server. */
  send(message: McpAppsMessage): void;

  /** Register a handler for incoming messages from the resource server. */
  onMessage(handler: TransportMessageHandler): void;

  /** Register a handler for connection state changes. */
  onStateChange(handler: TransportStateHandler): void;

  /** Connect to the resource server at the given URL. */
  connect(url: string): Promise<void>;

  /** Disconnect from the resource server. */
  disconnect(): void;

  /** Whether the transport is currently connected. */
  readonly connected: boolean;
}

/**
 * WebSocket-based transport for the MCP Apps Bridge.
 *
 * This is the primary transport. It provides full-duplex communication
 * so the resource server can push notifications (tool results, context
 * changes) to the app without polling.
 *
 * NOTE: This class uses browser WebSocket APIs. It is designed to run
 * inside a platform webview (Telegram, LINE), not on the server side.
 */
export class WebSocketTransport implements BridgeTransport {
  // deno-lint-ignore no-explicit-any
  private ws: any = null; // WebSocket instance (browser API)
  private messageHandlers: TransportMessageHandler[] = [];
  private stateHandlers: TransportStateHandler[] = [];

  send(message: McpAppsMessage): void {
    if (!this.ws || this.ws.readyState !== 1 /* WebSocket.OPEN */) {
      throw new Error(
        "[WebSocketTransport] Not connected. Call connect() first.",
      );
    }
    this.ws.send(JSON.stringify(message));
  }

  onMessage(handler: TransportMessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onStateChange(handler: TransportStateHandler): void {
    this.stateHandlers.push(handler);
  }

  connect(url: string): Promise<void> {
    // deno-lint-ignore no-explicit-any
    const WS = (globalThis as any).WebSocket;
    if (!WS) {
      throw new Error(
        "[WebSocketTransport] WebSocket API not available. " +
          "This transport requires a browser environment.",
      );
    }

    return new Promise<void>((resolve, reject) => {
      const ws = new WS(url);

      ws.onopen = () => {
        this.ws = ws;
        this.notifyState(true);
        resolve();
      };

      ws.onerror = () => {
        reject(
          new Error(`[WebSocketTransport] Failed to connect to ${url}.`),
        );
      };

      ws.onmessage = (event: { data: string }) => {
        try {
          const message = JSON.parse(event.data) as McpAppsMessage;
          for (const handler of this.messageHandlers) {
            handler(message);
          }
        } catch (err) {
          console.warn(
            "[WebSocketTransport] Received non-JSON message, dropping:",
            err instanceof Error ? err.message : err,
          );
        }
      };

      ws.onclose = () => {
        this.ws = null;
        this.notifyState(false);
      };
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  get connected(): boolean {
    return this.ws !== null && this.ws.readyState === 1; /* WebSocket.OPEN */
  }

  private notifyState(connected: boolean): void {
    for (const handler of this.stateHandlers) {
      handler(connected);
    }
  }
}
