/** @jsxImportSource preact */
/** Shared Preact presentation primitives for composable MCP Apps. */

import type { ComponentChildren, JSX } from "preact";

export type PresentationTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

export interface StackProps {
  readonly gap?: "xs" | "sm" | "md" | "lg";
  readonly className?: string;
  readonly children?: ComponentChildren;
}

/** Simple vertical composition primitive; it carries no domain semantics. */
export function Stack({ gap = "md", className, children }: StackProps): JSX.Element {
  return (
    <div class={classes("mcp-view-stack", className)} data-gap={gap}>
      {children}
    </div>
  );
}

export interface RowProps {
  readonly label?: string;
  readonly responsive?: boolean;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

/** Horizontal fact or control row; its contents and meaning remain caller-owned. */
export function Row({
  label,
  responsive = false,
  className,
  children,
}: RowProps): JSX.Element {
  return (
    <div
      aria-label={label}
      class={classes(
        "mcp-view-row",
        responsive ? "mcp-view-row-responsive" : undefined,
        className,
      )}
      role={label ? "group" : undefined}
    >
      {children}
    </div>
  );
}

export interface CardProps {
  readonly title?: ComponentChildren;
  readonly eyebrow?: ComponentChildren;
  readonly actions?: ComponentChildren;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

/** The canonical MCP component container. */
export function Card({
  title,
  eyebrow,
  actions,
  className,
  children,
}: CardProps): JSX.Element {
  return (
    <section class={classes("mcp-view-card", className)}>
      {(title || eyebrow || actions) && (
        <header class="mcp-view-card-header">
          <div class="mcp-view-card-heading">
            {eyebrow && <p class="mcp-view-card-eyebrow">{eyebrow}</p>}
            {title && <h2 class="mcp-view-card-title">{title}</h2>}
          </div>
          {actions && <div class="mcp-view-card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export interface BadgeProps {
  readonly tone?: PresentationTone;
  readonly children?: ComponentChildren;
  readonly className?: string;
}

export interface BadgeGroupProps {
  readonly label: string;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

/** Accessible wrapping group for compact status and classification badges. */
export function BadgeGroup({
  label,
  className,
  children,
}: BadgeGroupProps): JSX.Element {
  return (
    <div
      aria-label={label}
      class={classes("mcp-view-badges", className)}
      role="group"
    >
      {children}
    </div>
  );
}

/** Compact status or classification label. */
export function Badge({ tone = "neutral", children, className }: BadgeProps): JSX.Element {
  return (
    <span
      class={classes("mcp-view-badge", className)}
      data-tone={tone}
    >
      {children}
    </span>
  );
}

export interface MetricItem {
  readonly id: string;
  readonly label: ComponentChildren;
  readonly value: ComponentChildren;
  readonly unit?: ComponentChildren;
  readonly detail?: ComponentChildren;
  readonly tone?: PresentationTone;
}

export interface MetricGridProps {
  readonly items: readonly MetricItem[];
  readonly className?: string;
}

export interface MetricProps extends Omit<MetricItem, "id"> {
  readonly id?: string;
  readonly className?: string;
}

/** One unit-bearing reading. Callers remain responsible for the value and its tone. */
export function Metric({
  id,
  label,
  value,
  unit,
  detail,
  tone = "neutral",
  className,
}: MetricProps): JSX.Element {
  return (
    <article
      class={classes("mcp-view-metric", className)}
      data-metric={id}
      data-tone={tone}
    >
      <span class="mcp-view-metric-label">{label}</span>
      <strong class="mcp-view-metric-value">{value}</strong>
      {unit && <small class="mcp-view-metric-unit">{unit}</small>}
      {detail && <small class="mcp-view-metric-detail">{detail}</small>}
    </article>
  );
}

/** Responsive, container-aware metrics with stable semantic slots. */
export function MetricGrid({ items, className }: MetricGridProps): JSX.Element {
  return (
    <div class={classes("mcp-view-metrics", className)}>
      {items.map((metric) => <Metric {...metric} key={metric.id} />)}
    </div>
  );
}

export interface KeyValueItem {
  readonly id: string;
  readonly label: ComponentChildren;
  readonly value: ComponentChildren;
}

export interface KeyValueListProps {
  readonly items: readonly KeyValueItem[];
  readonly className?: string;
}

/** Provenance and identity facts with safe wrapping for hashes and URIs. */
export function KeyValueList({ items, className }: KeyValueListProps): JSX.Element {
  return (
    <dl class={classes("mcp-view-key-values", className)}>
      {items.map((item) => (
        <div class="mcp-view-key-value" key={item.id}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export interface DataTableColumn<TRow> {
  readonly id: string;
  readonly label: ComponentChildren;
  readonly align?: "left" | "right";
  readonly render: (row: TRow) => ComponentChildren;
}

export interface DataTableProps<TRow> {
  readonly label: string;
  readonly rows: readonly TRow[];
  readonly columns: readonly DataTableColumn<TRow>[];
  readonly rowKey: (row: TRow) => string | number;
  readonly selected?: (row: TRow) => boolean;
  readonly onSelect?: (row: TRow) => void;
  readonly emptyLabel?: string;
  readonly className?: string;
}

/** Accessible compact table; selection behavior is opt-in and keyboard-safe. */
export function DataTable<TRow>({
  label,
  rows,
  columns,
  rowKey,
  selected,
  onSelect,
  emptyLabel = "No matching data",
  className,
}: DataTableProps<TRow>): JSX.Element {
  if (rows.length === 0) {
    return (
      <div
        aria-label={label}
        class={classes("mcp-view-table-wrap", className)}
        role="status"
      >
        <EmptyState>{emptyLabel}</EmptyState>
      </div>
    );
  }
  return (
    <div class={classes("mcp-view-table-wrap", className)}>
      <table class="mcp-view-table" aria-label={label}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.id}
                scope="col"
                data-align={column.align ?? "left"}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const interactive = onSelect !== undefined;
            const isSelected = selected?.(row);
            const choose = () => onSelect?.(row);
            return (
              <tr
                aria-selected={selected ? isSelected : undefined}
                class={isSelected ? "mcp-view-selected" : undefined}
                data-interactive={interactive ? "true" : undefined}
                key={rowKey(row)}
                tabIndex={interactive ? 0 : undefined}
                onClick={interactive
                  ? (event) => {
                    if (eventStartedInInteractiveChild(event.currentTarget, event.target)) return;
                    choose();
                  }
                  : undefined}
                onKeyDown={interactive
                  ? (event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key !== "Enter" && event.key !== " ") return;
                    event.preventDefault();
                    choose();
                  }
                  : undefined}
              >
                {columns.map((column) => (
                  <td key={column.id} data-align={column.align ?? "left"}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface ButtonProps {
  readonly type?: "button" | "submit" | "reset";
  readonly pressed?: boolean;
  readonly disabled?: boolean;
  readonly title?: string;
  readonly className?: string;
  readonly onClick?: JSX.MouseEventHandler<HTMLButtonElement>;
  readonly children?: ComponentChildren;
}

/** Small dashboard-safe action, never a product-wide navigation control. */
export function Button({
  type = "button",
  pressed,
  disabled,
  title,
  className,
  onClick,
  children,
}: ButtonProps): JSX.Element {
  return (
    <button
      aria-pressed={pressed}
      class={classes("mcp-view-button", className)}
      disabled={disabled}
      onClick={onClick}
      title={title}
      type={type}
    >
      {children}
    </button>
  );
}

export interface ToolbarProps {
  readonly label: string;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

export interface TextInputProps {
  readonly label: string;
  readonly value: string;
  readonly placeholder?: string;
  readonly type?: "text" | "search";
  readonly disabled?: boolean;
  readonly className?: string;
  readonly onValueInput?: (value: string) => void;
}

/** Compact controlled text input with a mandatory accessible label. */
export function TextInput({
  label,
  value,
  placeholder,
  type = "search",
  disabled,
  className,
  onValueInput,
}: TextInputProps): JSX.Element {
  return (
    <input
      aria-label={label}
      class={classes("mcp-view-text-input", className)}
      disabled={disabled}
      onInput={(event) => onValueInput?.(event.currentTarget.value)}
      placeholder={placeholder}
      type={type}
      value={value}
    />
  );
}

export interface CodeBlockProps {
  readonly label?: string;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

/** Bounded preformatted content for expressions, source excerpts, and exact text. */
export function CodeBlock({ label, className, children }: CodeBlockProps): JSX.Element {
  return (
    <pre aria-label={label} class={classes("mcp-view-code-block", className)}>
      <code>{children}</code>
    </pre>
  );
}

export interface InlineCodeProps {
  readonly title?: string;
  readonly className?: string;
  readonly children?: ComponentChildren;
}

/** Inline exact text with safe wrapping for fingerprints, identifiers, and URIs. */
export function InlineCode({
  title,
  className,
  children,
}: InlineCodeProps): JSX.Element {
  return (
    <code class={classes("mcp-view-inline-code", className)} title={title}>
      {children}
    </code>
  );
}

export function Toolbar({
  label,
  className,
  children,
}: ToolbarProps): JSX.Element {
  return (
    <div
      aria-label={label}
      class={classes("mcp-view-toolbar", className)}
      role="group"
    >
      {children}
    </div>
  );
}

export interface EmptyStateProps {
  readonly children?: ComponentChildren;
  readonly className?: string;
}

export function EmptyState({
  children,
  className,
}: EmptyStateProps): JSX.Element {
  return <p class={classes("mcp-view-empty", className)}>{children}</p>;
}

export interface MessageProps {
  readonly tone?: PresentationTone;
  readonly children?: ComponentChildren;
  readonly className?: string;
}

/** Compact inline notice that keeps surrounding values visible. */
export function Message({
  tone = "neutral",
  children,
  className,
}: MessageProps): JSX.Element {
  return (
    <div
      class={classes("mcp-view-message", className)}
      data-tone={tone}
      role={tone === "danger" ? "alert" : "status"}
    >
      {children}
    </div>
  );
}

export interface CrossSelectionProps {
  readonly label: ComponentChildren;
  readonly value: ComponentChildren;
  readonly status?: ComponentChildren;
  readonly className?: string;
}

/** Read-only projection of a selection coordinated by an owning host. */
export function CrossSelection({
  label,
  value,
  status,
  className,
}: CrossSelectionProps): JSX.Element {
  return (
    <div class={classes("mcp-view-cross-selection", className)} role="status">
      <span class="mcp-view-cross-selection-label">{label}</span>
      <strong class="mcp-view-cross-selection-value">{value}</strong>
      {status && <span class="mcp-view-cross-selection-status">{status}</span>}
    </div>
  );
}

export interface StateMessageProps {
  readonly title?: ComponentChildren;
  readonly tone?: PresentationTone;
  readonly busy?: boolean;
  readonly children?: ComponentChildren;
  readonly className?: string;
}

export function StateMessage({
  title,
  tone = "neutral",
  busy,
  children,
  className,
}: StateMessageProps): JSX.Element {
  return (
    <div
      aria-busy={busy}
      class={classes("mcp-view-state", className)}
      data-tone={tone}
      role={tone === "danger" ? "alert" : "status"}
    >
      {busy && <span aria-hidden="true" class="mcp-view-state-busy" />}
      {title && <strong>{title}</strong>}
      {children && <div class="mcp-view-state-detail">{children}</div>}
    </div>
  );
}

const INTERACTIVE_CHILD_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
].join(",");

function eventStartedInInteractiveChild(
  row: HTMLTableRowElement,
  target: EventTarget | null,
): boolean {
  const candidate = target as (Element & { closest?: (selector: string) => Element | null }) | null;
  if (!candidate || typeof candidate.closest !== "function") return false;
  const interactive = candidate.closest(INTERACTIVE_CHILD_SELECTOR);
  return interactive !== null && interactive !== row && row.contains(interactive);
}

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}
