import type { SchemaField, ValidationError, FormSchema } from './types';

/**
 * Validate a single field value against its schema constraints.
 * Returns an array of error messages (empty = valid).
 */
export function validateField(field: SchemaField, value: unknown): string[] {
  const errors: string[] = [];

  // Required check
  if (field.required) {
    if (value === null || value === undefined || value === '') {
      errors.push(`${field.label} is required`);
      return errors; // No point validating further
    }
    if (field.type === 'array' && Array.isArray(value) && value.length === 0) {
      errors.push(`${field.label} is required`);
      return errors;
    }
  }

  // Skip further validation if value is empty and not required
  if (value === null || value === undefined || value === '') {
    return errors;
  }

  switch (field.type) {
    case 'string': {
      const strVal = String(value);
      if (field.minLength !== undefined && strVal.length < field.minLength) {
        errors.push(`${field.label} must be at least ${field.minLength} characters`);
      }
      if (field.maxLength !== undefined && strVal.length > field.maxLength) {
        errors.push(`${field.label} must be at most ${field.maxLength} characters`);
      }
      if (field.pattern) {
        const regex = new RegExp(field.pattern);
        if (!regex.test(strVal)) {
          errors.push(`${field.label} does not match the required format`);
        }
      }
      break;
    }

    case 'number': {
      const numVal = Number(value);
      if (isNaN(numVal)) {
        errors.push(`${field.label} must be a valid number`);
        break;
      }
      if (field.min !== undefined && numVal < field.min) {
        errors.push(`${field.label} must be at least ${field.min}`);
      }
      if (field.max !== undefined && numVal > field.max) {
        errors.push(`${field.label} must be at most ${field.max}`);
      }
      break;
    }

    case 'enum': {
      const allowedValues = (field.options ?? []).map(o => o.value);
      if (!allowedValues.includes(String(value))) {
        errors.push(`${field.label} must be one of: ${allowedValues.join(', ')}`);
      }
      break;
    }

    case 'array': {
      if (!Array.isArray(value)) {
        errors.push(`${field.label} must be an array`);
        break;
      }
      if (field.minItems !== undefined && value.length < field.minItems) {
        errors.push(`${field.label} must have at least ${field.minItems} items`);
      }
      if (field.maxItems !== undefined && value.length > field.maxItems) {
        errors.push(`${field.label} must have at most ${field.maxItems} items`);
      }
      // Validate each item if itemSchema is defined
      if (field.itemSchema) {
        value.forEach((item, idx) => {
          const itemErrors = validateField(
            { ...field.itemSchema!, key: `${field.key}[${idx}]`, label: `${field.label} item ${idx + 1}` },
            item
          );
          errors.push(...itemErrors);
        });
      }
      break;
    }

    case 'boolean':
      if (typeof value !== 'boolean') {
        errors.push(`${field.label} must be true or false`);
      }
      break;

    case 'object':
      if (typeof value !== 'object' || Array.isArray(value)) {
        errors.push(`${field.label} must be an object`);
      }
      break;
  }

  // Run custom validator if present
  if (field.validation) {
    const customError = field.validation(value);
    if (customError) {
      errors.push(customError);
    }
  }

  return errors;
}

/**
 * Validate all form values against a schema.
 * Returns a flat list of ValidationErrors.
 */
export function validateForm(
  values: Record<string, unknown>,
  schema: FormSchema
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const field of schema.fields) {
    const value = values[field.key];
    const fieldErrors = validateField(field, value);
    for (const message of fieldErrors) {
      errors.push({ path: field.key, message });
    }
  }

  return errors;
}

/**
 * Get default values from schema fields.
 */
export function getDefaultValues(schema: FormSchema): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};

  for (const field of schema.fields) {
    if (field.default !== undefined) {
      defaults[field.key] = field.default;
    } else {
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
