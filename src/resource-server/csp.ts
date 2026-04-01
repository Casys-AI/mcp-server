/**
 * Content Security Policy helpers for the resource server.
 *
 * Generates CSP headers that allow the MCP App UI to function within
 * platform WebViews while maintaining security.
 */

/** Options for generating a CSP header. */
export interface CspOptions {
  /** Additional allowed script sources (e.g. platform SDK URLs). */
  readonly scriptSources?: readonly string[];
  /** Additional allowed connect sources (e.g. API endpoints). */
  readonly connectSources?: readonly string[];
  /** Additional allowed frame ancestors. */
  readonly frameAncestors?: readonly string[];
  /**
   * If true, use `'unsafe-inline'` for scripts and styles (default).
   * If false, only external scripts/styles from `'self'` are allowed.
   * Use `false` when the MCP App HTML has no inline `<script>` or `<style>` tags.
   */
  readonly allowInline?: boolean;
}

/**
 * Build a Content-Security-Policy header value.
 *
 * Uses `default-src 'none'` as the base (deny-all), then explicitly allows
 * only what MCP App UIs need:
 * - Scripts from `'self'` (+ `'unsafe-inline'` if `allowInline` is true)
 * - Connections to `'self'` (+ custom sources for APIs/WebSocket)
 * - Styles from `'self'` (+ `'unsafe-inline'` if `allowInline` is true)
 * - Images from `'self'` and `data:`
 * - Fonts from `'self'`
 * - Frame ancestors from `'self'` (+ custom for platform embedding)
 * - `base-uri 'self'` to prevent base tag injection
 */
export function buildCspHeader(options: CspOptions = {}): string {
  const allowInline = options.allowInline !== false; // default true for backwards compat
  const inlineDirective = allowInline ? " 'unsafe-inline'" : "";

  const scriptSrc = [`'self'${inlineDirective}`, ...(options.scriptSources ?? [])].join(" ");
  const connectSrc = ["'self'", ...(options.connectSources ?? [])].join(" ");
  const frameAncestors = ["'self'", ...(options.frameAncestors ?? [])].join(" ");

  return [
    `default-src 'none'`,
    `script-src ${scriptSrc}`,
    `style-src 'self'${inlineDirective}`,
    `img-src 'self' data:`,
    `font-src 'self'`,
    `connect-src ${connectSrc}`,
    `frame-ancestors ${frameAncestors}`,
    `base-uri 'self'`,
  ].join("; ");
}
