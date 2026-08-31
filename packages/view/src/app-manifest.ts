import type {
  AdvertisedComponentCatalog,
  ComponentSurface,
  JsonValue,
  ViewComponentDescriptor,
  ViewComponentEventPorts,
} from "./composition-contracts.ts";

export const VIEW_APP_MANIFEST_SCHEMA = "io.casys.mcp.view-app-manifest/1.0" as const;
export const VIEWER_SESSION_APPLY_ACTION = "viewer.session.apply" as const;

export interface ViewAppManifestResource {
  /** Exact MCP App resource URI registered by the owning server. */
  readonly uri: string;
  /** Versioned result envelopes the resource can render after a tool call. */
  readonly resultSchemas: readonly string[];
  /** Versioned read-model envelopes accepted through `viewer.session.apply`. */
  readonly sessionSchemas?: readonly string[];
  /** Same component catalog advertised during `ui/initialize`. */
  readonly components: AdvertisedComponentCatalog;
}

/**
 * Versioned, JSON-serializable declaration owned by one MCP App package.
 *
 * It describes presentation compatibility only. Provider endpoints,
 * credentials, tool arguments and host routing policy deliberately have no
 * fields in this contract.
 */
export interface ViewAppManifest {
  readonly schemaVersion: typeof VIEW_APP_MANIFEST_SCHEMA;
  readonly app: {
    readonly id: string;
    readonly title: string;
    readonly version: string;
  };
  readonly resources: readonly ViewAppManifestResource[];
}

/** Validate, copy and deeply freeze an App-owned manifest. */
export function defineViewAppManifest(value: unknown): ViewAppManifest {
  if (!isExactRecord(value, ["schemaVersion", "app", "resources"])) {
    throw new TypeError("View App manifest must contain only schemaVersion, app, and resources");
  }
  if (value.schemaVersion !== VIEW_APP_MANIFEST_SCHEMA) {
    throw new TypeError(`View App manifest schema must be ${VIEW_APP_MANIFEST_SCHEMA}`);
  }
  if (!isExactRecord(value.app, ["id", "title", "version"])) {
    throw new TypeError("View App manifest app must contain only id, title, and version");
  }
  const id = requireIdentifier(value.app.id, "View App manifest app.id");
  const title = requireNonEmptyString(value.app.title, "View App manifest app.title");
  const version = requireSemver(value.app.version);
  if (!Array.isArray(value.resources) || value.resources.length === 0) {
    throw new TypeError("View App manifest must declare at least one resource");
  }

  const uris = new Set<string>();
  const resources = value.resources.map((resource, index) => {
    const normalized = validateResource(resource, index);
    if (uris.has(normalized.uri)) {
      throw new TypeError(`Duplicate View App resource URI ${JSON.stringify(normalized.uri)}`);
    }
    uris.add(normalized.uri);
    return normalized;
  });

  return Object.freeze({
    schemaVersion: VIEW_APP_MANIFEST_SCHEMA,
    app: Object.freeze({ id, title, version }),
    resources: Object.freeze(resources),
  });
}

