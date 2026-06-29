/**
 * OAuth client provider implementation.
 *
 * Implements OAuthClientProvider from the MCP SDK for authenticating
 * against OAuth-protected MCP servers. Handles token storage,
 * PKCE flow, and browser-based authorization.
 *
 * @module lib/server/client-auth/provider
 */

import type {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { OAuthClientConfig } from "./types.ts";
import {
  CimdConfigError,
  isCimdConfig,
  resolveClientMode,
  validateCimdClientConfig,
} from "./client-id-metadata.ts";

export class OAuthClientProviderImpl implements OAuthClientProvider {
  private serverUrl: string;
  private config: OAuthClientConfig;
  private _codeVerifier = "";
  private _clientInfo: OAuthClientInformationMixed | undefined;
  private _redirectUrl: string | undefined;

  constructor(serverUrl: string, config: OAuthClientConfig) {
    const mode = resolveClientMode(config);
    if (mode === "client_id_metadata") {
      validateCimdClientConfig(config);
    }
    this.serverUrl = serverUrl;
    this.config = config;
  }

  get redirectUrl(): string | URL {
    if (isCimdConfig(this.config)) {
      return this.config.clientRegistration.redirectUri;
    }
    return this._redirectUrl ?? "http://localhost:0/callback";
  }

  /** Set the redirect URL (called after CallbackServer binds to a port). */
  setRedirectUrl(url: string): void {
    if (isCimdConfig(this.config)) {
      if (url !== this.config.clientRegistration.redirectUri) {
        throw new CimdConfigError(
          "cimd_redirect_mismatch",
          "CIMD redirectUrl cannot differ from configured redirectUri",
          {
            redirectUrl: url,
            configuredRedirectUri: this.config.clientRegistration.redirectUri,
          },
          "Use clientRegistration.redirectUri as the runtime redirect URL.",
        );
      }
      return;
    }
    this._redirectUrl = url;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: this.config.clientName ?? "PML Client",
      redirect_uris: [String(this.redirectUrl)],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none", // public client, PKCE only
      application_type: "native", // loopback CLI/desktop — prevents AS rejection of http://127.0.0.1 redirects
    };
  }

  clientInformation(): Promise<OAuthClientInformationMixed | undefined> {
    if (isCimdConfig(this.config)) {
      return Promise.resolve({
        client_id: this.config.clientRegistration.clientIdMetadataUrl,
      });
    }
    return Promise.resolve(
      this._clientInfo ?? {
        client_id: this.config.clientId,
      },
    );
  }

  saveClientInformation(
    info: OAuthClientInformationMixed,
  ): Promise<void> {
    this._clientInfo = info;
    return Promise.resolve();
  }

  async tokens(): Promise<OAuthTokens | undefined> {
    const stored = await this.config.tokenStore.get(this.serverUrl);
    return stored?.tokens ?? undefined;
  }

  async saveTokens(tokens: OAuthTokens): Promise<void> {
    await this.config.tokenStore.set(this.serverUrl, {
      serverUrl: this.serverUrl,
      tokens,
      obtainedAt: Date.now(),
    });
  }

  async redirectToAuthorization(authorizationUrl: URL): Promise<void> {
    await this.config.openBrowser(authorizationUrl.toString());
  }

  saveCodeVerifier(codeVerifier: string): Promise<void> {
    this._codeVerifier = codeVerifier;
    return Promise.resolve();
  }

  codeVerifier(): Promise<string> {
    return Promise.resolve(this._codeVerifier);
  }

  async invalidateCredentials(
    scope: "all" | "client" | "tokens" | "verifier" | "discovery",
  ): Promise<void> {
    if (scope === "all" || scope === "tokens") {
      await this.config.tokenStore.delete(this.serverUrl);
    }
    if (scope === "all" || scope === "verifier") {
      this._codeVerifier = "";
    }
    if (scope === "all" || scope === "client") {
      this._clientInfo = undefined;
    }
  }
}
