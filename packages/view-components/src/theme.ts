/** Shared light-first visual language for composable MCP App components. */

export const MCP_VIEW_THEME_STYLE_ID = "mcp-view-theme";

/** Stable CSS custom-property names available to App-local themes. */
export type McpViewThemeTokens = Readonly<{
  text: "--mcp-view-text";
  muted: "--mcp-view-muted";
  quiet: "--mcp-view-quiet";
  border: "--mcp-view-border";
  panel: "--mcp-view-panel";
  subtle: "--mcp-view-subtle";
  accent: "--mcp-view-accent";
  brand: "--mcp-view-brand";
  success: "--mcp-view-success";
  warning: "--mcp-view-warning";
  danger: "--mcp-view-danger";
  radius: "--mcp-view-radius";
  radiusSmall: "--mcp-view-radius-sm";
  gap: "--mcp-view-gap";
}>;

export const MCP_VIEW_THEME_TOKENS: McpViewThemeTokens = Object.freeze(
  {
    text: "--mcp-view-text",
    muted: "--mcp-view-muted",
    quiet: "--mcp-view-quiet",
    border: "--mcp-view-border",
    panel: "--mcp-view-panel",
    subtle: "--mcp-view-subtle",
    accent: "--mcp-view-accent",
    brand: "--mcp-view-brand",
    success: "--mcp-view-success",
    warning: "--mcp-view-warning",
    danger: "--mcp-view-danger",
    radius: "--mcp-view-radius",
    radiusSmall: "--mcp-view-radius-sm",
    gap: "--mcp-view-gap",
  },
);

export type McpViewThemeToken = McpViewThemeTokens[keyof McpViewThemeTokens];

/**
 * Compact, container-friendly MCP View v2 defaults. Domain components keep
 * their own semantics while sharing tokens, cards, metrics, tables, badges
 * and explicit system states. Every token can be overridden by the host.
 */
