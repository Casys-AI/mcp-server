/**
 * JSON-RPC 2.0 message builders and validators for the MCP Apps protocol.
 *
 * Provides type-safe construction of all MCP Apps messages and a
 * message validator to guard incoming data at system boundaries.
 */

import type {
  HostCapabilities,
  HostContext,
  McpAppsErrorResponse,
  McpAppsMessage,
  McpAppsNotification,
  McpAppsRequest,
  McpAppsResponse,
} from "./types.ts";
import { McpAppsMethod } from "./types.ts";

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let _nextId = 1;

/** Generate a monotonically increasing request ID. */
export function nextRequestId(): number {
  return _nextId++;
}

/** Reset the ID counter. @internal — exported for tests only. */
export function resetRequestIdCounter(): void {
  _nextId = 1;
}

// ---------------------------------------------------------------------------
// Message type guards
// ---------------------------------------------------------------------------

/** Check if a value is a valid JSON-RPC 2.0 message. */
export function isJsonRpcMessage(value: unknown): value is McpAppsMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "jsonrpc" in value &&
    (value as Record<string, unknown>).jsonrpc === "2.0"
  );
}

/** Check if a message is a JSON-RPC request (has `id` and `method`). */
export function isRequest(msg: McpAppsMessage): msg is McpAppsRequest {
  return "method" in msg && "id" in msg;
}

/** Check if a message is a JSON-RPC notification (has `method`, no `id`). */
export function isNotification(
  msg: McpAppsMessage,
): msg is McpAppsNotification {
  return "method" in msg && !("id" in msg);
}

/** Check if a message is a JSON-RPC success response. */
export function isResponse(msg: McpAppsMessage): msg is McpAppsResponse {
  return "result" in msg && "id" in msg && !("method" in msg);
}

/** Check if a message is a JSON-RPC error response. */
export function isErrorResponse(
  msg: McpAppsMessage,
): msg is McpAppsErrorResponse {
  return "error" in msg && "id" in msg;
}

// ---------------------------------------------------------------------------
// Request builders (App -> Host)
// ---------------------------------------------------------------------------

/** Build a `ui/initialize` request. */
export function buildInitializeRequest(params: {
  protocolVersion: string;
  clientInfo: { name: string; version: string };
  capabilities?: Record<string, unknown>;
}): McpAppsRequest {
  return {
    jsonrpc: "2.0",
    id: nextRequestId(),
    method: McpAppsMethod.UI_INITIALIZE,
    params,
  };
}

/** Build a `tools/call` request. */
export function buildToolCallRequest(params: {
  name: string;
  arguments?: Record<string, unknown>;
}): McpAppsRequest {
  return {
    jsonrpc: "2.0",
    id: nextRequestId(),
    method: McpAppsMethod.TOOLS_CALL,
    params,
  };
}

/** Build a `resources/read` request. */
export function buildResourceReadRequest(params: {
  uri: string;
}): McpAppsRequest {
  return {
    jsonrpc: "2.0",
    id: nextRequestId(),
    method: McpAppsMethod.RESOURCES_READ,
    params,
  };
}

/** Build a `ui/open-link` request. */
export function buildOpenLinkRequest(params: {
  url: string;
}): McpAppsRequest {
  return {
    jsonrpc: "2.0",
    id: nextRequestId(),
    method: McpAppsMethod.UI_OPEN_LINK,
    params,
  };
}

/** Build a `ui/message` request. */
export function buildMessageRequest(params: {
  content: ReadonlyArray<{ type: string; text: string }>;
}): McpAppsRequest {
  return {
    jsonrpc: "2.0",
    id: nextRequestId(),
    method: McpAppsMethod.UI_MESSAGE,
    params,
  };
}

/** Build a `ui/update-model-context` request. */
export function buildUpdateModelContextRequest(params: {
  content: ReadonlyArray<{ type: string; text: string }>;
}): McpAppsRequest {
  return {
    jsonrpc: "2.0",
    id: nextRequestId(),
    method: McpAppsMethod.UI_UPDATE_MODEL_CONTEXT,
    params,
  };
}

