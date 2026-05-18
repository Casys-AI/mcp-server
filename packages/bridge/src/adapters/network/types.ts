/**
 * Network tunnel message contract.
 *
 * This adapter is the outbound tunnel counterpart to Telegram/LINE bridges:
 * a customer-side agent opens a WebSocket to a SaaS relay, then the relay routes
 * MCP tool calls to that agent.
 */

export const NETWORK_PROTOCOL_VERSION = 1;

export type NetworkMessage =
  | NetworkAgentHello
  | NetworkAgentReady
  | NetworkHeartbeat
  | NetworkToolCallRequest
  | NetworkToolCallResponse
  | NetworkError;

export interface NetworkAgentHello {
  readonly type: "agent.hello";
  readonly protocolVersion: number;
  readonly tenantId: string;
  readonly targetType: string;
  readonly agentId: string;
  readonly keyVersion: number;
}

export interface NetworkAgentReady {
  readonly type: "agent.ready";
  readonly protocolVersion: number;
  readonly tenantId: string;
  readonly targetType: string;
  readonly agentId: string;
}

export interface NetworkHeartbeat {
  readonly type: "heartbeat";
  readonly at: string;
}

export interface NetworkToolCallRequest {
  readonly type: "tool.call";
  readonly requestId: string;
  readonly toolName: string;
  readonly arguments: Record<string, unknown>;
  readonly actorSubject: string | null;
}

export interface NetworkToolCallResponse {
  readonly type: "tool.result";
  readonly requestId: string;
  readonly result: unknown;
}

export interface NetworkError {
  readonly type: "error";
  readonly requestId?: string;
  readonly code: string;
  readonly message: string;
  readonly context: Record<string, unknown>;
}
