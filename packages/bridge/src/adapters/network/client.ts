import type {
  NetworkAgentHello,
  NetworkMessage,
  NetworkToolCallRequest,
} from "./types.ts";

export interface NetworkTunnelTransport {
  connect(url: string): Promise<void>;
  send(message: NetworkMessage): void;
  onMessage(handler: (message: NetworkMessage) => void): void;
  disconnect(): void;
}

export type NetworkToolCallHandler = (
  call: NetworkToolCallRequest,
) => Promise<unknown>;

export interface NetworkTunnelClientOptions {
  readonly transport: NetworkTunnelTransport;
  readonly tenantId: string;
  readonly targetType: string;
  readonly agentId: string;
  readonly keyVersion: number;
  readonly handleToolCall: NetworkToolCallHandler;
}

export class NetworkTunnelClient {
  constructor(private readonly options: NetworkTunnelClientOptions) {}

  async start(relayUrl: string): Promise<void> {
    this.options.transport.onMessage((message) => {
      void this.handleMessage(message).catch(() => {
        // Transport-level send failures cannot be reported over the same
        // failing transport. Keep them out of tool failure semantics.
      });
    });
    await this.options.transport.connect(relayUrl);
    this.options.transport.send(this.hello());
  }

  stop(): void {
    this.options.transport.disconnect();
  }

  private async handleMessage(message: NetworkMessage): Promise<void> {
    if (message.type !== "tool.call") return;

    let result: unknown;
    try {
      result = await this.options.handleToolCall(message);
    } catch (err) {
      this.options.transport.send({
        type: "error",
        requestId: message.requestId,
        code: "TOOL_CALL_FAILED",
        message: err instanceof Error ? err.message : String(err),
        context: { toolName: message.toolName },
      });
      return;
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
      tenantId: this.options.tenantId,
      targetType: this.options.targetType,
      agentId: this.options.agentId,
      keyVersion: this.options.keyVersion,
    };
  }
}
