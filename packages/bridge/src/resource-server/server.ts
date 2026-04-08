/**
 * HTTP resource server for MCP Apps Bridge.
 *
 * Serves `ui://` resources as HTTP pages, injects bridge.js, sets CSP
 * headers, and provides a WebSocket endpoint for bidirectional JSON-RPC
 * communication between the BridgeClient (in the webview) and the MCP server.
 *
 * Endpoints:
 * - `GET /app/<server>/<path>` — Serve MCP App HTML with injected bridge.js
 * - `GET /bridge.js?platform=<p>&session=<s>` — Serve the bridge client script
 * - `GET /health` — Health check
 * - `WS  /bridge?session=<id>` — WebSocket for JSON-RPC messaging
 *
 * Uses Deno.serve() for the HTTP server.
 */

import type { BridgeOptions, McpAppsMessage } from "../core/types.ts";
import { buildErrorResponse, isJsonRpcMessage } from "../core/protocol.ts";
import { buildCspHeader } from "./csp.ts";
import type { CspOptions } from "./csp.ts";
import { createTelegramAuthHandler } from "./auth.ts";
import type { BridgeAuthHandler } from "./auth.ts";
import type { McpBackend } from "./backend.ts";
import { injectBridgeScript } from "./injector.ts";
import { SessionStore } from "./session.ts";
import type { BridgeSession, PendingNotification } from "./session.ts";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Resource server configuration. */
export interface ResourceServerConfig {
  /** Directory containing UI assets, keyed by server name (from ui:// URI). */
  readonly assetDirectories: Record<string, string>;
  /** Platform name for bridge.js configuration. */
  readonly platform: string;
  /** Bridge options (port, CORS, debug). */
  readonly options?: BridgeOptions;
  /** Custom CSP options applied to served HTML pages. */
  readonly csp?: CspOptions;
  /**
   * Optional platform auth handler. If provided, the webview must authenticate
   * over WebSocket before it can send JSON-RPC traffic.
   */
  readonly auth?: BridgeAuthHandler;
  /**
   * Convenience shortcut for Telegram auth. If `auth` is omitted and
   * `platform === "telegram"`, this token is used to create the default
   * Telegram auth handler.
   */
  readonly telegramBotToken?: string;
  /**
   * Optional MCP backend used to forward UI messages and resolve `ui://`
   * resources via the built-in `/ui?uri=...` route.
   */
  readonly backend?: McpBackend;
  /**
   * Path of the built-in UI proxy route. Defaults to `/ui`.
   * Set to `null` to disable the built-in route entirely.
   */
  readonly uiPath?: string | null;
  /**
   * Handler called when a JSON-RPC message is received from a webview.
   * Runs before `backend.handleMessage()`. Return `null` to fall through
   * to the configured backend (if any).
   * Only called for authenticated sessions.
   */
  readonly onMessage?: (
    session: BridgeSession,
    message: McpAppsMessage,
  ) => Promise<McpAppsMessage | null>;
  /**
   * Optional handler for custom HTTP routes.
   * Called for requests that don't match built-in routes
   * (/health, /session, /bridge, /bridge.js, /app/).
   *
   * Return values:
   * - `Response` — sent directly to the client (no bridge injection)
   * - `{ html: string; pendingNotifications?: PendingNotification[] }` —
   *   HTML content; bridge.js will be injected, a session created, and
   *   CSP headers set automatically. If `pendingNotifications` is provided,
   *   they are buffered on the session and sent via WebSocket when the
   *   client connects (e.g. `ui/notifications/tool-result`).
   * - `null` — the server responds with 404
   */
  readonly onHttpRequest?: (
    request: Request,
  ) => Promise<
    | Response
    | { html: string; pendingNotifications?: PendingNotification[] }
    | null
  >;
}

/** Tool result data to be pushed to an MCP App via WebSocket. */
export interface ToolResultData {
  readonly content: ReadonlyArray<
    { type: string; text?: string; data?: string; mimeType?: string }
  >;
  readonly isError?: boolean;
}

