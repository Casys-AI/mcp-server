/**
 * Core types for the MCP Apps Bridge protocol.
 *
 * Defines the message envelope, resource URIs, adapter configuration,
 * and tool declarations used throughout the bridge.
 */

// ---------------------------------------------------------------------------
// JSON-RPC 2.0 envelope for MCP Apps messages
// ---------------------------------------------------------------------------

/** A JSON-RPC 2.0 request sent between host and MCP App. */
export interface McpAppsRequest {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

/** A JSON-RPC 2.0 success response. */
export interface McpAppsResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number;
  readonly result: unknown;
}

/** A JSON-RPC 2.0 error response. */
export interface McpAppsErrorResponse {
  readonly jsonrpc: "2.0";
  readonly id: string | number | null;
  readonly error: {
    readonly code: number;
    readonly message: string;
    readonly data?: unknown;
  };
}

/** A JSON-RPC 2.0 notification (no id, no response expected). */
export interface McpAppsNotification {
  readonly jsonrpc: "2.0";
  readonly method: string;
  readonly params?: Record<string, unknown>;
}

/** Union of all JSON-RPC message shapes. */
export type McpAppsMessage =
  | McpAppsRequest
  | McpAppsResponse
  | McpAppsErrorResponse
  | McpAppsNotification;

// ---------------------------------------------------------------------------
// Resource URI (ui:// scheme)
// ---------------------------------------------------------------------------

