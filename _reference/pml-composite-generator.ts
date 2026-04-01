/**
 * Composite UI Generator
 *
 * Generates composite HTML layouts from collected UI resources.
 * Implements PML's innovation: declarative event routing between UI components
 * via sync rules defined in capability metadata.
 *
 * Key features:
 * - Layout modes: split, tabs, grid, stack
 * - Event bus for cross-UI communication via postMessage
 * - MCP Apps Protocol (SEP-1865) compliant
 * - Pure functions, no side effects
 *
 * @module ui/composite-generator
 * @see Story 16.4: Composite UI Generator
 */

import type {
  CollectedUiResource,
  CompositeUiDescriptor,
  ResolvedSyncRule,
  UiLayout,
  UiOrchestration,
} from "../types/ui-orchestration.ts";
import { uuidv7 } from "../utils/uuid.ts";

/**
 * Build a composite UI descriptor from collected resources.
 *
 * Resolves tool names in sync rules to slot indices based on the order
 * of collected resources. Generates a unique workflow ID for the composite.
 *
 * @param resources - UI resources collected during execution
 * @param orchestration - Optional orchestration config from capability
 * @returns Composite UI descriptor for rendering
 *
 * @example Basic usage
 * ```typescript
 * const resources: CollectedUiResource[] = [
 *   { source: "postgres:query", resourceUri: "ui://postgres/table/1", slot: 0 },
 *   { source: "viz:render", resourceUri: "ui://viz/chart/2", slot: 1 },
 * ];
 * const orchestration: UiOrchestration = {
 *   layout: "split",
 *   sync: [{ from: "postgres:query", event: "filter", to: "viz:render", action: "update" }],
 * };
 *
 * const descriptor = buildCompositeUi(resources, orchestration);
 * // descriptor.sync[0].from === 0 (resolved from "postgres:query")
 * // descriptor.sync[0].to === 1 (resolved from "viz:render")
 * ```
 */
export function buildCompositeUi(
  resources: CollectedUiResource[],
  orchestration?: UiOrchestration,
): CompositeUiDescriptor {
  const workflowId = uuidv7();

  // Build source → slot mapping for sync rule resolution
  const toolToSlot = new Map<string, number>();
  for (const resource of resources) {
    toolToSlot.set(resource.source, resource.slot);
  }

  // Resolve sync rules: tool names → slot indices
  const resolvedSync: ResolvedSyncRule[] = (orchestration?.sync ?? []).map(
    (rule) => ({
      from: toolToSlot.get(rule.from) ?? 0,
      event: rule.event,
      to: rule.to === "*" ? "*" : (toolToSlot.get(rule.to) ?? 0),
      action: rule.action,
    }),
  );

  // Extract shared context from collected UI resources
  const sharedContext = extractSharedContext(resources, orchestration?.sharedContext);

  return {
    type: "composite",
    resourceUri: `ui://pml/workflow/${workflowId}`,
    layout: orchestration?.layout ?? "stack",
    children: resources,
    sync: resolvedSync,
    sharedContext,
  };
}

/**
 * Extract shared context values from collected UI resources.
 *
 * @param resources - Collected UI resources with optional context
 * @param keys - Keys to extract from each resource's context
 * @returns Merged shared context object, or undefined if no keys specified
 */
function extractSharedContext(
  resources: CollectedUiResource[],
  keys?: string[],
): Record<string, unknown> | undefined {
  if (!keys || keys.length === 0) {
    return undefined;
  }

  const sharedContext: Record<string, unknown> = {};

  for (const resource of resources) {
    if (!resource.context) continue;

    for (const key of keys) {
      if (key in resource.context && !(key in sharedContext)) {
        sharedContext[key] = resource.context[key];
      }
    }
  }

  return Object.keys(sharedContext).length > 0 ? sharedContext : undefined;
}

/**
 * Get base CSS with theme variables for light/dark mode support.
 *
 * @returns CSS string with theme variables
 */
function getBaseCss(): string {
  return `
    :root {
      --pml-border-color: #e0e0e0;
      --pml-bg-secondary: #f5f5f5;
      --pml-bg-primary: #ffffff;
      --pml-bg-hover: #e8e8e8;
      --pml-accent-color: #1a73e8;
    }
    body.dark {
      --pml-border-color: #3a3a3a;
      --pml-bg-secondary: #2a2a2a;
      --pml-bg-primary: #1a1a1a;
      --pml-bg-hover: #3a3a3a;
      --pml-accent-color: #8ab4f8;
    }
    @media (prefers-color-scheme: dark) {
      :root:not(.light) {
        --pml-border-color: #3a3a3a;
        --pml-bg-secondary: #2a2a2a;
        --pml-bg-primary: #1a1a1a;
        --pml-bg-hover: #3a3a3a;
        --pml-accent-color: #8ab4f8;
      }
    }
  `;
}

/**
 * Get CSS for the specified layout mode.
 *
 * @param layout - Layout mode (split, tabs, grid, stack)
 * @returns CSS string for the layout
 */
