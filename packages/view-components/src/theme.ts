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
  fontHeading: "--mcp-view-font-heading";
  fontBody: "--mcp-view-font-body";
  fontMono: "--mcp-view-font-mono";
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
    fontHeading: "--mcp-view-font-heading",
    fontBody: "--mcp-view-font-body",
    fontMono: "--mcp-view-font-mono",
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
  --mcp-view-font-heading: var(
    --font-heading,
    "Space Grotesk",
    "Avenir Next",
    "Segoe UI",
    system-ui,
    sans-serif
  );
  --mcp-view-font-body: var(
    --font-body,
    var(
      --font-sans,
      "Work Sans",
      Avenir,
      "Segoe UI",
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      sans-serif
    )
  );
  --mcp-view-font-mono: var(
    --font-mono,
    "JetBrains Mono",
    "SFMono-Regular",
    "Cascadia Code",
    Menlo,
    Consolas,
    ui-monospace,
    monospace
  );
  --mcp-view-radius: 0.5rem;
  --mcp-view-radius-sm: 0.25rem;
  --mcp-view-gap: 0.65rem;
  color: var(--mcp-view-text);
  font-family: var(--mcp-view-font-body);
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
  font-family: var(--mcp-view-font-body);
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
  font-family: var(--mcp-view-font-mono);
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
  font-family: var(--mcp-view-font-mono);
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
  display: flex;
  align-items: center;
  min-width: 0;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius);
  background: var(--mcp-view-subtle);
}

.mcp-view-path-bar-list {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 0;
  min-height: 2.25rem;
  margin: 0;
  padding: 0 0.75rem;
  overflow-x: auto;
  list-style: none;
  scrollbar-width: thin;
}

