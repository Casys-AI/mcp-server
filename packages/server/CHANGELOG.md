# Changelog

All notable changes to `@casys/mcp-server` will be documented in this file.

## [Unreleased]

## [0.17.4] - 2026-04-16

### Fixed

- **Eliminated redundant `verifyToken` call on `tools/call`.** The HTTP-level
  auth gate (`verifyHttpAuth`) and the middleware pipeline (`createAuthMiddleware`)
  both called `provider.verifyToken()`, causing two independent JWKS lookups per
  tool call. On cold cache (after server restart), concurrent requests could race
  against the JWKS fetch — one call succeeds while the other gets a transient
  failure swallowed by `catch {} → null → 401`. Fix: `verifyHttpAuth` now returns
  the verified `AuthInfo`, which is passed to the middleware context.
  `createAuthMiddleware` skips re-verification when `ctx.authInfo` is already set.

## [0.17.3] - 2026-04-16

### Fixed

- **`resolveViewerDistPath` now handles HTTPS module URLs (JSR / remote
  modules).** When a package is consumed from JSR, `import.meta.url` is an
  `https://jsr.io/...` URL, not a `file://` URL. The previous code passed it
  to `fileUrlToPath()`, which only handles `file://` URLs, producing a
  broken UNC-like path (`//jsr.io/...`) and making every candidate `exists`
  check fail. The fix adds an early HTTPS branch that returns the raw
  resolved URL string (via `new URL(...).href`) instead of calling
  `fileUrlToPath`. The `exists` and `readFile` callbacks receive the HTTPS
  URL string and are responsible for handling it (e.g., via `fetch()`). The
  existing `file://` path is unchanged.

## [0.17.2] - 2026-04-16

### Fixed

- **Auth gate now covers `initialize` method** when `requireAuth: true`.
  Previously, `initialize` was excluded from auth checking, which prevented MCP
  clients (Claude.ai, Cursor) from discovering the OAuth flow — they received a
  200 response instead of the 401 needed to trigger WWW-Authenticate → PRM → AS
  metadata → DCR discovery.

- **Protocol version bumped to `2025-06-18`** (was `2025-03-26`). The 2025-06-18
  spec introduced mandatory auth support; clients seeing the old version skip
  the auth flow entirely.

## [0.17.1] - 2026-04-16

### Added

- **`createAsMetadataHandler`** — framework-agnostic Web Standard handler that
  serves an RFC 8414 Authorization Server Metadata document enriched with
  `registration_endpoint` (RFC 7591). Enables MCP servers behind IdPs without
  native Dynamic Client Registration (e.g., Zitadel, unconfigured Keycloak, Okta
  free tier) to advertise a DCR proxy so clients like Claude.ai can
  auto-register. See `AsMetadataProxyOptions` for configuration.
  - Two input forms: `upstreamMetadataUrl` (any AS) or `upstreamIssuer` (OIDC
    shorthand) — mutually exclusive, validated at construction time
  - Built-in stale-while-revalidate caching (default 24h TTL) with
    thundering-herd guard on background refreshes
  - Upstream response shape validation (requires JSON object with `issuer`)
  - Injectable `fetch` for testing and advanced use cases (mTLS, retries)
  - Fail-fast validation at construction: URLs, mutual exclusivity, `cacheTtlMs`
  - 405 Method Not Allowed on non-GET/HEAD requests
  - `extraFields` for overriding upstream metadata — `registration_endpoint` is
    always preserved regardless of `extraFields` content

## [0.17.0] - 2026-04-11

