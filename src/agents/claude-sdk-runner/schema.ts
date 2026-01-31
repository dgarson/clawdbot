import { z } from "zod";

type JsonSchema = Record<string, unknown>;

type ZodSchema = z.ZodTypeAny;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object");

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const strings = value.filter((entry): entry is string => typeof entry === "string");
  return strings.length === value.length ? strings : undefined;
};

const coerceUnion = (schemas: ZodSchema[]): ZodSchema => {
  if (schemas.length === 0) {
    return z.any();
  }
  if (schemas.length === 1) {
    return schemas[0] ?? z.any();
  }
  return z.union(schemas as [ZodSchema, ZodSchema, ...ZodSchema[]]);
};

const extractTypeList = (schema: JsonSchema): string[] => {
  const typeValue = schema.type;
  if (Array.isArray(typeValue)) {
    return typeValue.filter((entry): entry is string => typeof entry === "string");
  }
  if (typeof typeValue === "string") {
    return [typeValue];
  }
  return [];
};

const resolveEnumSchema = (schema: JsonSchema): ZodSchema | null => {
  const values = Array.isArray(schema.enum) ? schema.enum : null;
  if (!values || values.length === 0) {
    if ("const" in schema) {
      return z.literal((schema as { const?: unknown }).const);
    }
    return null;
  }
  const stringValues = asStringArray(values);
  if (stringValues && stringValues.length > 0) {
    return z.enum(stringValues as [string, ...string[]]);
  }
  return coerceUnion(values.map((value) => z.literal(value)));
};

const resolveNullable = (schema: JsonSchema, base: ZodSchema): ZodSchema => {
  const types = extractTypeList(schema);
  if (types.includes("null")) {
    return base.nullable();
  }
  return base;
};

const resolveAdditionalProperties = (schema: JsonSchema): ZodSchema | null => {
  if (!("additionalProperties" in schema)) {
    return null;
  }
  const value = schema.additionalProperties;
  if (value === false) {
    return null;
  }
  if (value === true) {
    return z.any();
  }
  if (isRecord(value)) {
    return jsonSchemaToZod(value);
  }
  return z.any();
};

const resolveObjectSchema = (schema: JsonSchema): ZodSchema => {
  const properties = isRecord(schema.properties) ? schema.properties : {};
  const required = Array.isArray(schema.required)
    ? schema.required.filter((entry): entry is string => typeof entry === "string")
    : [];
  const shape: Record<string, ZodSchema> = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    if (!isRecord(propSchema)) {
      shape[key] = z.any();
      continue;
    }
    const child = jsonSchemaToZod(propSchema);
    shape[key] = required.includes(key) ? child : child.optional();
  }

  let objectSchema = z.object(shape);
  const additional = resolveAdditionalProperties(schema);
  if (additional) {
    objectSchema = objectSchema.catchall(additional);
  }

  return objectSchema;
};

export function jsonSchemaToZod(schema: unknown): ZodSchema {
  if (!isRecord(schema)) {
    return z.any();
  }

  const enumSchema = resolveEnumSchema(schema);
  if (enumSchema) {
    return resolveNullable(schema, enumSchema);
  }

  const variants = Array.isArray(schema.anyOf)
    ? schema.anyOf
    : Array.isArray(schema.oneOf)
      ? schema.oneOf
      : null;
  if (variants) {
    const mapped = variants.map((entry) => jsonSchemaToZod(entry));
    const union = coerceUnion(mapped);
    return resolveNullable(schema, union);
  }

  const types = extractTypeList(schema);
  if (types.length === 0 && schema.properties) {
    return resolveObjectSchema(schema);
  }

  if (types.length > 1) {
    const mapped = types
      .filter((type) => type !== "null")
      .map((type) => jsonSchemaToZod({ ...schema, type }));
    const union = coerceUnion(mapped);
    return resolveNullable(schema, union);
  }

  const type = types[0];
  switch (type) {
    case "object":
      return resolveNullable(schema, resolveObjectSchema(schema));
    case "array": {
      const items = schema.items ? jsonSchemaToZod(schema.items) : z.any();
      return resolveNullable(schema, z.array(items));
    }
    case "string":
      return resolveNullable(schema, z.string());
    case "number":
    case "integer":
      return resolveNullable(schema, z.number());
    case "boolean":
      return resolveNullable(schema, z.boolean());
    case "null":
      return z.null();
    default:
      return z.any();
  }
}
