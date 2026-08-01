/** Declarative small-component surface contracts for composed MCP Apps. */

export type SurfaceLayoutType = "stack" | "row" | "grid";
export type SurfaceGap = "none" | "xs" | "sm" | "md" | "lg";
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export interface ComponentSurfaceLayout {
  readonly type: SurfaceLayoutType;
  readonly columns?: number;
  readonly gap?: SurfaceGap;
}

export interface ComponentSurfaceItem {
  readonly id: string;
  readonly component: string;
  readonly area?: string;
  readonly props?: Readonly<Record<string, JsonValue>>;
}

export interface ComponentSurface {
  readonly layout: ComponentSurfaceLayout;
  readonly components: readonly ComponentSurfaceItem[];
}

export interface ViewComponentDescriptor {
  readonly title: string;
  readonly description?: string;
}

export interface AdvertisedComponentCatalog {
  readonly components: Readonly<Record<string, ViewComponentDescriptor>>;
  readonly defaultSurface?: ComponentSurface;
}

export interface ReadyComponentSurface {
  readonly status: "ready";
  readonly source: "requested" | "default";
  readonly surface: ComponentSurface;
}

export interface UnresolvedComponentSurface {
  readonly status: "unresolved";
  readonly reason: "surface-required" | "unknown-components";
  readonly missingComponents?: readonly string[];
}

export type ComponentSurfaceResolution =
  | ReadyComponentSurface
  | UnresolvedComponentSurface;
