import { assertEquals } from "@std/assert";
import {
  buildDisplayModeRequest,
  buildErrorResponse,
  buildHostContextChangedNotification,
  buildInitializedNotification,
  buildInitializeResponse,
  buildLogNotification,
  buildMessageRequest,
  buildOpenLinkRequest,
  buildResourceReadRequest,
  buildResourceTeardownRequest,
  buildSuccessResponse,
  buildToolCallRequest,
  buildToolCancelledNotification,
  buildToolInputNotification,
  buildToolResultNotification,
  buildUpdateModelContextRequest,
  isErrorResponse,
  isJsonRpcMessage,
  isNotification,
  isRequest,
  isResponse,
  JsonRpcErrorCode,
  nextRequestId,
  resetRequestIdCounter,
} from "../../src/core/protocol.ts";
import { McpAppsMethod } from "../../src/core/types.ts";

// Reset counter before each test group
Deno.test("protocol - resetRequestIdCounter", () => {
  resetRequestIdCounter();
  assertEquals(nextRequestId(), 1);
  assertEquals(nextRequestId(), 2);
  resetRequestIdCounter();
  assertEquals(nextRequestId(), 1);
});

// ---- Type guards ----

Deno.test("isJsonRpcMessage - valid message", () => {
  assertEquals(isJsonRpcMessage({ jsonrpc: "2.0", id: 1, method: "test" }), true);
});

Deno.test("isJsonRpcMessage - invalid", () => {
  assertEquals(isJsonRpcMessage(null), false);
  assertEquals(isJsonRpcMessage("hello"), false);
  assertEquals(isJsonRpcMessage({ jsonrpc: "1.0" }), false);
  assertEquals(isJsonRpcMessage({}), false);
});

Deno.test("isRequest - identifies requests", () => {
  assertEquals(isRequest({ jsonrpc: "2.0", id: 1, method: "test" }), true);
  assertEquals(isRequest({ jsonrpc: "2.0", method: "test" }), false);
  assertEquals(isRequest({ jsonrpc: "2.0", id: 1, result: "ok" }), false);
});

Deno.test("isNotification - identifies notifications", () => {
  assertEquals(isNotification({ jsonrpc: "2.0", method: "test" }), true);
  assertEquals(isNotification({ jsonrpc: "2.0", id: 1, method: "test" }), false);
});

Deno.test("isResponse - identifies success responses", () => {
  assertEquals(isResponse({ jsonrpc: "2.0", id: 1, result: "ok" }), true);
  assertEquals(isResponse({ jsonrpc: "2.0", id: 1, error: { code: 1, message: "err" } }), false);
});

Deno.test("isErrorResponse - identifies error responses", () => {
  assertEquals(
    isErrorResponse({ jsonrpc: "2.0", id: 1, error: { code: -32601, message: "not found" } }),
    true,
  );
  assertEquals(isErrorResponse({ jsonrpc: "2.0", id: 1, result: "ok" }), false);
});

// ---- Request builders ----

Deno.test("buildToolCallRequest", () => {
  resetRequestIdCounter();
  const req = buildToolCallRequest({ name: "get-time", arguments: { tz: "UTC" } });
  assertEquals(req.jsonrpc, "2.0");
  assertEquals(req.method, McpAppsMethod.TOOLS_CALL);
  assertEquals(req.params, { name: "get-time", arguments: { tz: "UTC" } });
  assertEquals(typeof req.id, "number");
});

Deno.test("buildResourceReadRequest", () => {
  resetRequestIdCounter();
  const req = buildResourceReadRequest({ uri: "ui://app/page.html" });
  assertEquals(req.method, McpAppsMethod.RESOURCES_READ);
  assertEquals(req.params, { uri: "ui://app/page.html" });
});

Deno.test("buildOpenLinkRequest", () => {
  resetRequestIdCounter();
  const req = buildOpenLinkRequest({ url: "https://example.com" });
  assertEquals(req.method, McpAppsMethod.UI_OPEN_LINK);
});

Deno.test("buildMessageRequest", () => {
  resetRequestIdCounter();
  const req = buildMessageRequest({ content: [{ type: "text", text: "hello" }] });
  assertEquals(req.method, McpAppsMethod.UI_MESSAGE);
});

