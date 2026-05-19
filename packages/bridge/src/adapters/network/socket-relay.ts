import type {
  NetworkAgentHello,
  NetworkMessage,
  NetworkToolCallRequest,
  NetworkToolCallResponse,
} from "./types.ts";
import { NETWORK_PROTOCOL_VERSION } from "./types.ts";
import {
  type NetworkRelay,
  NetworkRelayError,
  type RegisteredNetworkAgentSendOptions,
} from "./relay.ts";

export interface NetworkTunnelSocket {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onmessage: ((event: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}

export interface AttachNetworkTunnelSocketArgs {
  readonly relay: NetworkRelay;
  readonly socket: NetworkTunnelSocket;
  readonly tenantId: string;
  readonly helloTimeoutMs?: number;
  readonly toolCallTimeoutMs?: number;
  readonly authorizeAgentHello?: NetworkAgentHelloAuthorizer;
}

export type NetworkAgentHelloAuthorization =
  | { ok: true }
  | { ok: false; closeCode: number; reason: string };

export type NetworkAgentHelloAuthorizer = (
  message: NetworkAgentHello,
) => NetworkAgentHelloAuthorization | Promise<NetworkAgentHelloAuthorization>;

interface PendingToolCall {
  readonly resolve: (response: NetworkToolCallResponse) => void;
  readonly reject: (error: Error) => void;
  readonly timer: number;
  readonly signal?: AbortSignal;
  readonly onAbort?: () => void;
}

let nextRegistrationId = 1;

export function attachNetworkTunnelSocket(
  args: AttachNetworkTunnelSocketArgs,
): void {
  const pending = new Map<string, PendingToolCall>();
  let registered:
    | {
      tenantId: string;
      targetType: string;
      agentId: string;
      registrationId: string;
    }
    | null = null;
  let registering = false;
  let closed = false;
  const timeoutMs = args.toolCallTimeoutMs ?? 30_000;
  const helloTimer = setTimeout(() => {
    if (!registered && !closed) {
      args.socket.close(4002, "agent hello timeout");
    }
  }, args.helloTimeoutMs ?? 5_000);

  args.socket.onmessage = (event) => {
    const message = parseNetworkMessage(event.data);
    if (!message) return;

    if (message.type === "agent.hello") {
      if (!hasSupportedProtocolVersion(message)) {
        args.socket.close(4002, "protocol version mismatch");
        return;
      }
      if (!isValidAgentHello(message)) {
        args.socket.close(4002, "invalid agent hello");
        return;
      }
      void handleAgentHello(message);
      return;
    }

    if (message.type === "tool.result") {
      const waiter = pending.get(message.requestId);
      if (!waiter) return;
      pending.delete(message.requestId);
      cleanupPendingToolCall(waiter);
      waiter.resolve(message);
      return;
    }

    if (message.type === "error" && message.requestId) {
      const waiter = pending.get(message.requestId);
      if (!waiter) return;
      pending.delete(message.requestId);
      cleanupPendingToolCall(waiter);
      waiter.reject(new Error(`${message.code}: ${message.message}`));
    }
  };

  const cleanup = () => {
    closed = true;
    clearTimeout(helloTimer);
    if (registered) {
      args.relay.unregisterAgent(
        registered.tenantId,
        registered.targetType,
        registered.agentId,
        registered.registrationId,
        "disconnected",
      );
      registered = null;
    }
    for (const [requestId, waiter] of pending) {
      pending.delete(requestId);
      cleanupPendingToolCall(waiter);
      waiter.reject(
        new NetworkRelayError({
          code: "TUNNEL_AGENT_DISCONNECTED",
          context: {
            requestId,
          },
          recovery: "Reconnect the tunnel agent before retrying the tool call.",
        }),
      );
    }
  };

  args.socket.onclose = cleanup;
  args.socket.onerror = cleanup;

  async function handleAgentHello(message: NetworkAgentHello): Promise<void> {
    if (registered || registering) {
      args.socket.close(4008, "agent already registered");
      return;
    }
    if (message.tenantId !== args.tenantId) {
      args.socket.close(4003, "tenant mismatch");
      return;
    }

    registering = true;
    try {
      let authorization: NetworkAgentHelloAuthorization;
      try {
        authorization = await (args.authorizeAgentHello?.(message) ?? {
          ok: false,
          closeCode: 4001,
          reason: "agent authorization required",
        });
      } catch {
        args.socket.close(4001, "agent authorization failed");
        return;
      }
      if (!authorization.ok) {
        args.socket.close(authorization.closeCode, authorization.reason);
        return;
      }
      if (closed) return;

      registered = {
        tenantId: message.tenantId,
        targetType: message.targetType,
        agentId: message.agentId,
        registrationId: `socket_${nextRegistrationId++}`,
      };
      clearTimeout(helloTimer);
      args.relay.registerAgent({
        tenantId: message.tenantId,
        targetType: message.targetType,
        agentId: message.agentId,
        registrationId: registered.registrationId,
        send: (toolCall, options) =>
          sendToolCall(args.socket, pending, toolCall, timeoutMs, options),
      });
      args.socket.send(JSON.stringify(agentReady(message)));
    } finally {
      registering = false;
    }
  }
}

function isValidAgentHello(
  message: NetworkMessage,
): message is NetworkAgentHello {
  return message.type === "agent.hello" &&
    isNonEmptyString(message.tenantId) &&
    isNonEmptyString(message.targetType) &&
    isNonEmptyString(message.agentId) &&
    Number.isInteger(message.keyVersion) &&
    message.keyVersion > 0;
}

function hasSupportedProtocolVersion(message: NetworkMessage): boolean {
  return "protocolVersion" in message &&
    message.protocolVersion === NETWORK_PROTOCOL_VERSION;
}

function sendToolCall(
  socket: NetworkTunnelSocket,
  pending: Map<string, PendingToolCall>,
  toolCall: NetworkToolCallRequest,
  timeoutMs: number,
  options?: RegisteredNetworkAgentSendOptions,
): Promise<NetworkToolCallResponse> {
  if (pending.has(toolCall.requestId)) {
    return Promise.reject(
      new Error(`DUPLICATE_TUNNEL_REQUEST requestId=${toolCall.requestId}`),
    );
  }

  return new Promise((resolve, reject) => {
    const signal = options?.signal;
    const abort = () => {
      const waiter = pending.get(toolCall.requestId);
      if (!waiter) return;
      pending.delete(toolCall.requestId);
      cleanupPendingToolCall(waiter);
      const error = relayErrorFromAbortSignal(signal, toolCall.requestId);
      sendCancellationFrame(socket, toolCall.requestId, error);
      reject(error);
    };
    const timer = setTimeout(() => {
      const waiter = pending.get(toolCall.requestId);
      pending.delete(toolCall.requestId);
      if (waiter) cleanupPendingToolCall(waiter);
      const error = new NetworkRelayError({
        code: "TUNNEL_REQUEST_TIMEOUT",
        context: { requestId: toolCall.requestId },
        recovery: "Check the agent connection and retry the tool call.",
      });
      sendCancellationFrame(socket, toolCall.requestId, error);
      reject(
        error,
      );
    }, timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    pending.set(toolCall.requestId, {
      resolve,
      reject,
      timer,
      signal,
      onAbort: abort,
    });

    if (signal?.aborted) {
      abort();
      return;
    }

    try {
      socket.send(JSON.stringify(toolCall));
    } catch (err) {
      pending.delete(toolCall.requestId);
      cleanupPendingToolCall({
        resolve,
        reject,
        timer,
        signal,
        onAbort: abort,
      });
      reject(err instanceof Error ? err : new Error(String(err)));
    }
  });
}

function cleanupPendingToolCall(waiter: PendingToolCall): void {
  clearTimeout(waiter.timer);
  if (waiter.signal && waiter.onAbort) {
    waiter.signal.removeEventListener("abort", waiter.onAbort);
  }
}

function relayErrorFromAbortSignal(
  signal: AbortSignal | undefined,
  requestId: string,
): NetworkRelayError {
  const reason = signal?.reason;
  if (reason instanceof NetworkRelayError) return reason;
  return new NetworkRelayError({
    code: "TUNNEL_REQUEST_CANCELLED",
    context: { requestId },
    recovery: "Retry after the tunnel agent is registered again.",
  });
}

function sendCancellationFrame(
  socket: NetworkTunnelSocket,
  requestId: string,
  error: NetworkRelayError,
): void {
  try {
    socket.send(JSON.stringify({
      type: "error",
      requestId,
      code: error.code,
      message: error.message,
      context: error.context,
    }));
  } catch {
    // The abort may be caused by the same broken socket; the relay already has
    // the structured rejection locally.
  }
}

function parseNetworkMessage(raw: string): NetworkMessage | null {
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) && typeof parsed.type === "string"
      ? parsed as unknown as NetworkMessage
      : null;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function agentReady(message: NetworkAgentHello): NetworkMessage {
  return {
    type: "agent.ready",
    protocolVersion: NETWORK_PROTOCOL_VERSION,
    tenantId: message.tenantId,
    targetType: message.targetType,
    agentId: message.agentId,
  };
}
