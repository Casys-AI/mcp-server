import type {
  NetworkToolCallRequest,
  NetworkToolCallResponse,
} from "./types.ts";

export interface RegisteredNetworkAgent {
  readonly tenantId: string;
  readonly targetType: string;
  readonly agentId: string;
  readonly registrationId?: string;
  readonly send: (
    message: NetworkToolCallRequest,
  ) => Promise<NetworkToolCallResponse>;
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
  | "TUNNEL_REQUEST_TIMEOUT"
  | "TUNNEL_REQUEST_ID_MISMATCH";

export class NetworkRelayError extends Error {
  constructor(
    public readonly code: NetworkRelayErrorCode,
    public readonly context: Record<string, unknown>,
    public readonly recovery: string,
  ) {
    super(`${code}: ${recovery}`);
    this.name = "NetworkRelayError";
  }
}

export class NetworkRelay {
  private readonly agents = new Map<string, RegisteredNetworkAgent>();
  private readonly inFlightAgents = new Map<string, number>();
  private readonly requestTimeoutMs: number;
  private readonly concurrencyStrategy: NetworkRelayConcurrencyStrategy;
  private nextRequestId = 1;

  constructor(options: NetworkRelayOptions = {}) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.concurrencyStrategy = options.concurrencyStrategy ?? "parallel";
  }

  registerAgent(agent: RegisteredNetworkAgent): void {
    this.agents.set(this.key(agent.tenantId, agent.targetType), agent);
  }

  unregisterAgent(
    tenantId: string,
    targetType: string,
    agentId?: string,
    registrationId?: string,
  ): void {
    const key = this.key(tenantId, targetType);
    if (agentId === undefined) {
      this.agents.delete(key);
      return;
    }

    const agent = this.agents.get(key);
    if (
      agent?.agentId === agentId &&
      (registrationId === undefined ||
        agent.registrationId === undefined ||
        agent.registrationId === registrationId)
    ) {
      this.agents.delete(key);
    }
  }

  async callTool(input: RelayToolCall): Promise<unknown> {
    const key = this.key(input.tenantId, input.targetType);
    const agent = this.agents.get(key);
    if (!agent) {
      throw new NetworkRelayError(
        "NO_TUNNEL_AGENT",
        { tenantId: input.tenantId, targetType: input.targetType },
        "Connect an agent for this tenant and targetType before calling tools.",
      );
    }

    if (
      this.concurrencyStrategy === "reject" &&
      (this.inFlightAgents.get(key) ?? 0) > 0
    ) {
      throw new NetworkRelayError(
        "TUNNEL_AGENT_BUSY",
        { tenantId: input.tenantId, targetType: input.targetType },
        "Retry after the current tool call completes or configure parallel concurrency.",
      );
    }

    const requestId = `net_${this.nextRequestId++}`;
    this.inFlightAgents.set(key, (this.inFlightAgents.get(key) ?? 0) + 1);
    let timer: number | undefined;
    try {
      const response = await Promise.race([
        agent.send({
          type: "tool.call",
          requestId,
          toolName: input.toolName,
          arguments: input.arguments,
          actorSubject: input.actorSubject,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new NetworkRelayError(
                "TUNNEL_REQUEST_TIMEOUT",
                {
                  tenantId: input.tenantId,
                  targetType: input.targetType,
                  requestId,
                },
                "Check the agent connection and retry the tool call.",
              ),
            );
          }, this.requestTimeoutMs);
        }),
      ]);

      if (response.requestId !== requestId) {
        throw new NetworkRelayError(
          "TUNNEL_REQUEST_ID_MISMATCH",
          { expected: requestId, actual: response.requestId },
          "Drop the agent connection because it returned a mismatched request id.",
        );
      }

      return response.result;
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      this.decrementInFlight(key);
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
