/** DOM-free contracts shared by MCP App servers and their viewers. */

/** Compose event names a component can emit or accept when a host connects it. */
export interface ViewComponentEventPorts {
  readonly emits?: readonly string[];
  readonly accepts?: readonly string[];
}

/** Layout modes available to serializable component surfaces. */
export type SurfaceLayoutType = "stack" | "row" | "grid";

/** Spacing scale accepted by serializable component surfaces. */
export type SurfaceGap = "none" | "xs" | "sm" | "md" | "lg";

/** JSON-only value accepted by a serializable component surface. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/** Serializable layout for an App-owned component surface. */
export interface ComponentSurfaceLayout {
  readonly type: SurfaceLayoutType;
  readonly columns?: number;
  readonly gap?: SurfaceGap;
}

/** One component instance in an App-owned component surface. */
export interface ComponentSurfaceItem {
  readonly id: string;
  readonly component: string;
  readonly area?: string;
  readonly props?: Readonly<Record<string, JsonValue>>;
}

/** Serializable surface selected by a host or used as an App default. */
export interface ComponentSurface {
  readonly layout: ComponentSurfaceLayout;
  readonly components: readonly ComponentSurfaceItem[];
}

/** Metadata a component advertises to a composition host. */
export interface ViewComponentDescriptor {
  readonly title: string;
  readonly description?: string;
  readonly events?: ViewComponentEventPorts;
}

/** Serializable catalog advertised during the MCP Apps initialize handshake. */
export interface AdvertisedComponentCatalog {
  readonly components: Readonly<Record<string, ViewComponentDescriptor>>;
  readonly defaultSurface?: ComponentSurface;
}

export const SEMANTIC_SELECTION_SCHEMA = "io.casys.semantic-selection/1.0" as const;
export const SEMANTIC_SELECTION_CHANGED_EVENT = "semantic.selection.changed" as const;
export const SEMANTIC_SELECTION_APPLY_ACTION = "semantic.selection.apply" as const;

/** Reusable component ports; routing remains an explicit mcp-compose host policy. */
export const SEMANTIC_SELECTION_EVENT_PORTS: ViewComponentEventPorts = Object.freeze({
  emits: Object.freeze([SEMANTIC_SELECTION_CHANGED_EVENT]),
  accepts: Object.freeze([SEMANTIC_SELECTION_APPLY_ACTION]),
});

/**
 * Structural projection compatible with a Digital Thread semantic reference.
 *
 * Domain values deliberately remain open here: the owning product validates
 * its narrower domain vocabulary and mcp-view does not become a second
 * engineering authority.
 */
export interface ComposedSemanticRef {
  readonly domain: string;
  readonly kind: string;
  readonly id: string;
  readonly basisFingerprint?: string;
}

export type SemanticSelectionMode = "replace" | "add" | "remove" | "clear";

export interface SemanticSelection {
  readonly schema: typeof SEMANTIC_SELECTION_SCHEMA;
  readonly mode: SemanticSelectionMode;
  readonly references: readonly ComposedSemanticRef[];
}

export interface SemanticSelectionInput {
  readonly mode: SemanticSelectionMode;
  readonly references: readonly ComposedSemanticRef[];
}

/** Validate and freeze an outgoing semantic-selection payload. */
export function defineSemanticSelection(input: SemanticSelectionInput): SemanticSelection {
  return validateSemanticSelection({
    schema: SEMANTIC_SELECTION_SCHEMA,
    mode: input.mode,
    references: input.references,
  });
}

/** Parse untrusted routed data; malformed payloads remain unavailable. */
export function parseSemanticSelection(value: unknown): SemanticSelection | undefined {
  try {
    return validateSemanticSelection(value);
  } catch {
    return undefined;
  }
}

export function validateSemanticSelection(value: unknown): SemanticSelection {
  if (!isRecord(value) || value.schema !== SEMANTIC_SELECTION_SCHEMA) {
    throw new TypeError(`Semantic selection schema must be ${SEMANTIC_SELECTION_SCHEMA}`);
  }
  if (!isSelectionMode(value.mode)) {
    throw new TypeError("Semantic selection mode is invalid");
  }
  if (!Array.isArray(value.references)) {
    throw new TypeError("Semantic selection references must be an array");
  }
  if (value.mode === "clear" && value.references.length !== 0) {
    throw new TypeError("Semantic selection clear mode must contain no references");
  }
  if (value.mode !== "clear" && value.references.length === 0) {
    throw new TypeError("Semantic selection requires at least one reference unless mode is clear");
  }

  const references = value.references.map((reference, index) =>
    validateSemanticRef(reference, index)
  );
  return Object.freeze({
    schema: SEMANTIC_SELECTION_SCHEMA,
    mode: value.mode,
    references: Object.freeze(references),
  });
}

function validateSemanticRef(value: unknown, index: number): ComposedSemanticRef {
  if (!isRecord(value)) {
    throw new TypeError(`Semantic selection reference ${index} must be an object`);
  }
  for (const field of ["domain", "kind", "id"] as const) {
    if (typeof value[field] !== "string" || !(value[field] as string).trim()) {
      throw new TypeError(`Semantic selection reference ${index}.${field} must be non-empty`);
    }
  }
  if (
    value.basisFingerprint !== undefined &&
    (typeof value.basisFingerprint !== "string" ||
      !/^[a-f0-9]{64}$/.test(value.basisFingerprint))
  ) {
    throw new TypeError(
      `Semantic selection reference ${index}.basisFingerprint must be a SHA-256 digest`,
    );
  }
  return Object.freeze({
    domain: value.domain as string,
    kind: value.kind as string,
    id: value.id as string,
    ...(value.basisFingerprint !== undefined
      ? { basisFingerprint: value.basisFingerprint as string }
      : {}),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSelectionMode(value: unknown): value is SemanticSelectionMode {
  return value === "replace" || value === "add" || value === "remove" || value === "clear";
}
