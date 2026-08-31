/** @jsxImportSource preact */
/** Shared Preact presentation primitives for composable MCP Apps. */

import type { ComponentChildren, JSX } from "preact";

export type PresentationTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

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

/** Responsive, container-aware metrics with stable semantic slots. */
export function MetricGrid({ items, className }: MetricGridProps): JSX.Element {
  return (
    <div class={classes("mcp-view-metrics", className)}>
      {items.map((metric) => (
        <article
          class="mcp-view-metric"
          data-metric={metric.id}
          data-tone={metric.tone ?? "neutral"}
          key={metric.id}
        >
          <span class="mcp-view-metric-label">{metric.label}</span>
          <strong class="mcp-view-metric-value">{metric.value}</strong>
          {metric.unit && <small class="mcp-view-metric-unit">{metric.unit}</small>}
          {metric.detail && <small class="mcp-view-metric-detail">{metric.detail}</small>}
        </article>
      ))}
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

export interface StateMessageProps {
  readonly title?: ComponentChildren;
  readonly tone?: PresentationTone;
  readonly children?: ComponentChildren;
  readonly className?: string;
}

export function StateMessage({
  title,
  tone = "neutral",
  children,
  className,
}: StateMessageProps): JSX.Element {
  return (
    <div
      class={classes("mcp-view-state", className)}
      data-tone={tone}
      role={tone === "danger" ? "alert" : "status"}
    >
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
