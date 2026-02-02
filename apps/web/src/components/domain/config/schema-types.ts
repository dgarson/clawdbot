/**
 * Types for the ConfigUiHint system from the main Clawdbrain repo.
 * These match the schema defined in src/config/schema.ts.
 */

/**
 * UI hint metadata for a single config field
 */
export interface ConfigUiHint {
  label?: string;
  help?: string;
  group?: string;
  order?: number;
  advanced?: boolean;
  sensitive?: boolean;
  placeholder?: string;
  itemTemplate?: unknown;
  /** Override widget type: "slider" | "stepper" | "text" */
  widget?: string;
  /** Force compact/non-compact layout */
  compact?: boolean;
}

/**
 * Map of field paths to their UI hints
 */
export type ConfigUiHints = Record<string, ConfigUiHint>;

/**
 * JSON Schema node for config fields
 */
export interface JsonSchemaNode {
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  additionalProperties?: JsonSchemaNode | boolean;
  required?: string[];
  enum?: (string | number | boolean)[];
  const?: unknown;
  default?: unknown;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  description?: string;
  title?: string;
  items?: JsonSchemaNode;
  oneOf?: JsonSchemaNode[];
  anyOf?: JsonSchemaNode[];
  allOf?: JsonSchemaNode[];
  $ref?: string;
}

/**
 * Response from config.schema endpoint
 */
export interface ConfigSchemaResponse {
  schema: JsonSchemaNode;
  uiHints: ConfigUiHints;
  version: string;
  generatedAt: string;
}

/**
 * Processed field info for rendering
 */
export interface ProcessedField {
  path: string;
  key: string;
  schema: JsonSchemaNode;
  hint: ConfigUiHint;
  type: FieldType;
  required: boolean;
}

/**
 * Field types supported by the dynamic form
 */
export type FieldType =
  | "text"
  | "password"
  | "number"
  | "boolean"
  | "select"
  | "slider"
  | "stepper"
  | "textarea"
  | "array"
  | "object"
  | "unknown";

/**
 * Group of fields for rendering
 */
export interface FieldGroup {
  key: string;
  label: string;
  order: number;
  fields: ProcessedField[];
  advancedFields: ProcessedField[];
}

/**
 * Infer field type from JSON schema and UI hints
 */
export function inferFieldType(
  schema: JsonSchemaNode,
  hint?: ConfigUiHint
): FieldType {
  // Check for widget hint override
  if (hint?.widget) {
    if (hint.widget === "slider") {return "slider";}
    if (hint.widget === "stepper") {return "stepper";}
    if (hint.widget === "text") {return "text";}
  }

  // Check for sensitive hint
  if (hint?.sensitive) {return "password";}

  // Check for enum
  if (schema.enum && schema.enum.length > 0) {return "select";}

  // Determine type from schema
  const schemaType = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  switch (schemaType) {
    case "string":
      // Check for format hints
      if (schema.format === "uri" || schema.format === "url") {return "text";}
      if (schema.format === "password") {return "password";}
      // Long strings get textarea
      if (schema.maxLength && schema.maxLength > 200) {return "textarea";}
      return "text";

    case "number":
    case "integer":
      // Use slider if min/max bounds are reasonable
      if (
        schema.minimum !== undefined &&
        schema.maximum !== undefined &&
        schema.maximum - schema.minimum <= 1000
      ) {
        return "slider";
      }
      return "number";

    case "boolean":
      return "boolean";

    case "array":
      return "array";

    case "object":
      return "object";

    default:
      return "unknown";
  }
}

/**
 * Get value at a nested path from an object
 */
export function getValueAtPath(obj: unknown, path: string): unknown {
  if (!obj || typeof obj !== "object") {return undefined;}

  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {return undefined;}
    if (typeof current !== "object") {return undefined;}
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set value at a nested path in an object (returns new object)
 */
export function setValueAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const parts = path.split(".");
  const result = { ...obj };

  if (parts.length === 1) {
    result[parts[0]] = value;
    return result;
  }

  const [first, ...rest] = parts;
  const nested = (result[first] as Record<string, unknown>) ?? {};
  result[first] = setValueAtPath(nested, rest.join("."), value);

  return result;
}

/**
 * Process schema and hints into grouped fields for rendering
 */
export function processSchemaFields(
  schema: JsonSchemaNode,
  hints: ConfigUiHints,
  basePath = "",
  requiredFields: string[] = []
): ProcessedField[] {
  const fields: ProcessedField[] = [];

  if (!schema.properties) {return fields;}

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    const path = basePath ? `${basePath}.${key}` : key;
    const hint = hints[path] ?? {};
    const type = inferFieldType(propSchema, hint);

    // Skip object types that should be recursively processed
    if (type === "object" && propSchema.properties) {
      const nestedFields = processSchemaFields(
        propSchema,
        hints,
        path,
        propSchema.required ?? []
      );
      fields.push(...nestedFields);
    } else {
      fields.push({
        path,
        key,
        schema: propSchema,
        hint,
        type,
        required: requiredFields.includes(key),
      });
    }
  }

  return fields;
}

/**
 * Group fields by their group hint
 */
export function groupFields(
  fields: ProcessedField[],
  hints: ConfigUiHints
): FieldGroup[] {
  const groups = new Map<string, FieldGroup>();
  const ungrouped: ProcessedField[] = [];

  for (const field of fields) {
    const groupKey = field.hint.group;

    if (!groupKey) {
      ungrouped.push(field);
      continue;
    }

    if (!groups.has(groupKey)) {
      const groupHint = hints[groupKey] ?? {};
      groups.set(groupKey, {
        key: groupKey,
        label: groupHint.label ?? groupKey,
        order: groupHint.order ?? 1000,
        fields: [],
        advancedFields: [],
      });
    }

    const group = groups.get(groupKey)!;
    if (field.hint.advanced) {
      group.advancedFields.push(field);
    } else {
      group.fields.push(field);
    }
  }

  // Sort fields within each group by order
  for (const group of groups.values()) {
    group.fields.sort((a, b) => (a.hint.order ?? 1000) - (b.hint.order ?? 1000));
    group.advancedFields.sort(
      (a, b) => (a.hint.order ?? 1000) - (b.hint.order ?? 1000)
    );
  }

  // Add ungrouped fields to a default group
  if (ungrouped.length > 0) {
    const normalFields = ungrouped.filter((f) => !f.hint.advanced);
    const advancedFields = ungrouped.filter((f) => f.hint.advanced);

    normalFields.sort((a, b) => (a.hint.order ?? 1000) - (b.hint.order ?? 1000));
    advancedFields.sort(
      (a, b) => (a.hint.order ?? 1000) - (b.hint.order ?? 1000)
    );

    groups.set("_general", {
      key: "_general",
      label: "General",
      order: 0,
      fields: normalFields,
      advancedFields,
    });
  }

  // Sort groups by order
  return Array.from(groups.values()).toSorted((a, b) => a.order - b.order);
}

/**
 * Filter fields for a specific section/prefix
 */
export function filterFieldsBySection(
  fields: ProcessedField[],
  sectionPrefix: string
): ProcessedField[] {
  return fields.filter(
    (f) =>
      f.path.startsWith(sectionPrefix) ||
      f.path === sectionPrefix
  );
}
