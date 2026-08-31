/**
 * DOM-free composition contracts shared by an MCP server and its App bundle.
 *
 * Import as `@casys/mcp-view/contracts` from server-side tool metadata without
 * loading the iframe runtime.
 */

export {
  defineViewAppManifest,
  parseViewAppManifestJson,
  VIEW_APP_MANIFEST_SCHEMA,
  VIEWER_SESSION_APPLY_ACTION,
} from "./src/app-manifest.ts";
export type { ViewAppManifest, ViewAppManifestResource } from "./src/app-manifest.ts";

export {
  defineSemanticSelection,
  parseSemanticSelection,
  SEMANTIC_SELECTION_APPLY_ACTION,
  SEMANTIC_SELECTION_CHANGED_EVENT,
  SEMANTIC_SELECTION_EVENT_PORTS,
  SEMANTIC_SELECTION_SCHEMA,
  validateSemanticSelection,
} from "./src/composition-contracts.ts";
export type {
  AdvertisedComponentCatalog,
  ComponentSurface,
  ComponentSurfaceItem,
  ComponentSurfaceLayout,
  ComposedSemanticRef,
  JsonValue,
  SemanticSelection,
  SemanticSelectionInput,
  SemanticSelectionMode,
  SurfaceGap,
  SurfaceLayoutType,
  ViewComponentDescriptor,
  ViewComponentEventPorts,
} from "./src/composition-contracts.ts";