.mcp-view-path-bar-back + .mcp-view-path-bar-list,
.mcp-view-path-bar-collapsed + .mcp-view-path-bar-list {
  padding-inline-start: 0.3rem;
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
  font-family: var(--mcp-view-font-mono);
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
.mcp-view-collection-card {
  padding: 0;
  overflow: hidden;
}
.mcp-view-collection-card > .mcp-view-card-header {
  margin-bottom: 0;
  padding: 0.65rem 0.85rem;
  border-bottom: 1px solid var(--mcp-view-border);
}
.mcp-view-collection-card > .mcp-view-semantic-list {
  border: 0;
  border-radius: 0;
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
.mcp-view-element-limit-label,
.mcp-view-element-limit-detail,
.mcp-view-element-verdict-label,
.mcp-view-element-provenance-label {
  color: var(--mcp-view-quiet);
  font-size: 0.61rem;
}

.mcp-view-element-reading { display: grid; gap: 0.08rem; min-width: 0; }
.mcp-view-element-reading-measure { display: inline-flex; align-items: baseline; gap: 0.24rem; }
.mcp-view-element-reading-value,
.mcp-view-element-reading-unit {
  font-variant-numeric: tabular-nums;
}
.mcp-view-element-reading-value { font-size: 0.8rem; }
.mcp-view-element-reading-unit { color: var(--mcp-view-muted); font-size: 0.65rem; }
.mcp-view-element-limit {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
  padding-inline-start: 0.55rem;
  border-inline-start: 1px solid var(--mcp-view-border);
}
.mcp-view-element-limit-statement {
  display: inline-flex;
  align-items: baseline;
  gap: 0.28rem;
  min-width: 0;
}
.mcp-view-element-limit-operator {
  display: inline-grid;
  min-width: 1.2rem;
  min-height: 1.2rem;
  place-items: center;
  padding-inline: 0.18rem;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-subtle);
  color: var(--mcp-view-muted);
  font-size: 0.68rem;
  line-height: 1;
}
.mcp-view-element-limit-value,
.mcp-view-element-limit-unit {
  font-variant-numeric: tabular-nums;
}
.mcp-view-element-limit-value { font-size: 0.95rem; }
.mcp-view-element-limit-unit { color: var(--mcp-view-muted); font-size: 0.65rem; }
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
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-limit-label,
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-limit-detail,
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-verdict-label,
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-body,
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-provenance {
  display: none;
}
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-ident-label,
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-reading-value,
.mcp-view-semantic-element[data-density="chip"] .mcp-view-element-limit-value {
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
.mcp-view-semantic-element[data-density="card"] .mcp-view-element-limit {
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
.mcp-view-semantic-element[data-density="card"] .mcp-view-element-limit-value {
  font-size: 1.35rem;
}
.mcp-view-semantic-element[data-density="card"] .mcp-view-element-provenance {
  grid-column: 1 / -1;
}

.mcp-view-path-bar-back,
.mcp-view-path-bar-collapsed-summary {
  display: inline-grid;
  min-width: 1.5rem;
  min-height: 1.5rem;
  place-items: center;
  margin-inline-start: 0.35rem;
  padding-inline: 0.25rem;
  border: 0;
  border-radius: var(--mcp-view-radius-sm);
  background: none;
  color: var(--mcp-view-accent);
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  list-style: none;
}
.mcp-view-path-bar-back:hover,
.mcp-view-path-bar-collapsed-summary:hover {
  background: color-mix(in srgb, var(--mcp-view-accent) 12%, transparent);
}
.mcp-view-path-bar-back:focus-visible,
.mcp-view-path-bar-collapsed-summary:focus-visible {
  outline: 2px solid var(--mcp-view-accent);
  outline-offset: 2px;
}
.mcp-view-path-bar-collapsed-summary::-webkit-details-marker { display: none; }
.mcp-view-path-bar-collapsed { position: relative; }
.mcp-view-path-bar-kept {
  position: absolute;
  z-index: 2;
  inset-inline-start: 0;
  display: grid;
  gap: 0.1rem;
  min-width: 13rem;
  margin: 0.3rem 0 0;
  padding: 0.3rem;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius);
  background: var(--mcp-view-panel);
  list-style: none;
}
.mcp-view-path-bar-kept-button {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.05rem 0.45rem;
  width: 100%;
  padding: 0.32rem 0.42rem;
  border: 0;
  border-radius: var(--mcp-view-radius-sm);
  background: none;
  color: var(--mcp-view-text);
  cursor: pointer;
  font: inherit;
  text-align: left;
}
.mcp-view-path-bar-kept-button:hover { background: var(--mcp-view-subtle); }
.mcp-view-path-bar-kept-button:focus-visible {
  outline: 2px solid var(--mcp-view-accent);
  outline-offset: -2px;
}
.mcp-view-path-bar-kept-rank {
  grid-row: 1 / span 2;
  align-self: center;
  color: var(--mcp-view-quiet);
  font-size: 0.6rem;
}
.mcp-view-path-bar-kept-label { font-size: 0.72rem; }
.mcp-view-path-bar-kept-detail { color: var(--mcp-view-quiet); font-size: 0.6rem; }

.mcp-view-drill-hint {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.16rem 0.32rem;
  border: 0;
  border-radius: var(--mcp-view-radius-sm);
  background: none;
  color: var(--mcp-view-accent);
  font: inherit;
  font-size: 0.72rem;
}
button.mcp-view-drill-hint { cursor: pointer; }
button.mcp-view-drill-hint:hover {
  background: color-mix(in srgb, var(--mcp-view-accent) 12%, transparent);
}
button.mcp-view-drill-hint:focus-visible {
  outline: 2px solid var(--mcp-view-accent);
  outline-offset: 2px;
}
.mcp-view-drill-hint[data-degraded="true"] {
  padding-inline: 0;
  color: var(--mcp-view-muted);
}
.mcp-view-drill-hint-label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.mcp-view-drill-hint-glyph { font-size: 0.8rem; line-height: 1; }
.mcp-view-drill-hint[data-direction="to-model"] { color: var(--mcp-view-brand); }
.mcp-view-drill-hint[data-direction="to-model"][data-degraded="true"] {
  color: var(--mcp-view-muted);
}

.mcp-view-type-badge {
  display: inline-grid;
  place-items: center;
  padding: 0.1rem 0.38rem;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius-sm);
  color: var(--mcp-view-quiet);
  font-size: 0.6rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.mcp-view-type-badge[data-kind="chart"] { color: var(--mcp-view-accent); }
.mcp-view-type-badge[data-kind="record"] { color: var(--mcp-view-brand); }

.mcp-view-stale-banner {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.42rem 0.7rem;
  border: 1px solid var(--mcp-view-border);
  border-inline-start: 3px solid var(--mcp-view-muted);
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-subtle);
  color: var(--mcp-view-muted);
  font-size: 0.68rem;
}
.mcp-view-stale-banner[data-tone="info"] { border-inline-start-color: var(--mcp-view-accent); }
.mcp-view-stale-banner[data-tone="success"] { border-inline-start-color: var(--mcp-view-success); }
.mcp-view-stale-banner[data-tone="warning"] { border-inline-start-color: var(--mcp-view-warning); }
.mcp-view-stale-banner[data-tone="danger"] { border-inline-start-color: var(--mcp-view-danger); }
.mcp-view-stale-banner-message { min-width: 0; flex: 1 1 auto; }
.mcp-view-stale-banner-action {
  flex: 0 0 auto;
  padding: 0.2rem 0.5rem;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-panel);
  color: var(--mcp-view-accent);
  cursor: pointer;
  font: inherit;
  font-size: 0.66rem;
}
.mcp-view-stale-banner-action:hover { border-color: var(--mcp-view-accent); }
.mcp-view-stale-banner-action:focus-visible {
  outline: 2px solid var(--mcp-view-accent);
  outline-offset: 2px;
}

