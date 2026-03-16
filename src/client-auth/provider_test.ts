import { assertEquals, assertExists } from "@std/assert";
import { OAuthClientProviderImpl } from "./provider.ts";
import { MemoryTokenStore } from "./token-store/memory-store.ts";

Deno.test("OAuthClientProviderImpl - tokens() returns undefined when no stored tokens", async () => {
  const provider = new OAuthClientProviderImpl("https://mcp.example.com", {
    clientId: "test-client",
    tokenStore: new MemoryTokenStore(),
    openBrowser: async () => {},
  });
  const tokens = await provider.tokens();
  assertEquals(tokens, undefined);
});

Deno.test("OAuthClientProviderImpl - saveTokens and tokens round-trip", async () => {
  const store = new MemoryTokenStore();
  const provider = new OAuthClientProviderImpl("https://mcp.example.com", {
    clientId: "test-client",
    tokenStore: store,
    openBrowser: async () => {},
  });
  await provider.saveTokens({
    access_token: "access-123",
    token_type: "bearer",
    refresh_token: "refresh-456",
  });
  const tokens = await provider.tokens();
  assertExists(tokens);
  assertEquals(tokens.access_token, "access-123");
  assertEquals(tokens.refresh_token, "refresh-456");
});

Deno.test("OAuthClientProviderImpl - clientMetadata returns correct shape", () => {
  const provider = new OAuthClientProviderImpl("https://mcp.example.com", {
    clientId: "my-client-id",
    clientName: "Test App",
    tokenStore: new MemoryTokenStore(),
    openBrowser: async () => {},
  });
  const metadata = provider.clientMetadata;
  assertEquals(metadata.client_name, "Test App");
  assertEquals(metadata.grant_types?.includes("authorization_code"), true);
  assertEquals(metadata.token_endpoint_auth_method, "none");
});

Deno.test("OAuthClientProviderImpl - saveCodeVerifier and codeVerifier round-trip", async () => {
  const provider = new OAuthClientProviderImpl("https://mcp.example.com", {
    clientId: "test",
    tokenStore: new MemoryTokenStore(),
    openBrowser: async () => {},
  });
  await provider.saveCodeVerifier("verifier-xyz");
  const verifier = await provider.codeVerifier();
  assertEquals(verifier, "verifier-xyz");
});

Deno.test("OAuthClientProviderImpl - redirectToAuthorization calls openBrowser", async () => {
  let capturedUrl = "";
  const provider = new OAuthClientProviderImpl("https://mcp.example.com", {
    clientId: "test",
    tokenStore: new MemoryTokenStore(),
    openBrowser: async (url) => {
      capturedUrl = url;
    },
  });
  const authUrl = new URL(
    "https://accounts.google.com/o/oauth2/auth?foo=bar",
  );
  await provider.redirectToAuthorization(authUrl);
  assertEquals(capturedUrl, authUrl.toString());
});

Deno.test("OAuthClientProviderImpl - clientInformation returns client_id", async () => {
  const provider = new OAuthClientProviderImpl("https://mcp.example.com", {
    clientId: "my-client-id",
    tokenStore: new MemoryTokenStore(),
    openBrowser: async () => {},
  });
  const info = await provider.clientInformation();
  assertExists(info);
  assertEquals(info.client_id, "my-client-id");
});

Deno.test("OAuthClientProviderImpl - invalidateCredentials clears tokens", async () => {
  const store = new MemoryTokenStore();
  const provider = new OAuthClientProviderImpl("https://mcp.example.com", {
    clientId: "test",
    tokenStore: store,
    openBrowser: async () => {},
  });
  await provider.saveTokens({
    access_token: "secret",
    token_type: "bearer",
  });
  assertExists(await provider.tokens());

  await provider.invalidateCredentials("tokens");
  assertEquals(await provider.tokens(), undefined);
});

Deno.test("OAuthClientProviderImpl - invalidateCredentials('all') clears everything", async () => {
  const store = new MemoryTokenStore();
  const provider = new OAuthClientProviderImpl("https://mcp.example.com", {
    clientId: "test",
    tokenStore: store,
    openBrowser: async () => {},
  });
  await provider.saveTokens({
    access_token: "secret",
    token_type: "bearer",
  });
  await provider.saveCodeVerifier("my-verifier");

  await provider.invalidateCredentials("all");
  assertEquals(await provider.tokens(), undefined);
  assertEquals(await provider.codeVerifier(), "");
});

Deno.test("OAuthClientProviderImpl - setRedirectUrl updates redirectUrl", () => {
  const provider = new OAuthClientProviderImpl("https://mcp.example.com", {
    clientId: "test",
    tokenStore: new MemoryTokenStore(),
    openBrowser: async () => {},
  });
  provider.setRedirectUrl("http://localhost:12345/callback");
  assertEquals(String(provider.redirectUrl), "http://localhost:12345/callback");
});
