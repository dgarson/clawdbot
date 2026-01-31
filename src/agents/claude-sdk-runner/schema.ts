/**
 * Minimal JSON Schema → Zod adapter for Claude Agent SDK tools.
 *
 * Handles the subset of JSON Schema used by OpenClaw tools:
 * - type: object, string, number, integer, boolean, array
 * - properties, required, additionalProperties
 * - enum, const
 * - items (array)
 * - anyOf/oneOf with null (optional types)
 *
 * For unsupported schemas, falls back to z.any().
 */

import { z } from "zod";

type JsonSchema = Record<string, unknown>;

/**
 * Convert a JSON Schema to a Zod schema.
 * Handles common cases; falls back to z.any() for complex schemas.
 */
export function jsonSchemaToZod(schema: JsonSchema | undefined): z.ZodTypeAny {
  if (!schema || typeof schema !== "object") {
    return z.any();
  }

  // Handle nullable types via anyOf/oneOf with null
  const nullable = extractNullableSchema(schema);
  if (nullable) {
    return jsonSchemaToZod(nullable).nullable();
  }

  // Handle enum
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return createEnumSchema(schema.enum);
  }

  // Handle const
  if ("const" in schema) {
    return z.literal(schema.const as string | number | boolean);
  }

  const schemaType = schema.type;

  // Handle array type
  if (Array.isArray(schemaType)) {
    // e.g. ["string", "null"] - treat as nullable string
    const nonNull = schemaType.filter((t) => t !== "null");
    if (nonNull.length === 1) {
      const innerSchema = jsonSchemaToZod({ ...schema, type: nonNull[0] });
      return schemaType.includes("null") ? innerSchema.nullable() : innerSchema;
    }
    return z.any();
  }

  // Helper to optionally add description to a Zod schema
  const withDescription = (zs: z.ZodTypeAny): z.ZodTypeAny => {
    if (typeof schema.description === "string") {
      return zs.describe(schema.description);
    }
    return zs;
  };

  switch (schemaType) {
    case "object":
      return createObjectSchema(schema);
    case "string":
      return createStringSchema(schema);
    case "number":
      return withDescription(z.number());
    case "integer":
      return withDescription(z.number().int());
    case "boolean":
      return withDescription(z.boolean());
    case "array":
      return withDescription(createArraySchema(schema));
    case "null":
      return z.null();
    default:
      // Infer object if properties present but no type
      if (typeof schema.properties === "object") {
        return createObjectSchema(schema);
      }
      return z.any();
  }
}

/**
 * Extract a non-null schema from anyOf/oneOf with null.
 * Returns undefined if not a nullable pattern.
 */
function extractNullableSchema(schema: JsonSchema): JsonSchema | undefined {
  const variants = (schema.anyOf ?? schema.oneOf) as JsonSchema[] | undefined;
  if (!Array.isArray(variants) || variants.length !== 2) {
    return undefined;
  }

  const nullIdx = variants.findIndex((v) => v.type === "null");
  if (nullIdx === -1) {
    return undefined;
  }

  return variants[1 - nullIdx];
}

function createEnumSchema(values: unknown[]): z.ZodTypeAny {
  // Filter to string literals for z.enum; use z.union for mixed types
  const stringValues = values.filter((v): v is string => typeof v === "string");
  if (stringValues.length === values.length && stringValues.length > 0) {
    return z.enum(stringValues as [string, ...string[]]);
  }

  // Mixed enum: use union of literals
  // For Zod 4, we need at least 2 items for union; fallback to any for edge cases
  const literals = values.map((v) => z.literal(v as string | number | boolean));
  if (literals.length === 0) {
    return z.any();
  }
  if (literals.length === 1) {
    return literals[0];
  }
  // Cast through unknown to satisfy Zod 4's stricter union type requirements
  return z.union(literals as unknown as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
}

function createStringSchema(schema: JsonSchema): z.ZodTypeAny {
  let zs: z.ZodTypeAny = z.string();
  if (typeof schema.minLength === "number") {
    zs = (zs as z.ZodString).min(schema.minLength);
  }
  if (typeof schema.maxLength === "number") {
    zs = (zs as z.ZodString).max(schema.maxLength);
  }
  // Preserve description for MCP/Claude SDK
  if (typeof schema.description === "string") {
    zs = zs.describe(schema.description);
  }
  return zs;
}

function createArraySchema(schema: JsonSchema): z.ZodArray<z.ZodTypeAny> {
  const itemsSchema = schema.items as JsonSchema | undefined;
  const itemZod = itemsSchema ? jsonSchemaToZod(itemsSchema) : z.any();
  return z.array(itemZod);
}

function createObjectSchema(schema: JsonSchema): z.ZodObject<z.ZodRawShape> {
  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
  const required = Array.isArray(schema.required)
    ? new Set(schema.required.filter((r): r is string => typeof r === "string"))
    : new Set<string>();

  // Build shape as mutable Record, then cast to ZodRawShape
  const mutableShape: Record<string, z.ZodTypeAny> = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    const propZod = jsonSchemaToZod(propSchema);
    mutableShape[key] = required.has(key) ? propZod : propZod.optional();
  }

  const shape = mutableShape as z.ZodRawShape;
  const additionalProps = schema.additionalProperties;
  if (additionalProps === false) {
    return z.object(shape).strict();
  }
  // Allow additional properties (default behavior)
  return z.object(shape).passthrough();
}

/**
 * Create a Zod raw shape (for SDK tool definitions) from a JSON Schema.
 * Returns an empty shape for non-object schemas.
 */
export function jsonSchemaToZodRawShape(schema: JsonSchema | undefined): z.ZodRawShape {
  if (!schema || typeof schema !== "object") {
    return {} as z.ZodRawShape;
  }

  const properties = (schema.properties ?? {}) as Record<string, JsonSchema>;
  const required = Array.isArray(schema.required)
    ? new Set(schema.required.filter((r): r is string => typeof r === "string"))
    : new Set<string>();

  // Build shape as mutable Record, then cast to ZodRawShape
  const mutableShape: Record<string, z.ZodTypeAny> = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    const propZod = jsonSchemaToZod(propSchema);
    mutableShape[key] = required.has(key) ? propZod : propZod.optional();
  }

  return mutableShape as z.ZodRawShape;
}
