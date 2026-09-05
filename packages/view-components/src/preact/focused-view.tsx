/** @jsxImportSource preact */
/** Presentation slots for one useful view and its optional technical details. */

import type { ComponentChildren, JSX } from "preact";
import { useViewerLayout } from "../layout/hooks.ts";
import type { LayoutHostHints, ViewerLayout } from "../layout/viewer-layout.ts";

export interface DisclosureProps {
  /** Visible, caller-worded summary and accessible name of the native control. */
  readonly label: string;
  readonly children?: ComponentChildren;
  /** Omit for a native disclosure that starts closed. */
  readonly open?: boolean;
  readonly onToggle?: (open: boolean) => void;
  readonly className?: string;
}

/** Native keyboard and disclosure semantics; never hides a caller's critical status by itself. */
export function Disclosure({
  label,
  children,
  open,
  onToggle,
  className,
}: DisclosureProps): JSX.Element {
  return (
    <details
      class={classes("mcp-view-disclosure", className)}
      open={open}
      onToggle={onToggle ? (event) => onToggle(event.currentTarget.open) : undefined}
    >
      <summary class="mcp-view-disclosure-summary">{label}</summary>
      <div class="mcp-view-disclosure-body">{children}</div>
    </details>
  );
}

interface FocusedViewSlots {
  /** Accessible name for this bounded group, supplied by the viewer. */
  readonly label: string;
  /** The visualization or reading that gives this viewer its purpose. */
  readonly primary: ComponentChildren;
  /** Critical recorded state belongs here, outside the collapsed details. */
  readonly status?: ComponentChildren;
  /** Passed by value; this component imports no MCP Apps lifecycle. */
  readonly hostContext?: LayoutHostHints;
  /** Optional review override; otherwise the host, container and pointer decide. */
  readonly layout?: ViewerLayout;
  readonly className?: string;
}

export type FocusedViewProps =
  & FocusedViewSlots
  & (
    | { readonly details?: never; readonly detailsLabel?: never }
    | { readonly details: ComponentChildren; readonly detailsLabel: string }
  );

/**
 * One primary view, an overt status and a closed technical disclosure. The
 * outer MCP surface supplies the frame. The viewer owns every value and label.
 */
export function FocusedView({
  label,
  primary,
  status,
  details,
  detailsLabel,
  hostContext,
  layout: forced,
  className,
}: FocusedViewProps): JSX.Element {
  const { ref, layout, boundsStyle } = useViewerLayout<HTMLDivElement>(hostContext, { forced });
  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      class={classes("mcp-view-focused-view", className)}
      data-layout={layout}
      style={boundsStyle}
    >
      {isPresent(status) && <div class="mcp-view-focused-status">{status}</div>}
      <div class="mcp-view-focused-primary">{primary}</div>
      {isPresent(details) && detailsLabel !== undefined && (
        <Disclosure label={detailsLabel}>{details}</Disclosure>
      )}
    </div>
  );
}

function isPresent(value: ComponentChildren): boolean {
  return value !== undefined && value !== null && value !== false;
}

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}