export const MCP_VIEW_THEME_CSS: string = String.raw`
:root {
  color-scheme: light dark;
  --mcp-view-text: var(--color-text-primary, #101519);
  --mcp-view-muted: var(--color-text-secondary, #5c6b76);
  --mcp-view-quiet: var(--color-text-tertiary, #7b8894);
  --mcp-view-border: var(--color-border, #dbe3e7);
  --mcp-view-panel: var(--color-background-primary, #ffffff);
  --mcp-view-subtle: var(--color-background-secondary, #f4f7f8);
  --mcp-view-accent: var(--color-accent, #0d7c8a);
  --mcp-view-brand: var(--color-brand, #8a4fa3);
  --mcp-view-success: var(--color-success, #12855f);
  --mcp-view-warning: var(--color-warning, #d98b1f);
  --mcp-view-danger: var(--color-danger, #c9453c);
  --mcp-view-radius: 0.5rem;
  --mcp-view-radius-sm: 0.25rem;
  --mcp-view-gap: 0.65rem;
  color: var(--mcp-view-text);
  font-family: var(
    --font-sans,
    ui-sans-serif,
    system-ui,
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif
  );
}

:root[data-theme="dark"] {
  --mcp-view-text: var(--color-text-primary, #e6ecf0);
  --mcp-view-muted: var(--color-text-secondary, #8895a0);
  --mcp-view-quiet: var(--color-text-tertiary, #5d6a74);
  --mcp-view-border: var(--color-border, #262c33);
  --mcp-view-panel: var(--color-background-primary, #13161a);
  --mcp-view-subtle: var(--color-background-secondary, #1d2329);
  --mcp-view-accent: var(--color-accent, #3ec1cf);
  --mcp-view-brand: var(--color-brand, #b47ec9);
  --mcp-view-success: var(--color-success, #4fbf8b);
  --mcp-view-warning: var(--color-warning, #e0a248);
  --mcp-view-danger: var(--color-danger, #f07067);
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --mcp-view-text: var(--color-text-primary, #e6ecf0);
    --mcp-view-muted: var(--color-text-secondary, #8895a0);
    --mcp-view-quiet: var(--color-text-tertiary, #5d6a74);
    --mcp-view-border: var(--color-border, #262c33);
    --mcp-view-panel: var(--color-background-primary, #13161a);
    --mcp-view-subtle: var(--color-background-secondary, #1d2329);
    --mcp-view-accent: var(--color-accent, #3ec1cf);
    --mcp-view-brand: var(--color-brand, #b47ec9);
    --mcp-view-success: var(--color-success, #4fbf8b);
    --mcp-view-warning: var(--color-warning, #e0a248);
    --mcp-view-danger: var(--color-danger, #f07067);
  }
}

*, *::before, *::after { box-sizing: border-box; }

.mcp-view-surface,
.mcp-view-preact-surface,
.mcp-view-component {
  width: 100%;
  min-width: 0;
}

.mcp-view-surface,
.mcp-view-preact-surface {
  container-type: inline-size;
}

.mcp-view-card {
  min-width: 0;
  padding: 0.85rem;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius);
  background: var(--mcp-view-panel);
}

.mcp-view-card-title {
  margin: 0 0 0.72rem;
  color: var(--mcp-view-text);
  font-size: 0.9rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.mcp-view-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.72rem;
}

.mcp-view-card-heading { min-width: 0; }

.mcp-view-card-header .mcp-view-card-title { margin: 0; }

.mcp-view-card-eyebrow {
  margin: 0 0 0.18rem;
  color: var(--mcp-view-accent);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.mcp-view-card-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.35rem;
  margin-left: auto;
}

.mcp-view-message,
.mcp-view-empty {
  color: var(--mcp-view-muted);
  font-size: 0.82rem;
}

.mcp-view-message {
  padding: 0.55rem 0.65rem;
  border: 1px solid color-mix(in srgb, currentColor 24%, transparent);
  border-radius: var(--mcp-view-radius-sm);
  background: color-mix(in srgb, currentColor 6%, transparent);
}

.mcp-view-message[data-tone="info"] { color: var(--mcp-view-accent); }
.mcp-view-message[data-tone="success"] { color: var(--mcp-view-success); }
.mcp-view-message[data-tone="warning"] { color: var(--mcp-view-warning); }
.mcp-view-message[data-tone="danger"] { color: var(--mcp-view-danger); }

.mcp-view-empty { margin: 0; }

.mcp-view-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
  gap: 0.45rem;
}

.mcp-view-metric {
  display: grid;
  gap: 0.12rem;
  min-width: 0;
  padding: 0.65rem;
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-subtle);
}

.mcp-view-metric-label,
.mcp-view-metric-unit {
  color: var(--mcp-view-muted);
  font-size: 0.68rem;
}

.mcp-view-metric-value {
  overflow-wrap: anywhere;
  font-size: 1.1rem;
  font-variant-numeric: tabular-nums;
}

.mcp-view-metric[data-tone="info"] .mcp-view-metric-value { color: var(--mcp-view-accent); }
.mcp-view-metric[data-tone="success"] .mcp-view-metric-value { color: var(--mcp-view-success); }
.mcp-view-metric[data-tone="warning"] .mcp-view-metric-value { color: var(--mcp-view-warning); }
.mcp-view-metric[data-tone="danger"] .mcp-view-metric-value { color: var(--mcp-view-danger); }

.mcp-view-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.mcp-view-badge {
  padding: 0.2rem 0.45rem;
  border-radius: var(--mcp-view-radius-sm);
  background: color-mix(in srgb, var(--mcp-view-muted) 12%, transparent);
  color: var(--mcp-view-muted);
  font-size: 0.68rem;
  font-weight: 700;
}

.mcp-view-badge[data-tone="info"] {
  background: color-mix(in srgb, var(--mcp-view-accent) 15%, transparent);
  color: var(--mcp-view-accent);
}

.mcp-view-badge[data-tone="success"] {
  background: color-mix(in srgb, var(--mcp-view-success) 15%, transparent);
  color: var(--mcp-view-success);
}

.mcp-view-badge[data-tone="warning"] {
  background: color-mix(in srgb, var(--mcp-view-warning) 15%, transparent);
  color: var(--mcp-view-warning);
}

.mcp-view-badge[data-tone="danger"] {
  background: color-mix(in srgb, var(--mcp-view-danger) 15%, transparent);
  color: var(--mcp-view-danger);
}

.mcp-view-table-wrap {
  max-width: 100%;
  overflow-x: auto;
}

.mcp-view-table {
  width: 100%;
  border-collapse: collapse;
  font: inherit;
  font-size: 0.76rem;
}

.mcp-view-table th,
.mcp-view-table td {
  padding: 0.48rem 0.42rem;
  border-bottom: 1px solid color-mix(in srgb, var(--mcp-view-border) 67%, transparent);
  text-align: left;
  white-space: nowrap;
}

.mcp-view-table [data-align="right"] { text-align: right; }

.mcp-view-table tbody tr[data-interactive="true"] { cursor: pointer; }
.mcp-view-table tbody tr[data-interactive="true"]:hover {
  background: color-mix(in srgb, var(--mcp-view-accent) 8%, transparent);
}
.mcp-view-table tbody tr[data-interactive="true"]:focus-visible {
  outline: 2px solid var(--mcp-view-accent);
  outline-offset: -2px;
}

.mcp-view-selected {
  background: color-mix(in srgb, var(--mcp-view-accent) 18%, transparent);
  outline: 1px solid color-mix(in srgb, var(--mcp-view-accent) 55%, transparent);
  outline-offset: -1px;
}

.mcp-view-cross-selection {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  margin-bottom: 0.65rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--mcp-view-accent) 32%, transparent);
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--mcp-view-accent) 10%, transparent);
  color: var(--mcp-view-muted);
  font-size: 0.75rem;
}

.mcp-view-cross-selection-status {
  margin-left: auto;
  color: var(--mcp-view-warning);
}

.mcp-view-stack { display: grid; gap: var(--mcp-view-gap); }
.mcp-view-stack[data-gap="xs"] { gap: 0.25rem; }
.mcp-view-stack[data-gap="sm"] { gap: 0.45rem; }
.mcp-view-stack[data-gap="lg"] { gap: 1rem; }

.mcp-view-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-width: 0;
  padding: 0.58rem;
  border-radius: 0.5rem;
  background: var(--mcp-view-subtle);
}

.mcp-view-key-values {
  display: grid;
  gap: 0.42rem;
  margin: 0;
}

.mcp-view-key-value {
  display: grid;
  grid-template-columns: minmax(7rem, auto) minmax(0, 1fr);
  gap: 0.75rem;
  padding: 0.58rem;
  border-radius: 0.5rem;
  background: var(--mcp-view-subtle);
}

.mcp-view-key-value dt {
  color: var(--mcp-view-muted);
  font-size: 0.7rem;
}

.mcp-view-key-value dd {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
  text-align: right;
}

.mcp-view-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.mcp-view-text-input {
  min-width: 0;
  min-height: 1.9rem;
  padding: 0.32rem 0.55rem;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius-sm);
  outline: none;
  background: var(--mcp-view-panel);
  color: var(--mcp-view-text);
  font: inherit;
  font-size: 0.75rem;
}
.mcp-view-text-input::placeholder { color: var(--mcp-view-quiet); }
.mcp-view-text-input:focus-visible {
  border-color: var(--mcp-view-accent);
  outline: 2px solid var(--mcp-view-accent);
  outline-offset: 2px;
}
.mcp-view-text-input:disabled { cursor: not-allowed; opacity: 0.5; }

.mcp-view-code-block {
  display: block;
  max-height: 10rem;
  margin: 0;
  padding: 0.65rem 0.75rem;
  overflow: auto;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-subtle);
  color: var(--mcp-view-muted);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.72rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

.mcp-view-inline-code {
  max-width: 100%;
  padding: 0.08rem 0.25rem;
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-subtle);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.88em;
  overflow-wrap: anywhere;
  word-break: break-word;
}

.mcp-view-button {
  min-height: 1.9rem;
  padding: 0.35rem 0.58rem;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-subtle);
  color: var(--mcp-view-text);
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 650;
}

.mcp-view-button:not(:disabled):hover,
.mcp-view-button[aria-pressed="true"] {
  border-color: color-mix(in srgb, var(--mcp-view-accent) 58%, var(--mcp-view-border));
  color: var(--mcp-view-accent);
}

.mcp-view-button:focus-visible {
  border-color: var(--mcp-view-accent);
  color: var(--mcp-view-accent);
  outline: 2px solid var(--mcp-view-accent);
  outline-offset: 2px;
}

.mcp-view-button[aria-pressed="true"] {
  background: color-mix(in srgb, var(--mcp-view-accent) 13%, transparent);
}

.mcp-view-button:disabled { cursor: not-allowed; opacity: 0.5; }

.mcp-view-state {
  display: grid;
  gap: 0.3rem;
  min-height: 4rem;
  place-content: center;
  padding: 1rem;
  border: 1px dashed var(--mcp-view-border);
  border-radius: var(--mcp-view-radius);
  color: var(--mcp-view-muted);
  text-align: center;
}

.mcp-view-state[data-tone="success"] strong { color: var(--mcp-view-success); }
.mcp-view-state[data-tone="warning"] strong { color: var(--mcp-view-warning); }
.mcp-view-state[data-tone="danger"] strong { color: var(--mcp-view-danger); }
.mcp-view-state[data-tone="info"] strong { color: var(--mcp-view-accent); }

.mcp-view-state-busy {
  width: 0.9rem;
  height: 0.9rem;
  justify-self: center;
  border: 2px solid color-mix(in srgb, currentColor 22%, transparent);
  border-block-start-color: currentColor;
  border-radius: 999px;
  color: var(--mcp-view-accent);
  animation: mcp-view-spin 0.8s linear infinite;
}

.mcp-view-state-detail { max-width: 48ch; }

.mcp-view-path-bar {
  min-width: 0;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius);
  background: var(--mcp-view-subtle);
}

.mcp-view-path-bar-list {
  display: flex;
  align-items: center;
  gap: 0;
  min-height: 2.25rem;
  margin: 0;
  padding: 0 0.75rem;
  overflow-x: auto;
  list-style: none;
  scrollbar-width: thin;
}

.mcp-view-path-bar-item {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  white-space: nowrap;
}

.mcp-view-path-bar-item + .mcp-view-path-bar-item::before {
  content: "/";
  margin: 0 0.48rem;
  color: var(--mcp-view-quiet);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.65rem;
}

.mcp-view-path-bar-button {
  padding: 0.22rem 0;
  border: 0;
  background: transparent;
  color: var(--mcp-view-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
}

.mcp-view-path-bar-button:hover { color: var(--mcp-view-accent); }
.mcp-view-path-bar-button:focus-visible {
  border-radius: 0.12rem;
  outline: 2px solid var(--mcp-view-accent);
  outline-offset: 2px;
}

.mcp-view-path-bar-current {
  color: var(--mcp-view-text);
  font-size: 0.72rem;
  font-weight: 650;
}

.mcp-view-limit-gauge {
  --mcp-view-gauge-tone: var(--mcp-view-muted);
  display: grid;
  grid-template-columns: minmax(7rem, auto) minmax(6rem, 1fr) auto;
  grid-template-areas:
    "label track reading"
    ". limit status";
  align-items: center;
  gap: 0.32rem 0.75rem;
  min-width: 0;
}

.mcp-view-limit-gauge[data-tone="info"] { --mcp-view-gauge-tone: var(--mcp-view-accent); }
.mcp-view-limit-gauge[data-tone="success"] { --mcp-view-gauge-tone: var(--mcp-view-success); }
.mcp-view-limit-gauge[data-tone="warning"] { --mcp-view-gauge-tone: var(--mcp-view-warning); }
.mcp-view-limit-gauge[data-tone="danger"] { --mcp-view-gauge-tone: var(--mcp-view-danger); }

.mcp-view-limit-gauge-label { grid-area: label; font-size: 0.75rem; }
.mcp-view-limit-gauge-track { position: relative; grid-area: track; min-width: 0; }
.mcp-view-limit-gauge-reading {
  grid-area: reading;
  color: var(--mcp-view-text);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
.mcp-view-limit-gauge-status {
  grid-area: status;
  color: var(--mcp-view-gauge-tone);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-align: right;
  text-transform: uppercase;
}
.mcp-view-limit-gauge-limit {
  grid-area: limit;
  color: var(--mcp-view-quiet);
  font-size: 0.62rem;
}

.mcp-view-limit-gauge-meter {
  width: 100%;
  height: 0.55rem;
  border: 0;
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-subtle);
  appearance: none;
}
.mcp-view-limit-gauge-meter::-webkit-meter-bar {
  border: 0;
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-subtle);
}
.mcp-view-limit-gauge-meter::-webkit-meter-optimum-value {
  border-radius: var(--mcp-view-radius-sm);
  background: color-mix(in srgb, var(--mcp-view-gauge-tone) 70%, transparent);
}
.mcp-view-limit-gauge-meter::-moz-meter-bar {
  border-radius: var(--mcp-view-radius-sm);
  background: color-mix(in srgb, var(--mcp-view-gauge-tone) 70%, transparent);
}
.mcp-view-limit-gauge-marker {
  position: absolute;
  top: -0.18rem;
  width: 2px;
  height: 0.9rem;
  background: var(--mcp-view-text);
  transform: translateX(-1px);
}

.mcp-view-artifact-row {
  display: grid;
  grid-template-columns: minmax(7rem, auto) minmax(10rem, 1fr) auto;
  align-items: center;
  gap: 0.35rem 0.75rem;
  width: 100%;
  min-width: 0;
  padding: 0.58rem 0.72rem;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius);
  background: var(--mcp-view-panel);
  color: var(--mcp-view-text);
  text-align: left;
}

button.mcp-view-artifact-row {
  cursor: pointer;
  font: inherit;
}
button.mcp-view-artifact-row:hover { border-color: var(--mcp-view-accent); }
button.mcp-view-artifact-row:focus-visible {
  outline: 2px solid var(--mcp-view-accent);
  outline-offset: 2px;
}

.mcp-view-artifact-row-identity {
  display: flex;
  align-items: center;
  gap: 0.42rem;
  min-width: 0;
}
.mcp-view-artifact-row-kind {
  flex: 0 0 auto;
  padding: 0.12rem 0.35rem;
  border-radius: var(--mcp-view-radius-sm);
  background: color-mix(in srgb, var(--mcp-view-accent) 10%, transparent);
  color: var(--mcp-view-accent);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.58rem;
  font-weight: 700;
}
.mcp-view-artifact-row-label { overflow-wrap: anywhere; font-size: 0.75rem; }
.mcp-view-artifact-row-uri,
.mcp-view-artifact-row-fingerprint {
  min-width: 0;
  overflow: hidden;
  color: var(--mcp-view-muted);
  font-size: 0.65rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mcp-view-artifact-row-fingerprint {
  grid-column: 2;
  display: flex;
  gap: 0.35rem;
}
.mcp-view-artifact-row-size {
  grid-column: 3;
  grid-row: 1;
  color: var(--mcp-view-quiet);
  font-size: 0.65rem;
  text-align: right;
}
.mcp-view-artifact-row-verification {
  grid-column: 3;
  color: var(--mcp-view-muted);
  font-size: 0.62rem;
  text-align: right;
}
.mcp-view-artifact-row-verification[data-tone="info"] { color: var(--mcp-view-accent); }
.mcp-view-artifact-row-verification[data-tone="success"] { color: var(--mcp-view-success); }
.mcp-view-artifact-row-verification[data-tone="warning"] { color: var(--mcp-view-warning); }
.mcp-view-artifact-row-verification[data-tone="danger"] { color: var(--mcp-view-danger); }

.mcp-view-semantic-element {
  min-width: 0;
  color: var(--mcp-view-text);
}
.mcp-view-semantic-element[data-density="chip"] {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  width: fit-content;
  max-width: 100%;
  min-height: 1.75rem;
  padding: 0.2rem 0.52rem;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-subtle);
}
.mcp-view-semantic-element[data-density="row"] {
  display: grid;
  grid-template-columns: minmax(8rem, 1.2fr) minmax(5rem, auto) minmax(5rem, auto) auto;
  align-items: center;
  gap: 0.55rem 0.85rem;
  min-height: 2.35rem;
  padding: 0.45rem 0.65rem;
  border-block: 1px solid var(--mcp-view-border);
  background: var(--mcp-view-panel);
}
.mcp-view-semantic-list {
  display: grid;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius);
}
.mcp-view-semantic-list[data-scrollable="true"] {
  max-height: min(22rem, 65cqi);
  overflow: auto;
}
.mcp-view-semantic-list > .mcp-view-semantic-element[data-density="row"] {
  border-inline: 0;
  border-block-start: 0;
}
.mcp-view-semantic-list > .mcp-view-semantic-element[data-density="row"]:last-child {
  border-block-end: 0;
}
.mcp-view-semantic-element[data-density="card"] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem 1rem;
  padding: 0.85rem;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius);
  background: var(--mcp-view-panel);
}
.mcp-view-semantic-element[data-interactive="true"] { cursor: pointer; }
.mcp-view-semantic-element[data-interactive="true"]:hover {
  border-color: var(--mcp-view-accent);
}
.mcp-view-semantic-element[data-interactive="true"]:focus-visible {
  outline: 2px solid var(--mcp-view-accent);
  outline-offset: 2px;
}

.mcp-view-element-ident {
  display: flex;
  align-items: center;
  gap: 0.48rem;
  min-width: 0;
}
.mcp-view-element-ident-marker {
  flex: 0 0 auto;
  color: var(--mcp-view-brand);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.65rem;
  font-weight: 700;
}
.mcp-view-element-ident-copy { display: grid; min-width: 0; gap: 0.08rem; }
.mcp-view-element-ident-label {
  min-width: 0;
  overflow: hidden;
  font-size: 0.76rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mcp-view-element-ident-detail,
.mcp-view-element-reading-label,
.mcp-view-element-reading-detail,
.mcp-view-element-verdict-label,
.mcp-view-element-provenance-label {
  color: var(--mcp-view-quiet);
  font-size: 0.61rem;
}

.mcp-view-element-reading { display: grid; gap: 0.08rem; min-width: 0; }
.mcp-view-element-reading-measure { display: inline-flex; align-items: baseline; gap: 0.24rem; }
.mcp-view-element-reading-value,
.mcp-view-element-reading-unit {
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-variant-numeric: tabular-nums;
}
.mcp-view-element-reading-value { font-size: 0.8rem; }
.mcp-view-element-reading-unit { color: var(--mcp-view-muted); font-size: 0.65rem; }
.mcp-view-element-body { min-width: 0; }

.mcp-view-element-verdict { display: grid; gap: 0.08rem; min-width: 0; }
.mcp-view-element-verdict-value {
  color: var(--mcp-view-muted);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.04em;
}
[data-tone="info"] > .mcp-view-element-verdict .mcp-view-element-verdict-value {
  color: var(--mcp-view-accent);
}
[data-tone="success"] > .mcp-view-element-verdict .mcp-view-element-verdict-value {
  color: var(--mcp-view-success);
}
[data-tone="warning"] > .mcp-view-element-verdict .mcp-view-element-verdict-value {
  color: var(--mcp-view-warning);
}
[data-tone="danger"] > .mcp-view-element-verdict .mcp-view-element-verdict-value {
  color: var(--mcp-view-danger);
}

.mcp-view-element-provenance {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
  color: var(--mcp-view-quiet);
  font-family: var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 0.6rem;
}
.mcp-view-element-provenance-value {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-ident-detail,
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-reading-label,
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-reading-detail,
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-verdict-label,
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-body,
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-provenance {
  display: none;
}
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-ident-label,
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-reading-value {
  font-size: 0.68rem;
}
.mcp-view-semantic-element[data-density="row"] .mcp-view-element-provenance {
  justify-self: end;
}
.mcp-view-semantic-element[data-density="row"] .mcp-view-element-body {
  grid-column: 1 / -1;
}
.mcp-view-semantic-element[data-density="card"] .mcp-view-element-ident {
  grid-column: 1;
}
.mcp-view-semantic-element[data-density="card"] .mcp-view-element-verdict {
  grid-column: 2;
  grid-row: 1;
  text-align: right;
}
.mcp-view-semantic-element[data-density="card"] .mcp-view-element-reading {
  grid-column: 1 / -1;
  padding-block: 0.65rem;
  border-block: 1px solid var(--mcp-view-border);
}
.mcp-view-semantic-element[data-density="card"] .mcp-view-element-body {
  grid-column: 1 / -1;
}
.mcp-view-semantic-element[data-density="card"] .mcp-view-element-reading-value {
  font-size: 1.35rem;
}
.mcp-view-semantic-element[data-density="card"] .mcp-view-element-provenance {
  grid-column: 1 / -1;
}

@container (max-width: 440px) {
  .mcp-view-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mcp-view-row-responsive { align-items: flex-start; flex-direction: column; }
  .mcp-view-card-header { align-items: stretch; flex-direction: column; }
  .mcp-view-card-actions { justify-content: flex-start; }
  .mcp-view-key-value { grid-template-columns: 1fr; gap: 0.2rem; }
  .mcp-view-key-value dd { text-align: left; }
  .mcp-view-limit-gauge {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      "label reading"
      "track track"
      "limit status";
  }
  .mcp-view-artifact-row { grid-template-columns: minmax(0, 1fr) auto; }
  .mcp-view-artifact-row-identity,
  .mcp-view-artifact-row-uri,
  .mcp-view-artifact-row-fingerprint { grid-column: 1; }
  .mcp-view-artifact-row-size,
  .mcp-view-artifact-row-verification { grid-column: 2; }
  .mcp-view-semantic-element[data-density="row"] {
    grid-template-columns: minmax(0, 1fr) auto;
  }
  .mcp-view-semantic-element[data-density="row"] .mcp-view-element-reading,
  .mcp-view-semantic-element[data-density="row"] .mcp-view-element-provenance {
    grid-column: 1 / -1;
  }
  .mcp-view-semantic-element[data-density="row"] .mcp-view-element-provenance {
    justify-self: start;
  }
}

@keyframes mcp-view-spin {
  to { transform: rotate(1turn); }
}

@media (prefers-reduced-motion: reduce) {
  .mcp-view-state-busy { animation: none; }
}
`;

export interface McpViewThemeDocument {
  readonly head: Pick<HTMLElement, "append">;
  getElementById(id: string): HTMLElement | null;
  createElement(tagName: "style"): HTMLStyleElement;
}

/** Install the shared theme once in the current MCP App document. */
export function installMcpViewTheme(
  target: McpViewThemeDocument = document,
): HTMLStyleElement {
  const existing = target.getElementById(MCP_VIEW_THEME_STYLE_ID);
  if (existing) return existing as HTMLStyleElement;

  const style = target.createElement("style");
  style.id = MCP_VIEW_THEME_STYLE_ID;
  style.textContent = MCP_VIEW_THEME_CSS;
  target.head.append(style);
  return style;
}
