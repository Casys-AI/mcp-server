/**
 * Streamable HTTP request-metadata headers (spec 2026-07-28, SEP-2243).
 *
 * The transport mirrors selected JSON-RPC body fields into HTTP headers so that
 * load balancers, gateways and observability tooling can route and meter without
 * parsing the body. Because two components then read two sources of truth, the
 * spec requires the server to **prove they agree**: any divergence is a
 * `HeaderMismatch` (`-32020`) with HTTP 400.
 *
 * Everything here is pure — no `Request`, no server state — so the encoding
 * rules can be asserted directly. `validateRequestHeaders` is the only entry
 * point the transport needs.
 *
 * @module lib/server/transport/request-headers
 */

/** `HeaderMismatch` — headers disagree with the body, or a required one is absent. */
export const MCP_HEADER_MISMATCH = -32020;

/**
 * Sentinel wrapper for values that cannot travel as plain ASCII.
 *
 * Case-sensitive and lowercase, per spec. Clients must also encode a plain-ASCII
 * value that happens to look like the sentinel, so an encoded payload is never
 * ambiguous with a literal one.
 */
const SENTINEL_PREFIX = "=?base64?";
const SENTINEL_SUFFIX = "?=";

/** Methods whose `Mcp-Name` is required, and which body field it mirrors. */
const NAME_SOURCE: Readonly<Record<string, "name" | "uri" | "taskId">> = {
  "tools/call": "name",
  "prompts/get": "name",
  "resources/read": "uri",
  // Tasks extension: the routing header carries the task id, so a gateway can
  // route or meter per task without reading the body — the same rationale as
  // for a tool name.
  "tasks/get": "taskId",
  "tasks/update": "taskId",
  "tasks/cancel": "taskId",
};

/** RFC 9110 §5.1 token: the only shape a header *name* may take. */
const HTTP_TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

/**
 * Field values are limited to visible ASCII, space and horizontal tab, and may
 * not carry leading or trailing whitespace.
 */
const HEADER_SAFE_VALUE = /^[\x21-\x7E]([\x20-\x7E\t]*[\x21-\x7E])?$/;

export interface HeaderValidationFailure {
  readonly ok: false;
  /** Human-readable reason; travels in the JSON-RPC error message. */
  readonly message: string;
}

export type HeaderValidationResult =
  | { readonly ok: true }
  | HeaderValidationFailure;

/**
 * Decode a header value, unwrapping the base64 sentinel when present.
 *
 * Returns `null` when the sentinel is malformed — a client that wrapped a value
 * badly is not the same as one that sent a plain value, and the caller must
 * reject rather than silently compare the raw bytes.
 */
