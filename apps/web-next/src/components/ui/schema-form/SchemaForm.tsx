import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../../../lib/utils';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { FormSchema, FormState, SchemaField } from './types';
import { validateForm, getDefaultValues } from './validation';
import { FIELD_COMPONENTS } from './fields';

interface SchemaFormProps {
  schema: FormSchema;
  initialValues?: Record<string, unknown>;
  onSubmit?: (data: Record<string, unknown>) => void;
  onChange?: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
  disabled?: boolean;
  loading?: boolean;
  className?: string;
}

/**
 * Collapsible section component
 */
function FormSection({
  section,
  fields,
  expanded,
  onToggle,
  children,
}: {
  section: NonNullable<FormSchema['sections']>[0];
  fields: SchemaField[];
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3",
          "bg-muted/50 hover:bg-muted transition-colors duration-150",
          "text-left"
        )}
      >
        <div>
          <h3 className="font-medium text-foreground">{section.title}</h3>
          {section.description && (
            <p className="text-sm text-muted-foreground">{section.description}</p>
          )}
        </div>
        {section.collapsible !== false && (
          expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      
      {expanded && (
        <div className="p-4 grid gap-4">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Main SchemaForm component
 */
export function SchemaForm({
  schema,
  initialValues,
  onSubmit,
  onChange,
  onCancel,
  disabled = false,
  loading = false,
  className,
}: SchemaFormProps) {
  // Initialize form state
  const [state, setState] = useState<FormState>(() => ({
    values: initialValues ?? getDefaultValues(schema),
    errors: {},
    touched: {},
    isSubmitting: false,
    isValid: true,
  }));

  // Track expanded sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    schema.sections?.forEach((section) => {
      initial[section.id] = section.defaultExpanded !== false;
    });
    return initial;
  });

  // Get field keys by section
  const fieldsBySection = useMemo(() => {
    if (!schema.sections) {
      return { _default: schema.fields };
    }

    const map: Record<string, SchemaField[]> = { _default: [] };
    schema.sections.forEach((section) => {
      map[section.id] = section.fields
        .map((key) => schema.fields.find((f) => f.key === key))
        .filter((f): f is SchemaField => f !== undefined);
    });
    return map;
  }, [schema]);

  // Handle field change
  const handleChange = useCallback((key: string, value: unknown) => {
    setState((prev) => {
      const newValues = { ...prev.values, [key]: value };
      const errors = validateForm(newValues, schema);
      
      const errorMap: Record<string, string> = {};
      errors.forEach((err) => {
        errorMap[err.path] = err.message;
      });

      const newState = {
        ...prev,
        values: newValues,
        errors: errorMap,
        isValid: errors.length === 0,
      };

      // Notify onChange
      onChange?.(newValues);

      return newState;
    });
  }, [schema, onChange]);

  // Handle field blur (mark as touched)
  const handleBlur = useCallback((key: string) => {
    setState((prev) => ({
      ...prev,
      touched: { ...prev.touched, [key]: true },
    }));

    // Re-validate on blur to show errors
    setState((prev) => {
      const errors = validateForm(prev.values, schema);
      const errorMap: Record<string, string> = {};
      errors.forEach((err) => {
        errorMap[err.path] = err.message;
      });
      return {
        ...prev,
        errors: errorMap,
        isValid: errors.length === 0,
      };
    });
  }, [schema]);

  // Handle form submission
  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();

    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {};
    schema.fields.forEach((f) => {
      allTouched[f.key] = true;
    });
    setState((prev) => ({ ...prev, touched: allTouched }));

    // Validate
    const errors = validateForm(state.values, schema);
    if (errors.length > 0) {
      const errorMap: Record<string, string> = {};
      errors.forEach((err) => {
        errorMap[err.path] = err.message;
      });
      setState((prev) => ({
        ...prev,
        errors: errorMap,
        isValid: false,
        isSubmitting: false,
      }));
      return;
    }

    setState((prev) => ({ ...prev, isSubmitting: true }));
    onSubmit?.(state.values);
  }, [state.values, schema, onSubmit]);

  // Render a single field
  const renderField = (field: SchemaField) => {
    const FieldComponent = FIELD_COMPONENTS[field.type] ?? FIELD_COMPONENTS.string;
    const value = state.values[field.key];
    const error = state.errors[field.key];
    const touched = state.touched[field.key] ?? false;

    return (
      <FieldComponent
        key={field.key}
        field={field}
        value={value}
        error={error}
        touched={touched}
        onChange={(val) => handleChange(field.key, val)}
        onBlur={() => handleBlur(field.key)}
        disabled={disabled || loading}
        loading={loading}
      />
    );
  };

  // Render fields based on column layout
  const renderFields = (fields: SchemaField[]) => {
    const columns = schema.columns ?? 1;
    
    if (columns === 1) {
      return fields.map(renderField);
    }

    return (
      <div className={cn("grid gap-4", columns === 2 && "grid-cols-2", columns === 3 && "grid-cols-3")}>
        {fields.map(renderField)}
      </div>
    );
  };

  const hasErrors = Object.keys(state.errors).length > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className={cn("flex flex-col gap-6", className)}
    >
      {/* Form header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">{schema.title}</h2>
        {schema.description && (
          <p className="text-sm text-muted-foreground mt-1">{schema.description}</p>
        )}
      </div>

      {/* Error summary */}
      {hasErrors && !state.isValid && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/30">
          <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0" />
          <p className="text-sm text-destructive">
            Please fix the errors below before submitting.
          </p>
        </div>
      )}

      {/* Form content */}
      {schema.sections ? (
        <div className="flex flex-col gap-4">
          {schema.sections.map((section) => (
            <FormSection
              key={section.id}
              section={section}
              fields={fieldsBySection[section.id] ?? []}
              expanded={expandedSections[section.id] ?? true}
              onToggle={() =>
                setExpandedSections((prev) => ({
                  ...prev,
                  [section.id]: !prev[section.id],
                }))
              }
            >
              {renderFields(fieldsBySection[section.id] ?? [])}
            </FormSection>
          ))}
        </div>
      ) : (
        <div className={cn(schema.columns && schema.columns > 1 ? "" : "flex flex-col gap-4")}>
          {renderFields(schema.fields)}
        </div>
      )}

      {/* Form actions */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <button
          type="submit"
          disabled={disabled || loading}
          className={cn(
            "h-10 px-6 rounded-md text-sm font-medium",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors duration-150"
          )}
        >
          {loading ? 'Saving...' : (schema.submitLabel ?? 'Submit')}
        </button>
        
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={disabled || loading}
            className={cn(
              "h-10 px-6 rounded-md text-sm font-medium",
              "border border-input bg-background text-foreground",
              "hover:bg-muted",
              "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "transition-colors duration-150"
            )}
          >
            {schema.cancelLabel ?? 'Cancel'}
          </button>
        )}
      </div>
    </form>
  );
}

export { FIELD_COMPONENTS, StringField, NumberField, BooleanField, EnumField, ArrayField } from './fields';
export { validateForm, getDefaultValues, formSchemaToZod } from './validation';
export type { FormSchema, FormState, SchemaField, FormSection, FieldType } from './types';