Deno.test("buildUpdateModelContextRequest", () => {
  resetRequestIdCounter();
  const req = buildUpdateModelContextRequest({ content: [{ type: "text", text: "ctx" }] });
  assertEquals(req.method, McpAppsMethod.UI_UPDATE_MODEL_CONTEXT);
});

Deno.test("buildDisplayModeRequest", () => {
  resetRequestIdCounter();
  const req = buildDisplayModeRequest({ mode: "fullscreen" });
  assertEquals(req.method, McpAppsMethod.UI_REQUEST_DISPLAY_MODE);
  assertEquals(req.params, { mode: "fullscreen" });
});

// ---- Notification builders ----

Deno.test("buildInitializedNotification", () => {
  const notif = buildInitializedNotification();
  assertEquals(notif.jsonrpc, "2.0");
  assertEquals(notif.method, McpAppsMethod.UI_NOTIFICATIONS_INITIALIZED);
  assertEquals("id" in notif, false);
});

Deno.test("buildToolInputNotification", () => {
  const notif = buildToolInputNotification({ name: "get-time", arguments: {} });
  assertEquals(notif.method, McpAppsMethod.UI_TOOL_INPUT);
});

Deno.test("buildToolResultNotification", () => {
  const notif = buildToolResultNotification({
    content: [{ type: "text", text: "2026-02-09T12:00:00Z" }],
  });
  assertEquals(notif.method, McpAppsMethod.UI_TOOL_RESULT);
});

Deno.test("buildToolCancelledNotification", () => {
  const notif = buildToolCancelledNotification({ reason: "user cancelled" });
  assertEquals(notif.method, McpAppsMethod.UI_TOOL_CANCELLED);
});

Deno.test("buildHostContextChangedNotification", () => {
  const notif = buildHostContextChangedNotification({ theme: "dark" });
  assertEquals(notif.method, McpAppsMethod.UI_HOST_CONTEXT_CHANGED);
  assertEquals(notif.params, { theme: "dark" });
});

Deno.test("buildResourceTeardownRequest", () => {
  resetRequestIdCounter();
  const req = buildResourceTeardownRequest({ reason: "platform-close" });
  assertEquals(req.method, McpAppsMethod.UI_RESOURCE_TEARDOWN);
});

Deno.test("buildLogNotification", () => {
  const notif = buildLogNotification({ level: "info", data: "test log" });
  assertEquals(notif.method, McpAppsMethod.NOTIFICATIONS_MESSAGE);
  assertEquals(notif.params, { level: "info", data: "test log" });
});

// ---- Response builders ----

Deno.test("buildInitializeResponse", () => {
  const resp = buildInitializeResponse(1, {
    protocolVersion: "2025-11-25",
    hostInfo: { name: "test-bridge", version: "0.1.0" },
    hostCapabilities: { logging: {} },
    hostContext: { theme: "dark" },
  });
  assertEquals(resp.jsonrpc, "2.0");
  assertEquals(resp.id, 1);
  const result = resp.result as Record<string, unknown>;
  assertEquals(result.protocolVersion, "2025-11-25");
});

Deno.test("buildSuccessResponse", () => {
  const resp = buildSuccessResponse(42, { data: "ok" });
  assertEquals(resp.id, 42);
  assertEquals(resp.result, { data: "ok" });
});

Deno.test("buildErrorResponse", () => {
  const resp = buildErrorResponse(1, JsonRpcErrorCode.METHOD_NOT_FOUND, "not found");
  assertEquals(resp.error.code, -32601);
  assertEquals(resp.error.message, "not found");
});

Deno.test("buildErrorResponse - with data", () => {
  const resp = buildErrorResponse(1, -32603, "internal", { detail: "stack" });
  assertEquals(resp.error.data, { detail: "stack" });
});

// ---- Error codes ----

Deno.test("JsonRpcErrorCode constants", () => {
  assertEquals(JsonRpcErrorCode.PARSE_ERROR, -32700);
  assertEquals(JsonRpcErrorCode.INVALID_REQUEST, -32600);
  assertEquals(JsonRpcErrorCode.METHOD_NOT_FOUND, -32601);
  assertEquals(JsonRpcErrorCode.INVALID_PARAMS, -32602);
  assertEquals(JsonRpcErrorCode.INTERNAL_ERROR, -32603);
});
