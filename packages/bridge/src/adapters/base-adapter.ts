/**
 * Base postMessage adapter for platform integrations.
 *
 * Provides the common message interception and dispatch logic shared by
 * all platform adapters that communicate via `window.parent.postMessage`.
 *
 * Subclasses only need to set their `platform` identifier.
 */

import type { McpAppsAdapter, MessageHandler } from "../core/adapter.ts";
import type { AdapterConfig, McpAppsMessage } from "../core/types.ts";

// Cast globalThis to access browser-only APIs at runtime.
// deno-lint-ignore no-explicit-any
const _global = globalThis as any;

/**
 * Abstract base for postMessage-based platform adapters.
 *
 * Handles the common lifecycle:
 * - `init()`: set up `message` event listener, derive targetOrigin from config
 * - `sendToHost()`: forward JSON-RPC to parent frame via postMessage
 * - `onMessageFromHost()`: register message handlers
 * - `destroy()`: tear down listener and handlers
 *
 * Concrete adapters (Telegram, LINE) extend this and set `platform`.
 */
export abstract class BasePostMessageAdapter implements McpAppsAdapter {
  abstract readonly platform: string;

  private initialized = false;
  private handlers: MessageHandler[] = [];
  private boundListener: EventListener | null = null;
  private targetOrigin = "*";

  init(config: AdapterConfig): Promise<void> {
    if (this.initialized) {
      throw new Error(`[${this.platform}Adapter] Already initialized.`);
    }

    // Use resourceBaseUrl as targetOrigin instead of "*" (security)
    if (config.resourceBaseUrl) {
      try {
        const url = new URL(config.resourceBaseUrl);
        this.targetOrigin = url.origin;
      } catch {
        console.warn(
          `[${this.platform}Adapter] Invalid resourceBaseUrl, falling back to '*' targetOrigin:`,
          config.resourceBaseUrl,
        );
      }
    }

    this.boundListener = ((event: Event) => {
      try {
        // deno-lint-ignore no-explicit-any
        const msgEvent = event as any;
        const raw = msgEvent.data;
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;

        if (data && typeof data === "object" && data.jsonrpc === "2.0") {
          const message = data as McpAppsMessage;
          for (const handler of this.handlers) {
            handler(message);
          }
        }
      } catch {
        // Non-JSON messages are expected (other postMessage traffic),
        // silently ignore to avoid log noise.
      }
    }) as EventListener;

    if (typeof _global.addEventListener === "function") {
      _global.addEventListener("message", this.boundListener);
    }

    this.initialized = true;
    return Promise.resolve();
  }

  sendToHost(message: McpAppsMessage): void {
    if (!this.initialized) {
      throw new Error(
        `[${this.platform}Adapter] Not initialized. Call init() first.`,
      );
    }

    if (typeof _global.parent?.postMessage === "function") {
      _global.parent.postMessage(JSON.stringify(message), this.targetOrigin);
    }
  }

  onMessageFromHost(handler: MessageHandler): void {
    this.handlers.push(handler);
  }

  destroy(): void {
    if (
      this.boundListener && typeof _global.removeEventListener === "function"
    ) {
      _global.removeEventListener("message", this.boundListener);
    }
    this.boundListener = null;
    this.handlers = [];
    this.initialized = false;
  }
}
