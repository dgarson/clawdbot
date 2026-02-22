import { z, ZodString, ZodNumber, ZodArray, ZodOptional, ZodEnum, ZodBoolean, ZodTypeAny } from 'zod';
import type { SchemaField, ValidationError, FormSchema } from './types';

/**
 * Convert a SchemaField to a Zod schema
 */
export function fieldToZod(field: SchemaField): ZodTypeAny {
  const { type, required, minLength, maxLength, min, max, pattern, options, itemSchema, minItems, maxItems } = field;

  let schema: ZodTypeAny;

  switch (type) {
    case 'string': {
      let stringSchema: ZodString = z.string();
      if (minLength) stringSchema = stringSchema.min(minLength);
      if (maxLength) stringSchema = stringSchema.max(maxLength);
      if (pattern) {
        stringSchema = stringSchema.regex(new RegExp(pattern));
      }
      schema = stringSchema;
      break;
    }

    case 'number': {
      let numberSchema: ZodNumber = z.number();
      if (min !== undefined) numberSchema = numberSchema.min(min);
      if (max !== undefined) numberSchema = numberSchema.max(max);
      schema = numberSchema;
      break;
    }

    case 'boolean':
      schema = z.boolean();
      break;

    case 'enum':
      if (!options || options.length === 0) {
        schema = z.string();
      } else {
        const enumValues = options.map(o => o.value) as [string, ...string[]];
        schema = z.enum(enumValues);
      }
      break;

    case 'array':
      if (itemSchema) {
        const itemZod = fieldToZod(itemSchema);
        let arraySchema: ZodArray<ZodTypeAny> = z.array(itemZod);
        if (minItems) arraySchema = arraySchema.min(minItems);
        if (maxItems) arraySchema = arraySchema.max(maxItems);
        schema = arraySchema;
      } else {
        schema = z.array(z.any());
      }
      break;

    case 'object':
      // For objects, we'd build a nested schema from properties
      schema = z.record(z.any());
      break;

    default:
      schema = z.any();
  }

  // Handle optional
  if (!required) {
    schema = schema.optional();
  }

  return schema;
}

/**
 * Convert FormSchema to a full Zod schema
 */
export function formSchemaToZod(schema: FormSchema): ZodTypeAny {
  const shape: Record<string, ZodTypeAny> = {};

  for (const field of schema.fields) {
    shape[field.key] = fieldToZod(field);
  }

  return z.object(shape);
}

/**
 * Validate form values against a schema
 */
export function validateForm(
  values: Record<string, unknown>,
  schema: FormSchema
): ValidationError[] {
  try {
    const zodSchema = formSchemaToZod(schema);
    zodSchema.parse(values);
    return [];
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
      }));
    }
    return [{ path: '', message: 'Validation failed' }];
  }
}

/**
 * Get default values from schema
 */
export function getDefaultValues(schema: FormSchema): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  for (const field of schema.fields) {
    if (field.default !== undefined) {
      defaults[field.key] = field.default;
    } else {
      // Set appropriate defaults based on type
      switch (field.type) {
        case 'string':
          defaults[field.key] = '';
          break;
        case 'number':
          defaults[field.key] = 0;
          break;
        case 'boolean':
          defaults[field.key] = false;
          break;
        case 'array':
          defaults[field.key] = [];
          break;
        case 'enum':
          defaults[field.key] = field.options?.[0]?.value ?? '';
          break;
        default:
          defaults[field.key] = '';
      }
    }
  }

  return defaults;
}
