import type {
  NetworkAgentHello,
  NetworkMessage,
  NetworkToolCallRequest,
} from "./types.ts";
import { NETWORK_PROTOCOL_VERSION } from "./types.ts";
import { NetworkRelayError } from "./relay.ts";

export interface NetworkTunnelCloseReason {
  readonly code?: number;
  readonly reason?: string;
}

export interface NetworkTunnelTransport {
  connect(url: string): Promise<void>;
  send(message: NetworkMessage): void;
  onMessage(handler: (message: NetworkMessage) => void): void;
  onOpen(handler: () => void): void;
  onClose(handler: (reason: NetworkTunnelCloseReason) => void): void;
  onError(handler: (error: unknown) => void): void;
  disconnect(): void;
}

export interface NetworkToolCallHandlerOptions {
  readonly signal: AbortSignal;
}

export type NetworkToolCallHandler = (
  call: NetworkToolCallRequest,
  options?: NetworkToolCallHandlerOptions,
) => Promise<unknown>;

export interface NetworkTunnelClientOptions {
  readonly transport: NetworkTunnelTransport;
  readonly tenantId: string;
  readonly targetType: string;
  readonly agentId: string;
  readonly keyVersion: number;
  readonly reconnect?: NetworkTunnelReconnectOptions | false;
  readonly onTerminalError?: (error: NetworkRelayError) => void;
  readonly handleToolCall: NetworkToolCallHandler;
}

export interface NetworkTunnelReconnectOptions {
  readonly initialDelayMs?: number;
  readonly maxDelayMs?: number;
  readonly jitterRatio?: number;
}

export class NetworkTunnelClient {
  private readonly pendingToolCalls = new Map<string, AbortController>();
  private relayUrl: string | null = null;
  private stopped = true;
  private reconnecting = false;
  private reconnectAttempt = 0;
  private reconnectTimer: number | undefined;
  private resolveReconnectSleep: (() => void) | undefined;
  private lifecycleRegistered = false;

  constructor(private readonly options: NetworkTunnelClientOptions) {}

  async start(relayUrl: string): Promise<void> {
    this.relayUrl = relayUrl;
    this.stopped = false;
    this.registerLifecycleHandlers();
    await this.connectAndHello();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    this.resolveReconnectSleep?.();
    this.resolveReconnectSleep = undefined;
    for (const controller of this.pendingToolCalls.values()) {
      controller.abort(new Error("network tunnel client stopped"));
    }
    this.pendingToolCalls.clear();
    this.options.transport.disconnect();
  }

  private registerLifecycleHandlers(): void {
    if (this.lifecycleRegistered) return;
    this.lifecycleRegistered = true;
    this.options.transport.onMessage((message) => {
      void this.handleMessage(message).catch(() => {
        // Transport-level send failures cannot be reported over the same
        // failing transport. Keep them out of tool failure semantics.
      });
    });
    this.options.transport.onOpen(() => {
      this.reconnectAttempt = 0;
    });
    this.options.transport.onClose((reason) => {
      this.abortPendingToolCalls(
        new Error(`network tunnel closed: ${reason.reason ?? "unknown"}`),
      );
      if (this.stopped) return;
      if (isTerminalClose(reason)) {
        this.stopped = true;
        this.options.onTerminalError?.(terminalCloseError(reason));
        return;
      }
      this.scheduleReconnect();
    });
    this.options.transport.onError((_error) => {
      if (!this.stopped) this.scheduleReconnect();
    });
  }

  private async connectAndHello(): Promise<void> {
    if (!this.relayUrl) {
      throw new Error("network tunnel relay URL is not configured");
    }
    await this.options.transport.connect(this.relayUrl);
    if (this.stopped) return;
    this.options.transport.send(this.hello());
  }

  private scheduleReconnect(): void {
    if (this.options.reconnect === false || this.reconnecting || this.stopped) {
      return;
    }
    this.reconnecting = true;
    void this.reconnectLoop();
  }

  private async reconnectLoop(): Promise<void> {
    try {
      while (!this.stopped) {
        await this.sleep(this.nextReconnectDelayMs());
        if (this.stopped) return;
        try {
          await this.connectAndHello();
          this.reconnectAttempt = 0;
          return;
        } catch (err) {
          if (err instanceof NetworkRelayError) {
            this.stopped = true;
            this.options.onTerminalError?.(err);
            return;
          }
        }
      }
    } finally {
      this.reconnecting = false;
    }
  }

  private nextReconnectDelayMs(): number {
    const options = this.options.reconnect === false
      ? undefined
      : this.options.reconnect;
    const initialDelayMs = options?.initialDelayMs ?? 1_000;
    const maxDelayMs = options?.maxDelayMs ?? 60_000;
    const jitterRatio = options?.jitterRatio ?? 0.2;
    const base = Math.min(
      maxDelayMs,
      initialDelayMs * 2 ** this.reconnectAttempt++,
    );
    if (jitterRatio <= 0 || base <= 0) return base;
    const jitter = base * jitterRatio * (Math.random() * 2 - 1);
    return Math.max(0, Math.round(base + jitter));
  }

  private sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
      this.resolveReconnectSleep = resolve;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = undefined;
        this.resolveReconnectSleep = undefined;
        resolve();
      }, delayMs);
    });
  }

  private abortPendingToolCalls(reason: unknown): void {
    for (const controller of this.pendingToolCalls.values()) {
      controller.abort(reason);
    }
    this.pendingToolCalls.clear();
  }

  private async handleMessage(message: NetworkMessage): Promise<void> {
    if (message.type === "error" && message.requestId) {
      this.pendingToolCalls.get(message.requestId)?.abort(message);
      return;
    }

    if (message.type !== "tool.call") return;

    const controller = new AbortController();
    this.pendingToolCalls.set(message.requestId, controller);
    let result: unknown;
    try {
      result = await this.options.handleToolCall(message, {
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
    } catch (err) {
      if (controller.signal.aborted) return;
      this.options.transport.send({
        type: "error",
        requestId: message.requestId,
        code: "TOOL_CALL_FAILED",
        message: err instanceof Error ? err.message : String(err),
        context: { toolName: message.toolName },
      });
      return;
    } finally {
      this.pendingToolCalls.delete(message.requestId);
    }

    this.options.transport.send({
      type: "tool.result",
      requestId: message.requestId,
      result,
    });
  }

  private hello(): NetworkAgentHello {
    return {
      type: "agent.hello",
      protocolVersion: NETWORK_PROTOCOL_VERSION,
      tenantId: this.options.tenantId,
      targetType: this.options.targetType,
      agentId: this.options.agentId,
      keyVersion: this.options.keyVersion,
    };
  }
}

function isTerminalClose(reason: NetworkTunnelCloseReason): boolean {
  return reason.code === 4001 ||
    reason.code === 4002 ||
    reason.code === 4004 ||
    reason.code === 4009;
}

function terminalCloseError(
  reason: NetworkTunnelCloseReason,
): NetworkRelayError {
  return new NetworkRelayError({
    code: "TUNNEL_AGENT_DISCONNECTED",
    context: {
      closeCode: reason.code,
      reason: reason.reason,
    },
    recovery:
      "Fix tunnel authentication or protocol configuration before reconnecting.",
  });
}
