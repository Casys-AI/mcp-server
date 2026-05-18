import type { NetworkMessage } from "./types.ts";
import type {
  NetworkTunnelCloseReason,
  NetworkTunnelTransport,
} from "./client.ts";

type MaybePromise<T> = T | Promise<T>;

export interface NetworkWebSocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(): void;
  onopen: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event?: unknown) => void) | null;
  onclose:
    | ((event?: { code?: number; reason?: string }) => void)
    | null;
}

export interface NetworkWebSocketFactoryOptions {
  readonly protocols?: string | string[];
  readonly headers?: Record<string, string>;
}

export type NetworkWebSocketFactory = (
  url: string,
  options?: NetworkWebSocketFactoryOptions,
) => NetworkWebSocketLike;

export type NetworkTransportAuth =
  | {
    readonly type: "bearer";
    readonly token: string | (() => MaybePromise<string>);
    readonly via?: "header" | "query";
    readonly queryParam?: string;
  }
  | {
    readonly type: "headers";
    readonly headers:
      | Record<string, string>
      | (() => MaybePromise<Record<string, string>>);
  };

export interface WebSocketNetworkTransportOptions {
  readonly webSocketFactory?: NetworkWebSocketFactory;
  readonly auth?: NetworkTransportAuth;
  readonly protocols?: string | string[];
}

export class WebSocketNetworkTransport implements NetworkTunnelTransport {
  private readonly webSocketFactory: NetworkWebSocketFactory;
  private readonly auth: NetworkTransportAuth | undefined;
  private readonly protocols: string | string[] | undefined;
  private socket: NetworkWebSocketLike | null = null;
  private readonly messageHandlers: Array<(message: NetworkMessage) => void> =
    [];
  private readonly openHandlers: Array<() => void> = [];
  private readonly closeHandlers: Array<
    (reason: NetworkTunnelCloseReason) => void
  > = [];
  private readonly errorHandlers: Array<(error: unknown) => void> = [];

  constructor(options: WebSocketNetworkTransportOptions = {}) {
    this.auth = options.auth;
    this.protocols = options.protocols;
    this.webSocketFactory = options.webSocketFactory ?? ((url, init) => {
      const WebSocketCtor = WebSocket as unknown as NativeWebSocketConstructor;
      return new WebSocketCtor(
        url,
        toNativeWebSocketOptions(init),
      ) as unknown as NetworkWebSocketLike;
    });
  }

  connect(url: string): Promise<void> {
    let connection: WebSocketConnection | Promise<WebSocketConnection>;
    try {
      connection = buildConnection(url, this.auth, this.protocols);
    } catch (err) {
      return Promise.reject(err);
    }
    if (isPromiseLike(connection)) {
      return connection.then((resolved) => this.open(resolved));
    }
    return this.open(connection);
  }

  private open(connection: WebSocketConnection): Promise<void> {
    return new Promise((resolve, reject) => {
      const redactedUrl = redactUrl(
        connection.url,
        authQueryParam(this.auth),
      );
      const socket = this.webSocketFactory(
        connection.url,
        connection.options,
      );
      let connected = false;
      socket.onopen = () => {
        connected = true;
        this.socket = socket;
        this.emitOpen();
        resolve();
      };
      socket.onerror = (event) => {
        const error = new Error(
          `WebSocket network tunnel failed to connect: ${redactedUrl}`,
        );
        this.emitError(event ?? error);
        if (!connected) {
          reject(error);
        }
      };
      socket.onmessage = (event) => {
        this.receive(event.data);
      };
      socket.onclose = (event) => {
        if (!connected) {
          reject(
            new Error(
              `WebSocket network tunnel closed before it connected: ${redactedUrl}`,
            ),
          );
        }
        if (this.socket === socket) this.socket = null;
        this.emitClose({
          code: event?.code,
          reason: event?.reason,
        });
      };
    });
  }

  send(message: NetworkMessage): void {
    if (!this.socket || this.socket.readyState !== 1) {
      throw new Error("WebSocket network tunnel is not connected");
    }
    this.socket.send(JSON.stringify(message));
  }

  onMessage(handler: (message: NetworkMessage) => void): void {
    this.messageHandlers.push(handler);
  }

  onOpen(handler: () => void): void {
    this.openHandlers.push(handler);
  }

  onClose(handler: (reason: NetworkTunnelCloseReason) => void): void {
    this.closeHandlers.push(handler);
  }