function getLayoutCss(layout: UiLayout): string {
  switch (layout) {
    case "split":
      return `
        .layout-split { display: flex; height: 100vh; }
        .layout-split > iframe { flex: 1; border: none; }
      `;
    case "tabs":
      return `
        .layout-tabs { height: 100vh; display: flex; flex-direction: column; }
        .tab-bar { display: flex; border-bottom: 1px solid var(--pml-border-color); background: var(--pml-bg-secondary); }
        .tab { padding: 12px 24px; cursor: pointer; border: none; background: transparent; font-size: 14px; color: inherit; }
        .tab:hover { background: var(--pml-bg-hover); }
        .tab.active { background: var(--pml-bg-primary); border-bottom: 2px solid var(--pml-accent-color); }
        .tab-content { flex: 1; position: relative; }
        .layout-tabs iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; display: none; }
        .layout-tabs iframe.active { display: block; }
      `;
    case "grid":
      return `
        .layout-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          grid-auto-rows: 1fr;
          gap: 8px;
          height: 100vh;
          padding: 8px;
          box-sizing: border-box;
        }
        .layout-grid > iframe { border: 1px solid var(--pml-border-color); border-radius: 4px; width: 100%; height: 100%; }
      `;
    case "stack":
      return `
        .layout-stack { display: flex; flex-direction: column; height: 100vh; }
        .layout-stack > iframe { flex: 1; border: none; border-bottom: 1px solid var(--pml-border-color); min-height: 200px; }
        .layout-stack > iframe:last-child { border-bottom: none; }
      `;
    default:
      return "";
  }
}

/**
 * Generate the JavaScript event bus script.
 *
 * The event bus:
 * - Responds to ui/initialize from child iframes (MCP Apps protocol)
 * - Routes ui/update-model-context messages per sync rules
 * - Handles broadcast (to: "*") by forwarding to all except sender
 * - Sends tool results via ui/notifications/tool-result
 *
 * @param descriptor - Composite UI descriptor with sync rules
 * @returns JavaScript code string for inline script tag
 */
function generateEventBusScript(descriptor: CompositeUiDescriptor): string {
  const tabSwitchingCode = descriptor.layout === "tabs"
    ? `
    // Tab switching logic
    const tabs = document.querySelectorAll('.tab');
    const tabIframes = document.querySelectorAll('.tab-content iframe');

    function switchTab(slot) {
      tabs.forEach((t, i) => t.classList.toggle('active', i === slot));
      tabIframes.forEach((iframe, i) => iframe.classList.toggle('active', i === slot));
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => switchTab(i));
    });

    // Show first tab by default
    if (tabs.length > 0) switchTab(0);
  `
    : "";

  return `
    // PML Event Bus - MCP Apps Protocol compliant
    const syncRules = ${JSON.stringify(descriptor.sync)};
    const sharedContext = ${JSON.stringify(descriptor.sharedContext ?? {})};

    // Build slot → iframe map
    const iframes = new Map();
    document.querySelectorAll('iframe[data-slot]').forEach((iframe) => {
      const slot = parseInt(iframe.dataset.slot, 10);
      iframes.set(slot, iframe);
    });

    // Find slot by iframe contentWindow
    function getSlotBySource(source) {
      for (const [slot, iframe] of iframes.entries()) {
        if (iframe.contentWindow === source) return slot;
      }
      return -1;
    }

    // Send tool result to an iframe (MCP Apps protocol)
    function sendToolResult(iframe, data) {
      iframe.contentWindow?.postMessage({
        jsonrpc: '2.0',
        method: 'ui/notifications/tool-result',
        params: {
          content: [{ type: 'text', text: JSON.stringify(data) }],
          isError: false
        }
      }, '*');
    }

    // Listen for messages from child UIs
    window.addEventListener('message', (e) => {
      const msg = e.data;

      // Skip non-object messages silently (browser extensions, etc.)
      if (!msg || typeof msg !== 'object') return;

      // Warn about malformed JSON-RPC messages for debugging
      if (msg.jsonrpc !== '2.0') {
        if (msg.method || msg.id) {
          console.warn('[PML Composite] Malformed JSON-RPC message (missing jsonrpc: "2.0"):', msg);
        }
        return;
      }

      const sourceSlot = getSlotBySource(e.source);

      // Handle ui/initialize - respond with host capabilities
      if (msg.method === 'ui/initialize') {
        e.source.postMessage({
          jsonrpc: '2.0',
          id: msg.id,
          result: {
            protocolVersion: '2026-01-26',
            hostInfo: { name: 'PML Composite UI', version: '1.0.0' },
            hostCapabilities: {
              openLinks: {},
              logging: {},
              updateModelContext: { text: {} },
              message: { text: {} }
            },
            hostContext: {
              theme: document.body.classList.contains('dark') ? 'dark' : 'light',
              displayMode: 'inline',
              sharedContext
            }
          }
        }, '*');
        return;
      }

      // Handle ui/update-model-context - route to other UIs per sync rules
      if (msg.method === 'ui/update-model-context') {
        const contextData = msg.params?.structuredContent || msg.params?.content;

        // Warn if params is missing
        if (!msg.params) {
          console.warn('[PML Composite] ui/update-model-context missing params:', msg);
        }

        // Extract event type from context (convention: { event: "filter", ... })
        const eventType = contextData?.event || 'update';

        // Find matching sync rules and route
        for (const rule of syncRules) {
          if (rule.from !== sourceSlot) continue;
          if (rule.event !== '*' && rule.event !== eventType) continue;

          // Determine target(s)
          const targets = rule.to === '*'
            ? [...iframes.entries()].filter(([s]) => s !== sourceSlot).map(([, iframe]) => iframe)
            : [iframes.get(rule.to)].filter(Boolean);

          // Forward to targets via MCP Apps protocol with shared context
          for (const target of targets) {
            sendToolResult(target, {
              action: rule.action,
              data: contextData,
              sourceSlot,
              sharedContext
            });
          }
        }

        // Acknowledge the request
        e.source.postMessage({ jsonrpc: '2.0', id: msg.id, result: {} }, '*');
        return;
      }

      // Handle ui/message - for debugging/logging
      if (msg.method === 'ui/message') {
        console.log('[PML Composite] UI message from slot', sourceSlot, ':', msg.params);
        e.source.postMessage({ jsonrpc: '2.0', id: msg.id, result: {} }, '*');
        return;
      }

      // Warn about unknown methods for debugging
      if (msg.method) {
        console.warn('[PML Composite] Unknown method:', msg.method);
      }
    });
    ${tabSwitchingCode}
  `;
}

