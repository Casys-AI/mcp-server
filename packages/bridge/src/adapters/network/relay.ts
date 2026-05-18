import type {
  NetworkToolCallRequest,
  NetworkToolCallResponse,
} from "./types.ts";

export interface RegisteredNetworkAgent {
  readonly tenantId: string;
  readonly targetType: string;
  readonly agentId: string;
  readonly registrationId?: string;
  /**
   * Sends a tool call to the registered agent.
   *
   * Implementations must honor `options.signal` by rejecting any pending
   * response once the signal is aborted.
   */
  readonly send: (
    message: NetworkToolCallRequest,
    options?: RegisteredNetworkAgentSendOptions,
  ) => Promise<NetworkToolCallResponse>;
}

export interface RegisteredNetworkAgentSendOptions {
  readonly signal?: AbortSignal;
}

export interface RelayToolCall {
  readonly tenantId: string;
  readonly targetType: string;
  readonly toolName: string;
  readonly arguments: Record<string, unknown>;
  readonly actorSubject: string | null;
}

export type NetworkRelayConcurrencyStrategy = "parallel" | "reject";

export interface NetworkRelayOptions {
  readonly requestTimeoutMs?: number;
  readonly concurrencyStrategy?: NetworkRelayConcurrencyStrategy;
}

export type NetworkRelayErrorCode =
  | "NO_TUNNEL_AGENT"
  | "TUNNEL_AGENT_BUSY"
  | "TUNNEL_AGENT_DISCONNECTED"
  | "TUNNEL_REQUEST_CANCELLED"
  | "TUNNEL_REQUEST_TIMEOUT";

export interface NetworkRelayErrorOptions {
  readonly code: NetworkRelayErrorCode;
  readonly context?: Record<string, unknown>;
  readonly recovery: string;
}

export class NetworkRelayError extends Error {
  readonly code: NetworkRelayErrorCode;
  readonly context: Record<string, unknown>;
  readonly recovery: string;

  constructor(options: NetworkRelayErrorOptions);
  constructor(
    code: NetworkRelayErrorCode,
    context: Record<string, unknown>,
    recovery: string,
  );
  constructor(
    optionsOrCode: NetworkRelayErrorOptions | NetworkRelayErrorCode,
    context?: Record<string, unknown>,
    recovery?: string,
  ) {
    const options = typeof optionsOrCode === "string"
      ? {
        code: optionsOrCode,
        context: context ?? {},
        recovery: recovery ?? "Retry the network tunnel operation.",
      }
      : optionsOrCode;
    super(`${options.code}: ${options.recovery}`);
    this.code = options.code;
    this.context = options.context ?? {};
    this.recovery = options.recovery;
    this.name = "NetworkRelayError";
  }
}

interface RegisteredNetworkAgentState {
  readonly agent: RegisteredNetworkAgent;
  readonly pending: Map<string, PendingRelayCall>;
}

interface PendingRelayCall {
  readonly reject: (error: NetworkRelayError) => void;
  readonly abort: (error: NetworkRelayError) => void;
  readonly releaseBusy: () => void;
}

/**
 * Relays tool calls to registered network agents.
 *
 * By default each agent accepts one in-flight call at a time; pass
 * `concurrencyStrategy: "parallel"` to opt in to concurrent calls.
 */
export class NetworkRelay {
  private readonly agents = new Map<string, RegisteredNetworkAgentState>();
  private readonly inFlightAgents = new Map<string, number>();
  private readonly requestTimeoutMs: number;
  private readonly concurrencyStrategy: NetworkRelayConcurrencyStrategy;
  private nextRequestId = 1;

