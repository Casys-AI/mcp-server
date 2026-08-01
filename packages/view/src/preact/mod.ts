/** Preact integration for `@casys/mcp-view` component surfaces. */

export { definePreactComponent, preactSurfaceRenderer, startPreactSurfaceApp } from "./surface.ts";
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
} from "./components.tsx";
export type {
  PreactComponentRenderer,
  PreactSurfaceAppOptions,
  PreactSurfaceAppState,
  PreactSurfaceComponentProps,
  PreactSurfaceContext,
  SurfaceMessageKind,
} from "./surface.ts";
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
} from "./components.tsx";
