/**
 * Resolves `ui://` resource URIs to HTTP URLs served by the resource server.
 *
 * The `ui://` scheme is defined by the MCP Apps specification:
 *   `ui://<server>/<path>?<query>`
 *
 * The resolver rewrites these to the resource server's HTTP base URL so that
 * platform WebViews can fetch the assets over plain HTTP(S).
 */

import type { ResourceUri } from "./types.ts";

const UI_SCHEME = "ui://";

/** Options for resolving a `ui://` URI to an HTTP URL. */
export interface ResolveToHttpOptions {
  /**
   * Resolution mode:
   * - `"app"` => `/app/<server>/<path>` for locally-served asset directories
   * - `"query"` => `/ui?uri=ui://...` for backend/resource proxy routes
   */
  readonly mode?: "app" | "query";
  /** Path prefix used when `mode === "app"`. Defaults to `/app`. */
  readonly appPath?: string;
  /** Path prefix used when `mode === "query"`. Defaults to `/ui`. */
  readonly uiPath?: string;
}

/**
 * Parse a raw `ui://` URI string into its components.
 *
 * @throws {Error} if the URI does not start with `ui://`.
 */
export function parseResourceUri(raw: string): ResourceUri {
  if (!raw.startsWith(UI_SCHEME)) {
    throw new Error(
      `[ResourceResolver] Invalid resource URI: expected "ui://" scheme, got "${raw}".`,
    );
  }

  const withoutScheme = raw.slice(UI_SCHEME.length);
  const queryIdx = withoutScheme.indexOf("?");

  let serverAndPath: string;
  let queryString = "";

  if (queryIdx >= 0) {
    serverAndPath = withoutScheme.slice(0, queryIdx);
    queryString = withoutScheme.slice(queryIdx + 1);
  } else {
    serverAndPath = withoutScheme;
  }

  const slashIdx = serverAndPath.indexOf("/");
  let server: string;
  let path: string;

  if (slashIdx >= 0) {
    server = serverAndPath.slice(0, slashIdx);
    path = serverAndPath.slice(slashIdx);
  } else {
    server = serverAndPath;
    path = "/";
  }

  if (server.length === 0) {
    throw new Error(
      `[ResourceResolver] Invalid resource URI: empty server in "${raw}".`,
    );
  }

  const query: Record<string, string> = {};
  if (queryString.length > 0) {
    for (const pair of queryString.split("&")) {
      const eqIdx = pair.indexOf("=");
      if (eqIdx >= 0) {
        query[decodeURIComponent(pair.slice(0, eqIdx))] = decodeURIComponent(
          pair.slice(eqIdx + 1),
        );
      } else {
        query[decodeURIComponent(pair)] = "";
      }
    }
  }

  return { raw, server, path, query };
}

/**
 * Resolve a `ui://` URI to an HTTP URL using the given base URL.
 *
 * Example:
 * ```
 * resolveToHttp("ui://my-app/index.html", "https://resource.example.com")
 * // => "https://resource.example.com/app/my-app/index.html"
 * ```
 */
export function resolveToHttp(
  uriOrString: ResourceUri | string,
  httpBaseUrl: string,
  options: ResolveToHttpOptions = {},
): string {
  const uri = typeof uriOrString === "string"
    ? parseResourceUri(uriOrString)
    : uriOrString;

  const base = httpBaseUrl.endsWith("/")
    ? httpBaseUrl.slice(0, -1)
    : httpBaseUrl;

  if (options.mode === "query") {
    const uiPath = options.uiPath ?? "/ui";
    const normalizedUiPath = uiPath.startsWith("/") ? uiPath : `/${uiPath}`;
    return `${base}${normalizedUiPath}?uri=${encodeURIComponent(uri.raw)}`;
  }

  const appPath = options.appPath ?? "/app";
  const normalizedAppPath = appPath.startsWith("/") ? appPath : `/${appPath}`;
  const pathPart = uri.path.startsWith("/") ? uri.path : `/${uri.path}`;
  const queryEntries = Object.entries(uri.query);

  let url = `${base}${normalizedAppPath}/${uri.server}${pathPart}`;
  if (queryEntries.length === 0) {
    return url;
  }

  const qs = queryEntries
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
    )
    .join("&");
  url += `?${qs}`;
  return url;
}