export function decodeHeaderValue(raw: string): string | null {
  if (!raw.startsWith(SENTINEL_PREFIX) || !raw.endsWith(SENTINEL_SUFFIX)) {
    return raw;
  }
  const payload = raw.slice(
    SENTINEL_PREFIX.length,
    raw.length - SENTINEL_SUFFIX.length,
  );
  try {
    // atob yields Latin-1 bytes; the payload is UTF-8, so re-decode it as such.
    const bytes = Uint8Array.from(atob(payload), (ch) => ch.charCodeAt(0));
    // `ignoreBOM: true` is load-bearing despite its name: it means "do not treat
    // a leading U+FEFF specially", so the BOM stays in the output. The default
    // (false) STRIPS it — which was a validation bypass: an encoded
    // "\uFEFFfoo" decoded to "foo" and compared equal to a body value of
    // "foo", letting a client mirror a header that does not match its body.
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
      .decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Encode a value for transport, applying the sentinel only when necessary.
 *
 * Exported for clients and tests; the server never needs it to validate. Note
 * the deliberate asymmetry with {@link decodeHeaderValue}: a plain value that
 * *looks* like the sentinel must be encoded, or decoding would unwrap something
 * that was never wrapped.
 */
export function encodeHeaderValue(value: string): string {
  const looksLikeSentinel = value.startsWith(SENTINEL_PREFIX) &&
    value.endsWith(SENTINEL_SUFFIX);
  if (HEADER_SAFE_VALUE.test(value) && !looksLikeSentinel) return value;

  const utf8 = new TextEncoder().encode(value);
  let latin1 = "";
  for (const byte of utf8) latin1 += String.fromCharCode(byte);
  return `${SENTINEL_PREFIX}${btoa(latin1)}${SENTINEL_SUFFIX}`;
}

/**
 * Whether `Mcp-Name` is required for this method, and the value it must mirror.
 *
 * The requirement follows the **method**, not the body. An earlier version
 * returned `undefined` whenever the body field was not a string, which meant a
 * malformed `tools/call` (no `name`, or a non-string one) escaped `Mcp-Name`
 * validation entirely instead of being rejected.
 */
export function mcpNameRequirement(
  method: string,
  params: Record<string, unknown> | undefined,
): {
  required: boolean;
  expected?: string;
  sourceField?: "name" | "uri" | "taskId";
} {
  const field = NAME_SOURCE[method];
  if (field === undefined) return { required: false };
  const value = params?.[field];
  return {
    required: true,
    sourceField: field,
    ...(typeof value === "string" ? { expected: value } : {}),
  };
}

/**
 * Validate an `x-mcp-header` annotation.
 *
 * Enforced when a tool is registered rather than when it is called: a malformed
 * annotation is a server-authoring bug, and the spec makes conforming clients
 * drop the whole tool from `tools/list` over it. Failing at registration turns a
 * silently-missing tool into an immediate, located error.
 *
 * @returns `null` when valid, else the reason it is not.
 */
export function validateXMcpHeaderName(name: unknown): string | null {
  if (typeof name !== "string" || name.length === 0) {
    return "x-mcp-header must be a non-empty string";
  }
  if (!HTTP_TOKEN.test(name)) {
    return `x-mcp-header "${name}" is not a valid HTTP field-name token (RFC 9110 §5.1)`;
  }
  return null;
}

/** Primitive JSON Schema types a mirrored parameter may declare. */
const MIRRORABLE_TYPES = new Set(["string", "integer", "boolean"]);

/**
 * Validate that a parameter declaring `x-mcp-header` may actually be mirrored.
 *
 * `number` is excluded by the spec — a float has no single canonical decimal
 * string, so header and body could never be compared reliably.
 */
export function validateXMcpHeaderType(type: unknown): string | null {
  if (typeof type !== "string" || !MIRRORABLE_TYPES.has(type)) {
    return `x-mcp-header may only annotate string, integer or boolean parameters (got ${
      typeof type === "string" ? `"${type}"` : "no type"
    })`;
  }
  return null;
}

/**
 * Compare a decoded header value against the body value it mirrors.
 *
 * Integers compare **numerically**, not as strings: the spec calls out that
 * `42.0` and `42` are the same value, and a string comparison would reject a
 * conforming client over formatting.
 */
function valueMatches(headerValue: string, bodyValue: unknown): boolean {
  if (typeof bodyValue === "number") {
    const asNumber = Number(headerValue);
    if (Number.isNaN(asNumber)) return false;
    // The spec bounds mirrored integers to the JS safe range. Outside it,
    // `Number()` silently collapses distinct values onto the same float, so two
    // different integers would compare equal — a mismatch bypass.
    if (
      !Number.isSafeInteger(bodyValue) ||
      !Number.isSafeInteger(asNumber) && Number.isInteger(asNumber)
    ) {
      return false;
    }
    return asNumber === bodyValue;
  }
  if (typeof bodyValue === "boolean") {
    return headerValue === String(bodyValue);
  }
  return headerValue === bodyValue;
}

/** Read a value at a chain of `properties` keys. Absent → `undefined`. */
function readAtPath(
  args: Record<string, unknown>,
  path: readonly string[],
): unknown {
  let cursor: unknown = args;
  for (const key of path) {
    // Own properties only. Walking with plain `cursor[key]` would resolve
    // inherited members, so a parameter annotated `toString` or `constructor`
    // would read off the prototype instead of the arguments.
    if (!isRecord(cursor) || !Object.hasOwn(cursor, key)) return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** A parameter the server has asked clients to mirror into a header. */
export interface MirroredParam {
  /** The `{Name}` in `Mcp-Param-{Name}`. */
  readonly headerName: string;
  /** Chain of `properties` keys leading to the annotated property. */
  readonly path: readonly string[];
}

export interface ValidateHeadersInput {
  /** Case-insensitive lookup, e.g. Hono's `c.req.header`. */
  readonly getHeader: (name: string) => string | undefined;
  readonly method: string;
  readonly params: Record<string, unknown> | undefined;
  /** Version already read from `_meta`; the header must agree with it. */
  readonly bodyProtocolVersion: string;
  /**
   * Parameters the called tool asked to mirror. Empty for anything that is not a
   * `tools/call`, or for a tool with no annotations.
   */
  readonly mirroredParams?: readonly MirroredParam[];
}

/**
 * Enforce the request-metadata contract for one POST.
 *
 * Checks, in the order a client is most likely to get wrong:
 *  1. `MCP-Protocol-Version` present and equal to the body's `_meta` value.
 *  2. `Mcp-Method` present and equal to `method`.
 *  3. `Mcp-Name` present and equal to `params.name` / `params.uri`, for the
 *     three methods that require it.
 *  4. Every mirrored `Mcp-Param-*` present-and-equal when its argument is
 *     present, and absent when it is not.
 *
 * Header *names* are matched case-insensitively (RFC 9110); header *values* are
 * compared case-sensitively, since method and tool names are case-sensitive.
 */
export function validateRequestHeaders(
  input: ValidateHeadersInput,
): HeaderValidationResult {
  const { getHeader, method, params, bodyProtocolVersion } = input;

  const versionHeader = getHeader("MCP-Protocol-Version");
  if (versionHeader === undefined) {
    return {
      ok: false,
      message:
        "Missing required header 'MCP-Protocol-Version'. Every POST to the MCP endpoint must carry it, matching _meta['io.modelcontextprotocol/protocolVersion'].",
    };
  }
  if (versionHeader !== bodyProtocolVersion) {
    return {
      ok: false,
      message:
        `MCP-Protocol-Version header "${versionHeader}" does not match _meta protocolVersion "${bodyProtocolVersion}"`,
    };
  }

  const methodHeader = getHeader("Mcp-Method");
  if (methodHeader === undefined) {
    return {
      ok: false,
      message:
        "Missing required header 'Mcp-Method'. It must mirror the JSON-RPC 'method' field.",
    };
  }
  if (methodHeader !== method) {
    return {
      ok: false,
      message:
        `Mcp-Method header "${methodHeader}" does not match body method "${method}"`,
    };
  }

  const nameRule = mcpNameRequirement(method, params);
  if (nameRule.required) {
    const raw = getHeader("Mcp-Name");
    if (raw === undefined) {
      return {
        ok: false,
        message:
          `Missing required header 'Mcp-Name' for ${method}. It must mirror params.${nameRule.sourceField}.`,
      };
    }
    const decoded = decodeHeaderValue(raw);
    if (decoded === null) {
      return {
        ok: false,
        message:
          "Mcp-Name header uses the =?base64?…?= sentinel but its payload is not valid base64-encoded UTF-8",
      };
    }
    // A value outside the header-safe set MUST arrive sentinel-encoded. When the
    // decode was a no-op (raw === decoded) the client sent it raw, which is a
    // violation regardless of whether it happens to match the body.
    if (raw === decoded && !HEADER_SAFE_VALUE.test(raw)) {
      return {
        ok: false,
        message:
          "Mcp-Name contains characters that are not valid in an HTTP field value and was not sentinel-encoded",
      };
    }
    if (nameRule.expected === undefined) {
      return {
        ok: false,
        message: `${method} requires ${
          nameRule.sourceField === "uri" ? "params.uri" : "params.name"
        } to be a string for Mcp-Name to mirror`,
      };
    }
    if (decoded !== nameRule.expected) {
      return {
        ok: false,
        message:
          `Mcp-Name header "${decoded}" does not match body value "${nameRule.expected}"`,
      };
    }
  }

  const mirrored = input.mirroredParams ?? [];
  if (mirrored.length > 0) {
    const args = isRecord(params?.["arguments"]) ? params["arguments"] : {};
    for (const { headerName, path } of mirrored) {
      const raw = getHeader(`Mcp-Param-${headerName}`);
      const bodyValue = readAtPath(args, path);
      const bodyAbsent = bodyValue === undefined || bodyValue === null;

      if (bodyAbsent) {
        // Client must omit the header; a present one has nothing to mirror.
        if (raw !== undefined) {
          return {
            ok: false,
            message: `Mcp-Param-${headerName} header is present but "${
              path.join(".")
            }" is absent from the arguments`,
          };
        }
        continue;
      }

      if (raw === undefined) {
        return {
          ok: false,
          message:
            `Missing required header 'Mcp-Param-${headerName}' mirroring argument "${
              path.join(".")
            }"`,
        };
      }
      const decoded = decodeHeaderValue(raw);
      if (decoded === null) {
        return {
          ok: false,
          message:
            `Mcp-Param-${headerName} uses the =?base64?…?= sentinel but its payload is not valid base64-encoded UTF-8`,
        };
      }
      if (!HEADER_SAFE_VALUE.test(raw) && raw === decoded) {
        return {
          ok: false,
          message:
            `Mcp-Param-${headerName} contains characters that are not valid in an HTTP field value and was not sentinel-encoded`,
        };
      }
      if (!valueMatches(decoded, bodyValue)) {
        return {
          ok: false,
          message:
            `Mcp-Param-${headerName} header "${decoded}" does not match argument "${
              path.join(".")
            }"`,
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Collect the `x-mcp-header` annotations of an `inputSchema`.
 *
 * Only *statically reachable* properties count: the chain from the root must
 * consist solely of `properties` keys. A path crossing `items`, `oneOf`/`anyOf`/
 * `allOf`/`not`, `if`/`then`/`else` or `$ref` cannot be resolved to one value
 * without evaluating the instance, so the spec makes such an annotation — and
 * the whole tool definition — invalid.
 *
 * @param onInvalid Called with a reason per rejected annotation. Registration
 *   uses it to fail loudly; a caller that only needs the valid set may ignore it.
 */
export function collectMirroredParams(
  inputSchema: unknown,
  onInvalid?: (reason: string) => void,
): MirroredParam[] {
  const found: MirroredParam[] = [];
  const seen = new Set<string>();

  /**
   * Keywords whose subschemas are NOT statically reachable: resolving a path
   * through them needs the instance. An `x-mcp-header` anywhere below one is
   * invalid per spec, so these subtrees are scanned only to *report* offenders.
   */
  const UNREACHABLE_KEYWORDS = [
    "items",
    "prefixItems",
    "additionalItems",
    "contains",
    "oneOf",
    "anyOf",
    "allOf",
    "not",
    "if",
    "then",
    "else",
    "additionalProperties",
    "patternProperties",
    "propertyNames",
    "$defs",
    "definitions",
  ];

  /** Report any annotation buried in a non-statically-reachable subtree. */
  const reportUnreachable = (node: unknown, where: string): void => {
    if (!isRecord(node)) {
      if (Array.isArray(node)) {
        for (const item of node) reportUnreachable(item, where);
      }
      return;
    }
    if (node["x-mcp-header"] !== undefined) {
      onInvalid?.(
        `x-mcp-header "${
          String(node["x-mcp-header"])
        }" is not statically reachable (it sits under "${where}"). The spec ` +
          `requires the path from the schema root to consist solely of ` +
          `"properties" keys; such an annotation invalidates the tool definition.`,
      );
    }
    for (const value of Object.values(node)) reportUnreachable(value, where);
  };

  const walk = (schema: unknown, path: readonly string[]): void => {
    if (!isRecord(schema)) return;

    // Scan the forbidden branches for offenders before descending the legal one.
    for (const keyword of UNREACHABLE_KEYWORDS) {
      if (schema[keyword] !== undefined) {
        reportUnreachable(schema[keyword], keyword);
      }
    }
    // `$ref` cannot be followed at all (and MUST NOT be dereferenced over the
    // network), so an annotated property behind one is unreachable by definition.
    if (typeof schema["$ref"] === "string" && path.length > 0) {
      onInvalid?.(
        `property "${
          path.join(".")
        }" resolves through a $ref, so any x-mcp-header below it is not statically reachable`,
      );
    }

    const properties = schema["properties"];
    if (!isRecord(properties)) return;

    for (const [key, raw] of Object.entries(properties)) {
      if (!isRecord(raw)) continue;
      const here = [...path, key];
      const annotation = raw["x-mcp-header"];

      if (annotation !== undefined) {
        const nameError = validateXMcpHeaderName(annotation);
        const typeError = validateXMcpHeaderType(raw["type"]);
        const headerName = annotation as string;
        if (nameError) {
          onInvalid?.(nameError);
        } else if (typeError) {
          onInvalid?.(`${typeError} (at "${here.join(".")}")`);
        } else if (seen.has(headerName.toLowerCase())) {
          onInvalid?.(
            `duplicate x-mcp-header "${headerName}" — values must be unique case-insensitively within one inputSchema`,
          );
        } else {
          seen.add(headerName.toLowerCase());
          found.push({ headerName, path: here });
        }
      }

      walk(raw, here);
    }
  };

  walk(inputSchema, []);
  return found;
}
