import React from 'react';
import { cn } from '../../../lib/utils';
import type { FieldRenderProps } from './types';

/**
 * Base field wrapper with label, description, and error handling
 */
export function FieldWrapper({
  field,
  error,
  touched,
  children,
}: {
  field: FieldRenderProps['field'];
  error?: string;
  touched: boolean;
  children: React.ReactNode;
}) {
  const showError = touched && error;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={field.key}
        className={cn(
          "text-sm font-medium",
          field.required ? "text-foreground" : "text-muted-foreground"
        )}
      >
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      
      {children}
      
      {field.description && (
        <p className="text-xs text-muted-foreground">{field.description}</p>
      )}
      
      {showError && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}

/**
 * Text input field
 */
export function StringField({
  field,
  value,
  error,
  touched,
  onChange,
  onBlur,
  disabled,
}: FieldRenderProps) {
  return (
    <FieldWrapper field={field} error={error} touched={touched}>
      <input
        id={field.key}
        type="text"
        value={value as string ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={field.placeholder}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors duration-150",
          error && touched && "border-destructive focus:ring-destructive"
        )}
      />
    </FieldWrapper>
  );
}

/**
 * Number input field
 */
export function NumberField({
  field,
  value,
  error,
  touched,
  onChange,
  onBlur,
  disabled,
}: FieldRenderProps) {
  return (
    <FieldWrapper field={field} error={error} touched={touched}>
      <input
        id={field.key}
        type="number"
        value={value as number ?? 0}
        onChange={(e) => {
          const val = e.target.value;
          onChange(val === '' ? undefined : Number(val));
        }}
        onBlur={onBlur}
        placeholder={field.placeholder}
        disabled={disabled}
        min={field.min}
        max={field.max}
        step={field.step ?? 1}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors duration-150",
          error && touched && "border-destructive focus:ring-destructive"
        )}
      />
    </FieldWrapper>
  );
}

/**
 * Toggle/switch field
 */
export function BooleanField({
  field,
  value,
  error,
  touched,
  onChange,
  onBlur,
  disabled,
}: FieldRenderProps) {
  return (
    <FieldWrapper field={field} error={error} touched={touched}>
      <label className="flex items-center gap-3 cursor-pointer">
        <button
          type="button"
          role="switch"
          aria-checked={value as boolean}
          onClick={() => onChange(!value)}
          onBlur={onBlur}
          disabled={disabled}
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
            value ? "bg-primary" : "bg-input",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span
            className={cn(
              "inline-block h-4 w-4 transform rounded-full bg-background transition-transform duration-200",
              value ? "translate-x-6" : "translate-x-1"
            )}
          />
        </button>
        <span className="text-sm text-muted-foreground">
          {field.description || `Enable ${field.label.toLowerCase()}`}
        </span>
      </label>
    </FieldWrapper>
  );
}

/**
 * Select/dropdown field for enum types
 */
export function EnumField({
  field,
  value,
  error,
  touched,
  onChange,
  onBlur,
  disabled,
}: FieldRenderProps) {
  return (
    <FieldWrapper field={field} error={error} touched={touched}>
      <select
        id={field.key}
        value={value as string ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors duration-150",
          error && touched && "border-destructive focus:ring-destructive",
          !value && "text-muted-foreground"
        )}
      >
        {!field.required && (
          <option value="" disabled>
            Select an option
          </option>
        )}
        {field.options?.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

/**
 * Array field with add/remove items
 */
export function ArrayField({
  field,
  value,
  error,
  touched,
  onChange,
  onBlur,
  disabled,
}: FieldRenderProps) {
  const items = (value as unknown[]) ?? [];
  const itemField = field.itemSchema;

  const handleAddItem = () => {
    const newItems = [...items, itemField?.default ?? ''];
    onChange(newItems);
  };

  const handleRemoveItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    onChange(newItems);
  };

  const handleItemChange = (index: number, itemValue: unknown) => {
    const newItems = [...items];
    newItems[index] = itemValue;
    onChange(newItems);
  };

  return (
    <FieldWrapper field={field} error={error} touched={touched}>
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            {itemField && (
              <input
                type={itemField.type === 'number' ? 'number' : 'text'}
                value={item as string ?? ''}
                onChange={(e) => {
                  const val = itemField.type === 'number' 
                    ? (e.target.value === '' ? undefined : Number(e.target.value))
                    : e.target.value;
                  handleItemChange(index, val);
                }}
                onBlur={onBlur}
                disabled={disabled}
                placeholder={itemField.placeholder}
                className={cn(
                  "flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                )}
              />
            )}
            <button
              type="button"
              onClick={() => handleRemoveItem(index)}
              disabled={disabled}
              className={cn(
                "h-10 px-3 rounded-md text-sm font-medium",
                "border border-input bg-background text-muted-foreground",
                "hover:bg-destructive hover:text-destructive-foreground hover:border-destructive",
                "focus:outline-none focus:ring-2 focus:ring-ring",
                "transition-colors duration-150",
                disabled && "opacity-50 cursor-not-allowed"
              )}
            >
              Remove
            </button>
          </div>
        ))}
        
        <button
          type="button"
          onClick={handleAddItem}
          disabled={disabled}
          className={cn(
            "self-start h-10 px-4 rounded-md text-sm font-medium",
            "bg-primary text-primary-foreground",
            "hover:bg-primary/90",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            "transition-colors duration-150",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          + Add Item
        </button>
      </div>
    </FieldWrapper>
  );
}

/**
 * Field type component mapping
 */
export const FIELD_COMPONENTS: Record<string, React.ComponentType<FieldRenderProps>> = {
  string: StringField,
  number: NumberField,
  boolean: BooleanField,
  enum: EnumField,
  array: ArrayField,
};
