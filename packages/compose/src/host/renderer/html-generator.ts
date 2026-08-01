/**
 * HTML generator — renders a CompositeUiDescriptor to a self-contained HTML document.
 *
 * @module renderer/html-generator
 */

import type { CompositeUiDescriptor } from "../../core/types/descriptor.ts";
import type { CollectedUiResource } from "../../core/types/resources.ts";
import { isLayoutAreas } from "../../core/types/layout.ts";
import { getBaseCss } from "./css/base.ts";
import { getLayoutCss } from "./css/layouts.ts";
import { generateEventBusScript } from "./js/event-bus.ts";
import type {
  RenderCompositeOptions,
  RendererSlotOptions,
  ResolvedRendererSlotOptions,
} from "./options.ts";

/**
 * Interactive App panels run scripts, but intentionally receive no forms,
 * popups, downloads, or top-level navigation permissions. A local multi-App
 * host assigns each panel its own origin before using this policy, so
 * `allow-same-origin` restores a verifiable MessageEvent.origin without making
 * the child same-origin with the dashboard parent or sibling panels.
 */
const DEFAULT_IFRAME_SANDBOX = "allow-scripts allow-same-origin";

/**
 * Generate a self-contained HTML document from a composite UI descriptor.
 *
 * Produces valid HTML5 with:
 * - Layout CSS for the specified mode (split/tabs/grid/stack)
 * - Dark/light theme support via CSS variables
 * - Iframes for each child UI with `data-slot` and `data-source` attributes
 * - JavaScript event bus for cross-UI communication (JSON-RPC 2.0)
 *
 * @param descriptor - Composite UI descriptor from `buildCompositeUi`
 * @param options - Optional browser-host bridge configuration. With no options,
 *   child `resourceUri` values remain the iframe source and no server proxy
 *   capabilities are advertised.
 * @returns Complete HTML document string
 *
 * @example
 * ```typescript
 * const descriptor = buildCompositeUi(resources, { layout: "split" });
 * const html = renderComposite(descriptor);
 * // html is a complete HTML document ready to serve
 * ```
 */
export function renderComposite(
  descriptor: CompositeUiDescriptor,
  options: RenderCompositeOptions = {},
): string {
  const baseCss = getBaseCss();
  const layoutCss = getLayoutCss(descriptor.layout);
  const slots = resolveRendererSlots(descriptor, options);
  const bodyContent = generateBodyContent(descriptor, slots);
  const eventBusScript = generateEventBusScript(descriptor, slots);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>mcp-compose</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--mcc-bg-primary); color: inherit; }
    ${baseCss}
    ${layoutCss}
  </style>
</head>
<body>
  ${bodyContent}
  <script>
    ${eventBusScript}
  </script>
</body>
</html>`;
}

function generateBodyContent(
  descriptor: CompositeUiDescriptor,
  slots: ReadonlyMap<number, ResolvedRendererSlotOptions>,
): string {
  if (isLayoutAreas(descriptor.layout)) {
    return generateAreasLayout(descriptor, slots);
  }

  if (descriptor.layout === "tabs") {
    return generateTabsLayout(descriptor, slots);
  }

  const iframesHtml = descriptor.children
    .map((child) => generateIframe(child, slots.get(child.slot)))
    .join("\n    ");
  return `<div class="layout-${descriptor.layout}" id="container">
    ${iframesHtml}
  </div>`;
}

function generateAreasLayout(
  descriptor: CompositeUiDescriptor,
  slots: ReadonlyMap<number, ResolvedRendererSlotOptions>,
): string {
  const areaMap = descriptor.areaMap ?? {};
  const iframesHtml = descriptor.children
    .map((child) => {
      const componentId = child.componentId ?? child.source;
      const area = areaMap[componentId] ?? componentId;
      const slot = slots.get(child.slot);
      return `<iframe
        id="ui-${child.slot}"
        src="${escapeAttr(slot?.iframeSrc ?? child.resourceUri)}"
        data-slot="${child.slot}"
        data-source="${escapeAttr(child.source)}"
        data-component-id="${escapeAttr(componentId)}"
        data-area="${escapeAttr(area)}"
${generateSandboxAttribute(slot)}
      ></iframe>`;
    })
    .join("\n    ");

  return `<div class="layout-areas" id="container">
    ${iframesHtml}
  </div>`;
}

function generateTabsLayout(
  descriptor: CompositeUiDescriptor,
  slots: ReadonlyMap<number, ResolvedRendererSlotOptions>,
): string {
  if (descriptor.children.length === 0) {
    return `<div class="layout-tabs" id="container">
    <div class="tab-bar"></div>
    <div class="tab-content">
      <p style="padding: 20px; color: var(--mcc-border-color);">No UI components available.</p>
    </div>
  </div>`;
  }

  const tabButtons = descriptor.children
    .map(
      (child, i) =>
        `<button class="tab${i === 0 ? " active" : ""}" data-slot="${child.slot}">${
          escapeHtml(child.source)
        }</button>`,
    )
    .join("\n        ");

  const iframesHtml = descriptor.children
    .map(
      (child, i) =>
        `<iframe
          id="ui-${child.slot}"
          class="${i === 0 ? "active" : ""}"
          src="${escapeAttr(slots.get(child.slot)?.iframeSrc ?? child.resourceUri)}"
          data-slot="${child.slot}"
          data-source="${escapeAttr(child.source)}"
          data-component-id="${escapeAttr(child.componentId ?? child.source)}"