  constructor(options: NetworkRelayOptions = {}) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.concurrencyStrategy = options.concurrencyStrategy ?? "reject";
  }

  registerAgent(agent: RegisteredNetworkAgent): void {
    this.agents.set(this.key(agent.tenantId, agent.targetType), {
      agent,
      pending: new Map(),
    });
  }

  unregisterAgent(
    tenantId: string,
    targetType: string,
    agentId?: string,
    registrationId?: string,
    reason: "cancelled" | "disconnected" = "cancelled",
  ): void {
    const key = this.key(tenantId, targetType);
    const state = this.agents.get(key);
    if (agentId === undefined) {
      this.agents.delete(key);
      if (state) {
        this.rejectPendingCalls(
          state,
          this.pendingRemovalError(reason, {
            tenantId,
            targetType,
            agentId: state.agent.agentId,
            registrationId: state.agent.registrationId,
          }),
        );
      }
      return;
    }

    if (
      state?.agent.agentId === agentId &&
      (registrationId === undefined ||
        state.agent.registrationId === undefined ||
        state.agent.registrationId === registrationId)
    ) {
      this.agents.delete(key);
      this.rejectPendingCalls(
        state,
        this.pendingRemovalError(reason, {
          tenantId,
          targetType,
          agentId,
          registrationId: state.agent.registrationId,
        }),
      );
    }
  }

  async callTool(input: RelayToolCall): Promise<unknown> {
    const key = this.key(input.tenantId, input.targetType);
    const state = this.agents.get(key);
    if (!state) {
      throw new NetworkRelayError({
        code: "NO_TUNNEL_AGENT",
        context: { tenantId: input.tenantId, targetType: input.targetType },
        recovery:
          "Connect an agent for this tenant and targetType before calling tools.",
      });
    }

    if (
      this.concurrencyStrategy === "reject" &&
      (this.inFlightAgents.get(key) ?? 0) > 0
    ) {
      throw new NetworkRelayError({
        code: "TUNNEL_AGENT_BUSY",
        context: { tenantId: input.tenantId, targetType: input.targetType },
        recovery:
          "Retry after the current tool call completes or configure parallel concurrency.",
      });
    }

    const requestId = `net_${this.nextRequestId++}`;
    this.inFlightAgents.set(key, (this.inFlightAgents.get(key) ?? 0) + 1);
    const abortController = new AbortController();
    let timer: number | undefined;
    let timedOut = false;
    let busyReleased = false;
    const releaseBusy = () => {
      if (busyReleased) return;
      busyReleased = true;
      this.decrementInFlight(key);
    };
    const timeoutError = () =>
      new NetworkRelayError({
        code: "TUNNEL_REQUEST_TIMEOUT",
        context: {
          tenantId: input.tenantId,
          targetType: input.targetType,
          requestId,
        },
        recovery: "Check the agent connection and retry the tool call.",
      });
    const removal = new Promise<never>((_, reject) => {
      state.pending.set(requestId, {
        reject,
        abort: (error) => {
          if (!abortController.signal.aborted) {
            abortController.abort(error);
          }
        },
        releaseBusy,
      });
    });
    const toolCall: NetworkToolCallRequest = {
      type: "tool.call",
      requestId,
      toolName: input.toolName,
      arguments: input.arguments,
      actorSubject: input.actorSubject,
    };
    const sendPromise = state.agent.send(toolCall, {
      signal: abortController.signal,
    });
    void sendPromise.then(
      () => {
        state.pending.delete(requestId);
        releaseBusy();
      },
      () => {
        state.pending.delete(requestId);
        releaseBusy();
      },
    );
    try {
      const response = await Promise.race([
        sendPromise,
        removal,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            timedOut = true;
            const error = timeoutError();
            if (!abortController.signal.aborted) {
              abortController.abort(error);
            }
            reject(error);
          }, this.requestTimeoutMs);
        }),
      ]);

      if (response.requestId !== requestId) {
        throw new NetworkRelayError({
          code: "TUNNEL_AGENT_DISCONNECTED",
          context: {
            tenantId: input.tenantId,
            targetType: input.targetType,
            expectedRequestId: requestId,
            actualRequestId: response.requestId,
          },
          recovery:
            "Drop the agent connection because it returned a mismatched request id.",
        });
      }

      return response.result;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      if (!timedOut) {
        state.pending.delete(requestId);
        releaseBusy();
      }
    }
  }

  private pendingRemovalError(
    reason: "cancelled" | "disconnected",
    context: Record<string, unknown>,
  ): (requestId: string) => NetworkRelayError {
    if (reason === "disconnected") {
      return (requestId) =>
        new NetworkRelayError({
          code: "TUNNEL_AGENT_DISCONNECTED",
          context: { ...context, requestId },
          recovery: "Reconnect the tunnel agent before retrying the tool call.",
        });
    }

    return (requestId) =>
      new NetworkRelayError({
        code: "TUNNEL_REQUEST_CANCELLED",
        context: { ...context, requestId },
        recovery: "Retry after the tunnel agent is registered again.",
      });
  }

  private rejectPendingCalls(
    state: RegisteredNetworkAgentState,
    errorForRequest: (requestId: string) => NetworkRelayError,
  ): void {
    for (const [requestId, pending] of state.pending) {
      const error = errorForRequest(requestId);
      state.pending.delete(requestId);
      pending.abort(error);
      pending.releaseBusy();
      pending.reject(error);
    }
  }

  private decrementInFlight(key: string): void {
    const count = this.inFlightAgents.get(key) ?? 0;
    if (count <= 1) {
      this.inFlightAgents.delete(key);
      return;
    }
    this.inFlightAgents.set(key, count - 1);
  }

  private key(tenantId: string, targetType: string): string {
    return JSON.stringify([tenantId, targetType]);
  }
}
