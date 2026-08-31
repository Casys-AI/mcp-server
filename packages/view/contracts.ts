/**
 * DOM-free composition contracts shared by an MCP server and its App bundle.
 *
 * Import as `@casys/mcp-view/contracts` from server-side tool metadata without
 * loading the iframe runtime.
 */

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
  ComposedSemanticRef,
  SemanticSelection,
  SemanticSelectionInput,
  SemanticSelectionMode,
  ViewComponentEventPorts,
} from "./src/composition-contracts.ts";
