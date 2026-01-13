/**
 * Sampling Bridge for Bidirectional LLM Communication
 *
 * Enables MCP servers to delegate complex tasks back to the client's LLM
 * via the sampling protocol. Manages pending requests with timeout and
 * response routing.
 *
 * @module lib/server/sampling-bridge
 */

import type { SamplingClient, SamplingParams, SamplingResult, PromiseResolver } from "./types.ts";

/**
 * SamplingBridge manages bidirectional sampling requests
 *
 * Features:
 * - Request/response correlation via unique IDs
 * - Automatic timeout for pending requests (60s default)
 * - Promise-based async/await API
 * - Support for both Anthropic and OpenAI sampling
 *
 * @example
 * ```typescript
 * const bridge = new SamplingBridge(samplingClient);
 *
 * // Delegate task to LLM
 * const result = await bridge.requestSampling({
 *   messages: [{ role: 'user', content: 'Analyze this data...' }]
 * });
 * ```
 */
export class SamplingBridge {
  private pendingRequests = new Map<number, PromiseResolver<SamplingResult>>();
  private nextId = 1;
  private samplingClient: SamplingClient;
  private defaultTimeout = 60000; // 60 seconds

  constructor(client: SamplingClient, options?: { timeout?: number }) {
    this.samplingClient = client;
    if (options?.timeout) {
      this.defaultTimeout = options.timeout;
    }
  }

  /**
   * Request sampling from the client's LLM
   *
   * @param params - Sampling parameters (messages, model preferences, etc.)
   * @param timeout - Override default timeout (ms)
   * @returns Promise that resolves with sampling result
   * @throws {Error} If request times out or client fails
   */
  async requestSampling(
    params: SamplingParams,
    timeout?: number
  ): Promise<SamplingResult> {
    const id = this.nextId++;
    const timeoutMs = timeout ?? this.defaultTimeout;

    // Create timeout promise for race condition
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Sampling request ${id} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    // Track pending request for potential external response handling
    const resultPromise = new Promise<SamplingResult>((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
    });

    try {
      // Race between client response and timeout
      // Also race with external response via handleResponse()
      const clientPromise = this.samplingClient.createMessage(params);
      const result = await Promise.race([
        clientPromise.then(r => {
          // Resolve the pending request tracker as well
          const pending = this.pendingRequests.get(id);
          if (pending) {
            pending.resolve(r);
          }
          return r;
        }),
        timeoutPromise,
        resultPromise, // Allow external handleResponse() to resolve
      ]);
      return result;
    } catch (error) {
      // Clean up pending request on error
      this.pendingRequests.delete(id);
      throw error;
    } finally {
      // Always clear timeout to prevent memory leak
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      // Clean up pending request
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Handle sampling response from client (for bidirectional stdio)
   *
   * Used when MCP server receives sampling responses via stdin.
   * Resolves the corresponding pending promise.
   *
   * @param id - Request ID from original sampling request
   * @param result - Sampling result from client
   */
  handleResponse(id: number, result: SamplingResult): void {
    const pending = this.pendingRequests.get(id);

    if (!pending) {
      console.error(`[SamplingBridge] Received response for unknown request: ${id}`);
      return;
    }

    this.pendingRequests.delete(id);
    pending.resolve(result);
  }

  /**
   * Handle sampling error from client
   *
   * @param id - Request ID
   * @param error - Error from client
   */
  handleError(id: number, error: Error): void {
    const pending = this.pendingRequests.get(id);

    if (!pending) {
      console.error(`[SamplingBridge] Received error for unknown request: ${id}`);
      return;
    }

    this.pendingRequests.delete(id);
    pending.reject(error);
  }

  /**
   * Get count of pending sampling requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Cancel all pending requests (useful for shutdown)
   */
  cancelAll(): void {
    for (const [id, pending] of this.pendingRequests.entries()) {
      pending.reject(new Error(`Sampling request ${id} cancelled (server shutdown)`));
    }
    this.pendingRequests.clear();
  }

  /**
   * Get sampling client for direct access
   */
  getClient(): SamplingClient {
    return this.samplingClient;
  }

  /**
   * Alias for requestSampling() - implements SamplingClient interface
   * This allows the bridge to be used as a drop-in replacement for SamplingClient
   *
   * @param params - Sampling parameters
   * @returns Sampling result
   */
  createMessage(params: SamplingParams): Promise<SamplingResult> {
    return this.requestSampling(params);
  }
}
