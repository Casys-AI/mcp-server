# Securing your HTTP server

MCP over **STDIO** needs no auth — it is a local pipe. **HTTP mode is different:
anyone who can reach the port can call every tool.** This guide covers the two
auth modes `@casys/mcp-server` ships and how to pick one.

> **Bind to loopback unless you mean to expose it.** `startHttp({ hostname })`
> controls the bind address, and reaching the port is what grants access. Bind
> to `127.0.0.1` for local / same-host use, and only expose a non-loopback
> interface (e.g. `0.0.0.0`, which is required inside Docker) once auth is
> configured.

## Which mode?

|            | Static bearer token                                   | OAuth 2.0 / JWT (OIDC)                              |
| ---------- | ----------------------------------------------------- | --------------------------------------------------- |
| What it is | a pre-shared secret                                   | tokens signed by an IdP, validated via JWKS         |
| Needs      | nothing                                               | an IdP (Auth0/Keycloak/Google/…) + a JWKS endpoint  |
| Best for   | same-network (Docker/VPN/LAN), service-to-service, CI | external/public access, team SSO                    |
| Identity   | none — a gate: allowed caller or not                  | per-user `subject`, `scopes`, expiry from the token |

Rule of thumb: **no IdP in the picture → static token.** Standing up an identity
provider just to protect one server is disproportionate. If you need per-user
identity, expiry, or SSO, use OIDC.

Both modes validate the standard `Authorization: Bearer <token>` header, and
neither applies to STDIO.

## Static bearer token

```typescript
import { createStaticTokenAuthProvider, McpApp } from "@casys/mcp-server";

const app = new McpApp({
  name: "my-server",
  version: "1.0.0",
  auth: {
    provider: createStaticTokenAuthProvider(
      (Deno.env.get("MCP_AUTH_TOKENS") ?? "").split(",").filter(Boolean),
      { resource: "https://my-mcp.example.com" },
    ),
  },
});

// requireAuth: true fails fast at startup if no auth provider is configured.
await app.startHttp({ port: 7654, hostname: "0.0.0.0", requireAuth: true });
```

Generate high-entropy tokens (e.g. `openssl rand -base64 32`), keep them in env
or a secrets manager (never in source), and rotate them. Every valid token maps
to the same identity: this authenticates the **caller**, it does not identify a
user. Clients send `Authorization: Bearer <token>`.

## OAuth 2.0 / JWT (OIDC)

For per-user identity, expiry, and SSO, validate JWTs against your provider's
JWKS endpoint:

```typescript
import { createOIDCAuthProvider, McpApp } from "@casys/mcp-server";

const app = new McpApp({
  name: "my-server",
  version: "1.0.0",
  auth: {
    provider: createOIDCAuthProvider({
      issuer: "https://my-tenant.example.com",
      audience: "mcp-my-server",
      resource: "https://my-mcp.example.com",
    }),
  },
});
await app.startHttp({ port: 7654, requireAuth: true });
```

Preset factories exist for common providers: `createAuth0AuthProvider`,
`createGoogleAuthProvider`, `createGitHubAuthProvider`. The token's `subject`
and `scopes` come from its signed claims.

## `requireAuth`

`startHttp({ requireAuth: true })` refuses to start when no auth provider is
configured. Use it in production so a misconfiguration fails loudly at startup
instead of silently exposing every tool.

## Per-tool scopes (optional)

If different callers should reach different tools, gate each tool by scope with
`createScopeMiddleware(new Map([["dangerous_tool", ["admin"]]]))`. The caller's
scopes come from the `AuthInfo` the provider returns:

- with **JWTs**, scopes are signed claims from your IdP;
- with **static tokens**, you set them per provider via the `scopes` option, and
  can hand different tokens different scopes.

Note this is authorization **at the MCP layer**, separate from any backend's own
permission model. If your tools call a backend that already has per-user
permissions, prefer enforcing there (per-user credentials) over rebuilding roles
here.

## Combining modes

`McpApp` takes a single `auth.provider`. To accept, say, both a static token and
JWTs, implement a small composite `AuthProvider` whose `verifyToken` tries each
underlying provider in turn — the `AuthProvider` base class is public for
exactly this kind of extension.
