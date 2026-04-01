/**
 * Auth configuration loader.
 *
 * Loads auth config from YAML file with env var overrides.
 * Priority: env vars > YAML > (nothing = no auth)
 *
 * @module lib/server/auth/config
 */

import { parse as parseYaml } from "@std/yaml";
import { env, readTextFile } from "../runtime/runtime.ts";
import type { AuthProvider } from "./provider.ts";
import {
  createAuth0AuthProvider,
  createGitHubAuthProvider,
  createGoogleAuthProvider,
  createOIDCAuthProvider,
} from "./presets.ts";

/** Supported auth provider names */
export type AuthProviderName = "github" | "google" | "auth0" | "oidc";

const VALID_PROVIDERS: AuthProviderName[] = [
  "github",
  "google",
  "auth0",
  "oidc",
];

/**
 * Parsed auth configuration (after YAML + env merge).
 */
export interface AuthConfig {
  provider: AuthProviderName;
  audience: string;
  resource: string;
  /** Auth0 tenant domain */
  domain?: string;
  /** OIDC issuer */
  issuer?: string;
  /** OIDC JWKS URI (optional, derived from issuer if absent) */
  jwksUri?: string;
  /** Supported scopes */
  scopesSupported?: string[];
}

/**
 * YAML file schema (top-level has `auth` key).
 */
interface ConfigFile {
  auth?: {
    provider?: string;
    audience?: string;
    resource?: string;
    domain?: string;
    issuer?: string;
    jwksUri?: string;
    scopesSupported?: string[];
  };
}

/**
 * Load auth configuration from YAML file + env var overrides.
 *
 * 1. Reads YAML file (if it exists)
 * 2. Overlays env vars (MCP_AUTH_* take precedence)
 * 3. Validates the merged config
 * 4. Returns null if no auth is configured
 *
 * Env var mapping:
 * - MCP_AUTH_PROVIDER → auth.provider
 * - MCP_AUTH_AUDIENCE → auth.audience
 * - MCP_AUTH_RESOURCE → auth.resource
 * - MCP_AUTH_DOMAIN → auth.domain
 * - MCP_AUTH_ISSUER → auth.issuer
 * - MCP_AUTH_JWKS_URI → auth.jwksUri
 * - MCP_AUTH_SCOPES → auth.scopesSupported (space-separated)
 *
 * @param configPath - Path to YAML config file. Defaults to "mcp-server.yaml" in cwd.
 * @returns AuthConfig or null if no auth configured
 * @throws Error if config is invalid (fail-fast)
 */
export async function loadAuthConfig(
  configPath?: string,
): Promise<AuthConfig | null> {
  // 1. Load YAML (optional - file may not exist)
  const yamlAuth = await loadYamlAuth(configPath ?? "mcp-server.yaml");

  // 2. Read env vars
  const envProvider = env("MCP_AUTH_PROVIDER");
  const envAudience = env("MCP_AUTH_AUDIENCE");
  const envResource = env("MCP_AUTH_RESOURCE");
  const envDomain = env("MCP_AUTH_DOMAIN");
  const envIssuer = env("MCP_AUTH_ISSUER");
  const envJwksUri = env("MCP_AUTH_JWKS_URI");
  const envScopes = env("MCP_AUTH_SCOPES");

  // 3. Merge: env overrides YAML
  const provider = envProvider ?? yamlAuth?.provider;

  // No provider configured anywhere → no auth
  if (!provider) return null;

  // Validate provider name
  if (!VALID_PROVIDERS.includes(provider as AuthProviderName)) {
    throw new Error(
      `[AuthConfig] Unknown auth provider: "${provider}". ` +
        `Valid values: ${VALID_PROVIDERS.join(", ")}`,
    );
  }

  const audience = envAudience ?? yamlAuth?.audience;
  const resource = envResource ?? yamlAuth?.resource;

  if (!audience) {
    throw new Error(
      `[AuthConfig] "audience" is required when provider="${provider}". ` +
        "Set auth.audience in YAML or MCP_AUTH_AUDIENCE env var.",
    );
  }
  if (!resource) {
    throw new Error(
      `[AuthConfig] "resource" is required when provider="${provider}". ` +
        "Set auth.resource in YAML or MCP_AUTH_RESOURCE env var.",
    );
  }

  const config: AuthConfig = {
    provider: provider as AuthProviderName,
    audience,
    resource,
    domain: envDomain ?? yamlAuth?.domain,
    issuer: envIssuer ?? yamlAuth?.issuer,
    jwksUri: envJwksUri ?? yamlAuth?.jwksUri,
    scopesSupported: envScopes
      ? envScopes.split(" ").filter(Boolean)
      : yamlAuth?.scopesSupported,
  };

  // Provider-specific validation (fail-fast)
  if (config.provider === "auth0" && !config.domain) {
    throw new Error(
      '[AuthConfig] "domain" is required for auth0 provider. ' +
        "Set auth.domain in YAML or MCP_AUTH_DOMAIN env var.",
    );
  }
  if (config.provider === "oidc" && !config.issuer) {
    throw new Error(
      '[AuthConfig] "issuer" is required for oidc provider. ' +
        "Set auth.issuer in YAML or MCP_AUTH_ISSUER env var.",
    );
  }

  return config;
}

/**
 * Create an AuthProvider from a loaded AuthConfig.
 *
 * @param config - Validated auth config
 * @returns AuthProvider instance
 */
export function createAuthProviderFromConfig(config: AuthConfig): AuthProvider {
  const base = {
    audience: config.audience,
    resource: config.resource,
    scopesSupported: config.scopesSupported,
  };

  switch (config.provider) {
    case "github":
      return createGitHubAuthProvider(base);
    case "google":
      return createGoogleAuthProvider(base);
    case "auth0":
      return createAuth0AuthProvider({ ...base, domain: config.domain! });
    case "oidc":
      return createOIDCAuthProvider({
        ...base,
        issuer: config.issuer!,
        jwksUri: config.jwksUri,
        authorizationServers: [config.issuer!],
      });
    default:
      throw new Error(`[AuthConfig] Unsupported provider: ${config.provider}`);
  }
}

/**
 * Load the auth section from a YAML config file.
 * Returns null if file doesn't exist (not an error).
 */
async function loadYamlAuth(
  path: string,
): Promise<ConfigFile["auth"] | null> {
  // readTextFile returns null if file doesn't exist
  const text = await readTextFile(path);
  if (text === null) return null;

  const parsed = parseYaml(text);

  // Validate parsed YAML is an object (not string, array, null, etc.)
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  const configFile = parsed as Record<string, unknown>;
  if (
    !configFile.auth || typeof configFile.auth !== "object" ||
    Array.isArray(configFile.auth)
  ) {
    return null;
  }

  const auth = configFile.auth as Record<string, unknown>;
  return {
    provider: typeof auth.provider === "string" ? auth.provider : undefined,
    audience: typeof auth.audience === "string" ? auth.audience : undefined,
    resource: typeof auth.resource === "string" ? auth.resource : undefined,
    domain: typeof auth.domain === "string" ? auth.domain : undefined,
    issuer: typeof auth.issuer === "string" ? auth.issuer : undefined,
    jwksUri: typeof auth.jwksUri === "string" ? auth.jwksUri : undefined,
    scopesSupported: Array.isArray(auth.scopesSupported)
      ? auth.scopesSupported.filter((s: unknown): s is string =>
        typeof s === "string"
      )
      : undefined,
  };
}
