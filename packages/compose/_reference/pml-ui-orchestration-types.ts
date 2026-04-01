/**
 * UI Orchestration Types
 *
 * Types for MCP Apps UI orchestration, collection, and composite generation.
 *
 * This module defines two categories of types:
 * - **MCP Apps Spec Types**: `McpUiToolMeta`, `McpUiResourceMeta` (from SEP-1865)
 * - **PML Innovation Types**: `UiOrchestration`, `UiSyncRule`, `CollectedUiResource`, `CompositeUiDescriptor`
 *
 * PML's innovation is the **sync rules system** that enables declarative event routing
 * between UI components without client-side coordination logic.
 *
 * @module types/ui-orchestration
 * @see https://github.com/modelcontextprotocol/ext-apps/blob/main/specification/2026-01-26/apps.mdx
 */

// ============================================================================
// Layout Types
// ============================================================================

/**
 * Layout modes for composite UI arrangement.
 *
 * - `"split"`: Side-by-side panels (e.g., query + visualization)
 * - `"tabs"`: Tabbed interface for mutually exclusive views
 * - `"grid"`: Grid layout for dashboard-style arrangements
 * - `"stack"`: Vertical stack for sequential content
 *
 * @example
 * ```typescript
 * const layout: UiLayout = "split";
 * ```
 */
export type UiLayout = "split" | "tabs" | "grid" | "stack";

// ============================================================================
// Sync Rule Types (PML Innovation)
// ============================================================================

/**
 * Sync rule for cross-UI event routing.
 *
 * PML's key innovation: declarative event routing between UI components.
 * When tool A emits an event, the sync rule specifies which tool B should
 * receive it and what action to trigger.
 *
 * @example Basic sync rule
 * ```typescript
 * const rule: UiSyncRule = {
 *   from: "postgres:query",    // Tool emitting the event
 *   event: "filter",           // Event type detected via args
 *   to: "viz:render",          // Target tool
 *   action: "update"           // Action to trigger
 * };
 * ```
 *
 * @example Broadcast sync rule
 * ```typescript
 * const broadcastRule: UiSyncRule = {
 *   from: "date-picker",
 *   event: "change",
 *   to: "*",                   // Broadcast to all other UIs
 *   action: "refresh"
 * };
 * ```
 */
export interface UiSyncRule {
  /**
   * Tool name emitting the event.
   * Format: "namespace:action" (e.g., "postgres:query")
   */
  from: string;

  /**
   * Event type to listen for.
   * Detected via tool call arguments (e.g., "filter", "select", "change")
   */
  event: string;

  /**
   * Target tool or broadcast marker.
   * - Specific tool: "viz:render"
   * - Broadcast: "*" (all other UIs receive the event)
   */
  to: string | "*";

  /**
   * Action to trigger on the target.
   * Common actions: "update", "highlight", "refresh", "clear"
   */
  action: string;
}

// ============================================================================
// Orchestration Types (PML Innovation)
// ============================================================================

/**
 * Declarative UI orchestration configuration.
 *
 * Defined in capability metadata to specify how UI components should
 * be arranged and synchronized. This is PML's innovation for composing
 * multiple MCP tool UIs into a cohesive experience.
 *
 * @example Capability with UI orchestration
 * ```typescript
 * const capability = {
 *   intent: "Analyze and visualize sales data",
 *   code: `...`,
 *   ui: {
 *     layout: "split",
 *     sync: [
 *       { from: "postgres:query", event: "filter", to: "viz:render", action: "update" }
 *     ]
 *   }
 * };
 * ```
 */
export interface UiOrchestration {
  /**
   * Layout mode for arranging UI components.
   */
  layout: UiLayout;

  /**
   * Optional sync rules for cross-UI event routing.
   * When omitted, UIs operate independently.
   */
  sync?: UiSyncRule[];

  /**
   * Optional keys to extract from collected UI contexts for shared injection.
   * These values are extracted from each UI's context and merged into a
   * shared context object that is injected into all child UIs.
   *
   * @example
   * ```typescript
   * sharedContext: ["workflowId", "userId", "sessionId"]
   * ```
   */
  sharedContext?: string[];
}

// ============================================================================
// Collected UI Resource Types
// ============================================================================

/**
 * UI resource collected during capability execution.
 *
 * When a tool call returns `_meta.ui.resourceUri`, PML collects it
 * for later composition into a composite UI.
 *
 * @example Collected resource from postgres:query
 * ```typescript
 * const collected: CollectedUiResource = {
 *   source: "postgres:query",
 *   resourceUri: "ui://postgres/table/abc123",
 *   context: { query: "SELECT * FROM sales" },
 *   slot: 0
 * };
 * ```
 */
export interface CollectedUiResource {
  /**
   * Tool that returned this UI resource.
   * Format: "namespace:action" (e.g., "postgres:query")
   */
  source: string;

  /**
   * URI of the UI resource (from `_meta.ui.resourceUri`).
   * Format: "ui://namespace/type/id"
   */
  resourceUri: string;

  /**
   * Optional context data for the UI.
   * Includes relevant parameters from the tool call.
   */
  context?: Record<string, unknown>;

  /**
   * Execution order slot (0-based index).
   * Used for resolving sync rules from tool names to slot indices.
   */
  slot: number;
}

// ============================================================================
// Composite UI Descriptor Types
// ============================================================================