${generateSandboxAttribute(slots.get(child.slot))}
        ></iframe>`,
    )
    .join("\n      ");

  return `<div class="layout-tabs" id="container">
    <div class="tab-bar">
      ${tabButtons}
    </div>
    <div class="tab-content">
      ${iframesHtml}
    </div>
  </div>`;
}

function generateIframe(
  child: CollectedUiResource,
  slot?: ResolvedRendererSlotOptions,
): string {
  return `<iframe
        id="ui-${child.slot}"
        src="${escapeAttr(slot?.iframeSrc ?? child.resourceUri)}"
        data-slot="${child.slot}"
        data-source="${escapeAttr(child.source)}"
        data-component-id="${escapeAttr(child.componentId ?? child.source)}"
${generateSandboxAttribute(slot)}
      ></iframe>`;
}

function generateSandboxAttribute(slot?: ResolvedRendererSlotOptions): string {
  return slot?.sandbox === undefined ? "" : `        sandbox="${escapeAttr(slot.sandbox)}"`;
}

/**
 * Resolve pure renderer options into one serialisable record per descriptor
 * child. This does not inspect the network or make runtime assumptions.
 */
export function resolveRendererSlots(
  descriptor: CompositeUiDescriptor,
  options: RenderCompositeOptions = {},
): ReadonlyMap<number, ResolvedRendererSlotOptions> {
  const apiBasePath = normalizeApiBasePath(options.apiBasePath);
  const slots = new Map<number, ResolvedRendererSlotOptions>();

  for (const child of descriptor.children) {
    const configured = options.slots?.[child.slot];
    const hasSlotConfiguration = hasOwn(options.slots, child.slot);
    const hasGlobalSandboxConfiguration = hasOwn(options, "iframeSandbox");
    const serverTools = configured?.capabilities?.serverTools === true;
    const serverResources = configured?.capabilities?.serverResources === true;
    const needsProxy = serverTools || serverResources;
    const sandbox = resolveSandbox(
      configured,
      options.iframeSandbox,
      hasSlotConfiguration || hasGlobalSandboxConfiguration,
    );

    slots.set(child.slot, {
      componentId: child.componentId ?? child.source,
      surface: child.surface,
      iframeSrc: configured?.iframeSrc ?? child.resourceUri,
      expectedOrigin: normalizeExpectedOrigin(configured?.expectedOrigin),
      sandbox,
      rpcEndpoint: needsProxy
        ? configured?.rpcEndpoint ?? `${apiBasePath}/${child.slot}/mcp`
        : undefined,
      serverTools,
      serverResources,
      hasInitialToolResult: hasOwn(configured, "initialToolResult"),
      initialToolResult: configured?.initialToolResult,
    });
  }

  return slots;
}

/**
 * Convert an expected origin URL to the exact serialized origin accepted by
 * `Window.postMessage`. Reject opaque and non-HTTP origins: an interactive
 * host cannot use them to distinguish a child document after navigation.
 */
function normalizeExpectedOrigin(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new TypeError(
      `Renderer slot expectedOrigin must be an absolute HTTP(S) origin, got ${
        JSON.stringify(value)
      }`,
    );
  }

  if ((url.protocol !== "http:" && url.protocol !== "https:") || url.origin === "null") {
    throw new TypeError(
      `Renderer slot expectedOrigin must be an absolute HTTP(S) origin, got ${
        JSON.stringify(value)
      }`,
    );
  }

  return url.origin;
}

function normalizeApiBasePath(value: string | undefined): string {
  const basePath = value ?? "/api/slots";
  const normalized = basePath.replace(/\/+$/, "");
  return normalized || "/api/slots";
}

function resolveSandbox(
  slot: RendererSlotOptions | undefined,
  defaultSandbox: string | false | undefined,
  enabled: boolean,
): string | undefined {
  if (!enabled) return undefined;
  const requested = slot?.sandbox ?? defaultSandbox ?? DEFAULT_IFRAME_SANDBOX;
  return requested === false ? undefined : requested;
}

function hasOwn(
  value: object | undefined,
  key: PropertyKey,
): boolean {
  return value !== undefined && Object.prototype.hasOwnProperty.call(value, key);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