.mcp-view-slot-3d {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  justify-items: center;
}
.mcp-view-slot-3d-frame {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 4rem;
  border-radius: var(--mcp-view-radius);
}
.mcp-view-slot-3d[data-reserved="true"] .mcp-view-slot-3d-frame {
  border: 1px dashed var(--mcp-view-border);
  background: var(--mcp-view-subtle);
}
.mcp-view-slot-3d-mark {
  width: 1.6rem;
  height: 1.6rem;
  border: 1px solid var(--mcp-view-quiet);
  border-radius: var(--mcp-view-radius-sm);
  opacity: 0.55;
  transform: rotate(45deg);
}
.mcp-view-slot-3d-status { color: var(--mcp-view-quiet); font-size: 0.6rem; }

.mcp-view-tree-list,
.mcp-view-tree-list-group {
  display: grid;
  gap: 0.05rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.mcp-view-tree-list-row {
  display: flex;
  align-items: center;
  gap: 0.42rem;
  min-width: 0;
  padding: 0.24rem 0.4rem;
  border-radius: var(--mcp-view-radius-sm);
}
.mcp-view-tree-list-row:hover { background: var(--mcp-view-subtle); }
.mcp-view-tree-list-item[aria-selected="true"] > .mcp-view-tree-list-row {
  background: color-mix(in srgb, var(--mcp-view-accent) 10%, transparent);
}
.mcp-view-tree-list-twisty {
  display: inline-grid;
  flex: 0 0 auto;
  width: 1.1rem;
  height: 1.1rem;
  place-items: center;
  border: 0;
  border-radius: var(--mcp-view-radius-sm);
  background: none;
  color: var(--mcp-view-muted);
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  line-height: 1;
}
.mcp-view-tree-list-twisty[data-empty="true"] { cursor: default; }
.mcp-view-tree-list-twisty:focus-visible {
  outline: 2px solid var(--mcp-view-accent);
  outline-offset: 1px;
}
.mcp-view-tree-list-type {
  flex: 0 0 auto;
  padding: 0.08rem 0.32rem;
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-subtle);
  color: var(--mcp-view-quiet);
  font-size: 0.58rem;
}
.mcp-view-tree-list-label {
  min-width: 0;
  overflow: hidden;
  padding: 0;
  border: 0;
  background: none;
  color: var(--mcp-view-text);
  font: inherit;
  font-size: 0.73rem;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}
