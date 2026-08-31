/**
 * Browser-parent contract for directly addressing one composed component.
 *
 * The generated dashboard installs this gateway on its parent window while
 * the event bus is alive. It is deliberately a browser-host contract: it
 * does not select an MCP server, call a provider tool, or participate in
 * cross-component sync routing.
 *
 * @module host/component-actions
 */

/**
 * Property installed on the generated dashboard's parent window.
 *
 * Browser hosts can use this value to find the typed
 * {@link HostComponentActionGateway}. The property exists only while the
 * generated event bus is active and is removed when that page is unloaded.
 */
export const MCP_COMPOSE_HOST_GATEWAY_KEY = "mcpComposeHost";

/**
 * An opaque browser-host action addressed to one stable composed component
 * instance.
 */
export interface HostComponentAction {
  /** Stable component instance identity from the composed descriptor. */
  readonly componentId: string;
  /** Action declared by exactly one active inner component's `events.accepts`. */
  readonly action: string;
  /** Unchanged application payload delivered as `ui/compose/event` data. */
  readonly payload?: unknown;
}

/** Reasons a browser-host component action was not delivered. */
export type HostComponentActionRejectionReason =
  | "invalid-action"
  | "component-not-found"
  | "component-ambiguous"
  | "component-not-active"
  | "action-not-accepted"
  | "action-ambiguous"
  | "payload-not-transferable";

/** Outcome returned synchronously by a browser-host action publication. */
export type HostComponentActionResult =
  | { readonly delivered: true }
  | {
    readonly delivered: false;
    readonly reason: HostComponentActionRejectionReason;
  };

/**
 * Typed browser-parent gateway installed by a generated Compose dashboard.
 *
 * @example
 * ```ts
 * const result = gateway.publishComponentAction({
 *   componentId: "viewer",
 *   action: "session.replace",
 *   payload: { sessionId: "next" },
 * });
 * if (!result.delivered) console.warn(result.reason);
 * ```
 */
export interface HostComponentActionGateway {
  /**
   * Deliver an opaque action directly to one accepting component after its
   * App has confirmed `ui/notifications/initialized`.
   */
  publishComponentAction(action: HostComponentAction): HostComponentActionResult;
}
