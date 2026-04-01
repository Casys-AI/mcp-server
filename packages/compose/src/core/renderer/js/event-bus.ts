/**
 * Event bus script generator for cross-UI communication.
 *
 * Generates JavaScript that implements:
 * - JSON-RPC 2.0 message handling via postMessage
 * - `ui/initialize` handshake (MCP Apps protocol)
 * - `ui/update-model-context` routing per sync rules
 * - `ui/notifications/tool-result` forwarding
 * - `ui/message` logging channel
 * - Broadcast support via `to: "*"`
 *
 * @module renderer/js/event-bus
 */

import type { CompositeUiDescriptor } from "../../types/descriptor.ts";

/**
 * Generate the event bus JavaScript for a composite UI.
 *
 * @param descriptor - Composite UI descriptor with sync rules
 * @returns JavaScript code string for inline `<script>` tag
 *
 * @example
 * ```typescript
 * const js = generateEventBusScript(descriptor);
 * // js contains postMessage handler with sync rule routing
 * ```
 */
export function generateEventBusScript(descriptor: CompositeUiDescriptor): string {
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

    if (tabs.length > 0) switchTab(0);
  `
    : "";

  return `
    // mcp-compose Event Bus - MCP Apps Protocol compliant
    const syncRules = ${JSON.stringify(descriptor.sync)};
    const sharedContext = ${JSON.stringify(descriptor.sharedContext ?? {})};

    // Build slot -> iframe map
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

      // Warn about malformed JSON-RPC messages
      if (msg.jsonrpc !== '2.0') {
        if (msg.method || msg.id) {
          console.warn('[mcp-compose] Malformed JSON-RPC message (missing jsonrpc: "2.0"):', msg);
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
            hostInfo: { name: 'mcp-compose', version: '0.1.0' },
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

      // Handle ui/update-model-context - route per sync rules
      if (msg.method === 'ui/update-model-context') {
        const contextData = msg.params?.structuredContent || msg.params?.content;

        if (!msg.params) {
          console.warn('[mcp-compose] ui/update-model-context missing params:', msg);
        }

        // Extract event type (convention: { event: "filter", ... })
        const eventType = contextData?.event || 'update';

        // Find matching sync rules and route
        for (const rule of syncRules) {
          if (rule.from !== sourceSlot) continue;
          if (rule.event !== '*' && rule.event !== eventType) continue;

          const targets = rule.to === '*'
            ? [...iframes.entries()].filter(([s]) => s !== sourceSlot).map(([, iframe]) => iframe)
            : [iframes.get(rule.to)].filter(Boolean);

          for (const target of targets) {
            sendToolResult(target, {
              action: rule.action,
              data: contextData,
              sourceSlot,
              sharedContext
            });
          }
        }

        // Acknowledge
        e.source.postMessage({ jsonrpc: '2.0', id: msg.id, result: {} }, '*');
        return;
      }

      // Handle ui/message - logging/debugging
      if (msg.method === 'ui/message') {
        console.log('[mcp-compose] UI message from slot', sourceSlot, ':', msg.params);
        e.source.postMessage({ jsonrpc: '2.0', id: msg.id, result: {} }, '*');
        return;
      }

      // Warn about unknown methods
      if (msg.method) {
        console.warn('[mcp-compose] Unknown method:', msg.method);
      }
    });
    ${tabSwitchingCode}
  `;
}
