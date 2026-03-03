// Field type enumeration
export type FieldType = 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'object';

// Custom validator function type — replaces Zod dependency
export type FieldValidator = (value: unknown) => string | null | undefined;

// JSON Schema field definition
export interface SchemaField {
  type: FieldType;
  key: string;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  default?: unknown;
  // String-specific
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  // Number-specific
  min?: number;
  max?: number;
  step?: number;
  // Enum-specific
  options?: Array<{ value: string; label: string }>;
  // Array-specific
  itemSchema?: SchemaField;
  minItems?: number;
  maxItems?: number;
  // Object-specific
  properties?: SchemaField[];
  // Validation — custom validator fn, returns error message or null/undefined if valid
  validation?: FieldValidator;
}

// Section definition for grouping fields
export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: string[]; // Field keys
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

// Complete form schema
export interface FormSchema {
  id: string;
  title: string;
  description?: string;
  sections?: FormSection[];
  fields: SchemaField[];
  // Layout
  columns?: 1 | 2 | 3;
  // Submit handling
  submitLabel?: string;
  cancelLabel?: string;
  onSubmit?: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
}

// Form state
export interface FormState {
  values: Record<string, unknown>;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  isSubmitting: boolean;
  isValid: boolean;
}

// Field render props
export interface FieldRenderProps {
  field: SchemaField;
  value: unknown;
  error?: string;
  touched: boolean;
  onChange: (value: unknown) => void;
  onBlur: () => void;
  disabled?: boolean;
  loading?: boolean;
}

// Validation error from Zod
export interface ValidationError {
  path: string;
  message: string;
}
