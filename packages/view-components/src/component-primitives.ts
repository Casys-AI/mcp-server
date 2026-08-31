/** Small, framework-neutral UI components reusable across MCP Apps. */

import {
  defineViewComponent,
  type ViewComponentDefinition,
  type ViewComponentDescriptor,
  type ViewComponentEventPorts,
  type ViewComponentMountContext,
} from "./components.ts";
import { installMcpViewTheme } from "./theme.ts";

export type ComponentTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface StatusComponentValue {
  readonly label: string;
  readonly detail?: string;
  readonly tone?: ComponentTone;
}

export interface MetricComponentValue {
  readonly id: string;
  readonly label: string;
  readonly value: string | number;
  readonly unit?: string;
  readonly detail?: string;
}

export interface KeyValueComponentValue {
  readonly key: string;
  readonly label: string;
  readonly value: string | number | boolean | null;
}

interface PrimitiveConfig<TData, TValue> {
  readonly title: string;
  readonly description?: string;
  readonly events?: ViewComponentEventPorts;
  readonly select: (data: TData) => TValue;
}

/** One compact status block with a semantic tone and optional detail. */
export function defineStatusComponent<TData, TAppContext = unknown>(
  config: PrimitiveConfig<TData, StatusComponentValue>,
): ViewComponentDefinition<TData, TAppContext> {
  return defineViewComponent<TData, TAppContext>({
    descriptor: descriptor(config),
    mount(target, context) {
      const value = config.select(context.data);
      installMcpViewTheme(target.ownerDocument);
      target.dataset.primitive = "status";
      target.dataset.tone = value.tone ?? "neutral";
      const label = element("strong", value.label);
      label.style.fontSize = "1rem";
      target.append(label);
      if (value.detail) target.append(element("span", value.detail));
      applyCard(target);
      target.style.display = "flex";
      target.style.alignItems = "center";
      target.style.justifyContent = "space-between";
      target.style.gap = "0.75rem";
      target.classList.add("mcp-view-card", "mcp-view-row");
    },
  });
}

/** Responsive metric cards; formatting remains owned by the domain selector. */
export function defineMetricGridComponent<TData, TAppContext = unknown>(
  config: PrimitiveConfig<TData, readonly MetricComponentValue[]>,
): ViewComponentDefinition<TData, TAppContext> {
  return defineViewComponent<TData, TAppContext>({
    descriptor: descriptor(config),
    mount(target, context) {
      installMcpViewTheme(target.ownerDocument);
      target.dataset.primitive = "metric-grid";
      target.classList.add("mcp-view-metrics");
      target.style.display = "grid";
      target.style.gridTemplateColumns = "repeat(auto-fit, minmax(9rem, 1fr))";
      target.style.gap = "0.5rem";
      for (const metric of config.select(context.data)) {
        const card = document.createElement("article");
        card.dataset.metric = metric.id;
        applyCard(card);
        card.classList.add("mcp-view-metric");
        const label = element("span", metric.label);
        label.classList.add("mcp-view-metric-label");
        label.style.fontSize = "0.75rem";
        label.style.opacity = "0.72";
        const value = element("strong", String(metric.value));
        value.classList.add("mcp-view-metric-value");
        value.style.fontSize = "1.25rem";
        value.style.overflowWrap = "anywhere";
        card.append(label, value);
        if (metric.unit) {
          const unit = element("span", metric.unit);
          unit.classList.add("mcp-view-metric-unit");
          card.append(unit);
        }
        if (metric.detail) {
          const detail = element("small", metric.detail);
          detail.style.opacity = "0.72";
          card.append(detail);
        }
        card.style.display = "grid";
        card.style.gap = "0.2rem";
        target.append(card);
      }
    },
  });
}

/** Semantic definition list for provenance, identity, and other compact facts. */
export function defineKeyValueComponent<TData, TAppContext = unknown>(
  config: PrimitiveConfig<TData, readonly KeyValueComponentValue[]>,
): ViewComponentDefinition<TData, TAppContext> {
  return defineViewComponent<TData, TAppContext>({
    descriptor: descriptor(config),
    mount(target, context) {
      installMcpViewTheme(target.ownerDocument);
      target.dataset.primitive = "key-value";
      const list = document.createElement("dl");
      list.style.display = "grid";
      list.style.gridTemplateColumns = "minmax(7rem, auto) minmax(0, 1fr)";
      list.style.gap = "0.4rem 0.75rem";
      list.style.margin = "0";
      for (const item of config.select(context.data)) {
        const term = element("dt", item.label);
        term.dataset.key = item.key;
        term.style.opacity = "0.72";
        const detail = element("dd", item.value === null ? "—" : String(item.value));
        detail.style.margin = "0";
        detail.style.overflowWrap = "anywhere";
        list.append(term, detail);
      }
      target.append(list);
      applyCard(target);
    },
  });
}

/** A custom component factory with the same descriptor convention as primitives. */
export function defineCustomComponent<TData, TAppContext = unknown>(config: {
  readonly title: string;
  readonly description?: string;
  readonly events?: ViewComponentEventPorts;
  readonly mount: (
    target: HTMLElement,
    context: ViewComponentMountContext<TData, TAppContext>,
  ) => ReturnType<
    ReturnType<typeof defineViewComponent<TData, TAppContext>>["mount"]
  >;
}): ViewComponentDefinition<TData, TAppContext> {
  return defineViewComponent<TData, TAppContext>({
    descriptor: descriptor(config),
    mount: config.mount,
  });
}

function descriptor(config: {
  readonly title: string;
  readonly description?: string;
  readonly events?: ViewComponentEventPorts;
}): ViewComponentDescriptor {
  return {
    title: config.title,
    ...(config.description ? { description: config.description } : {}),
    ...(config.events ? { events: config.events } : {}),
  };
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  text: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.textContent = text;
  return node;
}

function applyCard(target: HTMLElement): void {
  target.classList.add("mcp-view-card");
  target.style.padding = "0.75rem";
  target.style.border = "1px solid var(--color-border, rgba(127, 127, 127, 0.28))";
  target.style.borderRadius = "0.5rem";
  target.style.background = "var(--color-background-secondary, rgba(127, 127, 127, 0.08))";
  target.style.minWidth = "0";
}
