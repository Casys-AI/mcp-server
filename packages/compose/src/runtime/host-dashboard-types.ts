/**
 * Runtime-facing types for serving an interactive composed dashboard.
 *
 * The renderer remains transport-agnostic; these values are the explicit
 * binding between a collected UI slot and the MCP connection that produced it.
 *
 * @module runtime/host-dashboard-types
 */

/**
 * One MCP App panel owned by an interactive composed dashboard.
 *
 * The slot is a security boundary: browser requests from this iframe can reach
 * only `serverName`, the collected `resourceUri`, and `allowedToolNames`.
 */
export interface ComposedDashboardPanel {
  /** Numeric iframe slot assigned by the collector. */
  readonly slot: number;
  /** Manifest/server name that produced the panel. */
  readonly serverName: string;
  /** Tool that instantiated the App. */
  readonly toolName: string;
  /** Original MCP resource URI, before any browser URL projection. */
  readonly resourceUri: string;
  /** Complete initial CallToolResult delivered after Apps initialization. */
  readonly initialToolResult: unknown;
  /** Explicit app-callable tool names for this source server. */
  readonly allowedToolNames: readonly string[];
  /**
   * Trusted manifest descriptions for the App-only `tools/list` response.
   * App-only tools are intentionally absent from a server's public
   * `tools/list`, so the local host must not attempt to discover them by
   * listing the upstream MCP surface.
   */
  readonly allowedTools: readonly ComposedDashboardTool[];
  /**
   * CSP domain declarations attached to the instantiating tool result. The
   * local host validates and intersects these with resource-level metadata
   * before creating a child response header.
   */
  readonly resourceCsp?: ComposedDashboardCsp;
}

/** Manifest-owned metadata exposed to an App through its slot-local tools/list. */
export interface ComposedDashboardTool {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: Record<string, unknown>;
}

/** Domain-only CSP declaration carried by MCP Apps resource metadata. */
export interface ComposedDashboardCsp {
  readonly connectDomains?: readonly string[];
  readonly resourceDomains?: readonly string[];
  readonly frameDomains?: readonly string[];
  readonly baseUriDomains?: readonly string[];
}

/** Options for the local loopback host that serves an interactive dashboard. */
export interface ServeComposedDashboardOptions {
  /** TCP port. Defaults to 0 so the OS selects a free local port. */
  readonly port?: number;
  /** Open the served dashboard in the default browser. Defaults to `true`. */
  readonly open?: boolean;
  /**
   * Reviewed HTTP(S) origins allowed to embed the dashboard document.
   * Defaults to none, keeping the standalone host non-embeddable. Invalid
   * CSP sources are ignored instead of becoming raw policy text.
   */
  readonly frameAncestors?: readonly string[];
}

/** A running local MCP Apps dashboard host. */
export interface ComposedDashboardHandle {
  /** Loopback URL of the dashboard document. */
  readonly url: string;
  /** Composition result used to construct this host. */
  readonly result: import("./types.ts").ComposeResult;
  /** Stop HTTP serving and release every connected or spawned MCP server. */
  shutdown(): Promise<void>;
}
