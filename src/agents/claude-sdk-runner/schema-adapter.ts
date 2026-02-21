/**
 * Schema Adapter: TypeBox → Zod
 *
 * Converts TypeBox (JSON Schema) parameter schemas to Zod raw shapes for use
 * with the Agent SDK's tool() helper. Handles the subset of TypeBox types used
 * by OpenClaw tools.
 *
 * Supported conversions:
 *   Type.String    → z.string()
 *   Type.Number    → z.number()
 *   Type.Boolean   → z.boolean()
 *   Type.Array(T)  → z.array(zodT)
 *   Type.Object    → z.object({...})
 *   Type.Optional  → zodT.optional()
 *   Type.Union     → z.union([...])
 *   Type.Enum      → z.enum([...])
 *   Type.Literal   → z.literal(V)
 */

import { Kind, OptionalKind, type TSchema } from "@sinclair/typebox";
import { z } from "zod";

type ZodTypeAny = z.ZodTypeAny;
type ZodRawShape = z.ZodRawShape;

/**
 * Converts a single TypeBox property schema to a Zod type.
 * Preserves description annotations.
 *
 * TypeBox Optional adds Symbol(TypeBox.Optional) = "Optional" to the schema WITHOUT
 * changing the Kind. We detect it via OptionalKind and wrap the base conversion
 * in .optional() to avoid infinite recursion.
 */
export function typeboxPropertyToZod(schema: TSchema): ZodTypeAny {
  const kind = schema[Kind] as string | undefined;

  // TypeBox Optional adds Symbol(TypeBox.Optional) = "Optional" to the schema.
  // It does NOT change the Kind — so we must check for the symbol explicitly.
  const isOptional = (schema as unknown as Record<symbol, unknown>)[OptionalKind] === "Optional";
  if (isOptional) {
    // Convert the base type by kind (skipping Optional detection to avoid recursion)
    const base = typeboxKindToZod(kind, schema);
    return applyDescription(base.optional(), schema.description);
  }

  return typeboxKindToZod(kind, schema);
}

/**
 * Converts a TypeBox schema based on its Kind. Does NOT handle Optional —
 * that is done in typeboxPropertyToZod before calling here.
 */
function typeboxKindToZod(kind: string | undefined, schema: TSchema): ZodTypeAny {
  // Literal
  if (kind === "Literal") {
    const val = (schema as { const?: unknown }).const;
    return applyDescription(z.literal(val as string | number | boolean), schema.description);
  }

  // Enum — TypeBox enum schemas have a list of literal values
  if (kind === "Enum") {
    const values = (schema as { enum?: unknown[] }).enum;
    if (values && values.length >= 1) {
      const [first, ...rest] = values as string[];
      return applyDescription(
        z.enum([first, ...rest] as [string, ...string[]]),
        schema.description,
      );
    }
    return applyDescription(z.unknown(), schema.description);
  }

  // Union
  if (kind === "Union") {
    const anyOf = (schema as { anyOf?: TSchema[] }).anyOf ?? [];
    if (anyOf.length < 2) {
      return applyDescription(z.unknown(), schema.description);
    }
    const [first, second, ...rest] = anyOf.map(typeboxPropertyToZod);
    return applyDescription(
      z.union([first, second, ...rest] as [ZodTypeAny, ZodTypeAny, ...ZodTypeAny[]]),
      schema.description,
    );
  }

  // String
  if (kind === "String") {
    return applyDescription(z.string(), schema.description);
  }

  // Number / Integer
  if (kind === "Number" || kind === "Integer") {
    return applyDescription(z.number(), schema.description);
  }

  // Boolean
  if (kind === "Boolean") {
    return applyDescription(z.boolean(), schema.description);
  }

  // Array
  if (kind === "Array") {
    const items = (schema as { items?: TSchema }).items;
    const itemZod = items ? typeboxPropertyToZod(items) : z.unknown();
    return applyDescription(z.array(itemZod), schema.description);
  }

  // Nested Object
  if (kind === "Object") {
    const shape = typeboxToZod(schema);
    return applyDescription(z.object(shape), schema.description);
  }

  // Null
  if (kind === "Null") {
    return applyDescription(z.null(), schema.description);
  }

  // Unknown / fallback
  return applyDescription(z.unknown(), schema.description);
}

/**
 * Converts a TypeBox TObject schema to a Zod raw shape (for use with tool()).
 * For non-object schemas, returns a fallback shape with an optional _input field.
 */
export function typeboxToZod(schema: TSchema): ZodRawShape {
  if (
    schema[Kind] === "Object" &&
    (schema as { properties?: Record<string, TSchema> }).properties
  ) {
    const schemaAsObj = schema as unknown as {
      properties: Record<string, TSchema>;
      required?: string[];
    };
    const props = schemaAsObj.properties;
    const required = new Set<string>(schemaAsObj.required ?? []);
    const shape: Record<string, ZodTypeAny> = {};

    for (const [key, propSchema] of Object.entries(props)) {
      let zodType = typeboxPropertyToZod(propSchema);

      // If the field is not required and not already Optional-marked, make it optional.
      const propIsOptional =
        (propSchema as unknown as Record<symbol, unknown>)[OptionalKind] === "Optional";
      if (!required.has(key) && !propIsOptional) {
        const isAlreadyOptional = zodType instanceof z.ZodOptional;
        if (!isAlreadyOptional) {
          zodType = zodType.optional();
        }
      }

      // Carry over description annotation from property schema
      if (propSchema.description && !zodType.description) {
        zodType = zodType.describe(propSchema.description);
      }

      shape[key] = zodType;
    }
    return shape as ZodRawShape;
  }

  // Non-object schema fallback: accept any input
  return { _input: z.unknown().optional() } as ZodRawShape;
}

function applyDescription(zodType: ZodTypeAny, description?: string): ZodTypeAny {
  if (description) {
    return zodType.describe(description);
  }
  return zodType;
}