/** Parsed representation of a `ui://` resource URI. */
export interface ResourceUri {
  /** The raw URI string, e.g. `ui://my-app/index.html`. */
  readonly raw: string;
  /** Server / app identifier (host portion of the URI). */
  readonly server: string;
  /** Path within the app, e.g. `/index.html`. */
  readonly path: string;
  /** Optional query parameters. */
  readonly query: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Adapter configuration
// ---------------------------------------------------------------------------

/** Platform-specific configuration supplied when initializing an adapter. */
export interface AdapterConfig {
  /** Base URL where the resource server is reachable by the client. */
  readonly resourceBaseUrl: string;
  /** Optional platform-specific settings (e.g. Telegram bot token). */
  readonly platformOptions?: Record<string, unknown>;
}

/** Global bridge options shared across all adapters. */
export interface BridgeOptions {
  /** Port for the local resource server. Defaults to 0 (OS-assigned). */
  readonly resourceServerPort?: number;
  /** Origin allowlist for CORS. Defaults to `["*"]`. */
  readonly allowedOrigins?: readonly string[];
  /** Enable debug logging. */
  readonly debug?: boolean;
}

// ---------------------------------------------------------------------------
// MCP tool declaration with UI metadata
// ---------------------------------------------------------------------------

/** UI metadata attached to an MCP tool via `_meta`. */
export interface McpToolUiMeta {
  /** Resource URI pointing to the interactive UI for this tool. */
  readonly resourceUri: string;
  /** Optional human-readable label for the UI. */
  readonly label?: string;
  /** Optional width hint in pixels. */
  readonly width?: number;
  /** Optional height hint in pixels. */
  readonly height?: number;
}

/** CSP (Content Security Policy) metadata for an MCP App resource. */
export interface McpToolUiCsp {
  /** Allowed script-src origins. */
  readonly scriptSources?: readonly string[];
  /** Allowed connect-src origins. */
  readonly connectSources?: readonly string[];
  /** Allowed frame-ancestors origins. */
  readonly frameAncestors?: readonly string[];
}

/** Iframe sandbox permission flags that an MCP App can request. */
export type McpAppPermission =
  | "allow-downloads"
  | "allow-forms"
  | "allow-modals"
  | "allow-popups"
  | "allow-same-origin"
  | "allow-scripts"
  | "camera"
  | "microphone"
  | "geolocation"
  | "clipboard-read"
  | "clipboard-write";

/** An MCP tool declaration that carries `_meta.ui`. */
export interface McpToolDeclaration {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema: Record<string, unknown>;
  readonly _meta?: {
    readonly ui?: McpToolUiMeta & {
      /** CSP directives for the UI resource. */
      readonly csp?: McpToolUiCsp;
      /** Additional sandbox permissions requested by the app. */
      readonly permissions?: readonly McpAppPermission[];
    };
  };
}

// ---------------------------------------------------------------------------
// MCP Apps JSON-RPC method constants
// ---------------------------------------------------------------------------

/**
 * Well-known JSON-RPC method names used in the MCP Apps protocol (SEP-1865).
 *
 * App -> Host requests.
 */
export const McpAppsMethod = {
  // Initialization handshake
  UI_INITIALIZE: "ui/initialize",
  UI_NOTIFICATIONS_INITIALIZED: "ui/notifications/initialized",

  // App -> Host requests
  TOOLS_CALL: "tools/call",
  RESOURCES_READ: "resources/read",
  UI_OPEN_LINK: "ui/open-link",
  UI_MESSAGE: "ui/message",
  UI_UPDATE_MODEL_CONTEXT: "ui/update-model-context",
  UI_REQUEST_DISPLAY_MODE: "ui/request-display-mode",
  NOTIFICATIONS_MESSAGE: "notifications/message",

  // Host -> App notifications
  UI_TOOL_INPUT: "ui/notifications/tool-input",
  UI_TOOL_INPUT_PARTIAL: "ui/notifications/tool-input-partial",
  UI_TOOL_RESULT: "ui/notifications/tool-result",
  UI_TOOL_CANCELLED: "ui/notifications/tool-cancelled",
  UI_HOST_CONTEXT_CHANGED: "ui/notifications/host-context-changed",
  UI_SIZE_CHANGED: "ui/notifications/size-changed",
  UI_RESOURCE_TEARDOWN: "ui/resource-teardown",
} as const;

// ---------------------------------------------------------------------------
// Host context (provided to MCP App during ui/initialize)
// ---------------------------------------------------------------------------

/** Dimensions of the container rendering the MCP App. */
export interface ContainerDimensions {
  readonly width?: number;
  readonly maxWidth?: number;
  readonly height?: number;
  readonly maxHeight?: number;
}

/** Safe area insets (e.g. notch, status bar) from the platform. */
export interface SafeAreaInsets {
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
  readonly left: number;
}

/** Host theme and style information provided to the MCP App. */
export interface HostContextStyles {
  /** CSS custom properties for theming (e.g. `--color-background-primary`). */
  readonly variables?: Record<string, string>;
  /** Optional CSS with font declarations. */
  readonly css?: { readonly fonts?: string };
}

/**
 * Host context provided to an MCP App during `ui/initialize`.
 *
 * Contains theme, dimensions, locale, and other environment info
 * needed for the app to adapt to its container.
 */
export interface HostContext {
  readonly theme: "light" | "dark";
  readonly styles?: HostContextStyles;
  readonly containerDimensions?: ContainerDimensions;
  readonly platform?: "web" | "desktop" | "mobile";
  readonly locale?: string;
  readonly timeZone?: string;
  readonly safeAreaInsets?: SafeAreaInsets;
}

/** Display mode an MCP App can request via `ui/request-display-mode`. */
export type DisplayMode = "inline" | "fullscreen" | "pip";

// ---------------------------------------------------------------------------
// Host capabilities
// ---------------------------------------------------------------------------

/**
 * Capabilities the host exposes to the MCP App during `ui/initialize`.
 */
export interface HostCapabilities {
  readonly serverTools?: { readonly listChanged?: boolean };
  readonly serverResources?: { readonly listChanged?: boolean };
  readonly logging?: Record<string, never>;
  readonly openLinks?: Record<string, never>;
}

// ---------------------------------------------------------------------------
// Platform lifecycle events (bridge-specific)
// ---------------------------------------------------------------------------

/**
 * Lifecycle events generated by platform adapters.
 *
 * The bridge translates these into MCP Apps notifications
 * (e.g. `ui/notifications/host-context-changed`).
 */
export interface LifecycleEvent {
  readonly type:
    | "theme-changed"
    | "viewport-changed"
    | "activated"
    | "deactivated"
    | "teardown";
  readonly reason?: string;
}
