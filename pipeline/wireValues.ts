import "server-only";
import { z } from "zod";

// Undo only synthetic optional nulls; real nullable fields and unknown values stay intact.
export function normalizeOptionalNulls(value: unknown, schema: z.ZodType): unknown {
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodNullable || schema instanceof z.ZodReadonly) {
    return normalizeOptionalNulls(value, schema.unwrap() as z.ZodType);
  }
  if (schema instanceof z.ZodDefault) return normalizeOptionalNulls(value, schema.removeDefault() as z.ZodType);
  if (schema instanceof z.ZodUnion) {
    for (const option of schema.options) {
      const candidate = normalizeOptionalNulls(value, option as z.ZodType);
      if ((option as z.ZodType).safeParse(candidate).success) return candidate;
    }
    return value;
  }
  if (schema instanceof z.ZodArray && Array.isArray(value)) {
    return value.map(v => normalizeOptionalNulls(v, schema.element as z.ZodType));
  }
  if (schema instanceof z.ZodObject && value && typeof value === "object" && !Array.isArray(value)) {
    return Object.fromEntries(Object.entries(value).flatMap(([key, v]) => {
      const child = schema.shape[key] as z.ZodType | undefined;
      if (!child) return [[key, v]];
      if (v === null && child.isOptional() && !child.safeParse(null).success) return [];
      return [[key, normalizeOptionalNulls(v, child)]];
    }));
  }
  return value;
}
