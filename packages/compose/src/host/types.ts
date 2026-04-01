/**
 * Host integration types for mcp-compose.
 *
 * These types define the contracts a host application (e.g., a desktop shell,
 * web container, or IDE extension) must satisfy to embed composite UIs.
 *
 * @module host/types
 */

import type { CompositeUiDescriptor } from "../core/types/descriptor.ts";

/**
 * Minimal interface for a host that can display composite UIs.
 *
 * Hosts receive rendered HTML or descriptors and are responsible for
 * presenting them to the user (e.g., in a webview, iframe, or panel).
 */
export interface CompositeUiHost {
  /** Mount a composite UI into a container element. */
  mount(descriptor: CompositeUiDescriptor, container: unknown): void;
  /** Unmount / tear down a previously mounted composite UI. */
  unmount(container: unknown): void;
}

/**
 * Configuration options for host integration.
 *
 * @example
 * ```typescript
 * const config: HostConfig = {
 *   sandboxIframes: true,
 *   allowedOrigins: ["ui://"],
 *   maxConcurrentUis: 10,
 * };
 * ```
 */
export interface HostConfig {
  /** Whether to sandbox iframes (default: true). */
  sandboxIframes?: boolean;
  /** Allowed origin prefixes for postMessage routing. */
  allowedOrigins?: string[];
  /** Maximum number of concurrent UI panels. */
  maxConcurrentUis?: number;
}