button.mcp-view-tree-list-label { cursor: pointer; }
button.mcp-view-tree-list-label:hover { color: var(--mcp-view-accent); }
button.mcp-view-tree-list-label:focus-visible {
  outline: 2px solid var(--mcp-view-accent);
  outline-offset: 2px;
}
.mcp-view-tree-list-detail {
  color: var(--mcp-view-muted);
  font-size: 0.65rem;
  font-variant-numeric: tabular-nums;
}
.mcp-view-tree-list-coverage {
  margin-inline-start: auto;
  color: var(--mcp-view-quiet);
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
}
.mcp-view-tree-list-coverage[data-tone="info"] { color: var(--mcp-view-accent); }
.mcp-view-tree-list-coverage[data-tone="success"] { color: var(--mcp-view-success); }
.mcp-view-tree-list-coverage[data-tone="warning"] { color: var(--mcp-view-warning); }
.mcp-view-tree-list-coverage[data-tone="danger"] { color: var(--mcp-view-danger); }

.mcp-view-sparkline {
  width: 3.6rem;
  height: 0.9rem;
  overflow: visible;
  color: var(--mcp-view-accent);
}
.mcp-view-sparkline[data-tone="neutral"] { color: var(--mcp-view-muted); }
.mcp-view-sparkline[data-tone="success"] { color: var(--mcp-view-success); }
.mcp-view-sparkline[data-tone="warning"] { color: var(--mcp-view-warning); }
.mcp-view-sparkline[data-tone="danger"] { color: var(--mcp-view-danger); }
.mcp-view-sparkline-line {
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.3;
}

.mcp-view-series-chart { display: grid; gap: 0.35rem; margin: 0; min-width: 0; }
.mcp-view-series-chart-plot {
  width: 100%;
  height: 6.5rem;
  overflow: visible;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius);
  background: var(--mcp-view-panel);
}
.mcp-view-series-chart-baseline {
  stroke: var(--mcp-view-border);
  stroke-dasharray: 3 3;
  stroke-width: 1;
}
.mcp-view-series-chart-cursor {
  stroke: var(--mcp-view-quiet);
  stroke-width: 1;
}
.mcp-view-series-chart-line {
  fill: none;
  stroke: var(--mcp-view-accent);
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 1.4;
}
.mcp-view-series-chart-line[data-tone="neutral"] { stroke: var(--mcp-view-muted); }
.mcp-view-series-chart-line[data-tone="success"] { stroke: var(--mcp-view-success); }
.mcp-view-series-chart-line[data-tone="warning"] { stroke: var(--mcp-view-warning); }
.mcp-view-series-chart-line[data-tone="danger"] { stroke: var(--mcp-view-danger); }
.mcp-view-series-chart-bars line {
  stroke: var(--mcp-view-accent);
  stroke-linecap: butt;
  stroke-width: 3;
}
.mcp-view-series-chart-bars[data-tone="neutral"] line { stroke: var(--mcp-view-muted); }
.mcp-view-series-chart-bars[data-tone="success"] line { stroke: var(--mcp-view-success); }
.mcp-view-series-chart-bars[data-tone="warning"] line { stroke: var(--mcp-view-warning); }
.mcp-view-series-chart-bars[data-tone="danger"] line { stroke: var(--mcp-view-danger); }
.mcp-view-series-chart-axis {
  display: flex;
  justify-content: space-between;
  color: var(--mcp-view-quiet);
  font-size: 0.6rem;
}
.mcp-view-series-chart-readout {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  flex-wrap: wrap;
  padding: 0.32rem 0.5rem;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-subtle);
}
.mcp-view-series-chart-readout-position { color: var(--mcp-view-text); font-size: 0.66rem; }
.mcp-view-series-chart-readout-values {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin: 0;
}
.mcp-view-series-chart-readout-value { display: flex; align-items: baseline; gap: 0.3rem; }
.mcp-view-series-chart-readout-value dt {
  color: var(--mcp-view-accent);
  font-size: 0.62rem;
}
.mcp-view-series-chart-readout-value dt[data-tone="neutral"] { color: var(--mcp-view-muted); }
.mcp-view-series-chart-readout-value dt[data-tone="success"] { color: var(--mcp-view-success); }
.mcp-view-series-chart-readout-value dt[data-tone="warning"] { color: var(--mcp-view-warning); }
.mcp-view-series-chart-readout-value dt[data-tone="danger"] { color: var(--mcp-view-danger); }
.mcp-view-series-chart-readout-value dd {
  margin: 0;
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
}
.mcp-view-series-chart-summary {
  display: flex;
  gap: 0.9rem;
  flex-wrap: wrap;
  color: var(--mcp-view-muted);
  font-size: 0.62rem;
}
.mcp-view-series-chart-summary-item { display: inline-flex; align-items: baseline; gap: 0.3rem; }
.mcp-view-series-chart-summary-label { color: var(--mcp-view-quiet); }
.mcp-view-series-chart-summary-value {
  color: var(--mcp-view-text);
  font-variant-numeric: tabular-nums;
}

