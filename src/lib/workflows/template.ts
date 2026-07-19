/**
 * Lets a step's config reference the output of an earlier step, e.g.
 * `{{step1.text}}` or `{{trigger.text}}`. Pure and unit-testable —
 * the engine builds the `values` map from prior step outputs, this
 * module just does the substitution.
 */

import type { Json } from "@/types/database";

/** Unresolved placeholders are left as-is (easier to debug than silently blanking them). */
export function renderTemplate(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match
  );
}

/** Recursively renders every string value in a step config object/array, leaving other types untouched. */
export function renderConfigTemplates<T>(config: T, values: Record<string, string>): T {
  if (typeof config === "string") {
    return renderTemplate(config, values) as unknown as T;
  }
  if (Array.isArray(config)) {
    return config.map((item) => renderConfigTemplates(item, values)) as unknown as T;
  }
  if (config && typeof config === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config as Record<string, unknown>)) {
      result[key] = renderConfigTemplates(value, values);
    }
    return result as T;
  }
  return config;
}

/** Best-effort plain-text form of a step output, used to seed `{{trigger.text}}` from an inbound webhook body. */
export function stringifyTriggerInput(input: Json | undefined): string {
  if (input === undefined || input === null) return "";
  if (typeof input === "string") return input;
  try {
    return JSON.stringify(input);
  } catch {
    return "";
  }
}
