/**
 * OpenTelemetry Integration for @casys/mcp-server
 *
 * Provides tracing for tool calls, auth, and middleware pipeline.
 *
 * Enable with:
 * - Deno: OTEL_DENO=true deno run --unstable-otel ...
 * - Node.js: OTEL_ENABLED=true node ...
 *
 * @module lib/server/observability/otel
 */

import {
  type Span,
  SpanStatusCode,
  trace,
  type Tracer,
} from "@opentelemetry/api";
import { env } from "../runtime/runtime.ts";

let serverTracer: Tracer | null = null;

/**
 * Get or create the MCP server tracer
 */
export function getServerTracer(): Tracer {
  if (!serverTracer) {
    serverTracer = trace.getTracer("mcp.server", "0.8.0");
  }
  return serverTracer;
}

/**
 * Span attributes for MCP tool calls
 */
export interface ToolCallSpanAttributes {
  "mcp.tool.name": string;
  "mcp.server.name"?: string;
  "mcp.transport"?: string;
  "mcp.session.id"?: string;
  "mcp.auth.subject"?: string;
  "mcp.auth.client_id"?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Start a span for a tool call.
 * Caller MUST call span.end() when done.
 */
export function startToolCallSpan(
  toolName: string,
  attributes: ToolCallSpanAttributes,
): Span {
  const tracer = getServerTracer();
  return tracer.startSpan(`mcp.tool.call ${toolName}`, { attributes });
}

/**
 * Record a tool call result on a span and end it.
 */
export function endToolCallSpan(
  span: Span,
  success: boolean,
  durationMs: number,
  error?: string,
): void {
  span.setAttribute("mcp.tool.duration_ms", durationMs);
  span.setAttribute("mcp.tool.success", success);

  if (error) {
    span.setAttribute("mcp.tool.error", error);
    span.recordException(new Error(error));
  }

  span.setStatus({
    code: success ? SpanStatusCode.OK : SpanStatusCode.ERROR,
    message: error,
  });
  span.end();
}

/**
 * Record an auth event as a fire-and-forget span.
 */
export function recordAuthEvent(
  event: "verify" | "reject" | "cache_hit",
  attributes: Record<string, string | number | boolean | undefined>,
): void {
  const tracer = getServerTracer();
  tracer.startActiveSpan(`mcp.auth.${event}`, { attributes }, (span) => {
    span.setStatus({
      code: event === "reject" ? SpanStatusCode.ERROR : SpanStatusCode.OK,
    });
    span.end();
  });
}

/**
 * Check if OTEL is enabled.
 * Deno: OTEL_DENO=true  |  Node.js: OTEL_ENABLED=true
 */
export function isOtelEnabled(): boolean {
  try {
    return env("OTEL_DENO") === "true" || env("OTEL_ENABLED") === "true";
  } catch {
    // Deno without --allow-env throws NotCapable
    return false;
  }
}