/** Parse untrusted JSON and apply the same strict manifest validation. */
export function parseViewAppManifestJson(json: string): ViewAppManifest {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch (error) {
    throw new TypeError(
      `View App manifest JSON is invalid: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  return defineViewAppManifest(value);
}

function validateResource(value: unknown, index: number): ViewAppManifestResource {
  if (!isRecord(value)) {
    throw new TypeError(`View App manifest resources[${index}] must be an object`);
  }
  const keys = value.sessionSchemas === undefined
    ? ["uri", "resultSchemas", "components"]
    : ["uri", "resultSchemas", "sessionSchemas", "components"];
  if (!hasExactKeys(value, keys)) {
    throw new TypeError(`View App manifest resources[${index}] contains unsupported fields`);
  }
  const uri = requireUiUri(value.uri, index);
  const resultSchemas = validateStringSet(
    value.resultSchemas,
    `View App manifest resources[${index}].resultSchemas`,
    true,
  );
  const sessionSchemas = value.sessionSchemas === undefined ? undefined : validateStringSet(
    value.sessionSchemas,
    `View App manifest resources[${index}].sessionSchemas`,
    true,
  );
  const components = validateCatalog(value.components, index);
  const acceptsSession = Object.values(components.components).some((component) =>
    component.events?.accepts?.includes(VIEWER_SESSION_APPLY_ACTION)
  );
  if (acceptsSession !== (sessionSchemas !== undefined)) {
    throw new TypeError(
      `View App manifest resources[${index}] must declare both viewer.session.apply and sessionSchemas`,
    );
  }
  return Object.freeze({
    uri,
    resultSchemas: Object.freeze(resultSchemas),
    ...(sessionSchemas ? { sessionSchemas: Object.freeze(sessionSchemas) } : {}),
    components,
  });
}

function validateCatalog(value: unknown, resourceIndex: number): AdvertisedComponentCatalog {
  if (!isRecord(value)) {
    throw new TypeError(
      `View App manifest resources[${resourceIndex}].components must be an object`,
    );
  }
  const keys = value.defaultSurface === undefined
    ? ["components"]
    : ["components", "defaultSurface"];
  if (!hasExactKeys(value, keys) || !isRecord(value.components)) {
    throw new TypeError(
      `View App manifest resources[${resourceIndex}].components has an invalid shape`,
    );
  }
  const entries = Object.entries(value.components);
  if (entries.length === 0) {
    throw new TypeError(
      `View App manifest resources[${resourceIndex}] must advertise at least one component`,
    );
  }
  const components = Object.fromEntries(entries.map(([key, descriptor]) => [
    requireIdentifier(key, `View App component key ${JSON.stringify(key)}`),
    validateDescriptor(descriptor, key),
  ]));
  const defaultSurface = value.defaultSurface === undefined
    ? undefined
    : validateSurface(value.defaultSurface, new Set(Object.keys(components)));
  return Object.freeze({
    components: Object.freeze(components),
    ...(defaultSurface ? { defaultSurface } : {}),
  });
}

function validateDescriptor(value: unknown, key: string): ViewComponentDescriptor {
  if (!isRecord(value)) {
    throw new TypeError(`View App component ${JSON.stringify(key)} must be an object`);
  }
  const keys = ["title"];
  if (value.description !== undefined) keys.push("description");
  if (value.events !== undefined) keys.push("events");
  if (!hasExactKeys(value, keys)) {
    throw new TypeError(`View App component ${JSON.stringify(key)} contains unsupported fields`);
  }
  const title = requireNonEmptyString(value.title, `View App component ${key}.title`);
  const description = value.description === undefined
    ? undefined
    : requireNonEmptyString(value.description, `View App component ${key}.description`);
  const events = value.events === undefined ? undefined : validateEventPorts(value.events, key);
  return Object.freeze({
    title,
    ...(description ? { description } : {}),
    ...(events ? { events } : {}),
  });
}

function validateEventPorts(value: unknown, key: string): ViewComponentEventPorts {
  if (!isRecord(value)) {
    throw new TypeError(`View App component ${key}.events must be an object`);
  }
  const keys = [];
  if (value.emits !== undefined) keys.push("emits");
  if (value.accepts !== undefined) keys.push("accepts");
  if (keys.length === 0 || !hasExactKeys(value, keys)) {
    throw new TypeError(`View App component ${key}.events must declare emits or accepts`);
  }
  const emits = value.emits === undefined
    ? undefined
    : validateStringSet(value.emits, `View App component ${key}.events.emits`, true);
  const accepts = value.accepts === undefined
    ? undefined
    : validateStringSet(value.accepts, `View App component ${key}.events.accepts`, true);
  return Object.freeze({
    ...(emits ? { emits: Object.freeze(emits) } : {}),
    ...(accepts ? { accepts: Object.freeze(accepts) } : {}),
  });
}

function validateSurface(value: unknown, componentKeys: ReadonlySet<string>): ComponentSurface {
  if (!isExactRecord(value, ["layout", "components"])) {
    throw new TypeError("View App defaultSurface must contain only layout and components");
  }
  if (!isRecord(value.layout)) throw new TypeError("View App defaultSurface.layout is invalid");
  const layoutKeys = ["type"];
  if (value.layout.columns !== undefined) layoutKeys.push("columns");
  if (value.layout.gap !== undefined) layoutKeys.push("gap");
  if (!hasExactKeys(value.layout, layoutKeys)) {
    throw new TypeError("View App defaultSurface.layout contains unsupported fields");
  }
  if (!isLayoutType(value.layout.type)) {
    throw new TypeError("View App defaultSurface.layout.type is invalid");
  }
  if (
    value.layout.columns !== undefined &&
    (!Number.isInteger(value.layout.columns) ||
      (value.layout.columns as number) < 1 ||
      (value.layout.columns as number) > 12 || value.layout.type !== "grid")
  ) throw new TypeError("View App defaultSurface.layout.columns is invalid");
  if (value.layout.gap !== undefined && !isGap(value.layout.gap)) {
    throw new TypeError("View App defaultSurface.layout.gap is invalid");
  }
  if (!Array.isArray(value.components) || value.components.length === 0) {
    throw new TypeError("View App defaultSurface must contain at least one component");
  }
  const ids = new Set<string>();
  const components = value.components.map((item, index) => {
    if (!isRecord(item)) {
      throw new TypeError(`View App defaultSurface.components[${index}] must be an object`);
    }
    const keys = ["id", "component"];
    if (item.area !== undefined) keys.push("area");
    if (item.props !== undefined) keys.push("props");
    if (!hasExactKeys(item, keys)) {
      throw new TypeError(
        `View App defaultSurface.components[${index}] contains unsupported fields`,
      );
    }
    const id = requireIdentifier(item.id, `View App defaultSurface.components[${index}].id`);
    const component = requireIdentifier(
      item.component,
      `View App defaultSurface.components[${index}].component`,
    );
    if (ids.has(id)) throw new TypeError(`Duplicate View App surface component id ${id}`);
    ids.add(id);
    if (!componentKeys.has(component)) {
      throw new TypeError(`Unknown View App surface component ${component}`);
    }
    const area = item.area === undefined
      ? undefined
      : requireArea(item.area, `View App defaultSurface.components[${index}].area`);
    if (item.props !== undefined && !isJsonValue(item.props)) {
      throw new TypeError(`View App defaultSurface.components[${index}].props must be JSON`);
    }
    return Object.freeze({
      id,
      component,
      ...(area ? { area } : {}),
      ...(item.props === undefined
        ? {}
        : { props: cloneFrozenJson(item.props as Readonly<Record<string, JsonValue>>) }),
    });
  });
  return Object.freeze({
    layout: Object.freeze({
      type: value.layout.type,
      ...(value.layout.columns === undefined ? {} : { columns: value.layout.columns as number }),
      ...(value.layout.gap === undefined ? {} : { gap: value.layout.gap }),
    }),
    components: Object.freeze(components),
  });
}

function validateStringSet(value: unknown, path: string, requireOne: boolean): string[] {
  if (!Array.isArray(value) || (requireOne && value.length === 0)) {
    throw new TypeError(`${path} must be a non-empty array`);
  }
  const normalized = value.map((item, index) => requireNonEmptyString(item, `${path}[${index}]`));
  if (new Set(normalized).size !== normalized.length) {
    throw new TypeError(`${path} must not contain duplicates`);
  }
  return normalized;
}

function requireUiUri(value: unknown, index: number): string {
  const uri = requireNonEmptyString(value, `View App manifest resources[${index}].uri`);
  if (!/^ui:\/\/[A-Za-z0-9][A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]*$/.test(uri)) {
    throw new TypeError(`View App manifest resources[${index}].uri must be an exact ui:// URI`);
  }
  return uri;
}

function requireIdentifier(value: unknown, path: string): string {
  const identifier = requireNonEmptyString(value, path);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(identifier)) {
    throw new TypeError(`${path} is invalid`);
  }
  return identifier;
}

