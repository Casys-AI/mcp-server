/**
 * Sugar helper for preparing an authenticated MCP transport.
 *
 * Wires together OAuthClientProviderImpl with a CallbackServer.
 * The consumer is responsible for creating the StreamableHTTPClientTransport
 * and passing `result.provider` as the `authProvider` option.
 *
 * @module lib/server/client-auth/connect
 */

import { OAuthClientProviderImpl } from "./provider.ts";
import type { OAuthClientConfig } from "./types.ts";
import { CallbackServer } from "./callback-server.ts";

export interface PrepareOAuthResult {
  /** The configured provider — pass as authProvider to StreamableHTTPClientTransport */
  provider: OAuthClientProviderImpl;
  /** The callback server instance (caller must close on error paths) */
  callbackServer: CallbackServer;
  /** The actual port the callback server is listening on */
  callbackPort: number;
}

/**
 * Prepare an OAuth client provider with a running callback server.
 *
 * Usage:
 * ```typescript
 * const { provider, callbackServer } = await prepareOAuthProvider(serverUrl, config);
 * const transport = new StreamableHTTPClientTransport(new URL(serverUrl), { authProvider: provider });
 * await client.connect(transport);
 * ```
 */
export async function prepareOAuthProvider(
  serverUrl: string,
  config: OAuthClientConfig,
): Promise<PrepareOAuthResult> {
  const callbackServer = new CallbackServer({
    port: config.callbackPort ?? 0,
    timeout: config.authTimeout ?? 120_000,
  });
  const { port } = await callbackServer.start();

  const provider = new OAuthClientProviderImpl(serverUrl, config);
  provider.setRedirectUrl(`http://localhost:${port}/callback`);

  return { provider, callbackServer, callbackPort: port };
}
