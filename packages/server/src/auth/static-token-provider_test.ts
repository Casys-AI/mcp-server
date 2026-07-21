/**
 * Tests for StaticTokenAuthProvider.
 *
 * @module lib/server/auth/static-token-provider_test
 */

import { assertEquals, assertThrows } from "@std/assert";
import { httpsUrl } from "./types.ts";
import {
  createStaticTokenAuthProvider,
  StaticTokenAuthProvider,
} from "./static-token-provider.ts";

// ── Construction ─────────────────────────────────────────────────────────────

Deno.test("StaticTokenAuthProvider - throws on empty tokens array", () => {
  assertThrows(
    () =>
      new StaticTokenAuthProvider([], { resource: "https://mcp.example.com" }),
    Error,
    "at least one token",
  );
});

Deno.test("StaticTokenAuthProvider - throws on missing resource", () => {
  assertThrows(
    () => new StaticTokenAuthProvider(["tok"], { resource: "  " }),
    Error,
    "`resource` is required",
  );
});

Deno.test("StaticTokenAuthProvider - throws on non-URL resource", () => {
  assertThrows(
    () => new StaticTokenAuthProvider(["tok"], { resource: "not-a-url" }),
    Error,
  );
});

// ── verifyToken ──────────────────────────────────────────────────────────────

Deno.test("StaticTokenAuthProvider - valid token returns AuthInfo", async () => {
  const provider = createStaticTokenAuthProvider(["secret-token"], {
    resource: "https://mcp.example.com",
    subject: "ci",
    scopes: ["read"],
  });
  const info = await provider.verifyToken("secret-token");
  assertEquals(info?.subject, "ci");
  assertEquals(info?.scopes, ["read"]);
});

Deno.test("StaticTokenAuthProvider - unknown token returns null", async () => {
  const provider = createStaticTokenAuthProvider(["secret-token"], {
    resource: "https://mcp.example.com",
  });
  assertEquals(await provider.verifyToken("wrong-token"), null);
});

Deno.test("StaticTokenAuthProvider - multiple tokens all valid", async () => {
  const provider = createStaticTokenAuthProvider(["token-a", "token-b"], {
    resource: "https://mcp.example.com",
  });
  assertEquals(
    (await provider.verifyToken("token-a"))?.subject,
    "static-token-user",
  );
  assertEquals(
    (await provider.verifyToken("token-b"))?.subject,
    "static-token-user",
  );
  assertEquals(await provider.verifyToken("token-c"), null);
});

Deno.test("StaticTokenAuthProvider - defaults: subject and scopes", async () => {
  const provider = createStaticTokenAuthProvider(["tok"], {
    resource: "https://mcp.example.com",
  });
  const info = await provider.verifyToken("tok");
  assertEquals(info?.subject, "static-token-user");
  assertEquals(info?.scopes, []);
});

// ── getResourceMetadata ──────────────────────────────────────────────────────

Deno.test("StaticTokenAuthProvider - metadata: empty authorization_servers + header method", () => {
  const meta = createStaticTokenAuthProvider(["tok"], {
    resource: "https://mcp.example.com",
  }).getResourceMetadata();
  assertEquals(meta.resource, "https://mcp.example.com");
  assertEquals(meta.authorization_servers, []);
  assertEquals(meta.bearer_methods_supported, ["header"]);
  assertEquals(
    meta.resource_metadata_url,
    httpsUrl("https://mcp.example.com/.well-known/oauth-protected-resource"),
  );
});

Deno.test("StaticTokenAuthProvider - metadata: RFC 9728 3.1 path insertion", () => {
  const meta = createStaticTokenAuthProvider(["tok"], {
    resource: "https://mcp.example.com/v2/mcp",
  }).getResourceMetadata();
  assertEquals(
    meta.resource_metadata_url,
    httpsUrl(
      "https://mcp.example.com/.well-known/oauth-protected-resource/v2/mcp",
    ),
  );
});

Deno.test("StaticTokenAuthProvider - metadata: explicit resourceMetadataUrl wins", () => {
  const meta = createStaticTokenAuthProvider(["tok"], {
    resource: "https://mcp.example.com",
    resourceMetadataUrl:
      "https://meta.example.com/.well-known/oauth-protected-resource",
  }).getResourceMetadata();
  assertEquals(
    meta.resource_metadata_url,
    httpsUrl("https://meta.example.com/.well-known/oauth-protected-resource"),
  );
});

Deno.test("StaticTokenAuthProvider - metadata: scopes_supported derives from scopes", () => {
  const meta = createStaticTokenAuthProvider(["tok"], {
    resource: "https://mcp.example.com",
    scopes: ["read", "write"],
  }).getResourceMetadata();
  assertEquals(meta.scopes_supported, ["read", "write"]);
});

Deno.test("StaticTokenAuthProvider - metadata: scopes_supported override", () => {
  const meta = createStaticTokenAuthProvider(["tok"], {
    resource: "https://mcp.example.com",
    scopes: ["read"],
    scopesSupported: ["read", "write", "admin"],
  }).getResourceMetadata();
  assertEquals(meta.scopes_supported, ["read", "write", "admin"]);
});

Deno.test("StaticTokenAuthProvider - throws on empty token entry", () => {
  assertThrows(
    () =>
      new StaticTokenAuthProvider(["", "ok"], {
        resource: "https://mcp.example.com",
      }),
    Error,
    "empty entries",
  );
});

Deno.test("StaticTokenAuthProvider - verifyToken scopes cannot be mutated", async () => {
  const provider = createStaticTokenAuthProvider(["tok"], {
    resource: "https://mcp.example.com",
    scopes: ["read"],
  });
  const info = await provider.verifyToken("tok");
  assertThrows(() => info!.scopes.push("admin"));
});

Deno.test("StaticTokenAuthProvider - metadata: preserves resource query string", () => {
  const meta = createStaticTokenAuthProvider(["tok"], {
    resource: "https://mcp.example.com/v2?tenant=a",
  }).getResourceMetadata();
  assertEquals(
    meta.resource_metadata_url,
    httpsUrl(
      "https://mcp.example.com/.well-known/oauth-protected-resource/v2?tenant=a",
    ),
  );
});

Deno.test("StaticTokenAuthProvider - validates resource even when resourceMetadataUrl is set", () => {
  assertThrows(
    () =>
      new StaticTokenAuthProvider(["tok"], {
        resource: "not-a-url",
        resourceMetadataUrl:
          "https://meta.example.com/.well-known/oauth-protected-resource",
      }),
    Error,
  );
});

Deno.test("StaticTokenAuthProvider - stored tokens are trimmed to match extracted bearer", async () => {
  const provider = createStaticTokenAuthProvider([" secret "], {
    resource: "https://mcp.example.com",
  });
  assertEquals(
    (await provider.verifyToken("secret"))?.subject,
    "static-token-user",
  );
  // verifyToken trims its argument too, so a padded direct call matches.
  assertEquals(
    (await provider.verifyToken(" secret "))?.subject,
    "static-token-user",
  );
});
