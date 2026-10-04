import "server-only";
import { z } from "zod";
import { Step } from "@/schema";

// Diagnostic ablation: same Step contract, but retain native optional properties.
// This deliberately doesn't claim to be a general-purpose JSON Schema converter.
export function nativeStepSchema(): unknown {
  const allowed = new Set(["type", "format", "title", "description", "enum", "items", "prefixItems",
    "minItems", "maxItems", "minimum", "maximum", "anyOf", "oneOf", "properties", "required"]);
  function convert(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(convert);
    if (!value || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).flatMap(([k, v]) => {
      if (k === "const") return [["enum", [v]]];
      if (!allowed.has(k)) return [];
      return [[k, k === "properties"
        ? Object.fromEntries(Object.entries(v as object).map(([name, sub]) => [name, convert(sub)])) : convert(v)]];
    }));
  }
  return convert(z.toJSONSchema(Step, { io: "input" }));
}
