/**
 * OAuth client auth types.
 *
 * Interfaces for token storage and OAuth client configuration.
 * Used by OAuthClientProviderImpl to authenticate against
 * OAuth-protected MCP servers.
 *
 * @module lib/server/client-auth/types
 */

import type { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";

/** Stored OAuth credentials for one MCP server */
export interface StoredCredentials {
  /** The MCP server URL these credentials are for */
  serverUrl: string;
  /** OAuth tokens (access_token, refresh_token, etc.) */
  tokens: OAuthTokens;
  /** When the tokens were obtained (Unix epoch ms) */
  obtainedAt: number;
  /** Authorization server URL (needed for refresh) */
  authServerUrl?: string;
}

/** Abstract token storage — consumers provide the implementation */
export interface TokenStore {
  /** Retrieve stored credentials for a server, or null if none */
  get(serverUrl: string): Promise<StoredCredentials | null>;
  /** Store credentials for a server */
  set(serverUrl: string, credentials: StoredCredentials): Promise<void>;
  /** Delete credentials for a server */
  delete(serverUrl: string): Promise<void>;
  /** List all server URLs with stored credentials */
  list(): Promise<string[]>;
}

/** Configuration for creating an OAuthClientProvider */
export interface OAuthClientConfig {
  /** OAuth Client ID (public — embedded in consumer binary) */
  clientId: string;
  /** Client name shown in consent screen */
  clientName?: string;
  /** Scopes to request (space-separated in OAuth, array here) */
  scopes?: string[];
  /** Token storage backend */
  tokenStore: TokenStore;
  /** Callback to open browser — injected by consumer (platform-specific) */
  openBrowser: (url: string) => Promise<void>;
  /** Callback server port (0 = OS auto-assign, default: 0) */
  callbackPort?: number;
  /** Timeout for user to complete OAuth flow (ms, default: 120_000) */
  authTimeout?: number;
}
