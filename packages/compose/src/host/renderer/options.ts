import type { ComponentSurface } from "../../core/types/components.ts";

/**
 * Data contracts injected into the browser renderer.
 *
 * The renderer deliberately knows nothing about the runtime, transport, or
 * MCP client implementation. A serving runtime supplies these values when it
 * wants the generated dashboard to act as an MCP Apps host rather than a
 * legacy, static iframe layout.
 *
 * @module renderer/options
 */

/**
 * Per-iframe capabilities implemented by the local compose host.
 *
 * A capability is opt-in. The renderer never advertises a capability merely
 * because an iframe is present: the serving layer must explicitly opt in and
 * provide a local MCP proxy route.
 */
export interface RendererSlotCapabilities {
  /** Allow this iframe to issue tool requests through its slot-local proxy. */
  readonly serverTools?: boolean;

  /** Allow this iframe to issue resource requests through its slot-local proxy. */
  readonly serverResources?: boolean;
}

/**
 * Browser-host data for one composed child UI.
 *
 * `initialToolResult` is the complete MCP `CallToolResult`, not only its
 * `structuredContent`. It is delivered as the params of
 * `ui/notifications/tool-result` only after the child has sent
 * `ui/notifications/initialized`.
 */
export interface RendererSlotOptions {
  /**
   * Browser URL used for this iframe. Omit to preserve the collected
   * `resourceUri` exactly (the legacy static-renderer behaviour).
   *
   * A local Compose host normally uses `/ui/<slot>`.
   */
  readonly iframeSrc?: string;

  /**
   * Exact browser origin expected for messages from this iframe, for example
   * `http://127.0.0.1:49152`.
   *
   * Interactive hosts should give every slot a distinct origin, separate from
   * the parent dashboard. The renderer then binds both the iframe's
   * `WindowProxy` and `MessageEvent.origin` before exposing host
   * capabilities. Omit only for the legacy static-renderer behaviour, which
   * preserves historical `postMessage(..., "*")` routing.
   */
  readonly expectedOrigin?: string;

  /**
   * Override the sandbox attribute for this iframe. `false` removes the
   * attribute and should be reserved for explicitly trusted UIs.
   */
  readonly sandbox?: string | false;

  /**
   * Full local JSON-RPC endpoint for this slot. Omit to use
   * `${apiBasePath}/<slot>/mcp` when a capability is enabled.
   */
  readonly rpcEndpoint?: string;

  /** Capabilities that this host implements for this iframe. */
  readonly capabilities?: RendererSlotCapabilities;

  /**
   * Complete initial MCP tool result for this UI. It is intentionally typed
   * as `unknown` so the renderer has no dependency on a particular MCP SDK.
   */
  readonly initialToolResult?: unknown;
}

/**
 * Options for rendering a composed dashboard as an interactive MCP Apps host.
 *
 * With no options, `renderComposite()` retains its historical behaviour:
 * children use their collected `ui://` URI and the host advertises only its
 * baseline capabilities. A runtime can opt individual slots into the local
 * resource/proxy bridge without importing runtime types into this layer.
 *
 * @example
 * ```ts
 * renderComposite(descriptor, {
 *   slots: {
 *     0: {
 *       iframeSrc: "/ui/0",
 *       capabilities: { serverTools: true, serverResources: true },
 *       initialToolResult: toolResult,
 *     },
 *   },
 * });
 * ```
 */
export interface RenderCompositeOptions {
  /** Settings keyed by the descriptor's numeric child slot. */
  readonly slots?: Readonly<Record<number, RendererSlotOptions>>;

  /**
   * Default iframe sandbox policy for configured interactive slots:
   * `allow-scripts allow-same-origin`. A real interactive host must place
   * every untrusted slot on a distinct origin from the parent and siblings;
   * that gives postMessage a stable, verifiable origin without granting forms,
   * popups, downloads, or top-level navigation. Individual slots may override
   * this low-level renderer setting, but runtime hosts should apply a reviewed
   * policy instead of passing through untrusted configuration.
   */
  readonly iframeSandbox?: string | false;

  /**
   * Base path used to derive slot-local MCP proxy routes. Defaults to
   * `/api/slots`, producing `/api/slots/<slot>/mcp`.
   */
  readonly apiBasePath?: string;
}

/** Fully-resolved, JSON-serialisable settings consumed by the event bus. */
export interface ResolvedRendererSlotOptions {
  /** Stable App instance identity shared by layout, events, and inner surfaces. */
  readonly componentId: string;
  /** Host-requested composition of components advertised by this App. */
  readonly surface?: ComponentSurface;
  readonly iframeSrc: string;
  /** Canonical exact origin used for incoming and outgoing postMessage checks. */
  readonly expectedOrigin?: string;
  readonly sandbox?: string;
  readonly rpcEndpoint?: string;
  readonly serverTools: boolean;
  readonly serverResources: boolean;
  readonly hasInitialToolResult: boolean;
  readonly initialToolResult?: unknown;
}