/** Build a `ui/request-display-mode` request. */
export function buildDisplayModeRequest(params: {
  mode: "inline" | "fullscreen" | "pip";
}): McpAppsRequest {
  return {
    jsonrpc: "2.0",
    id: nextRequestId(),
    method: McpAppsMethod.UI_REQUEST_DISPLAY_MODE,
    params,
  };
}

// ---------------------------------------------------------------------------
// Notification builders (Host -> App)
// ---------------------------------------------------------------------------

/** Build a `ui/notifications/initialized` notification (App -> Host). */
export function buildInitializedNotification(): McpAppsNotification {
  return {
    jsonrpc: "2.0",
    method: McpAppsMethod.UI_NOTIFICATIONS_INITIALIZED,
  };
}

/** Build a `ui/notifications/tool-input` notification (Host -> App). */
export function buildToolInputNotification(params: {
  name: string;
  arguments?: Record<string, unknown>;
}): McpAppsNotification {
  return {
    jsonrpc: "2.0",
    method: McpAppsMethod.UI_TOOL_INPUT,
    params,
  };
}

/** Build a `ui/notifications/tool-result` notification (Host -> App). */
export function buildToolResultNotification(params: {
  content: ReadonlyArray<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}): McpAppsNotification {
  return {
    jsonrpc: "2.0",
    method: McpAppsMethod.UI_TOOL_RESULT,
    params,
  };
}

/** Build a `ui/notifications/tool-cancelled` notification (Host -> App). */
export function buildToolCancelledNotification(params?: {
  reason?: string;
}): McpAppsNotification {
  return {
    jsonrpc: "2.0",
    method: McpAppsMethod.UI_TOOL_CANCELLED,
    params,
  };
}

/** Build a `ui/notifications/host-context-changed` notification. */
export function buildHostContextChangedNotification(
  params: Partial<HostContext>,
): McpAppsNotification {
  return {
    jsonrpc: "2.0",
    method: McpAppsMethod.UI_HOST_CONTEXT_CHANGED,
    params: params as Record<string, unknown>,
  };
}

/** Build a `ui/resource-teardown` request (Host -> App). */
export function buildResourceTeardownRequest(params?: {
  reason?: string;
}): McpAppsRequest {
  return {
    jsonrpc: "2.0",
    id: nextRequestId(),
    method: McpAppsMethod.UI_RESOURCE_TEARDOWN,
    params,
  };
}

/** Build a `notifications/message` notification (logging). */
export function buildLogNotification(params: {
  level: "debug" | "info" | "warning" | "error";
  data?: unknown;
  logger?: string;
}): McpAppsNotification {
  return {
    jsonrpc: "2.0",
    method: McpAppsMethod.NOTIFICATIONS_MESSAGE,
    params,
  };
}

// ---------------------------------------------------------------------------
// Response builders
// ---------------------------------------------------------------------------

/** Build a `ui/initialize` success response. */
export function buildInitializeResponse(
  id: string | number,
  params: {
    protocolVersion: string;
    hostInfo: { name: string; version: string };
    hostCapabilities: HostCapabilities;
    hostContext: HostContext;
  },
): McpAppsResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: params,
  };
}

/** Build a generic JSON-RPC success response. */
export function buildSuccessResponse(
  id: string | number,
  result: unknown,
): McpAppsResponse {
  return { jsonrpc: "2.0", id, result };
}

/** Build a JSON-RPC error response. */
export function buildErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown,
): McpAppsErrorResponse {
  return {
    jsonrpc: "2.0",
    id,
    error: { code, message, ...(data !== undefined ? { data } : {}) },
  };
}

// ---------------------------------------------------------------------------
// Standard JSON-RPC error codes
// ---------------------------------------------------------------------------

export const JsonRpcErrorCode = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;