/** A running resource server instance. */
export interface ResourceServer {
  /** The base URL at which the server is listening. */
  readonly baseUrl: string;
  /** The session store (for inspection/testing). */
  readonly sessions: SessionStore;
  /**
   * Store a tool result for later delivery to an MCP App.
   * Returns an opaque reference ID. Pass it in the page URL (e.g. `?ref=abc`).
   *
   * When the page is served via `onHttpRequest` returning `{ html }`, the
   * server automatically extracts `?ref=` from the request URL, looks up
   * the stored result, and buffers it as a `ui/notifications/tool-result`
   * notification on the session. No manual handling is needed.
   *
   * Stored results auto-expire after 5 minutes.
   */
  storeToolResult(result: ToolResultData): string;
  /**
   * Retrieve and consume a stored tool result by reference.
   * Returns `undefined` if the ref doesn't exist or has expired.
   * The result is deleted after retrieval (single-use).
   */
  consumeToolResult(ref: string): ToolResultData | undefined;
  /** Stop the server and release resources. */
  stop(): Promise<void>;
}

// ---------------------------------------------------------------------------
// MIME types
// ---------------------------------------------------------------------------

const MIME_MAP: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function mimeType(path: string): string {
  const ext = path.slice(path.lastIndexOf("."));
  return MIME_MAP[ext] ?? "application/octet-stream";
}

/** Normalize a path by resolving `.` and `..` segments without filesystem access. */
function normalizePath(p: string): string {
  const parts = p.split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      result.pop();
    } else if (part !== "." && part !== "") {
      result.push(part);
    }
  }
  return (p.startsWith("/") ? "/" : "") + result.join("/");
}

/** Normalize a directory path, ensuring it ends with `/`. */
function normalizeDir(p: string): string {
  const n = normalizePath(p);
  return n.endsWith("/") ? n : n + "/";
}

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

/**
 * Start the resource server.
 *
 * @returns A running ResourceServer with baseUrl and stop() method.
 */
