/**
 * Dashboard template parsing, validation, and arg injection.
 *
 * Templates are YAML files that define which MCP servers to start,
 * which tools to call, and how to arrange the resulting UIs.
 * Runtime args are injected via `{{placeholder}}` syntax.
 *
 * @module runtime/template
 */

import { parse as parseYaml } from "@std/yaml";
import type { DashboardTemplate, McpManifest, TemplateToolCall } from "./types.ts";
import { RuntimeErrorCode } from "./types.ts";
import type { RuntimeError } from "./types.ts";
import { isValidLayout } from "../core/types/layout.ts";

/**
 * Validate a template against available manifests.
 *
 * Checks that each source references an existing manifest
 * and each tool call references a tool in that manifest.
 *
 * @example
 * ```typescript
 * const { valid, errors } = validateTemplate(template, manifests);
 * ```
 */
export function validateTemplate(
  template: DashboardTemplate,
  manifests: Map<string, McpManifest>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!template.name || typeof template.name !== "string") {
    errors.push("Template must have a non-empty 'name'");
  }

  if (!Array.isArray(template.sources) || template.sources.length === 0) {
    errors.push("Template must have at least one source");
  } else {
    for (let i = 0; i < template.sources.length; i++) {
      const source = template.sources[i];
      const manifest = manifests.get(source.manifest);

      if (!manifest) {
        errors.push(
          `sources[${i}].manifest "${source.manifest}" not found in available manifests`,
        );
        continue;
      }

      if (!Array.isArray(source.calls) || source.calls.length === 0) {
        errors.push(`sources[${i}] must have at least one tool call`);
        continue;
      }

      const toolNames = new Set(manifest.tools.map((t) => t.name));
      for (let j = 0; j < source.calls.length; j++) {
        if (!toolNames.has(source.calls[j].tool)) {
          errors.push(
            `sources[${i}].calls[${j}].tool "${source.calls[j].tool}" not found in manifest "${source.manifest}"`,
          );
        }
      }
    }
  }

  if (!template.orchestration || typeof template.orchestration !== "object") {
    errors.push("Template must have an 'orchestration' object");
  } else if (!isValidLayout(template.orchestration.layout)) {
    errors.push(
      `orchestration.layout "${template.orchestration.layout}" is not a valid layout`,
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Parse a YAML string into a DashboardTemplate.
 *
 * @param yaml - Raw YAML string
 * @param filePath - Optional file path for error messages
 * @returns Parsed template
 * @throws RuntimeError on invalid YAML or structure
 *
 * @example
 * ```typescript
 * const template = parseTemplate(`
 *   name: My Dashboard
 *   sources:
 *     - manifest: postgres
 *       calls:
 *         - tool: query
 *   orchestration:
 *     layout: split
 * `);
 * ```
 */
export function parseTemplate(yaml: string, filePath?: string): DashboardTemplate {
  let data: unknown;
  try {
    data = parseYaml(yaml);
  } catch (e) {
    throw {
      code: RuntimeErrorCode.TEMPLATE_PARSE_ERROR,
      message: `Invalid YAML${filePath ? ` in ${filePath}` : ""}: ${e instanceof Error ? e.message : String(e)}`,
    } satisfies RuntimeError;
  }

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw {
      code: RuntimeErrorCode.TEMPLATE_PARSE_ERROR,
      message: `Template must be a YAML object${filePath ? ` (${filePath})` : ""}`,
    } satisfies RuntimeError;
  }

  return data as DashboardTemplate;
}

/**
 * Load a template from a file path.
 *
 * @example
 * ```typescript
 * const template = await loadTemplate("./dashboards/sales.yaml");
 * ```
 */
export async function loadTemplate(path: string): Promise<DashboardTemplate> {
  const yaml = await Deno.readTextFile(path);
  return parseTemplate(yaml, path);
}

/**
 * Inject runtime args into tool call arguments.
 *
 * Replaces `{{key}}` placeholders in string values with the corresponding
 * runtime arg. If the entire value is a `{{key}}` placeholder, the replacement
 * preserves the original type. Partial placeholders produce string concatenation.
 *
 * Does not mutate the input — returns new TemplateToolCall objects.
 *
 * @example
 * ```typescript
 * const calls = [{ tool: "query", args: { id: "{{customer_id}}" } }];
 * const result = injectArgs(calls, { customer_id: "C-123" });
 * // result[0].args.id === "C-123"
 * ```
 */
export function injectArgs(
  calls: TemplateToolCall[],
  args: Record<string, unknown>,
): TemplateToolCall[] {
  return calls.map((call) => {
    if (!call.args) return call;

    const injected: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(call.args)) {
      injected[key] = injectValue(value, args);
    }

    return { ...call, args: injected };
  });
}

/**
 * Inject args into a single value. Handles full and partial placeholders.
 */
function injectValue(value: unknown, args: Record<string, unknown>): unknown {
  if (typeof value !== "string") return value;

  // Full placeholder: "{{key}}" → preserve original type
  const fullMatch = value.match(/^\{\{(\w+)\}\}$/);
  if (fullMatch) {
    const key = fullMatch[1];
    return key in args ? args[key] : value;
  }

  // Partial placeholders: "prefix-{{key}}-suffix" → string interpolation
  return value.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return key in args ? String(args[key]) : `{{${key}}}`;
  });
}
