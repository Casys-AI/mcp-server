/**
 * Abstract adapter interfaces for platform integrations.
 *
 * Two adapter levels:
 * - `McpAppsAdapter`: Low-level message transport (postMessage replacement).
 * - `PlatformAdapter`: High-level platform SDK abstraction (theme, viewport,
 *   native UI, auth). Used by BridgeClient to synthesize HostContext and
 *   translate platform events into MCP notifications.
 */

import type {
  AdapterConfig,
  ContainerDimensions,
  HostContext,
  LifecycleEvent,
  McpAppsMessage,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Low-level transport adapter
// ---------------------------------------------------------------------------

/** Handler function invoked when the host sends a message to the MCP App. */
export type MessageHandler = (message: McpAppsMessage) => void;

/**
 * Low-level transport adapter contract.
 *
 * Replaces the iframe postMessage channel with a platform-specific
 * communication mechanism. Each platform implements this to bridge
 * JSON-RPC messages between the MCP App and the resource server.
 *
 * Lifecycle: `init()` -> use -> `destroy()`.
 */
export interface McpAppsAdapter {
  /** Unique platform identifier (e.g. `"telegram"`, `"line"`). */
  readonly platform: string;

  /**
   * Initialize the adapter with platform-specific configuration.
   * Must be called before any other method.
   */
  init(config: AdapterConfig): Promise<void>;

  /**
   * Send a JSON-RPC message from the MCP App to the host.
   * Throws if the adapter has not been initialized.
   */
  sendToHost(message: McpAppsMessage): void;

  /**
   * Register a handler that is called when the host sends a message
   * to the MCP App.
   */
  onMessageFromHost(handler: MessageHandler): void;

  /**
   * Tear down the adapter, releasing all resources and listeners.
   * After calling `destroy()`, the adapter must not be reused.
   */
  destroy(): void;
}

// ---------------------------------------------------------------------------
// High-level platform adapter
// ---------------------------------------------------------------------------

/** Handler for platform lifecycle events. */
export type LifecycleEventHandler = (event: LifecycleEvent) => void;

/**
 * High-level platform adapter contract.
 *
 * Abstracts platform-specific SDK features (theme, viewport, native UI,
 * auth) into a uniform interface that the BridgeClient uses to:
 * - Build the initial `HostContext` for `ui/initialize`
 * - Map platform events to `ui/notifications/host-context-changed`
 * - Execute platform-specific actions (open link, expand viewport)
 */
export interface PlatformAdapter {
  /** Platform name (e.g. `"telegram"`, `"line"`). */
  readonly name: string;

  /**
   * Initialize the platform SDK and return the initial host context.
   * This is called once during BridgeClient startup.
   */
  initialize(): Promise<HostContext>;

  /** Get the current theme from the platform. */
  getTheme(): "light" | "dark";

  /** Get the current container dimensions from the platform. */
  getContainerDimensions(): ContainerDimensions;

  /**
   * Subscribe to platform lifecycle events (theme change, viewport
   * resize, activation, teardown).
   */
  onLifecycleEvent(handler: LifecycleEventHandler): void;

  /** Open an external link using the platform's native method. */
  openLink(url: string): Promise<void>;

  /**
   * Send a message via the platform's native messaging (if supported).
   *
   * WARNING (Telegram): `sendData()` closes the Mini App. Use with caution.
   */
  sendMessage?(text: string): Promise<void>;

  /**
   * Get platform-specific auth data for forwarding to the MCP server.
   * E.g. Telegram `initData`, LIFF access token.
   */
  getAuthData?(): Record<string, unknown>;
}
