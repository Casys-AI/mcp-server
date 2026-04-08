/**
 * MCP backend abstractions for the resource server.
 *
 * The bridge itself only knows how to move JSON-RPC messages and serve
 * UI resources. Concrete MCP backends implement this contract to connect
 * the bridge to any server transport or deployment model.
 */

import type { McpAppsMessage } from "../core/types.ts";
import type { BridgeSession, PendingNotification } from "./session.ts";
import type { CspOptions } from "./csp.ts";
import { buildErrorResponse } from "../core/protocol.ts";

/** UI resource content resolved from a `ui://` URI. */
export interface UiResourceResponse {
  /** HTML payload to inject with `bridge.js`. */
  readonly html: string;
  /** Optional resource-specific CSP additions. */
  readonly csp?: CspOptions;
  /** Optional notifications buffered until the webview connects. */
  readonly pendingNotifications?: PendingNotification[];
}

/**
 * Generic MCP backend contract used by the resource server.
 *
 * - `handleMessage()` forwards JSON-RPC sent by the in-app UI.
 * - `readResource()` resolves `ui://...` resources to HTML.
 */
export interface McpBackend {
  handleMessage(
    session: BridgeSession,
    message: McpAppsMessage,
  ): Promise<McpAppsMessage | null>;

  readResource?(
    uri: string,
    request?: Request,
  ): Promise<string | UiResourceResponse | null>;
}

/** Options for the generic HTTP JSON-RPC MCP backend. */
export interface JsonRpcMcpBackendOptions {
  /** Full HTTP endpoint URL that accepts JSON-RPC POST requests. */
  readonly endpointUrl: string;
  /** Optional static headers added to every request. */
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * Optional custom fetch implementation.
   * Useful for tests or custom runtime environments.
   */
  readonly fetchFn?: typeof fetch;
}

interface ResourceReadResult {
  readonly contents?: Array<{
    readonly text?: string;
    readonly uri?: string;
    readonly mimeType?: string;
  }>;
}

/**
 * Generic MCP backend for servers exposing an HTTP JSON-RPC endpoint.
 *
 * This is the default building block for "any MCP" support: if a server
 * speaks MCP over HTTP JSON-RPC, the bridge can proxy tools and UI resources
 * without any backend-specific code.
 */
export class JsonRpcMcpBackend implements McpBackend {
  private readonly endpointUrl: string;
  private readonly headers: Readonly<Record<string, string>>;
  private readonly fetchFn: typeof fetch;

  constructor(options: JsonRpcMcpBackendOptions) {
    this.endpointUrl = options.endpointUrl.replace(/\/$/, "");
    this.headers = options.headers ?? {};
    this.fetchFn = options.fetchFn ?? fetch;
  }

  async handleMessage(
    _session: BridgeSession,
    message: McpAppsMessage,
  ): Promise<McpAppsMessage | null> {
    if (!("method" in message)) {
      return null;
    }

    try {
      return await this.send(message);
    } catch (err) {
      if (!("id" in message)) {
        return null;
      }

      return buildErrorResponse(
        message.id,
        -32603,
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  async readResource(
    uri: string,
  ): Promise<string | UiResourceResponse | null> {
    const response = await this.send<ResourceReadResult>({
      jsonrpc: "2.0",
      id: `resource-${Date.now()}-${crypto.randomUUID()}`,
      method: "resources/read",
      params: { uri },
    });

    if (!response || !("result" in response)) {
      return null;
    }

    const contents = (response.result as ResourceReadResult | undefined)
      ?.contents;
    if (!Array.isArray(contents) || contents.length === 0) {
      return null;
    }

    const first = contents[0];
    return typeof first?.text === "string" ? first.text : null;
  }

  private async send<T = unknown>(
    message: McpAppsMessage,
  ): Promise<McpAppsMessage & { result?: T }> {
    const response = await this.fetchFn(this.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `[JsonRpcMcpBackend] HTTP ${response.status}: ${
          text || response.statusText
        }`,
      );
    }

    return await response.json();
  }
}