.mcp-view-interval-plot { display: grid; gap: 0.3rem; min-width: 0; }
.mcp-view-interval-plot-scale {
  position: relative;
  display: flex;
  justify-content: center;
  min-height: 0.85rem;
}
.mcp-view-interval-plot-zero {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: var(--mcp-view-quiet);
}
.mcp-view-interval-plot-zero-label {
  position: absolute;
  padding-inline-start: 0.4rem;
  color: var(--mcp-view-quiet);
  font-size: 0.6rem;
  white-space: nowrap;
}
.mcp-view-interval-plot-row {
  display: grid;
  grid-template-columns: minmax(2.5rem, auto) minmax(0, 1fr) minmax(5rem, auto);
  align-items: center;
  gap: 0.5rem;
}
.mcp-view-interval-plot-label { color: var(--mcp-view-text); font-size: 0.68rem; }
.mcp-view-interval-plot-track {
  position: relative;
  display: block;
  height: 0.85rem;
  border-radius: var(--mcp-view-radius-sm);
  background: var(--mcp-view-subtle);
}
.mcp-view-interval-plot-box {
  position: absolute;
  top: 0.12rem;
  bottom: 0.12rem;
  min-width: 2px;
  border-radius: 1px;
  background: color-mix(in srgb, var(--mcp-view-muted) 45%, transparent);
}
.mcp-view-interval-plot-row[data-tone="info"] .mcp-view-interval-plot-box {
  background: color-mix(in srgb, var(--mcp-view-accent) 45%, transparent);
}
.mcp-view-interval-plot-row[data-tone="success"] .mcp-view-interval-plot-box {
  background: color-mix(in srgb, var(--mcp-view-success) 45%, transparent);
}
.mcp-view-interval-plot-row[data-tone="warning"] .mcp-view-interval-plot-box {
  background: color-mix(in srgb, var(--mcp-view-warning) 45%, transparent);
}
.mcp-view-interval-plot-row[data-tone="danger"] .mcp-view-interval-plot-box {
  background: color-mix(in srgb, var(--mcp-view-danger) 45%, transparent);
}
.mcp-view-interval-plot-bounds {
  display: flex;
  justify-content: space-between;
  gap: 0.4rem;
  color: var(--mcp-view-muted);
  font-size: 0.62rem;
  font-variant-numeric: tabular-nums;
}
.mcp-view-interval-plot-lower { text-align: left; }
.mcp-view-interval-plot-upper { text-align: right; }

.mcp-view-skeleton {
  display: grid;
  gap: 0.42rem;
  padding: 0.85rem;
  border: 1px solid var(--mcp-view-border);
  border-radius: var(--mcp-view-radius);
  background: var(--mcp-view-panel);
}
.mcp-view-skeleton-line {
  height: 0.62rem;
  border-radius: var(--mcp-view-radius-sm);
  background-color: var(--mcp-view-subtle);
  background-image: linear-gradient(
    90deg,
    var(--mcp-view-subtle) 0%,
    color-mix(in srgb, var(--mcp-view-border) 60%, var(--mcp-view-subtle)) 50%,
    var(--mcp-view-subtle) 100%
  );
  background-size: 220% 100%;
  animation: mcp-view-sheen 1.5s ease-in-out infinite;
}
.mcp-view-skeleton-line:first-child { width: 45%; }
.mcp-view-skeleton-line:last-child { width: 72%; }

