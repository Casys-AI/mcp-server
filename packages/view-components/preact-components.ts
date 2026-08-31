/**
 * Pure Preact presentation primitives for native applications and MCP Apps.
 *
 * Unlike `@casys/mcp-view-components/preact`, this entry point does not import the MCP
 * Apps lifecycle, iframe transport, surface registry, or postMessage bridge.
 *
 * Import as `@casys/mcp-view-components/preact/components`.
 *
 * @module
 */

export {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  KeyValueList,
  MetricGrid,
  StateMessage,
  Toolbar,
} from "./src/preact/components.tsx";
export type {
  BadgeProps,
  ButtonProps,
  CardProps,
  DataTableColumn,
  DataTableProps,
  EmptyStateProps,
  KeyValueItem,
  KeyValueListProps,
  MetricGridProps,
  MetricItem,
  PresentationTone,
  StateMessageProps,
  ToolbarProps,
} from "./src/preact/components.tsx";

export { installMcpViewTheme, MCP_VIEW_THEME_CSS, MCP_VIEW_THEME_STYLE_ID } from "./src/theme.ts";
export type { McpViewThemeDocument } from "./src/theme.ts";