/**
 * Generate HTML for the tabs layout bar.
 *
 * @param children - Child resources to create tabs for
 * @returns HTML string for tab bar
 */
function generateTabBar(children: CollectedUiResource[]): string {
  const tabButtons = children
    .map(
      (child, i) =>
        `<button class="tab${
          i === 0 ? " active" : ""
        }" data-slot="${child.slot}">${child.source}</button>`,
    )
    .join("\n        ");

  return `
    <div class="tab-bar">
      ${tabButtons}
    </div>
  `;
}

/**
 * Generate composite HTML from a descriptor.
 *
 * Produces a self-contained HTML document with:
 * - CSS for the specified layout mode (with dark mode support via CSS variables)
 * - Iframes for each child UI with data attributes
 * - JavaScript event bus for cross-UI communication
 * - Shared context injection for all child UIs
 *
 * The generated HTML is compatible with Claude, ChatGPT, VS Code, Goose,
 * and Postman clients (standard HTML5/CSS3/ES6 only).
 *
 * **Security Note:** Iframes use `sandbox="allow-scripts allow-same-origin"`.
 * `allow-same-origin` is required for postMessage communication but also
 * allows child UIs to access the composite's localStorage. This is intentional
 * for shared state but should be considered in security-sensitive contexts.
 *
 * @param descriptor - Composite UI descriptor to render
 * @returns Complete HTML document string
 *
 * @example
 * ```typescript
 * const descriptor = buildCompositeUi(resources, { layout: "split" });
 * const html = generateCompositeHtml(descriptor);
 * // html is a complete HTML document ready to render
 * ```
 */
export function generateCompositeHtml(descriptor: CompositeUiDescriptor): string {
  const baseCss = getBaseCss();
  const layoutCss = getLayoutCss(descriptor.layout);

  // Generate iframes with proper attributes
  // Security: sandbox="allow-scripts allow-same-origin" enables postMessage
  // but also localStorage access. This is intentional for shared context.
  const iframeHtml = (child: CollectedUiResource): string => `
      <iframe
        id="ui-${child.slot}"
        src="${child.resourceUri}"
        data-slot="${child.slot}"
        data-source="${child.source}"
        sandbox="allow-scripts allow-same-origin"
      ></iframe>`;

  // Handle different layout structures
  let bodyContent: string;

  if (descriptor.layout === "tabs") {
    // Handle empty children case for tabs layout
    if (descriptor.children.length === 0) {
      bodyContent = `
  <div class="layout-tabs" id="container">
    <div class="tab-bar"></div>
    <div class="tab-content">
      <p style="padding: 20px; color: var(--pml-border-color);">No UI components available.</p>
    </div>
  </div>`;
    } else {
      const iframesHtml = descriptor.children
        .map(
          (child, i) =>
            `<iframe
          id="ui-${child.slot}"
          class="${i === 0 ? "active" : ""}"
          src="${child.resourceUri}"
          data-slot="${child.slot}"
          data-source="${child.source}"
          sandbox="allow-scripts allow-same-origin"
        ></iframe>`,
        )
        .join("\n      ");

      bodyContent = `
  <div class="layout-tabs" id="container">
    ${generateTabBar(descriptor.children)}
    <div class="tab-content">
      ${iframesHtml}
    </div>
  </div>`;
    }
  } else {
    const iframesHtml = descriptor.children.map(iframeHtml).join("\n    ");
    bodyContent = `
  <div class="layout-${descriptor.layout}" id="container">
    ${iframesHtml}
  </div>`;
  }

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PML Composite UI</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--pml-bg-primary); color: inherit; }
    ${baseCss}
    ${layoutCss}
  </style>
</head>
<body>
  ${bodyContent}
  <script>
    ${generateEventBusScript(descriptor)}
  </script>
</body>
</html>`;
}