This release bundles the four deferred items from the 0.16.0 type-design review
(issues [#11](https://github.com/Casys-AI/mcp-server/issues/11),
[#12](https://github.com/Casys-AI/mcp-server/issues/12),
[#13](https://github.com/Casys-AI/mcp-server/issues/13),
[#14](https://github.com/Casys-AI/mcp-server/issues/14)) into one breaking minor
bump. Three of four are BREAKING; one is additive. All four live in `src/auth/`,
so a single migration pass covers the whole auth module. Preset users (the 90%
case) need **zero changes**; only direct `new JwtAuthProvider(...)` callers,
custom `AuthProvider` subclasses, and app-code constructing `AuthConfig` /
`AuthOptions` literals need updates.

### BREAKING

**(1) [#12](https://github.com/Casys-AI/mcp-server/issues/12) —
`JwtAuthProviderOptions` now requires a `kind: "url" | "opaque"` discriminant
tag.**

The 0.16.0 DU lacked a discriminant, which made:

- TypeScript narrowing unsound (finding C1 from the 0.16.0 review). After
  `if (options.resourceMetadataUrl !== undefined)`, TS could not narrow
  `options.resource` from `HttpsUrl | string` to `HttpsUrl` because the union
  collapsed to `string`. The constructor comment documented this honestly as
  "defense-in-depth via re-validation" but the type system wasn't doing the work
  it claimed.
- Branches not strictly disjoint (finding C2). A caller annotating their
  constant as `JwtAuthProviderOptionsOpaqueResource` with an `HttpsUrl`-branded
  `resource` type-checked anyway because `HttpsUrl
  extends string`.
  Semantically misleading, no runtime bug.

0.17.0 adds an explicit `kind` tag to both branches:

```typescript
// Before (0.16.x)
new JwtAuthProvider({
  issuer: "https://idp.example.com",
  audience: "https://api.example.com",
  resource: httpsUrl("https://api.example.com"),
  authorizationServers: [httpsUrl("https://idp.example.com")],
});

// After (0.17.0)
new JwtAuthProvider({
  kind: "url", // ← NEW: required
  issuer: "https://idp.example.com",
  audience: "https://api.example.com",
  resource: httpsUrl("https://api.example.com"),
  authorizationServers: [httpsUrl("https://idp.example.com")],
});
```

The constructor now narrows soundly on `options.kind === "opaque"`: after the
check, TS knows `resource` is `string` with required `resourceMetadataUrl`; in
the else branch, TS knows `resource` is `HttpsUrl`. No more honest-but-unsound
comments.

**(2) [#11](https://github.com/Casys-AI/mcp-server/issues/11) — `AuthConfig` is
now a discriminated union on `provider` tag.**

The flat 0.16.x interface used optional `domain?` / `issuer?` fields guarded by
runtime checks in `loadAuthConfig()`. A TS caller could construct an invalid
`AuthConfig` literal (e.g., `provider: "auth0"` without `domain`) and the
compiler wouldn't complain — the failure only surfaced at boot.

0.17.0 lifts the invariant to the type level via 4 exported variants:

```typescript
export interface GitHubAuthConfig extends AuthConfigBase {
  provider: "github";
}
export interface GoogleAuthConfig extends AuthConfigBase {
  provider: "google";
}
export interface Auth0AuthConfig extends AuthConfigBase {
  provider: "auth0";
  domain: string; // required
}
export interface OIDCAuthConfig extends AuthConfigBase {
  provider: "oidc";
  issuer: string; // required
  jwksUri?: string;
}
export type AuthConfig =
  | GitHubAuthConfig
  | GoogleAuthConfig
  | Auth0AuthConfig
  | OIDCAuthConfig;
```

`createAuthProviderFromConfig()` no longer needs non-null assertions
(`config.domain!`) — TypeScript narrowing on `config.provider` types the
required fields correctly in each branch.

`loadAuthConfig()` still runtime-validates YAML/env input (untyped at the
file-system boundary) and throws with the same error messages as 0.16.x — the
failure mode is unchanged for config-file users. The DU benefits TS callers who
construct `AuthConfig` literals directly in application code (typically test
fixtures or programmatic wiring).

Migration: literals that already pass `domain` / `issuer` where needed satisfy
the DU unchanged. The break bites only when the literal was missing a required
field and relying on runtime validation (a latent bug).

**(3) [#13](https://github.com/Casys-AI/mcp-server/issues/13) — `AuthOptions`
slimmed; dead `resource` / `authorizationServers` / `scopesSupported` fields
removed.**

The pre-0.17 `AuthOptions` exposed `authorizationServers: string[]`,
`resource: string`, and `scopesSupported?: string[]` alongside
`provider: AuthProvider`. **Only `provider` was ever read by `McpApp` at
runtime** (at `mcp-app.ts:1061`, where
`this.authProvider =
this.options.auth.provider`). The three other fields were
vestigial from a pre-0.15 design where `McpApp` could auto-construct a
`JwtAuthProvider` from its own `auth:` option — that auto-construction path was
removed when `createAuthProviderFromConfig` took over YAML/env provider
construction, but the dead fields stayed in the interface.

```typescript
// Before (0.16.x) — the 3 extra fields were SILENTLY IGNORED
new McpApp({
  name: "my-server",
  version: "1.0.0",
  auth: {
    provider: myProvider,
    authorizationServers: ["https://idp.example.com"], // silently ignored
    resource: "https://my-mcp.example.com", // silently ignored
  },
});

// After (0.17.0)
new McpApp({
  name: "my-server",
  version: "1.0.0",
  auth: {
    provider: myProvider,
  },
});
```

Callers who passed the vestigial fields now get a TS error
(`Object literal may only specify known properties`). The fix is to remove them
— they had no effect before, they have no effect now, the type system is just
honest about it.

### Added

**(4) [#14](https://github.com/Casys-AI/mcp-server/issues/14) —
`buildJwtAuthProvider` exported as public API** _(non-breaking addition)_.

The bridge helper previously named `buildJwtProvider` (private in `presets.ts`)
is now exported from `mod.ts` as `buildJwtAuthProvider`, alongside its
`BuildJwtAuthProviderOptions` interface. 3rd-party OIDC provider implementations
(Keycloak, Zitadel custom, Okta, …) can now build factory functions that
delegate URL-vs-opaque detection, `HttpsUrl` validation, and `kind`-tag
selection to the shared bridge instead of reimplementing it:

```typescript
import { buildJwtAuthProvider, type JwtAuthProvider } from "@casys/mcp-server";

export function createKeycloakAuthProvider(
  options: KeycloakPresetOptions,
): JwtAuthProvider {
  const issuer = `https://${options.keycloakHost}/realms/${options.realm}`;
  return buildJwtAuthProvider(
    {
      issuer,
      audience: options.audience,
      authorizationServers: [issuer],
      jwksUri: `${issuer}/protocol/openid-connect/certs`,
      resource: options.resource,
      resourceMetadataUrl: options.resourceMetadataUrl,
    },
    "createKeycloakAuthProvider",
  );
}
```

The `label` second argument is optional (defaults to `"buildJwtAuthProvider"`)
and threads through to error messages for preset-level diagnostics.

### Changed

- **`JwtAuthProvider` constructor narrows on the `kind` tag.** The 0.16.0
  comment documenting the narrowing's unsoundness is replaced with an honest
  comment explaining the now-sound behavior. The RFC 9728 § 3.1 derivation logic
  is unchanged.

- **`loadAuthConfig()` constructs DU variants explicitly.** Instead of building
  a flat object with `domain?` / `issuer?` fields, it switches on the provider
  and returns the correctly-shaped variant. Runtime checks for `domain` /
  `issuer` stay — the YAML/env boundary is untyped.

- **`createAuthProviderFromConfig()` drops non-null assertions.** The DU
  narrowing on `config.provider` makes `config.domain` / `config.issuer` typed
  as required in their respective branches.

- **Preset bridge sets the `kind` tag explicitly.** `buildJwtAuthProvider` (née
  `buildJwtProvider`) passes `kind: "url"` or `kind: "opaque"` to the
  `JwtAuthProvider` constructor based on the detected case. Preset callers never
  see the tag — it's encapsulated in the bridge.

### Removed

- **`AuthOptions.resource`, `AuthOptions.authorizationServers`,
  `AuthOptions.scopesSupported`.** Vestigial from pre-0.15 auto-construction
  path — never read by `McpApp`. See BREAKING (3) above for migration.

- **Non-null assertions in `createAuthProviderFromConfig`.** Were
  `config.domain!` / `config.issuer!`, now typed as required by the DU.

## [0.16.1] - 2026-04-11

### Added

- **`McpApp.name` public readonly field.** The server name (identifier reported
  to MCP clients in `InitializeResult.serverInfo.name`) is now exposed as
  `app.name` on every `McpApp` instance. Previously it was only stored in
  `this.options.name` (private), forcing consumers to either reach into the
  private field, keep a separate reference, or re-construct the value from their
  own config. The compose integration test stubs
  (`packages/compose/stubs/shared.ts`) had been doing `server.name` in a log
  prefix since inception — a latent type error that was never caught because
  `deno task check` on `packages/compose` only type-checked `mod.ts`, not the
  stubs. 0.16.1 fixes the underlying type gap by making the field a first-class
  part of the public API.

  This completes the `ConcurrentMCPServer` → `McpApp` hard rename started in
  `b155f7c` (source class) and `def49b2` (tests + stubs) — the final piece was
  exposing what the old consumers implicitly expected.

### Changed

- **`packages/compose` `check` task now type-checks the stubs.** Previously
  `"check": "deno check mod.ts"` covered only the public API surface. The new
  task also type-checks `stubs/stub-*/server.ts` and `stubs/shared.ts` so drift
  like the pre-0.16.1 `server.name` silent bug is caught in CI before shipping.

## [0.16.0] - 2026-04-11

### Fixed

- **RFC 9728 § 3.1 compliance: metadata URL derivation for non-root paths.**
  When a caller's `resource` had a path or query component (e.g.,
  `"https://api.example.com/v1/mcp"`), the naive 0.15.x derivation appended
  `/.well-known/oauth-protected-resource` AFTER the full path, producing
  `"https://api.example.com/v1/mcp/.well-known/oauth-protected-resource"` — a
  404 for any client following RFC 9728 discovery. The correct output inserts
  the well-known suffix BETWEEN the host and the path:
  `"https://api.example.com/.well-known/oauth-protected-resource/v1/mcp"`. The
  bug survived 0.15.x because all existing tests exercised root-path resources
  (where both approaches produce identical output); it was caught during the
  0.16.0 code review. Query strings and deeply nested paths are now covered by 5
  new regression tests in `auth_test.ts`. Fragments are dropped per RFC 3986 §
  3.5.

### Added

- **`HttpsUrl` branded type.** New nominal type in `src/auth/types.ts`
  representing a string validated as an absolute HTTP(S) URL. Constructed
  exclusively via the new `httpsUrl(raw)` factory, which:
  1. Trims leading/trailing whitespace
  2. Parses via `new URL()` (lowercases the scheme — accepts `HTTPS://...`)
  3. Rejects non-HTTP(S) schemes (`javascript:`, `ftp:`, relative paths, …)
  4. Throws on empty / whitespace-only input
  5. Returns the normalized URL string with the brand applied

  Also exports `tryHttpsUrl(raw): HttpsUrl | null` — the non-throwing variant
  used by the preset bridge layer to distinguish URL resources from opaque URIs
  without exception handling.

- **`JwtAuthProviderOptions` discriminated union.** Replaces the flat interface
  with two branches enforcing metadata-URL presence at compile time:
  - `JwtAuthProviderOptionsUrlResource`: `resource: HttpsUrl`,
    `resourceMetadataUrl?: HttpsUrl` (optional, auto-derived).
  - `JwtAuthProviderOptionsOpaqueResource`: `resource: string` (opaque),
    `resourceMetadataUrl: HttpsUrl` (REQUIRED).

  TypeScript narrows based on which branch accepts the call-site fields. A
  caller that passes a raw string for `resource` without `resourceMetadataUrl`
  gets a compile error telling them to either wrap via `httpsUrl()` or supply
  the metadata URL explicitly.

- **`OIDCPresetOptions` type.** Preset-style interface for
  `createOIDCAuthProvider` that accepts raw `string` fields (like the other
  three presets). The bridge helper inside `presets.ts` wraps them through
  `httpsUrl()` before reaching the `JwtAuthProvider` constructor.

- **`httpsUrl()` / `tryHttpsUrl()` test coverage.** 14 new unit tests in
  `src/auth/auth_test.ts` covering the factory's validation matrix (valid HTTPS,
  valid HTTP, uppercase scheme normalization, whitespace trimming, empty /
  whitespace-only rejection, non-URL rejection, relative-path rejection,
  `javascript:` / `ftp:` scheme rejection, error message formatting,
  `tryHttpsUrl` success / opaque / empty handling).

### Changed

- **`ProtectedResourceMetadata.resource_metadata_url`** now typed as `HttpsUrl`
  (was `string`). The invariant is structurally enforced — producers construct
  the value via `httpsUrl()` instead of relying on a runtime validator in
  `JwtAuthProvider`'s constructor.

- **`ProtectedResourceMetadata.authorization_servers`** now typed as
  `HttpsUrl[]` (was `string[]`). Downstream consumers can rely on each entry
  being parseable without re-validation.

- **`AuthProvider` subclasses** must now return `HttpsUrl`-branded values from
  `getResourceMetadata()`. Construct via `httpsUrl()` or import the brand type
  from `@casys/mcp-server`.

- **`JwtAuthProvider` constructor simplified.** All URL validation has been
  lifted to the `httpsUrl()` factory call sites. The constructor no longer
  performs runtime URL parsing, whitespace trimming, or scheme checking — the
  type system guarantees that any field requiring those properties is already
  validated. The 0.15.1 `validateAbsoluteHttpUrl` helper has been removed (dead
  code).

- **Preset factories bridge raw strings → branded DU.** Each preset
  (`createGitHubAuthProvider`, `createGoogleAuthProvider`,
  `createAuth0AuthProvider`, `createOIDCAuthProvider`) centralizes
  raw-to-branded translation through a private `buildJwtProvider` helper that
  handles the URL-vs-opaque resource detection, auth server validation, and
  empty-metadata-URL fall-through in one place.

- **`authorization_servers` values are now normalized.** `httpsUrl()` delegates
  parsing to `new URL().toString()`, which appends a trailing slash to host-only
  URLs (`"https://foo.com"` → `"https://foo.com/"`). Tests comparing these
  values as raw strings must adjust their expectations.

### Removed

- **`JwtAuthProvider`'s private `validateAbsoluteHttpUrl` helper.** The logic
  has been moved to the public `httpsUrl()` factory in `types.ts`, where it
  belongs on the brand constructor instead of a runtime guard.

- **0.15.1 runtime validation tests for constructor-level URL checks.** These
  tests (empty-string `resourceMetadataUrl`, whitespace-only, invalid URL,
  non-HTTP(S) scheme, trailing whitespace in `resource`, uppercase scheme) have
  been re-homed:
  - Factory-level validation → `httpsUrl()` tests in `auth_test.ts`
  - Fall-through behavior (YAML empty key) → preset bridge tests in
    `auth_test.ts`

### BREAKING

This is a **minor version bump with breaking changes** — semver-permitted before
1.0, but migration is required.

1. **Direct `new JwtAuthProvider(...)` callers must wrap URL fields.** Every
   `resource`, `authorizationServers[i]`, and `resourceMetadataUrl` that was a
   raw string in 0.15.x must now be wrapped in `httpsUrl()`:

   ```typescript
   // Before (0.15.x)
   new JwtAuthProvider({
     issuer: "https://idp.example.com",
     audience: "https://api.example.com",
     resource: "https://api.example.com",
     authorizationServers: ["https://idp.example.com"],
   });

   // After (0.16.0)
   import { httpsUrl, JwtAuthProvider } from "@casys/mcp-server";
   new JwtAuthProvider({
     issuer: "https://idp.example.com",
     audience: "https://api.example.com",
     resource: httpsUrl("https://api.example.com"),
     authorizationServers: [httpsUrl("https://idp.example.com")],
   });
   ```

2. **`createOIDCAuthProvider` signature changed.** Previously accepted
   `JwtAuthProviderOptions` directly; now accepts the new `OIDCPresetOptions`
   with raw `string` fields. Migration: drop any `httpsUrl()` wrappers — the
   preset handles it internally.

   ```typescript
   // Before (0.15.x) — JwtAuthProviderOptions direct
   createOIDCAuthProvider({
     issuer: "https://idp.example.com",
     audience: "https://api.example.com",
     resource: "https://api.example.com",
     authorizationServers: ["https://idp.example.com"],
   });

   // After (0.16.0) — same call-site, still works with raw strings
   createOIDCAuthProvider({
     issuer: "https://idp.example.com",
     audience: "https://api.example.com",
     resource: "https://api.example.com",
     // authorizationServers optional, defaults to [issuer]
   });
   ```

3. **Custom `AuthProvider` subclasses must return `HttpsUrl`-branded values**
   from `getResourceMetadata()`. Previously `string` / `string[]`:

   ```typescript
   // Before (0.15.x)
   getResourceMetadata(): ProtectedResourceMetadata {
     return {
       resource: "https://foo.com",
       resource_metadata_url: "https://foo.com/.well-known/oauth-protected-resource",
       authorization_servers: ["https://idp.example.com"],
       bearer_methods_supported: ["header"],
     };
   }

   // After (0.16.0)
   getResourceMetadata(): ProtectedResourceMetadata {
     return {
       resource: "https://foo.com",  // stays string — RFC 9728 § 2 allows opaque
       resource_metadata_url: httpsUrl(
         "https://foo.com/.well-known/oauth-protected-resource",
       ),
       authorization_servers: [httpsUrl("https://idp.example.com")],
       bearer_methods_supported: ["header"],
     };
   }
   ```

4. **`ProtectedResourceMetadata.authorization_servers` values now include
   trailing slashes** for host-only URLs due to `new URL().toString()`
   normalization. Downstream code comparing these values as raw strings must
   adjust: `"https://foo.com"` becomes `"https://foo.com/"`. The JSON payload
   served at `/.well-known/oauth-protected-resource` contains the normalized
   form — OIDC clients that trim trailing slashes are unaffected, but strict
   string matchers should update.

### Migration path

Most callers go through `createAuthProviderFromConfig()` or one of the presets
(`createGitHubAuthProvider`, `createGoogleAuthProvider`,
`createAuth0AuthProvider`, `createOIDCAuthProvider`) and will not need any
changes — the preset bridge layer accepts raw strings and wraps them internally.
Only direct `new JwtAuthProvider(...)` callers and custom `AuthProvider`
subclasses need the updates above.

### Why

0.14.x had a class of bugs where `WWW-Authenticate` headers could be produced
with `"://host/.well-known/..."` when the caller mis-set `resource`. 0.15.0
closed it with a required `resource_metadata_url` field on the metadata type.
0.15.1 added runtime validation in the `JwtAuthProvider` constructor. 0.16.0
lifts the invariant to the type layer: raw strings for URL fields are now a
compile error, and the runtime validator is removed as dead code. The bug is
closed three times: structurally (type), behaviorally (runtime at factory), and
by the 14 new `httpsUrl()` unit tests covering every validation path.

## [0.15.1] - 2026-04-11

### Fixed

- **`JwtAuthProvider` constructor now runtime-validates `resourceMetadataUrl`**
  — both the explicit-value branch and the auto-derive-from-`resource` branch
  call `new URL()` on the resulting string and reject non-HTTP(S) schemes with a
  clear error message. Previously the constructor stored the value verbatim and
  trusted the type system; a caller passing `"not a url"`, a relative path, a
  `javascript:` scheme, or a value with trailing whitespace would silently
  produce a broken `WWW-Authenticate` header at runtime — the exact class of bug
  that 0.15.0 was meant to eliminate, just transferred to the constructor layer.
  0.15.1 closes that hole with a `validateAbsoluteHttpUrl` helper.

- **Empty-string and whitespace-only `resourceMetadataUrl` are now treated as
  absent.** Previously `if (options.resourceMetadataUrl)` accepted `""` as falsy
  and silently fell through to derivation. Now the code trims the value and
  checks for non-empty explicitly — a YAML key with no value or an env var
  expanded to empty gets the same behavior as omitting the key entirely (instead
  of producing `"://host"`).

- **Trailing whitespace in `resource` is now trimmed before derivation.**
  Previously `"https://foo.com   "` produced
  `"https://foo.com   /.well-known/oauth-protected-resource"` — unparseable.
  0.15.1 trims before the path append AND runs the result through
  `validateAbsoluteHttpUrl` as a belt-and-suspenders check.

- **`resource` URL detection is now case-insensitive.** `"HTTPS://foo.com"` is a
  valid URL per RFC 3986 (scheme comparison is case-insensitive) and 0.15.1
  accepts it, normalizing to lowercase via `new URL().toString()`. Previously
  the `/^https?:\/\//` regex was case-sensitive and would have thrown on
  uppercase schemes as if they were opaque URIs.

- **`clearAuthEnv()` test helper now clears `MCP_AUTH_RESOURCE_METADATA_URL`.**
  The helper was written for 0.14.0 and the 0.15.0 commit added a read of the
  new env var in `config.ts:loadEnvAuth` but forgot to mirror that in the
  cleanup. A test that sets the env var leaked its value to subsequent tests in
  the same process — intermittent green/red flips waiting to happen. Fix:
  one-line addition to the helper.

### Changed

- **Error message on invalid `resource` now `JSON.stringify`s the value.**
  Previously the error template embedded `${options.resource}` raw; a value
  containing quotes, newlines, or other specials could break error log parsing.
  Now the value is unambiguously inspectable even when weird.

### Migration

No migration needed. Backward compatible with 0.15.0 — all existing valid
configurations keep working. The changes only make previously-silent-wrong
configurations fail loudly at construction. If your tests set
`MCP_AUTH_RESOURCE_METADATA_URL` you may want to mirror the `clearAuthEnv()`
update in your own test helpers.

## [0.15.0] - 2026-04-11

### BREAKING

- **`ProtectedResourceMetadata.resource_metadata_url` is now required**
  (previously the field did not exist and the middleware derived the metadata
  URL from `resource`, which produced a broken URL when `resource` was not
  itself an HTTP(S) URL — e.g., when using an opaque OIDC project ID as JWT
  audience per RFC 9728 § 2).

### Fixed

- **`WWW-Authenticate` header now always contains a valid absolute HTTP(S) URL**
  in the `resource_metadata="..."` parameter. Previously, if a custom
  `AuthProvider` returned a non-URL `resource` (for example, an opaque OAuth2
  resource URI or an OIDC project ID used as audience — both valid per RFC 9728
  § 2), the middleware would compute
  `${resource}/.well-known/oauth-protected-resource` and produce something like
  `"367545125829670172/.well-known/oauth-protected-resource"` — not a valid URL,
  causing RFC 9728 § 5 compliant clients (Claude.ai / ChatGPT) to fail OAuth
  discovery.

  The fix makes `resource_metadata_url` a first-class required field on
  `ProtectedResourceMetadata`, always set by the provider, and used directly by
  the middleware. Derivation from `resource` is no longer attempted.

### Changed

- `JwtAuthProviderOptions` accepts a new optional
  `resourceMetadataUrl?: string`.
  - When the option is set, it is used as-is.
  - When omitted AND `resource` is an HTTP(S) URL, the factory auto-derives
    `${resource}/.well-known/oauth-protected-resource` and stores it (existing
    URL-resource callers get a no-op migration — no code change needed on their
    side).
  - When omitted AND `resource` is not an HTTP(S) URL, `JwtAuthProvider` throws
    at construction with a clear error message pointing to RFC 9728 and
    suggesting the fix.

### Migration

- **If your `resource` is an HTTP(S) URL**: no change needed. The factory
  auto-derives the metadata URL and stores it. `getResourceMetadata()` now
  returns a `resource_metadata_url` field, but you don't need to provide one.
- **If your `resource` is an opaque URI** (e.g., OIDC project ID): add
  `resourceMetadataUrl` to the `createOIDCAuthProvider` / `JwtAuthProvider`
  options, pointing to the HTTPS URL where your
  `/.well-known/oauth-protected-resource` endpoint is served publicly.
- **If you have a custom `AuthProvider` subclass**: the
  `ProtectedResourceMetadata` returned by `getResourceMetadata()` must include
  `resource_metadata_url`. TypeScript will catch missing values at compile time.
- **If you configure `@casys/mcp-server` via YAML or environment variables AND
  your `resource` is an opaque URI** (not an HTTP(S) URL): set
  `auth.resourceMetadataUrl` in YAML or the env var
  `MCP_AUTH_RESOURCE_METADATA_URL` to the public HTTPS URL of your
  `/.well-known/oauth-protected-resource` endpoint. Previously this case would
  fail at startup with a `JwtAuthProvider` error and no recovery path — the
  config layer silently dropped any override attempt because the field was not
  plumbed through `AuthConfig` / `loadYamlAuth` / `loadEnvAuth` /
  `createAuthProviderFromConfig`. Now wired end-to-end.

## [0.14.0] - 2026-04-08

### Added

- **MCP Apps capability negotiation** — new helpers and constants to read the
  MCP Apps extension capability advertised by clients (per the
  `@modelcontextprotocol/ext-apps` spec dated 2026-01-26 and the SDK 1.29
  `extensions` field on `ClientCapabilities`).
  - `MCP_APPS_EXTENSION_ID = "io.modelcontextprotocol/ui"` — well-known
    extension key.
  - `MCP_APPS_PROTOCOL_VERSION = "2026-01-26"` — dated spec this package
    targets. Bump in lockstep when adopting newer dated specs.
  - `getMcpAppsCapability(clientCapabilities)` — best-effort, defensive reader.
    Returns `McpAppsClientCapability | undefined`. Tolerates `null`/`undefined`
    input, missing `extensions` field, malformed extension values, and silently
    filters non-string `mimeTypes` entries.
  - `McpApp.getClientMcpAppsCapability()` — instance method that wires the above
    against the connected client. Use it from a tool handler to decide between
    returning a `_meta.ui` resource or a text-only fallback.
  - `McpAppsClientCapability` interface (currently `{ mimeTypes?: string[] }`,
    extensible to match future spec additions).
  - 13 boundary tests in `mcp-apps-capability_test.ts` cover happy paths,
    null/undefined inputs, missing extensions, non-object extension values,
    malformed `mimeTypes`, and determinism.

### Changed

- **Bumped `@modelcontextprotocol/sdk` from `^1.27.0` → `^1.29.0`** in both
  `packages/server` and `packages/compose`. SDK 1.28 brought
  `scopes_supported`-from-resource-metadata default behavior and
  `client_secret_basic` defaulting — both verified harmless against our
  `JwtAuthProvider` (we already emit `scopes_supported` server-side) and
  `client-auth/provider.ts` (we already override `token_endpoint_auth_method` to
  `"none"` for our public PKCE client). SDK 1.29 brings the
  `extensions`-on-`ClientCapabilities` feature that powers MCP Apps capability
  negotiation, plus an npm audit fix and several minor schema fixes (`size` on
  `ResourceSchema`, missing types exports, Windows stdio hide, infinite-TTL
  guard).

### Fixed

- **`scripts/build-node.sh` SDK version drift** — the generated
  `dist-node/package.json` for npm consumers hardcoded
  `@modelcontextprotocol/sdk: ^1.15.1`, far behind the `^1.29.0` used at build
  time. The script now reads the version from `deno.json` (single source of
  truth) and fails fast with a clear error if parsing fails. This was a latent
  bug since the package's first npm release — npm consumers may have been
  resolving an SDK floor too old to support features the code uses.

## [0.13.0] - 2026-04-08

### Added

- **`createMultiTenantMiddleware()`** — tenant resolution middleware sitting
  after the auth middleware. Delegates tenant identification to a user-provided
  `TenantResolver`, injects the resolved `tenantId` into `ctx.authInfo`, and
  rejects mismatches with a generic `invalid_token` error. Passthrough on STDIO;
  fails fast with a config error if `ctx.authInfo` is missing on HTTP. Existing
  single-tenant servers require no changes.
- **`AuthInfo.tenantId`** — new optional field populated by the multi-tenant
  middleware. Tool handlers should read this instead of raw JWT claims.
  `authInfo` is re-frozen after injection.
- **`MultiTenantMiddlewareOptions.onRejection`** — async audit hook awaited
  before the 401 is thrown. Rejection reasons are server-side only; the client
  always sees a generic `invalid_token` error. Hook exceptions are caught and
  logged to stderr — they can never change client-visible behaviour or become an
  oracle for attackers.
- **Empty-`tenantId` guard** — `{ ok: true, tenantId: "" }` is rejected as if it
  were a resolver failure, preventing truthy-guard bypasses in downstream
  handlers.
- **`McpApp.getFetchHandler()`** — returns a Web Standard fetch handler without
  binding a port. Use this to mount the MCP HTTP layer inside another framework
  (Fresh, Hono, Express, Cloudflare Workers, etc.) without giving up port
  ownership to `startHttp`. Auth, multi-tenant middleware, scope checks, rate
  limiting, sessions, and SSE all run identically. Designed for the multi-tenant
  SaaS pattern of caching one server-per-tenant and dispatching from the host
  framework's routing layer.
- **`HttpServerOptions.embedded` + `embeddedHandlerCallback`** — internal
  mechanism powering `getFetchHandler`. Most consumers should use
  `getFetchHandler` directly rather than setting these.
- **`FetchHandler` type re-exported from `./types.ts`** — was already exported
  from the runtime port at top-level, now also re-exported alongside
  `HttpServerOptions` for ergonomic single-import use.
- **New types** — `TenantResolver`, `TenantResolution`,
  `MultiTenantMiddlewareOptions` exported from `mod.ts`.

### Changed

- **`ConcurrentMCPServer` → `McpApp`** — **non-breaking**. The framework's main
  class has been renamed and its source file moved from
  `src/concurrent-server.ts` to `src/mcp-app.ts` (git-tracked rename, history
  preserved). `McpApp` is now the canonical name everywhere — class body, error
  messages, JSDoc, internal modules, tests, README, and the compose stubs. The
  options type follows: `ConcurrentServerOptions → McpAppOptions`. Existing code
  keeps working unchanged thanks to the deprecated re-exports in `mod.ts` (see
  Deprecated below) —
  `import { ConcurrentMCPServer } from
  "@casys/mcp-server"` still resolves to
  the same constructor at runtime, `ConcurrentMCPServer === McpApp` is true, and
  `instanceof` checks pass in both directions. Migration is a one-line import
  swap when consumers are ready. Rationale: "Concurrent" described a trivial
  implementation detail (any HTTP server is concurrent), while `McpApp` captures
  the actual value of the lib — a middleware-first framework on top of the MCP
  SDK, mirroring the Hono idiom (`new Hono()` → `new McpApp()`). `McpServer` was
  off the table because it would collide with the SDK's own `McpServer` class
  which we wrap.

### Deprecated

- **`ConcurrentMCPServer`** — kept as a re-export of `McpApp` for backwards
  compatibility (`export { McpApp as ConcurrentMCPServer }`). Both names point
  to the exact same class at runtime, so `instanceof` checks pass in both
  directions and migration is a one-line import swap. The deprecated alias will
  be removed in **v1.0**.
- **`ConcurrentServerOptions`** — same treatment as a re-export of
  `McpAppOptions`. Will be removed in v1.0.

### Fixed

- **`setRequestHandler` callbacks now have explicit type annotations** — the
  `tools/call` and `resources/read` handlers in `McpApp` (formerly
  `ConcurrentMCPServer`) relied on TypeScript inference for their `request`
  parameter. The MCP SDK exports the Zod-inferred types (`CallToolRequest`,
  `ReadResourceRequest`) from `@modelcontextprotocol/sdk/types.js` but the
  callback sites used neither imports nor annotations. Consumers who pulled the
  package via a local-path workspace and built with strict `noImplicitAny` were
  tripping on the inference gap. Both callbacks now import and annotate the
  request types explicitly, surfacing full type info at the call site and
  catching SDK shape drift early. Runtime behaviour unchanged.

## [0.12.0] - 2026-03-22

### Added

- **`structuredContent` support** — tool handlers can return
  `{ content: "summary", structuredContent: { ...data } }` to separate LLM
  context (text summary) from viewer payload (structured data). Reduces LLM
  token usage for data-heavy tools.
- **`outputSchema` on tools** — optional JSON Schema for tool output, passed
  through in `tools/list`. Enables host-side validation of tool results.
- **`annotations` on tools** — behavioural hints (`title`, `readOnlyHint`,
  `destructiveHint`, `idempotentHint`, `openWorldHint`) passed through in
  `tools/list`.
- **Tool visibility filtering** — tools with `_meta.ui.visibility: ["app"]` are
  excluded from `tools/list` (hidden from LLM) but remain callable via
  `tools/call`. Cleans up LLM tool list from UI-only actions (refresh,
  pagination, etc.).
- **`registerAppOnlyTool()` helper** — shortcut to register app-only tools with
  `visibility: ["app"]` auto-injected.
- **`toolErrorMapper` option** — centralized error-to-`isError` mapping.
  Business errors produce `{ isError: true }` results; system errors rethrow as
  JSON-RPC errors. Configurable via `ConcurrentServerOptions.toolErrorMapper`.
- **New types** — `ToolAnnotations`, `StructuredToolResult`, `ToolErrorMapper`
  exported from `mod.ts`.

### Changed

- **`tools/list` refactored** — both STDIO and HTTP paths now use shared
  `buildToolListing()` method (deduplication).
- **`tools/call` refactored** — both STDIO and HTTP paths now use shared
  `buildToolCallResult()` and `handleToolError()` methods. Serialization errors
  are no longer routed through `toolErrorMapper`.

## [0.11.0] - 2026-03-20

### Added

- **`registerViewers()` CSP option** — `csp` field on `RegisterViewersConfig`
  declares external domains the viewer needs (tiles, APIs, CDNs). Injects
  `_meta.ui.csp` into resource content.
- **Re-export compose SDK helpers** — `composeEvents`, `uiMeta`, and related
  types re-exported from `mod.ts` via `@casys/mcp-compose`.

### Changed

- **Bump `@casys/mcp-compose` ^0.2.0 → ^0.3.0**.

## [0.10.0] - 2026-03-20

### Changed

- **Bump MCP SDK ^1.15 → ^1.27** — unlocks `structuredContent`, `outputSchema`,
  `annotations`, `isError` at the protocol level.
- **Bump `@casys/mcp-compose` → ^0.2.0** — adds sub-path exports (`/sdk`,
  `/core`).
- **`McpUiToolMeta` imported from mcp-compose** — replaced inlined base type
  with `import type { McpUiToolMeta } from "@casys/mcp-compose/core"`. No API
  change.

## [0.9.2] - 2026-03-17

### Added

- **MCP Inspector launcher** — `launchInspector()` starts an interactive MCP
  Inspector session for debugging. Exported from `mod.ts` with
  `InspectorOptions` type.

## [0.9.1] - 2026-03-17

### Changed

- **Import `McpUiToolMetaBase` from `@casys/mcp-compose/core`** — replaced
  inlined visibility/resourceUri type with proper dependency import.

## [0.9.0] - 2026-03-17

### Added

- **Client-side OAuth2 flow** — `CallbackServer` (localhost redirect capture),
  `OAuthClientProviderImpl`, `connect()` helper for MCP client auth. Token
  stores: `FileTokenStore` (persistent, 0o600 permissions) and
  `MemoryTokenStore` (ephemeral).
- **MCP Apps viewer utilities** — `resolveViewerDistPath()` and
  `discoverViewers()` for auto-discovering built UI viewers. `registerViewers()`
  method on `ConcurrentMCPServer` for bulk resource registration.
- **New exports** — `RegisterViewersConfig`, `RegisterViewersSummary`,
  `resolveViewerDistPath`, `discoverViewers` from `mod.ts`.

## [0.8.0] - 2026-02-12

### Added

- **Security: HMAC-SHA256 channel authentication for PostMessage (MCP Apps)** —
  `MessageSigner` class for signing/verifying JSON-RPC messages with `_hmac` +
  `_seq` (anti-replay). `injectChannelAuth()` injects an inline script into
  iframe HTML that signs outgoing postMessages. Host-side verification via
  `MessageSigner.verify()`.
- **Security: HTTP hardening options** — `maxBodyBytes` (default 1 MB, returns
  413 JSON-RPC error), `corsOrigins` allowlist with wildcard warning,
  `requireAuth` fail-fast at startup, `ipRateLimit` per-IP 429 + `Retry-After`
  header, `sessionId` propagation into middleware context.
- **Security: CSP injection** — `buildCspHeader()` and `injectCspMetaTag()` for
  Content-Security-Policy in MCP Apps HTML resources. Configurable via
  `resourceCsp` in `ConcurrentServerOptions`.
- **Security: CORS wildcard warning** — logs `[WARN]` when `corsOrigins` is
  `"*"` regardless of auth configuration.
- **Node.js runtime adapter** — `runtime.node.ts` implements the `RuntimePort`
  contract for Node.js 18+ with `maxBodyBytes` enforcement at both
  `Content-Length` and streaming body levels.
- **Observability: `recordAuthEvent()` wired** — auth tracing spans now fire on
  token verify, reject, and JWT cache hit (gated by `isOtelEnabled()`).
- **`HttpServerInstance` return type** — `startHttp()` now returns
  `{ shutdown(), addr }` for programmatic control.

### Changed

- **File reorganization** — moved files into domain subfolders: `src/runtime/`,
  `src/concurrency/`, `src/validation/`, `src/sampling/`. All re-exports from
  `mod.ts` are unchanged.
- **API cleanup** — removed internal types from public barrel
  (`PromiseResolver`, `QueueOptions`, `MCP_APP_URI_SCHEME`).
- **Lint cleanup** — zero `deno lint` errors, zero `deno fmt` issues, no slow
  types.

## [0.7.0] - 2026-02-07

### Added

- **Observability: OTel tracing** — every tool call emits an OpenTelemetry span
  (`mcp.tool.call {name}`) with attributes (tool name, server name, transport,
  session ID, duration, success/error). Requires `OTEL_DENO=true` +
  `--unstable-otel`.
- **Observability: Prometheus `/metrics` endpoint** — exposes counters (tool
  calls, auth, sessions, rate limiting), histogram (tool call latency), and
  gauges (active requests, queued, sessions, SSE clients, uptime) in Prometheus
  text format.
- **Observability: `ServerMetrics` class** — embeddable metrics collector with
  per-tool breakdown, `getSnapshot()`, `toPrometheusFormat()`, and `reset()`.
- **Observability: `getServerMetrics()` / `getPrometheusMetrics()`** — public
  methods on `ConcurrentMCPServer` for programmatic access.
- **Observability: auth event tracing** — `recordAuthEvent()` helper for
  fire-and-forget auth spans.
- **Security: per-IP rate limiting on `initialize`** — 10 requests/min per IP to
  prevent session exhaustion attacks (DoS).
- **Reliability: session cleanup grace period** — 60s grace period added to
  session TTL so in-flight requests are not killed mid-execution.
- **Reliability: `RateLimiter.purgeExpiredKeys()`** — periodic cleanup of stale
  keys to prevent unbounded memory growth. Auto-triggers every 1000 operations.

### Fixed

- **Critical: RateLimiter memory leak** — keys with no active requests were
  never removed from the internal Map, causing unbounded growth in long-running
  servers with per-IP rate limiting.
- **Critical: SSE zombie clients** — failed `controller.enqueue()` calls were
  silently caught without removing the dead client from the Map, causing memory
  leaks and wasted CPU on every `sendToSession()`.
- **High: JWT token cache** — added SHA-256 token cache (max 1000 entries, TTL =
  min(token expiry, 5min)) to avoid redundant JWKS network round-trips on every
  tool call.

## [0.6.0] - 2026-02-06

### Added

- **OAuth2/Bearer authentication** — `JwtAuthProvider` with JWKS validation, 4
  presets (Google, Auth0, GitHub, OIDC).
- **YAML + env config** — `loadAuthConfig()` reads `mcp-server.yaml` +
  `MCP_AUTH_*` env vars with priority: programmatic > env > YAML.
- **Middleware pipeline** — composable onion-model pipeline: rate-limit → auth →
  custom → scope-check → validation → backpressure → handler.
- **Scope enforcement** — `requiredScopes` on tools with AND-based checking.
- **RFC 9728** — `/.well-known/oauth-protected-resource` metadata endpoint.
- **HTTP/SSE transport** — `startHttp()` with Streamable HTTP, session
  management, SSE streaming.
- **MCP Apps** — `ui://` scheme, `MCP_APP_MIME_TYPE`, `registerResource()`.

## [0.5.0] - 2026-01-28

### Added

- Initial release: `ConcurrentMCPServer`, `RequestQueue`, `RateLimiter`,
  `SchemaValidator`, `SamplingBridge`.
- STDIO transport with backpressure strategies (sleep/queue/reject).
- Schema validation with ajv.
