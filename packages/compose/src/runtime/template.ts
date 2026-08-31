/**
 * Dashboard template parsing, validation, and arg injection.
 *
 * Canonical agent-authored templates are JSON. YAML remains supported for existing human-authored
 * dashboards. Both define which MCP servers to start, which tools to call, and how to arrange the
 * resulting UIs.
 * Runtime args are injected via `{{placeholder}}` syntax.
 *
 * @module runtime/template
 */

import { parse as parseYaml } from "@std/yaml";
import type { DashboardTemplate, McpManifest, TemplateSource, TemplateToolCall } from "./types.ts";
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
    const componentIds = new Map<string, string>();
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
      const occurrences = new Map<string, number>();
      for (const call of source.calls) {
        occurrences.set(call.tool, (occurrences.get(call.tool) ?? 0) + 1);
      }
      for (let j = 0; j < source.calls.length; j++) {
        const call = source.calls[j];
        if (!toolNames.has(call.tool)) {
          errors.push(
            `sources[${i}].calls[${j}].tool "${call.tool}" not found in manifest "${source.manifest}"`,
          );
        }
        if ((occurrences.get(call.tool) ?? 0) > 1 && !call.id) {
          errors.push(
            `sources[${i}].calls[${j}] repeats tool "${call.tool}" and requires a stable 'id'`,
          );
        }

        const componentId = resolveTemplateComponentId(source, i, call, j);
        const previous = componentIds.get(componentId);
        if (previous) {
          errors.push(
            `Duplicate component id "${componentId}" at sources[${i}].calls[${j}]; already used by ${previous}`,
          );
        } else {
          componentIds.set(componentId, `sources[${i}].calls[${j}]`);
        }
        validateSurface(
          call.surface ?? source.surface,
          `sources[${i}]${call.surface ? `.calls[${j}]` : ""}.surface`,
          errors,
        );
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
  if (template.orchestration?.portSync !== undefined) {
    if (!Array.isArray(template.orchestration.portSync)) {
      errors.push("orchestration.portSync must be an array");
    } else {
      for (let index = 0; index < template.orchestration.portSync.length; index++) {
        const rule = template.orchestration.portSync[index];
        for (const field of ["event", "action"] as const) {
          if (typeof rule?.[field] !== "string" || !rule[field].trim()) {
            errors.push(
              `orchestration.portSync[${index}].${field} must be a non-empty string`,
            );
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Resolve the stable component identity used by slots, routes, and layout areas. */
export function resolveTemplateComponentId(
  source: TemplateSource,
  _sourceIndex: number,
  call: TemplateToolCall,
  callIndex: number,
): string {
  if (call.id) return call.id;
  if (source.calls.length === 1 && source.id) return source.id;
  if (source.id) return `${source.id}/${call.tool}-${callIndex + 1}`;
  return `${source.manifest}:${call.tool}`;
}

function validateSurface(
  surface: TemplateSource["surface"],
  path: string,
  errors: string[],
): void {
  if (surface === undefined) return;
  if (!surface || typeof surface !== "object") {
    errors.push(`${path} must be an object`);
    return;
  }
  const layout = surface.layout;
  if (!layout || !["stack", "row", "grid"].includes(layout.type)) {
    errors.push(`${path}.layout.type must be stack, row, or grid`);
  } else {
    if (
      layout.columns !== undefined &&
      (!Number.isInteger(layout.columns) || layout.columns < 1 || layout.columns > 12)
    ) {
      errors.push(`${path}.layout.columns must be an integer from 1 to 12`);
    }
    if (layout.type !== "grid" && layout.columns !== undefined) {
      errors.push(`${path}.layout.columns is valid only for grid layouts`);
    }
    if (layout.gap !== undefined && !["none", "xs", "sm", "md", "lg"].includes(layout.gap)) {
      errors.push(`${path}.layout.gap must be none, xs, sm, md, or lg`);
    }
  }
  if (!Array.isArray(surface.components) || surface.components.length === 0) {
    errors.push(`${path}.components must contain at least one component`);
    return;
  }
  const ids = new Set<string>();
  for (let index = 0; index < surface.components.length; index++) {
    const component = surface.components[index];
    const componentPath = `${path}.components[${index}]`;
    if (!component || typeof component !== "object") {
      errors.push(`${componentPath} must be an object`);
      continue;
    }
    if (!validIdentifier(component.id)) {
      errors.push(`${componentPath}.id is invalid`);
    } else if (ids.has(component.id)) {
      errors.push(`${componentPath}.id duplicates ${JSON.stringify(component.id)}`);
    } else {
      ids.add(component.id);
    }
    if (!validIdentifier(component.component)) {
      errors.push(`${componentPath}.component is invalid`);
    }
    if (
      component.area !== undefined &&
      (typeof component.area !== "string" || !/^[A-Za-z][A-Za-z0-9_-]*$/.test(component.area))
    ) {
      errors.push(`${componentPath}.area is invalid`);
    }
    if (component.props !== undefined && !isJsonValue(component.props)) {
      errors.push(`${componentPath}.props must contain only JSON values`);
    }
  }
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value);
}

function isJsonValue(value: unknown): boolean {
  if (
    value === null || typeof value === "string" || typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (value && typeof value === "object") return Object.values(value).every(isJsonValue);
  return false;
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
      message: `Invalid YAML${filePath ? ` in ${filePath}` : ""}: ${
        e instanceof Error ? e.message : String(e)
      }`,
    } satisfies RuntimeError;
  }

  return templateObject(data, "YAML", filePath);
}

/** Parse the canonical agent-facing JSON dashboard manifest. */
export function parseTemplateJson(json: string, filePath?: string): DashboardTemplate {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (error) {
    throw {
      code: RuntimeErrorCode.TEMPLATE_PARSE_ERROR,
      message: `Invalid JSON${filePath ? ` in ${filePath}` : ""}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    } satisfies RuntimeError;
  }
  return templateObject(data, "JSON", filePath);
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
  const text = await Deno.readTextFile(path);
  return path.toLowerCase().endsWith(".json")
    ? parseTemplateJson(text, path)
    : parseTemplate(text, path);
}

function templateObject(
  data: unknown,
  format: "JSON" | "YAML",
  filePath?: string,
): DashboardTemplate {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw {
      code: RuntimeErrorCode.TEMPLATE_PARSE_ERROR,
      message: `Template must be a ${format} object${filePath ? ` (${filePath})` : ""}`,
    } satisfies RuntimeError;
  }
  return data as DashboardTemplate;
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
