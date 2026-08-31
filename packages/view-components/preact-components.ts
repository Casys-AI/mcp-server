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
  BadgeGroup,
  Button,
  Card,
  CodeBlock,
  CrossSelection,
  DataTable,
  EmptyState,
  InlineCode,
  KeyValueList,
  Message,
  Metric,
  MetricGrid,
  Row,
  Stack,
  StateMessage,
  TextInput,
  Toolbar,
} from "./src/preact/components.tsx";
export type {
  BadgeGroupProps,
  BadgeProps,
  ButtonProps,
  CardProps,
  CodeBlockProps,
  CrossSelectionProps,
  DataTableColumn,
  DataTableProps,
  EmptyStateProps,
  InlineCodeProps,
  KeyValueItem,
  KeyValueListProps,
  MessageProps,
  MetricGridProps,
  MetricItem,
  MetricProps,
  PresentationTone,
  RowProps,
  StackProps,
  StateMessageProps,
  TextInputProps,
  ToolbarProps,
} from "./src/preact/components.tsx";

export { ArtifactRow, LimitGauge, PathBar } from "./src/preact/structural.tsx";
export type {
  ArtifactFingerprint,
  ArtifactRowProps,
  ArtifactVerification,
  LimitGaugeLimit,
  LimitGaugeProps,
  PathBarItem,
  PathBarProps,
} from "./src/preact/structural.tsx";

export {
  ElementBody,
  ElementIdent,
  ElementProvenance,
  ElementReading,
  ElementVerdict,
  SemanticElement,
  SemanticList,
} from "./src/preact/semantic-element.tsx";
export type {
  ElementBodyProps,
  ElementIdentProps,
  ElementProvenanceProps,
  ElementReadingProps,
  ElementVerdictProps,
  SemanticElementDensity,
  SemanticElementProps,
  SemanticListProps,
} from "./src/preact/semantic-element.tsx";

export {
  installMcpViewTheme,
  MCP_VIEW_THEME_CSS,
  MCP_VIEW_THEME_STYLE_ID,
  MCP_VIEW_THEME_TOKENS,
} from "./src/theme.ts";
export type { McpViewThemeDocument, McpViewThemeToken, McpViewThemeTokens } from "./src/theme.ts";
