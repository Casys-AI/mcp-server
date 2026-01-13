/**
 * Type definitions for the MCP Concurrent Server Framework
 *
 * This module provides TypeScript types for building high-performance
 * MCP servers with built-in concurrency control and backpressure.
 *
 * @module lib/server/types
 */

/**
 * Rate limit configuration
 */
export interface RateLimitOptions {
  /** Maximum requests per window */
  maxRequests: number;

  /** Time window in milliseconds */
  windowMs: number;

  /**
   * Function to extract client identifier from request context
   * Default: uses "default" for all requests (global rate limit)
   */
  keyExtractor?: (context: RateLimitContext) => string;

  /**
   * Behavior when rate limit is exceeded
   * - 'reject': Return error immediately
   * - 'wait': Wait for slot with backoff (default)
   */
  onLimitExceeded?: 'reject' | 'wait';
}

/**
 * Context passed to rate limit key extractor
 */
export interface RateLimitContext {
  /** Tool being called */
  toolName: string;

  /** Tool arguments */
  args: Record<string, unknown>;
}

/**
 * Configuration options for ConcurrentMCPServer
 */
export interface ConcurrentServerOptions {
  /** Server name (shown in MCP protocol) */
  name: string;

  /** Server version */
  version: string;

  /** Maximum concurrent requests (default: 10) */
  maxConcurrent?: number;

  /** Backpressure strategy when at capacity (default: 'sleep') */
  backpressureStrategy?: 'sleep' | 'queue' | 'reject';

  /** Sleep duration in ms for 'sleep' strategy (default: 10) */
  backpressureSleepMs?: number;

  /**
   * Rate limiting configuration
   * If provided, requests will be rate limited per client
   */
  rateLimit?: RateLimitOptions;

  /** Enable sampling support for agentic tools (default: false) */
  enableSampling?: boolean;

  /** Sampling client implementation (required if enableSampling is true) */
  samplingClient?: SamplingClient;

  /** Custom logger function (default: console.error) */
  logger?: (msg: string) => void;
}

/**
 * MCP Tool definition (compatible with MCP protocol)
 */
export interface MCPTool {
  /** Tool name */
  name: string;

  /** Human-readable description */
  description: string;

  /** JSON Schema for tool input */
  inputSchema: Record<string, unknown>;
}

/**
 * Tool handler function
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown> | unknown;

/**
 * Sampling client interface for bidirectional LLM delegation
 * Compatible with the agentic sampling protocol (SEP-1577)
 */
export interface SamplingClient {
  /**
   * Request LLM completion from the client
   * @param params - Sampling parameters (messages, tools, etc.)
   * @returns Completion result with content and stop reason
   */
  createMessage(params: SamplingParams): Promise<SamplingResult>;
}

/**
 * Parameters for sampling request
 * Compatible with MCP sampling protocol
 */
export interface SamplingParams {
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  /** Tools available for the agent to use. Client handles execution. */
  tools?: Array<{
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }>;
  /** "auto" = LLM decides, "required" = must use tool, "none" = no tools */
  toolChoice?: "auto" | "required" | "none";
  maxTokens?: number;
  /** Hint for client: max agentic loop iterations */
  maxIterations?: number;
  /** Tool name patterns to filter (e.g., ['git_*', 'vfs_*']) */
  allowedToolPatterns?: string[];
}

/**
 * Result from sampling request
 * Compatible with MCP sampling protocol
 */
export interface SamplingResult {
  content: Array<{
    type: string;
    text?: string;
    name?: string;
    input?: Record<string, unknown>;
  }>;
  stopReason: "end_turn" | "tool_use" | "max_tokens";
}

/**
 * Queue metrics for monitoring
 */
export interface QueueMetrics {
  /** Number of requests currently executing */
  inFlight: number;

  /** Number of requests waiting in queue */
  queued: number;
}

/**
 * Promise resolver for pending requests
 */
export interface PromiseResolver<T = unknown> {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * Request queue options
 */
export interface QueueOptions {
  maxConcurrent: number;
  strategy: 'sleep' | 'queue' | 'reject';
  sleepMs: number;
}