/*
 * Type is role-based so a provider can theme the whole kit without coupling
 * presentation components to a particular font delivery mechanism. Keep the
 * role layer after component-local font shorthands so it remains authoritative.
 */
.mcp-view-card-title,
.mcp-view-metric-value,
.mcp-view-state > strong,
.mcp-view-element-reading-value,
.mcp-view-element-reading-unit,
.mcp-view-element-limit-value,
.mcp-view-element-limit-unit,
.mcp-view-series-chart-readout-value dd,
.mcp-view-series-chart-summary-value {
  font-family: var(--mcp-view-font-heading);
}

.mcp-view-card-eyebrow,
.mcp-view-metric-label,
.mcp-view-metric-unit,
.mcp-view-metric-detail,
.mcp-view-badge,
.mcp-view-table th,
.mcp-view-table [data-align="right"],
.mcp-view-key-value dt,
.mcp-view-key-value dd,
.mcp-view-button,
.mcp-view-cross-selection-label,
.mcp-view-cross-selection-status,
.mcp-view-path-bar-list,
.mcp-view-limit-gauge-reading,
.mcp-view-limit-gauge-status,
.mcp-view-limit-gauge-limit,
.mcp-view-artifact-row-kind,
.mcp-view-artifact-row-uri,
.mcp-view-artifact-row-fingerprint,
.mcp-view-artifact-row-fingerprint code,
.mcp-view-artifact-row-size,
.mcp-view-artifact-row-verification,
.mcp-view-element-ident-marker,
.mcp-view-element-ident-detail,
.mcp-view-element-reading-label,
.mcp-view-element-reading-detail,
.mcp-view-element-limit-label,
.mcp-view-element-limit-detail,
.mcp-view-element-limit-operator,
.mcp-view-element-verdict-label,
.mcp-view-element-verdict-value,
.mcp-view-element-provenance,
.mcp-view-path-bar-kept-rank,
.mcp-view-path-bar-kept-detail,
.mcp-view-drill-hint-glyph,
.mcp-view-type-badge,
.mcp-view-stale-banner,
.mcp-view-slot-3d-status,
.mcp-view-tree-list-type,
.mcp-view-tree-list-detail,
.mcp-view-tree-list-coverage,
.mcp-view-series-chart-axis,
.mcp-view-series-chart-readout-position,
.mcp-view-series-chart-readout-value dt,
.mcp-view-series-chart-summary-label,
.mcp-view-interval-plot-label,
.mcp-view-interval-plot-bounds,
.mcp-view-interval-plot-zero-label {
  font-family: var(--mcp-view-font-mono);
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
  .mcp-view-semantic-element[data-density="row"] .mcp-view-element-limit,
  .mcp-view-semantic-element[data-density="row"] .mcp-view-element-provenance {
    grid-column: 1 / -1;
  }
  .mcp-view-semantic-element[data-density="row"] .mcp-view-element-provenance {
    justify-self: start;
  }
  .mcp-view-series-chart-readout { align-items: flex-start; flex-direction: column; }
  .mcp-view-interval-plot-row {
    grid-template-columns: minmax(0, 1fr) minmax(5rem, auto);
  }
  .mcp-view-interval-plot-track { grid-column: 1 / -1; grid-row: 2; }
}

@keyframes mcp-view-spin {
  to { transform: rotate(1turn); }
}

@keyframes mcp-view-sheen {
  from { background-position: 130% 0; }
  to { background-position: -30% 0; }
}

@media (prefers-reduced-motion: reduce) {
  .mcp-view-state-busy { animation: none; }
  .mcp-view-skeleton-line { animation: none; }
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
