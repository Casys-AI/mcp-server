/**
 * Script injector for the resource server.
 *
 * Injects the MCP Apps Bridge client-side script into HTML responses
 * so that the UI can communicate with the host application.
 */

/**
 * Inject the bridge client script tag into an HTML string.
 *
 * The script is inserted just before `</head>` (or `</body>` as fallback,
 * or appended if neither tag is found).
 *
 * @param html - The original HTML content.
 * @param scriptUrl - URL of the bridge client script to inject.
 * @returns The modified HTML with the script tag inserted.
 */
export function injectBridgeScript(html: string, scriptUrl: string): string {
  const scriptTag = `<script src="${escapeAttr(scriptUrl)}"></script>`;

  // Prefer injection before </head>
  const headCloseIdx = html.indexOf("</head>");
  if (headCloseIdx >= 0) {
    return html.slice(0, headCloseIdx) + scriptTag + "\n" + html.slice(headCloseIdx);
  }

  // Fallback: before </body>
  const bodyCloseIdx = html.indexOf("</body>");
  if (bodyCloseIdx >= 0) {
    return html.slice(0, bodyCloseIdx) + scriptTag + "\n" + html.slice(bodyCloseIdx);
  }

  // Last resort: append
  return html + "\n" + scriptTag;
}

/** Escape a string for safe use in an HTML attribute value. */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
