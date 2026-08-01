/** Shared visual language for composable MCP views. */

export const MCP_VIEW_THEME_STYLE_ID = "mcp-view-theme";

/**
 * Compact, container-friendly defaults extracted from the ERPNext component
 * viewer. Domain components keep their own semantics while sharing tokens,
 * cards, metrics, tables, badges and system states.
 */
export const MCP_VIEW_THEME_CSS = String.raw`
:root {
  color-scheme: light dark;
  --mcp-view-text: var(--color-text-primary, #f4efe7);
  --mcp-view-muted: var(--color-text-secondary, #a99c8f);
  --mcp-view-border: var(--color-border, rgba(150, 135, 120, 0.24));
  --mcp-view-panel: var(--color-background-secondary, rgba(34, 30, 26, 0.92));
  --mcp-view-subtle: rgba(128, 112, 95, 0.09);
  --mcp-view-accent: var(--color-accent, #e49a53);
  --mcp-view-success: var(--color-success, #62d99a);
  --mcp-view-warning: var(--color-warning, #f6c453);
  --mcp-view-danger: var(--color-danger, #ef7b72);
  --mcp-view-radius: 0.75rem;
  --mcp-view-gap: 0.65rem;
  color: var(--mcp-view-text);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
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
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.12);
}

.mcp-view-card-title {
  margin: 0 0 0.72rem;
  color: var(--mcp-view-muted);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.mcp-view-message,
.mcp-view-empty {
  color: var(--mcp-view-muted);
  font-size: 0.82rem;
}

.mcp-view-message {
  padding: 1rem;
  border: 1px dashed color-mix(in srgb, currentColor 25%, transparent);
  border-radius: 0.6rem;
}

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
  border-radius: 0.55rem;
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
}

.mcp-view-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.mcp-view-badge {
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--mcp-view-success) 15%, transparent);
  color: var(--mcp-view-success);
  font-size: 0.68rem;
  font-weight: 700;
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
  text-align: right;
  white-space: nowrap;
}

.mcp-view-table th:first-child,
.mcp-view-table td:first-child { text-align: left; }

.mcp-view-table tbody tr { cursor: pointer; }
.mcp-view-table tbody tr:hover { background: color-mix(in srgb, var(--mcp-view-accent) 8%, transparent); }

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

.mcp-view-stack { display: grid; gap: 0.42rem; }

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

@container (max-width: 440px) {
  .mcp-view-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .mcp-view-row-responsive { align-items: flex-start; flex-direction: column; }
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
