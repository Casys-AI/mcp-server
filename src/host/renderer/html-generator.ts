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
 * @returns Complete HTML document string
 *
 * @example
 * ```typescript
 * const descriptor = buildCompositeUi(resources, { layout: "split" });
 * const html = renderComposite(descriptor);
 * // html is a complete HTML document ready to serve
 * ```
 */
export function renderComposite(descriptor: CompositeUiDescriptor): string {
  const baseCss = getBaseCss();
  const layoutCss = getLayoutCss(descriptor.layout);
  const bodyContent = generateBodyContent(descriptor);
  const eventBusScript = generateEventBusScript(descriptor);

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

function generateBodyContent(descriptor: CompositeUiDescriptor): string {
  if (isLayoutAreas(descriptor.layout)) {
    return generateAreasLayout(descriptor);
  }

  if (descriptor.layout === "tabs") {
    return generateTabsLayout(descriptor);
  }

  const iframesHtml = descriptor.children.map((c) => generateIframe(c)).join("\n    ");
  return `<div class="layout-${descriptor.layout}" id="container">
    ${iframesHtml}
  </div>`;
}

function generateAreasLayout(descriptor: CompositeUiDescriptor): string {
  const areaMap = descriptor.areaMap ?? {};
  const iframesHtml = descriptor.children
    .map((child) => {
      const area = areaMap[child.source] ?? child.source;
      return `<iframe
        id="ui-${child.slot}"
        src="${escapeAttr(child.resourceUri)}"
        data-slot="${child.slot}"
        data-source="${escapeAttr(child.source)}"
        data-area="${escapeAttr(area)}"

      ></iframe>`;
    })
    .join("\n    ");

  return `<div class="layout-areas" id="container">
    ${iframesHtml}
  </div>`;
}

function generateTabsLayout(descriptor: CompositeUiDescriptor): string {
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
          src="${escapeAttr(child.resourceUri)}"
          data-slot="${child.slot}"
          data-source="${escapeAttr(child.source)}"
  
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

function generateIframe(child: CollectedUiResource): string {
  return `<iframe
        id="ui-${child.slot}"
        src="${escapeAttr(child.resourceUri)}"
        data-slot="${child.slot}"
        data-source="${escapeAttr(child.source)}"

      ></iframe>`;
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