function requireSemver(value: unknown): string {
  const version = requireNonEmptyString(value, "View App manifest app.version");
  const numeric = "(?:0|[1-9]\\d*)";
  const prerelease =
    "(?:(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[A-Za-z-][0-9A-Za-z-]*))*)";
  const build = "(?:[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)";
  if (
    !new RegExp(`^${numeric}\\.${numeric}\\.${numeric}(?:-${prerelease})?(?:\\+${build})?$`).test(
      version,
    )
  ) {
    throw new TypeError("View App manifest app.version must be exact SemVer");
  }
  return version;
}

function requireArea(value: unknown, path: string): string {
  const area = requireNonEmptyString(value, path);
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(area)) throw new TypeError(`${path} is invalid`);
  return area;
}

function requireNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${path} must be non-empty`);
  return value;
}

function isLayoutType(value: unknown): value is "stack" | "row" | "grid" {
  return value === "stack" || value === "row" || value === "grid";
}

function isGap(value: unknown): value is "none" | "xs" | "sm" | "md" | "lg" {
  return value === "none" || value === "xs" || value === "sm" || value === "md" || value === "lg";
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null || typeof value === "string" || typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (isRecord(value)) return Object.values(value).every(isJsonValue);
  return false;
}

function cloneFrozenJson<T extends JsonValue>(value: T): T {
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => cloneFrozenJson(item))) as T;
  }
  if (isRecord(value)) {
    return Object.freeze(Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        cloneFrozenJson(item as JsonValue),
      ]),
    )) as T;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExactRecord(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && hasExactKeys(value, keys);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