/**
 * Resolved sync rule with slot indices.
 *
 * Internal type used in `CompositeUiDescriptor` where tool names
 * have been resolved to slot indices for client-side routing.
 */
export interface ResolvedSyncRule {
  /**
   * Source slot index (resolved from tool name).
   */
  from: number;

  /**
   * Event type to listen for.
   */
  event: string;

  /**
   * Target slot index or broadcast marker.
   * - number: specific slot index
   * - "*": broadcast to all other slots
   */
  to: number | "*";

  /**
   * Action to trigger on the target.
   */
  action: string;
}

/**
 * Composite UI descriptor returned to the client.
 *
 * Contains all collected UI resources and resolved sync rules
 * for rendering a multi-UI composite layout.
 *
 * @example Composite descriptor for a sales dashboard
 * ```typescript
 * const composite: CompositeUiDescriptor = {
 *   type: "composite",
 *   resourceUri: "ui://pml/workflow/abc123",
 *   layout: "split",
 *   children: [
 *     { source: "postgres:query", resourceUri: "ui://postgres/table/...", slot: 0 },
 *     { source: "viz:render", resourceUri: "ui://viz/chart/...", slot: 1 }
 *   ],
 *   sync: [
 *     { from: 0, event: "filter", to: 1, action: "update" }
 *   ]
 * };
 * ```
 */
export interface CompositeUiDescriptor {
  /**
   * Type discriminant. Always "composite" for composite UIs.
   */
  type: "composite";

  /**
   * URI of this composite UI resource.
   * Format: "ui://pml/workflow/{workflowId}"
   */
  resourceUri: string;

  /**
   * Layout mode for arranging children.
   */
  layout: UiLayout;

  /**
   * Child UI resources in slot order.
   */
  children: CollectedUiResource[];

  /**
   * Sync rules with resolved slot indices.
   * Tool names from `UiSyncRule` are resolved to slot numbers.
   */
  sync: ResolvedSyncRule[];

  /**
   * Shared context to inject into all child UIs.
   * Extracted from collected UI contexts based on `UiOrchestration.sharedContext` keys.
   */
  sharedContext?: Record<string, unknown>;
}

// ============================================================================
// MCP Apps Spec Types (SEP-1865)
// ============================================================================

/**
 * MCP tool metadata with UI association.
 *
 * From MCP Apps specification (SEP-1865).
 * When a tool returns `_meta.ui`, it indicates a UI resource is available.
 *
 * @example Tool response with UI metadata
 * ```typescript
 * return {
 *   content: [{ type: "text", text: "Query executed" }],
 *   _meta: {
 *     ui: {
 *       resourceUri: "ui://postgres/table/abc123",
 *       visibility: ["model", "app"]
 *     }
 *   }
 * };
 * ```
 */
export interface McpUiToolMeta {
  /**
   * URI of the UI resource to display.
   * Format: "ui://namespace/type/id"
   */
  resourceUri?: string;

  /**
   * Visibility settings for the UI.
   * - "model": visible to the LLM for reasoning
   * - "app": visible to the user application
   */
  visibility?: Array<"model" | "app">;
}

/**
 * Content Security Policy configuration for UI resources.
 *
 * From MCP Apps specification (SEP-1865).
 * Allows fine-grained control over what external resources the UI can access.
 */
export interface McpUiCsp {
  /**
   * Domains for connect-src (fetch, WebSocket).
   */
  connectDomains?: string[];

  /**
   * Domains for resource loading (scripts, styles).
   */
  resourceDomains?: string[];

  /**
   * Domains for iframe embedding.
   */
  frameDomains?: string[];

  /**
   * Base URI domains for relative URLs.
   */
  baseUriDomains?: string[];
}

/**
 * Permission capabilities for UI resources.
 *
 * From MCP Apps specification (SEP-1865).
 * Declares which device/browser permissions the UI may request.
 * Empty object indicates the permission is requested but with no specific config.
 */
export interface McpUiPermissions {
  /**
   * Camera access permission.
   */
  camera?: Record<string, never>;

  /**
   * Microphone access permission.
   */
  microphone?: Record<string, never>;

  /**
   * Geolocation access permission.
   */
  geolocation?: Record<string, never>;

  /**
   * Clipboard write access permission.
   */
  clipboardWrite?: Record<string, never>;
}

/**
 * MCP resource metadata for UI rendering.
 *
 * From MCP Apps specification (SEP-1865).
 * Provides security policies and display hints for UI resources.
 *
 * @example UI resource with full metadata
 * ```typescript
 * const resourceMeta: McpUiResourceMeta = {
 *   csp: {
 *     connectDomains: ["api.example.com"],
 *     resourceDomains: ["cdn.example.com"]
 *   },
 *   permissions: {
 *     clipboardWrite: {}
 *   },
 *   domain: "example.com",
 *   prefersBorder: true
 * };
 * ```
 */
export interface McpUiResourceMeta {
  /**
   * Content Security Policy configuration.
   */
  csp?: McpUiCsp;

  /**
   * Permission capabilities the UI may request.
   */
  permissions?: McpUiPermissions;

  /**
   * Domain hint for the UI resource.
   * Used for display and security context.
   */
  domain?: string;

  /**
   * Whether the UI prefers a visible border/frame.
   * Hint for the host application's rendering.
   */
  prefersBorder?: boolean;
}
