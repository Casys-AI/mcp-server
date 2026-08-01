/** Pure resolution of a requested small-component surface against an App catalog. */

import type {
  AdvertisedComponentCatalog,
  ComponentSurface,
  ComponentSurfaceResolution,
} from "../types/components.ts";

export function resolveComponentSurface(
  catalog: AdvertisedComponentCatalog,
  requested?: ComponentSurface,
): ComponentSurfaceResolution {
  const surface = requested ?? catalog.defaultSurface;
  const known = new Set(Object.keys(catalog.components));
  const missingComponents = [
    ...new Set(
      surface.components
        .map((item) => item.component)
        .filter((component) => !known.has(component)),
    ),
  ].sort();
  if (missingComponents.length > 0) {
    return {
      status: "unresolved",
      reason: "unknown-components",
      missingComponents,
    };
  }
  return {
    status: "ready",
    source: requested ? "requested" : "default",
    surface,
  };
}