  onError(handler: (error: unknown) => void): void {
    this.errorHandlers.push(handler);
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  private receive(raw: string): void {
    try {
      const message = JSON.parse(raw) as NetworkMessage;
      for (const handler of this.messageHandlers) {
        handler(message);
      }
    } catch {
      // Invalid JSON from the relay is ignored at transport level. The protocol
      // layer can add strict validation once the handshake schema is final.
    }
  }

  private emitOpen(): void {
    for (const handler of this.openHandlers) handler();
  }

  private emitClose(reason: NetworkTunnelCloseReason): void {
    for (const handler of this.closeHandlers) handler(reason);
  }

  private emitError(error: unknown): void {
    for (const handler of this.errorHandlers) handler(error);
  }
}

interface WebSocketConnection {
  readonly url: string;
  readonly options?: NetworkWebSocketFactoryOptions;
}

function redactUrl(url: string, queryParam?: string): string {
  const sensitiveParams = new Set(["access_token", "token"]);
  const normalizedQueryParam = queryParam?.trim().toLowerCase();
  if (normalizedQueryParam) {
    sensitiveParams.add(normalizedQueryParam);
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }

  const paramsToRedact = new Set<string>();
  for (const [name] of parsed.searchParams) {
    if (sensitiveParams.has(name.toLowerCase())) {
      paramsToRedact.add(name);
    }
  }
  if (paramsToRedact.size === 0) {
    return url;
  }

  // Keep the endpoint identifiable while replacing bearer token values.
  for (const name of paramsToRedact) {
    parsed.searchParams.set(name, "***");
  }
  return parsed.toString();
}

function authQueryParam(
  auth: NetworkTransportAuth | undefined,
): string | undefined {
  return auth?.type === "bearer" && auth.via === "query"
    ? auth.queryParam
    : undefined;
}

function buildConnection(
  url: string,
  auth: NetworkTransportAuth | undefined,
  protocols: string | string[] | undefined,
): WebSocketConnection | Promise<WebSocketConnection> {
  if (!auth) {
    return protocols ? { url, options: { protocols } } : { url };
  }

  if (auth.type === "bearer") {
    const token = resolveAuthValue(auth.token);
    return isPromiseLike(token)
      ? token.then((resolved) =>
        bearerConnection(url, protocols, auth, resolved)
      )
      : bearerConnection(url, protocols, auth, token);
  }

  const headers = resolveHeaders(auth.headers);
  return isPromiseLike(headers)
    ? headers.then((resolved) => ({
      url,
      options: withHeaders(protocols, resolved),
    }))
    : { url, options: withHeaders(protocols, headers) };
}

function bearerConnection(
  url: string,
  protocols: string | string[] | undefined,
  auth: Extract<NetworkTransportAuth, { type: "bearer" }>,
  token: string,
): WebSocketConnection {
  if (auth.via === "query") {
    const queryUrl = new URL(url);
    queryUrl.searchParams.set(auth.queryParam ?? "access_token", token);
    return protocols
      ? { url: queryUrl.toString(), options: { protocols } }
      : { url: queryUrl.toString() };
  }

  return {
    url,
    options: withHeaders(protocols, {
      authorization: `Bearer ${token}`,
    }),
  };
}

function withHeaders(
  protocols: string | string[] | undefined,
  headers: Record<string, string>,
): NetworkWebSocketFactoryOptions {
  return protocols ? { protocols, headers } : { headers };
}

function resolveHeaders(
  headers:
    | Record<string, string>
    | (() => MaybePromise<Record<string, string>>),
): Record<string, string> | Promise<Record<string, string>> {
  const resolved = typeof headers === "function" ? headers() : headers;
  if (isPromiseLike(resolved)) {
    return resolved.then(normalizeHeaders);
  }
  return normalizeHeaders(resolved);
}

function normalizeHeaders(
  resolved: Record<string, string>,
): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [name, value] of Object.entries(resolved)) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("WebSocket network tunnel auth header name is empty");
    }
    normalized[trimmedName.toLowerCase()] = validateAuthValue(
      value,
      `auth header ${trimmedName}`,
    );
  }
  return normalized;
}

function resolveAuthValue(
  value: string | (() => MaybePromise<string>),
): string | Promise<string> {
  const resolved = typeof value === "function" ? value() : value;
  return isPromiseLike(resolved)
    ? resolved.then((token) => validateAuthValue(token, "auth token"))
    : validateAuthValue(resolved, "auth token");
}

function validateAuthValue(value: string, label: string): string {
  if (value.trim().length === 0) {
    throw new Error(`WebSocket network tunnel ${label} is empty`);
  }
  return value;
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof (value as { then?: unknown }).then === "function";
}

function toNativeWebSocketOptions(
  options: NetworkWebSocketFactoryOptions | undefined,
): string | string[] | NativeWebSocketOptions | undefined {
  if (!options) return undefined;
  if (options.headers) {
    return { protocols: options.protocols, headers: options.headers };
  }
  return options.protocols;
}

interface NativeWebSocketOptions {
  readonly protocols?: string | string[];
  readonly headers?: Record<string, string>;
}

interface NativeWebSocketConstructor {
  new (
    url: string,
    protocolsOrOptions?: string | string[] | NativeWebSocketOptions,
  ): WebSocket;
}
