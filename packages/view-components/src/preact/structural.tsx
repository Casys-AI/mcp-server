/** @jsxImportSource preact */
/** Pure presentation structures shared by composable MCP Apps. */

import type { ComponentChildren, JSX } from "preact";
import type { PresentationTone } from "./components.tsx";

export interface PathBarItem {
  readonly id: string;
  readonly label: ComponentChildren;
}

export interface PathBarProps {
  /** Accessible name for the navigation landmark. */
  readonly label: string;
  /** Ordered path, including the current item. */
  readonly items: readonly PathBarItem[];
  /** Controlled identity of the current item. */
  readonly currentId: string;
  /** Local navigation callback. The component owns no routing state. */
  readonly onSelect: (id: string) => void;
  readonly className?: string;
}

/** Controlled breadcrumb-like navigation without host or MCP side effects. */
export function PathBar({
  label,
  items,
  currentId,
  onSelect,
  className,
}: PathBarProps): JSX.Element {
  validatePath(items, currentId);
  return (
    <nav aria-label={label} class={classes("mcp-view-path-bar", className)}>
      <ol class="mcp-view-path-bar-list">
        {items.map((item) => {
          const current = item.id === currentId;
          return (
            <li
              class="mcp-view-path-bar-item"
              data-current={current ? "true" : undefined}
              key={item.id}
            >
              {current
                ? (
                  <span aria-current="page" class="mcp-view-path-bar-current">
                    {item.label}
                  </span>
                )
                : (
                  <button
                    class="mcp-view-path-bar-button"
                    onClick={() => onSelect(item.id)}
                    type="button"
                  >
                    {item.label}
                  </button>
                )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export interface LimitGaugeLimit {
  /** Position of the caller-provided limit on the same finite scale. */
  readonly value: number;
  /** Visible description of that recorded limit. */
  readonly label: string;
}

export interface LimitGaugeProps {
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly value: number;
  /** Caller-formatted reading, including its unit when applicable. */
  readonly valueLabel: string;
  /** Caller-provided state text; the gauge never derives a verdict. */
  readonly statusLabel: string;
  readonly tone: PresentationTone;
  readonly limit?: LimitGaugeLimit;
  readonly className?: string;
}

/** Finite meter with an optional caller-supplied limit marker and explicit status text. */
export function LimitGauge({
  label,
  min,
  max,
  value,
  valueLabel,
  statusLabel,
  tone,
  limit,
  className,
}: LimitGaugeProps): JSX.Element {
  validateGaugeRange(min, max, value, limit);
  const markerPosition = limit === undefined
    ? undefined
    : `${((limit.value - min) / (max - min)) * 100}%`;

  return (
    <div
      class={classes("mcp-view-limit-gauge", className)}
      data-tone={tone}
    >
      <span class="mcp-view-limit-gauge-label">{label}</span>
      <div class="mcp-view-limit-gauge-track">
        <meter
          aria-label={label}
          aria-valuetext={`${valueLabel}; ${statusLabel}`}
          class="mcp-view-limit-gauge-meter"
          min={min}
          max={max}
          value={value}
        />
        {limit && (
          <span
            aria-hidden="true"
            class="mcp-view-limit-gauge-marker"
            style={{ left: markerPosition }}
          />
        )}
      </div>
      <span class="mcp-view-limit-gauge-reading">{valueLabel}</span>
      <span class="mcp-view-limit-gauge-status" data-tone={tone}>{statusLabel}</span>
      {limit && <span class="mcp-view-limit-gauge-limit">{limit.label}</span>}
    </div>
  );
}

export interface ArtifactFingerprint {
  readonly algorithm: string;
  readonly digest: string;
}

export interface ArtifactVerification {
  /** Literal verification state supplied by the caller. */
  readonly label: ComponentChildren;
  readonly tone: PresentationTone;
}

interface ArtifactRowBaseProps {
  readonly label: ComponentChildren;
  readonly kind?: ComponentChildren;
  readonly uri: string;
  readonly fingerprint?: ArtifactFingerprint;
  /** Caller-formatted byte size or other bounded size description. */
  readonly sizeLabel?: ComponentChildren;
  readonly verification?: ArtifactVerification;
  readonly className?: string;
}

interface StaticArtifactRowProps extends ArtifactRowBaseProps {
  readonly onActivate?: undefined;
  readonly actionLabel?: never;
}

interface InteractiveArtifactRowProps extends ArtifactRowBaseProps {
  readonly onActivate: () => void;
  /** Accessible action name, supplied together with the callback. */
  readonly actionLabel: string;
}

export type ArtifactRowProps = StaticArtifactRowProps | InteractiveArtifactRowProps;

/** Immutable-artifact presentation; verification is displayed, never inferred or performed. */
export function ArtifactRow(props: ArtifactRowProps): JSX.Element {
  const content = (
    <>
      <span class="mcp-view-artifact-row-identity">
        {props.kind && <span class="mcp-view-artifact-row-kind">{props.kind}</span>}
        <strong class="mcp-view-artifact-row-label">{props.label}</strong>
      </span>
      <code class="mcp-view-artifact-row-uri">{props.uri}</code>
      {props.fingerprint && (
        <span class="mcp-view-artifact-row-fingerprint">
          <span>{props.fingerprint.algorithm}</span>
          <code>{props.fingerprint.digest}</code>
        </span>
      )}
      {props.sizeLabel && <span class="mcp-view-artifact-row-size">{props.sizeLabel}</span>}
      {props.verification && (
        <span
          class="mcp-view-artifact-row-verification"
          data-tone={props.verification.tone}
        >
          {props.verification.label}
        </span>
      )}
    </>
  );
  const className = classes("mcp-view-artifact-row", props.className);

  if (props.onActivate) {
    return (
      <button
        aria-label={props.actionLabel}
        class={className}
        onClick={props.onActivate}
        type="button"
      >
        {content}
      </button>
    );
  }
  return <article class={className}>{content}</article>;
}

function validatePath(items: readonly PathBarItem[], currentId: string): void {
  if (items.length === 0) throw new TypeError("PathBar items must not be empty");
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id.trim()) throw new TypeError("PathBar item ids must be non-empty");
    if (ids.has(item.id)) throw new TypeError(`PathBar item id ${item.id} is duplicated`);
    ids.add(item.id);
  }
  if (!ids.has(currentId)) throw new TypeError("PathBar currentId must identify one item");
}

function validateGaugeRange(
  min: number,
  max: number,
  value: number,
  limit: LimitGaugeLimit | undefined,
): void {
  for (const [name, candidate] of [["min", min], ["max", max], ["value", value]] as const) {
    if (!Number.isFinite(candidate)) throw new TypeError(`LimitGauge ${name} must be finite`);
  }
  if (max <= min) throw new RangeError("LimitGauge max must be greater than min");
  if (value < min || value > max) {
    throw new RangeError("LimitGauge value must be within min and max");
  }
  if (limit === undefined) return;
  if (!Number.isFinite(limit.value)) throw new TypeError("LimitGauge limit must be finite");
  if (limit.value < min || limit.value > max) {
    throw new RangeError("LimitGauge limit must be within min and max");
  }
}

function classes(...values: Array<string | undefined>): string {
  return values.filter(Boolean).join(" ");
}