export function startResourceServer(
  config: ResourceServerConfig,
): ResourceServer {
  const authHandler = config.auth ??
    (config.telegramBotToken
      ? createTelegramAuthHandler(config.telegramBotToken)
      : undefined);

  // -----------------------------------------------------------------------
  // Fail-fast: telegram requires an auth strategy by default
  // -----------------------------------------------------------------------
  if (config.platform === "telegram" && !authHandler) {
    throw new Error(
      "[ResourceServer] Telegram requires an auth handler. " +
        "Provide `telegramBotToken` or a custom `auth` handler.",
    );
  }

  const requiresAuth = !!authHandler;
  const port = config.options?.resourceServerPort ?? 0;
  const allowedOrigins = config.options?.allowedOrigins ?? ["*"];
  const debug = config.options?.debug ?? false;
  const uiPath = config.uiPath === undefined ? "/ui" : config.uiPath;
  const MAX_SESSIONS = 10_000;
  const sessions = new SessionStore();
  const wsConnections = new Map<string, WebSocket>();

  // Tool result store: ref -> data (auto-expires after 5 min)
  const toolResultStore = new Map<string, ToolResultData>();
  const toolResultTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const TOOL_RESULT_TTL = 5 * 60 * 1000;

  function storeToolResult(result: ToolResultData): string {
    const ref = generateRef();
    toolResultStore.set(ref, result);
    const timer = setTimeout(() => {
      toolResultStore.delete(ref);
      toolResultTimers.delete(ref);
    }, TOOL_RESULT_TTL);
    toolResultTimers.set(ref, timer);
    return ref;
  }

  function consumeToolResult(ref: string): ToolResultData | undefined {
    const result = toolResultStore.get(ref);
    if (result) {
      toolResultStore.delete(ref);
      const timer = toolResultTimers.get(ref);
      if (timer) {
        clearTimeout(timer);
        toolResultTimers.delete(ref);
      }
    }
    return result;
  }

  // Periodic session cleanup + stale WebSocket eviction
  const cleanupInterval = setInterval(() => {
    const removed = sessions.cleanup();
    if (removed > 0) {
      log("Cleaned up", removed, "expired session(s)");
    }
    // Close WebSocket connections whose session has expired
    for (const [sessionId, ws] of wsConnections) {
      if (!sessions.get(sessionId)) {
        log("Closing stale WebSocket:", sessionId);
        try {
          ws.close(4002, "Session expired");
        } catch { /* already closed */ }
        wsConnections.delete(sessionId);
      }
    }
  }, 60_000);

  function log(...args: unknown[]): void {
    if (debug) {
      console.log("[ResourceServer]", ...args);
    }
  }

  function corsHeaders(request?: Request): Record<string, string> {
    let origin: string;
    if (allowedOrigins.includes("*")) {
      origin = "*";
    } else if (request) {
      // Reflect the request origin if it's in the allowlist (HTTP spec: only one origin allowed)
      const reqOrigin = request.headers.get("origin") ?? "";
      origin = allowedOrigins.includes(reqOrigin)
        ? reqOrigin
        : allowedOrigins[0];
    } else {
      origin = allowedOrigins[0];
    }
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }

  async function handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    log(request.method, path);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // Health check
    if (path === "/health") {
      return Response.json(
        { status: "ok", sessions: sessions.size },
        { headers: corsHeaders(request) },
      );
    }

    // Serve bridge.js client script
    if (path === "/bridge.js") {
      return await serveBridgeScript(corsHeaders(request));
    }

    // Session creation (rate-limited to prevent memory exhaustion DoS)
    if (path === "/session" && request.method === "POST") {
      if (sessions.size >= MAX_SESSIONS) {
        log(
          "Session creation rejected: max sessions reached (",
          MAX_SESSIONS,
          ")",
        );
        return new Response("Too many active sessions", {
          status: 429,
          headers: corsHeaders(request),
        });
      }
      const session = sessions.create(config.platform);
      log("Session created:", session.id);
      return Response.json(
        { sessionId: session.id },
        { headers: corsHeaders(request) },
      );
    }

    // WebSocket bridge endpoint
    if (path === "/bridge") {
      const sessionId = url.searchParams.get("session");
      if (!sessionId) {
        return new Response("Missing session parameter", { status: 400 });
      }

      // Session must exist (created via POST /session or HTML page load)
      const session = sessions.get(sessionId);
      if (!session) {
        return new Response(
          "Unknown or expired session. Create one via POST /session first.",
          { status: 403 },
        );
      }

      const upgrade = request.headers.get("upgrade")?.toLowerCase();
      if (upgrade !== "websocket") {
        return new Response("Expected WebSocket upgrade", { status: 426 });
      }

      // deno-lint-ignore no-explicit-any
      const { socket, response } = (Deno as any).upgradeWebSocket(request);

      socket.onopen = () => {
        wsConnections.set(sessionId, socket);
        sessions.touch(sessionId);
        log("WebSocket connected:", sessionId);

        // Flush pending notifications immediately — bridge.js queues
        // them until the app has called ui/initialize, then replays.
        if (
          session.pendingNotifications &&
          session.pendingNotifications.length > 0
        ) {
          const pending = session.pendingNotifications;
          session.pendingNotifications = undefined;
          for (const notification of pending) {
            if (socket.readyState === 1 /* OPEN */) {
              const payload = JSON.stringify(notification);
              log("Flushing pending notification:", notification.method);
              socket.send(payload);
            }
          }
        }
      };

      socket.onmessage = async (event: MessageEvent) => {
        sessions.touch(sessionId);

        try {
          const data = typeof event.data === "string"
            ? JSON.parse(event.data)
            : event.data;

          // -------------------------------------------------------------------
          // Auth-on-first-message: handle auth before any JSON-RPC
          // -------------------------------------------------------------------
          if (requiresAuth && !session.authenticated) {
            if (isRecord(data) && data.type === "auth" && authHandler) {
              try {
                const authResult = await authHandler(session, data);
                if (authResult.valid) {
                  session.authenticated = true;
                  session.principalId = authResult.principalId;
                  if (typeof authResult.principalId === "number") {
                    session.userId = authResult.principalId;
                  }
                  session.username = authResult.username;
                  session.authContext = authResult.context;
                  log(
                    "Authenticated session",
                    sessionId,
                    "principal:",
                    authResult.principalId,
                  );
                  if (socket.readyState === 1) {
                    socket.send(JSON.stringify({
                      type: "auth_ok",
                      principalId: authResult.principalId,
                      ...(typeof authResult.principalId === "number"
                        ? { userId: authResult.principalId }
                        : {}),
                      ...(authResult.username
                        ? { username: authResult.username }
                        : {}),
                    }));
                  }
                } else {
                  log("Auth failed for", sessionId, ":", authResult.error);
                  if (socket.readyState === 1) {
                    socket.send(
                      JSON.stringify({
                        type: "auth_error",
                        error: authResult.error,
                      }),
                    );
                    socket.close(4001, "Authentication failed");
                  }
                }
              } catch (err) {
                const errorMessage = err instanceof Error
                  ? err.message
                  : String(err);
                log("Auth handler error for", sessionId, ":", errorMessage);
                if (socket.readyState === 1) {
                  socket.send(
                    JSON.stringify({ type: "auth_error", error: errorMessage }),
                  );
                  socket.close(4001, "Authentication failed");
                }
              }
              return;
            }

            // Non-auth message on unauthenticated session — reject
            log("Unauthenticated message from", sessionId, "— closing");
            if (socket.readyState === 1) {
              socket.send(
                JSON.stringify({
                  type: "auth_error",
                  error:
                    "Authentication required. Send { type: 'auth', initData: '...' } first.",
                }),
              );
              socket.close(4003, "Authentication required");
            }
            return;
          }

          // -------------------------------------------------------------------
          // Normal JSON-RPC message handling (authenticated or auth not required)
          // -------------------------------------------------------------------
          if (!isJsonRpcMessage(data)) {
            log("Non-JSON-RPC message from", sessionId);
            return;
          }

          const message = data as McpAppsMessage;
          log(
            "Received from",
            sessionId,
            ":",
            (message as { method?: string }).method ?? "response",
          );

          const response = await routeMessage(
            session,
            message,
            config.onMessage,
            config.backend,
          );
          if (response && socket.readyState === 1 /* OPEN */) {
            socket.send(JSON.stringify(response));
          }
        } catch (err) {
          log("Error handling message from", sessionId, ":", err);
          if (isJsonRpcMessageCandidate(event.data)) {
            const candidate = parseJsonRpcCandidate(event.data);
            if (
              candidate && "method" in candidate && "id" in candidate &&
              socket.readyState === 1
            ) {
              const errorMessage = err instanceof Error
                ? err.message
                : String(err);
              socket.send(
                JSON.stringify(
                  buildErrorResponse(candidate.id, -32603, errorMessage),
                ),
              );
            }
          }
        }
      };

      socket.onclose = () => {
        wsConnections.delete(sessionId);
        log("WebSocket disconnected:", sessionId);
      };

      socket.onerror = (e: Event) => {
        log("WebSocket error:", sessionId, e);
      };

      return response;
    }

    // Serve MCP App assets: /app/<server>/<path>
    if (path.startsWith("/app/")) {
      return await serveAppAsset(path.slice(5), config, corsHeaders(request));
    }

    // Custom HTTP request handler (proxy, additional routes, etc.)
    if (config.onHttpRequest) {
      const result = await config.onHttpRequest(request);
      if (result) {
        if (result instanceof Response) {
          return result;
        }
        // { html, pendingNotifications? } — inject bridge.js, create session, set CSP
        // The original request is passed so serveProxiedHtml can auto-resolve ?ref=
        return serveProxiedHtml(
          result.html,
          config,
          corsHeaders(request),
          request,
          result.pendingNotifications,
        );
      }
    }

    if (uiPath && path === uiPath && request.method === "GET") {
      return await serveBackendUiResource(
        request,
        config,
        corsHeaders(request),
      );
    }

    return new Response("Not Found", {
      status: 404,
      headers: corsHeaders(request),
    });
  }

  async function serveAppAsset(
    assetPath: string,
    cfg: ResourceServerConfig,
    headers: Record<string, string>,
  ): Promise<Response> {
    // Parse: <server>/<file-path>
    const slashIdx = assetPath.indexOf("/");
    if (slashIdx < 0) {
      return new Response("Invalid asset path", { status: 400, headers });
    }

    const serverName = assetPath.slice(0, slashIdx);
    const filePath = assetPath.slice(slashIdx + 1) || "index.html";

    const baseDir = cfg.assetDirectories[serverName];
    if (!baseDir) {
      return new Response(`Unknown app server: ${serverName}`, {
        status: 404,
        headers,
      });
    }

    // Prevent path traversal: normalize both paths and compare
    const normalizedBase = normalizeDir(baseDir);
    const resolved = normalizePath(`${normalizedBase}/${filePath}`);
    if (!resolved.startsWith(normalizedBase)) {
      return new Response("Forbidden", { status: 403, headers });
    }

    try {
      const mime = mimeType(filePath);
      const isText = mime.startsWith("text/") ||
        mime.startsWith("application/javascript") ||
        mime.startsWith("application/json") ||
        mime.startsWith("image/svg+xml");

      if (isText) {
        const content = await Deno.readTextFile(resolved);

        // For HTML files, inject bridge script and set CSP
        if (mime.startsWith("text/html")) {
          const session = sessions.create(cfg.platform);
          const bridgeScriptUrl = buildBridgeScriptUrl(
            cfg.platform,
            session.id,
            requiresAuth,
            debug,
          );
          const injected = injectBridgeScript(content, bridgeScriptUrl);
          const cspHeader = buildCspHeader(cfg.csp);

          return new Response(injected, {
            status: 200,
            headers: {
              ...headers,
              "Content-Type": mime,
              "Content-Security-Policy": cspHeader,
            },
          });
        }

        return new Response(content, {
          status: 200,
          headers: { ...headers, "Content-Type": mime },
        });
      }

      // Binary files (images, fonts, etc.)
      const content = await Deno.readFile(resolved);
      return new Response(content, {
        status: 200,
        headers: { ...headers, "Content-Type": mime },
      });
    } catch (err) {
      log(
        "Asset not found:",
        resolved,
        err instanceof Error ? err.message : err,
      );
      return new Response("File not found", { status: 404, headers });
    }
  }

  /**
   * Serve externally-fetched HTML with bridge.js injection.
   * Creates a session, injects bridge script, and sets CSP — same as local assets.
   *
   * Automatically checks for a `?ref=` query parameter on the original request.
   * If found, looks up the stored tool result and builds a
   * `ui/notifications/tool-result` notification buffered on the session.
   *
   * Additional `notifications` (from the `onHttpRequest` handler) are also
   * buffered. The `?ref=` auto-notification is prepended before any extras.
   */
  function serveProxiedHtml(
    html: string,
    cfg: ResourceServerConfig,
    headers: Record<string, string>,
    originalRequest?: Request,
    notifications?: PendingNotification[],
    cspOverride?: CspOptions,
  ): Response {
    const session = sessions.create(cfg.platform);

    // Auto-resolve ?ref= from the original request URL
    const allNotifications: PendingNotification[] = [];

    if (originalRequest) {
      const reqUrl = new URL(originalRequest.url);
      const dataRef = reqUrl.searchParams.get("ref");
      if (dataRef) {
        const toolResult = consumeToolResult(dataRef);
        if (toolResult) {
          log("Auto-attaching tool-result for ref=" + dataRef);
          allNotifications.push(buildToolResultFromData(toolResult));
        }
      }
    }

    if (notifications && notifications.length > 0) {
      allNotifications.push(...notifications);
    }

    if (allNotifications.length > 0) {
      session.pendingNotifications = allNotifications;
      log(
        "Buffered",
        allNotifications.length,
        "notification(s) for session",
        session.id,
      );
    }

    const bridgeScriptUrl = buildBridgeScriptUrl(
      cfg.platform,
      session.id,
      requiresAuth,
      debug,
    );
    const injected = injectBridgeScript(html, bridgeScriptUrl);
    const cspHeader = buildCspHeader(mergeCspOptions(cfg.csp, cspOverride));

    return new Response(injected, {
      status: 200,
      headers: {
        ...headers,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": cspHeader,
      },
    });
  }

  async function serveBackendUiResource(
    request: Request,
    cfg: ResourceServerConfig,
    headers: Record<string, string>,
  ): Promise<Response> {
    const backend = cfg.backend;
    if (!backend?.readResource) {
      return new Response("UI proxy not configured", { status: 404, headers });
    }

    const url = new URL(request.url);
    const uri = url.searchParams.get("uri");
    if (!uri || !uri.startsWith("ui://")) {
      return new Response("Missing or invalid ?uri parameter", {
        status: 400,
        headers,
      });
    }

    try {
      const resource = await backend.readResource(uri, request);
      if (!resource) {
        return new Response(`Resource not found: ${uri}`, {
          status: 404,
          headers,
        });
      }

      if (typeof resource === "string") {
        return serveProxiedHtml(resource, cfg, headers, request);
      }

      return serveProxiedHtml(
        resource.html,
        cfg,
        headers,
        request,
        resource.pendingNotifications,
        resource.csp,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      log("Failed to resolve UI resource", uri, ":", errorMessage);
      return new Response(`Failed to resolve resource: ${errorMessage}`, {
        status: 502,
        headers,
      });
    }
  }

  // Resolve the path to bridge.js relative to this module
  const bridgeJsPath = new URL("../client/bridge.js", import.meta.url);

  async function serveBridgeScript(
    headers: Record<string, string>,
  ): Promise<Response> {
    try {
      const content = await (await fetch(bridgeJsPath)).text();
      return new Response(content, {
        status: 200,
        headers: {
          ...headers,
          "Content-Type": "application/javascript; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    } catch (err) {
      log(
        "Failed to serve bridge.js:",
        err instanceof Error ? err.message : err,
      );
      return new Response("bridge.js not found", { status: 500, headers });
    }
  }

  // Start the server
  // deno-lint-ignore no-explicit-any
  const server = (Deno as any).serve({
    port,
    handler: handleRequest,
    onListen: (addr: { port: number }) => {
      log(`Listening on http://localhost:${addr.port}`);
    },
  });

  // Wait for the server to be ready and get the actual port
  // Deno.serve returns a server with addr
  const addr = server.addr;
  const actualPort = addr?.port ?? port;
  const baseUrl = `http://localhost:${actualPort}`;

  return {
    baseUrl,
    sessions,
    storeToolResult,
    consumeToolResult,
    async stop() {
      clearInterval(cleanupInterval);
      // Close all WebSocket connections
      for (const [, ws] of wsConnections) {
        try {
          ws.close();
        } catch (err) {
          log(
            "Error closing WebSocket:",
            err instanceof Error ? err.message : err,
          );
        }
      }
      wsConnections.clear();
      sessions.clear();
      // Clear tool result timers to prevent leaks
      for (const timer of toolResultTimers.values()) {
        clearTimeout(timer);
      }
      toolResultTimers.clear();
      toolResultStore.clear();
      await server.shutdown();
    },
  };
}

async function routeMessage(
  configSession: BridgeSession,
  message: McpAppsMessage,
  onMessage?: ResourceServerConfig["onMessage"],
  backend?: McpBackend,
): Promise<McpAppsMessage | null> {
  if (onMessage) {
    const response = await onMessage(configSession, message);
    if (response !== null) {
      return response;
    }
  }

  if (backend) {
    const response = await backend.handleMessage(configSession, message);
    if (response !== null) {
      return response;
    }
  }

  if ("method" in message && "id" in message) {
    return buildErrorResponse(
      message.id,
      -32601,
      `Unhandled method: ${message.method}`,
    );
  }

  return null;
}

function buildBridgeScriptUrl(
  platform: string,
  sessionId: string,
  requiresAuth: boolean,
  debug: boolean,
): string {
  const params = new URLSearchParams({
    platform,
    session: sessionId,
  });
  if (requiresAuth) {
    params.set("auth", "1");
  }
  if (debug) {
    params.set("debug", "1");
  }
  return `/bridge.js?${params.toString()}`;
}

function mergeCspOptions(
  base?: CspOptions,
  override?: CspOptions,
): CspOptions {
  return {
    scriptSources: mergeStringLists(
      base?.scriptSources,
      override?.scriptSources,
    ),
    connectSources: mergeStringLists(
      base?.connectSources,
      override?.connectSources,
    ),
    frameAncestors: mergeStringLists(
      base?.frameAncestors,
      override?.frameAncestors,
    ),
    allowInline: override?.allowInline ?? base?.allowInline,
  };
}

function mergeStringLists(
  first?: readonly string[],
  second?: readonly string[],
): readonly string[] | undefined {
  if (!first && !second) {
    return undefined;
  }
  return Array.from(new Set([...(first ?? []), ...(second ?? [])]));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isJsonRpcMessageCandidate(value: unknown): boolean {
  if (typeof value !== "string") {
    return isJsonRpcMessage(value);
  }
  try {
    return isJsonRpcMessage(JSON.parse(value));
  } catch {
    return false;
  }
}

function parseJsonRpcCandidate(value: unknown): McpAppsMessage | null {
  if (isJsonRpcMessage(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return isJsonRpcMessage(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a random ref ID (32 hex chars = 128 bits of entropy). */
function generateRef(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Build a `ui/notifications/tool-result` pending notification from ToolResultData. */
export function buildToolResultFromData(
  data: ToolResultData,
): PendingNotification {
  return {
    jsonrpc: "2.0",
    method: "ui/notifications/tool-result",
    params: data as unknown as Record<string, unknown>,
  };
}
