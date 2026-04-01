/**
 * Event bus script generator for cross-UI communication.
 *
 * Generates JavaScript that implements:
 * - JSON-RPC 2.0 message handling via postMessage
 * - `ui/initialize` handshake (MCP Apps protocol)
 * - `ui/compose/event` dedicated cross-UI event routing
 * - `ui/update-model-context` routing per sync rules (legacy)
 * - `ui/notifications/tool-result` forwarding
 * - `ui/message` logging channel
 * - Broadcast support via `to: "*"`
 *
 * @module renderer/js/event-bus
 */

import type { CompositeUiDescriptor } from "../../../core/types/descriptor.ts";
import { COMPOSE_EVENT_METHOD } from "../../../sdk/compose-events.ts";

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
    const COMPOSE_METHOD = '${COMPOSE_EVENT_METHOD}';
    const syncRules = ${JSON.stringify(descriptor.sync)};
    const sharedContext = ${JSON.stringify(descriptor.sharedContext ?? {})};

    // Build slot -> iframe map + reverse lookup
    const iframes = new Map();
    const windowToSlot = new Map();
    document.querySelectorAll('iframe[data-slot]').forEach((iframe) => {
      const slot = parseInt(iframe.dataset.slot, 10);
      iframes.set(slot, iframe);
      if (iframe.contentWindow) windowToSlot.set(iframe.contentWindow, slot);
    });

    function getSlotBySource(source) {
      return windowToSlot.get(source) ?? -1;
    }

    // Acknowledge a JSON-RPC message
    function ack(source, id) {
      source.postMessage({ jsonrpc: '2.0', id, result: {} }, '*');
    }

    // Route an event through sync rules, calling deliver(rule, targetIframe) for each match
    function routeEvent(sourceSlot, eventType, deliver) {
      for (const rule of syncRules) {
        if (rule.from !== sourceSlot) continue;
        if (rule.event !== '*' && rule.event !== eventType) continue;

        const targets = rule.to === '*'
          ? [...iframes.entries()].filter(([s]) => s !== sourceSlot).map(([, iframe]) => iframe)
          : [iframes.get(rule.to)].filter(Boolean);

        for (const target of targets) {
          deliver(rule, target);
        }
      }
    }

    // Send a compose event to an iframe (mcp-compose protocol)
    function sendComposeEvent(iframe, action, data, sourceSlot) {
      iframe.contentWindow?.postMessage({
        jsonrpc: '2.0',
        method: COMPOSE_METHOD,
        params: { action, data, sourceSlot, sharedContext }
      }, '*');
    }

    // Send tool result to an iframe (MCP Apps protocol, legacy)
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

      // Handle ui/initialize - respond with host capabilities (no slot lookup needed)
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

      // Handle ui/message - logging/debugging (no slot routing needed)
      if (msg.method === 'ui/message') {
        const slot = getSlotBySource(e.source);
        console.log('[mcp-compose] UI message from slot', slot, ':', msg.params);
        ack(e.source, msg.id);
        return;
      }

      // Methods below require source slot resolution
      const sourceSlot = getSlotBySource(e.source);

      // Handle ui/compose/event - dedicated cross-UI event routing
      if (msg.method === COMPOSE_METHOD) {
        const eventType = msg.params?.event;

        if (!eventType || typeof eventType !== 'string') {
          console.warn('[mcp-compose] ui/compose/event missing or invalid event name:', msg);
          return;
        }

        routeEvent(sourceSlot, eventType, (rule, target) => {
          sendComposeEvent(target, rule.action, msg.params.data, sourceSlot);
        });

        ack(e.source, msg.id);
        return;
      }

      // Handle ui/update-model-context - route per sync rules (legacy)
      if (msg.method === 'ui/update-model-context') {
        const contextData = msg.params?.structuredContent || msg.params?.content;

        if (!msg.params) {
          console.warn('[mcp-compose] ui/update-model-context missing params:', msg);
        }

        const eventType = contextData?.event || 'update';

        routeEvent(sourceSlot, eventType, (rule, target) => {
          sendToolResult(target, {
            action: rule.action,
            data: contextData,
            sourceSlot,
            sharedContext
          });
        });

        ack(e.source, msg.id);
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
