
import * as React from "react";
import { Loader2, AlertCircle, Save, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfigFieldGroup, AdvancedFieldsSection } from "./ConfigFieldGroup";
import { ConfigField } from "./ConfigField";
import {
  processSchemaFields,
  groupFields,
  filterFieldsBySection,
  setValueAtPath,
  type ConfigSchemaResponse,
  type ProcessedField,
  type FieldGroup,
} from "./schema-types";

export interface DynamicConfigFormProps {
  /** Schema response from the gateway */
  schemaResponse?: ConfigSchemaResponse | null;
  /** Current config values */
  values?: Record<string, unknown>;
  /** Called when values change */
  onChange?: (values: Record<string, unknown>) => void;
  /** Called when form is submitted */
  onSubmit?: (values: Record<string, unknown>) => void;
  /** Whether the form is loading */
  isLoading?: boolean;
  /** Whether the form is saving */
  isSaving?: boolean;
  /** Error message to display */
  error?: string | null;
  /** Optional section prefix to filter fields (e.g., "gateway" or "channels.telegram") */
  sectionPrefix?: string;
  /** Whether to show section groups as cards */
  groupAsCards?: boolean;
  /** Whether to show the submit button */
  showSubmitButton?: boolean;
  /** Whether to show the reset button */
  showResetButton?: boolean;
  /** Submit button label */
  submitLabel?: string;
  /** Additional className */
  className?: string;
}

/**
 * Dynamic configuration form that renders fields based on JSON schema and UI hints
 */
export function DynamicConfigForm({
  schemaResponse,
  values: externalValues,
  onChange: externalOnChange,
  onSubmit,
  isLoading = false,
  isSaving = false,
  error,
  sectionPrefix,
  groupAsCards = true,
  showSubmitButton = true,
  showResetButton = true,
  submitLabel = "Save Changes",
  className,
}: DynamicConfigFormProps) {
  // Internal state for uncontrolled mode
  const [internalValues, setInternalValues] = React.useState<Record<string, unknown>>({});
  const [initialValues, setInitialValues] = React.useState<Record<string, unknown>>({});
  const [hasChanges, setHasChanges] = React.useState(false);

  // Use external values if provided, otherwise use internal
  const values = externalValues ?? internalValues;
  const onChange = externalOnChange ?? setInternalValues;

  // Track initial values for reset
  React.useEffect(() => {
    if (externalValues) {
      setInitialValues(externalValues);
    }
  }, [externalValues]);

  // Process schema into field groups
  const fieldGroups = React.useMemo(() => {
    if (!schemaResponse) {return [];}

    const { schema, uiHints } = schemaResponse;
    let fields = processSchemaFields(schema, uiHints, "", schema.required ?? []);

    // Filter by section if specified
    if (sectionPrefix) {
      fields = filterFieldsBySection(fields, sectionPrefix);
    }

    return groupFields(fields, uiHints);
  }, [schemaResponse, sectionPrefix]);

  // Handle field change
  const handleFieldChange = React.useCallback(
    (path: string, value: unknown) => {
      const newValues = setValueAtPath(values as Record<string, unknown>, path, value);
      onChange(newValues);
      setHasChanges(true);
    },
    [values, onChange]
  );

  // Handle form submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(values as Record<string, unknown>);
  };

  // Handle reset
  const handleReset = () => {
    onChange(initialValues);
    setHasChanges(false);
  };

  // Loading state
  if (isLoading) {
    return <DynamicConfigFormSkeleton className={className} />;
  }

  // Error state
  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  // No schema loaded
  if (!schemaResponse) {
    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Configuration schema not loaded. Connect to the gateway to configure settings.
        </AlertDescription>
      </Alert>
    );
  }

  // No fields for this section
  if (fieldGroups.length === 0) {
    return (
      <Alert className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No configuration fields available for this section.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-6", className)}>
      {/* Field groups */}
      {groupAsCards ? (
        <div className="space-y-6">
          {fieldGroups.map((group) => (
            <ConfigFieldGroup
              key={group.key}
              group={group}
              values={values as Record<string, unknown>}
              onChange={handleFieldChange}
              disabled={isSaving}
            />
          ))}
        </div>
      ) : (
        <FlatFieldsRenderer
          groups={fieldGroups}
          values={values as Record<string, unknown>}
          onChange={handleFieldChange}
          disabled={isSaving}
        />
      )}

      {/* Action buttons */}
      {(showSubmitButton || showResetButton) && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          {showResetButton && hasChanges && (
            <Button
              type="button"
              variant="outline"
              onClick={handleReset}
              disabled={isSaving}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          )}
          {showSubmitButton && (
            <Button type="submit" disabled={isSaving || !hasChanges}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {submitLabel}
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </form>
  );
}

/**
 * Flat renderer for fields without card grouping
 */
interface FlatFieldsRendererProps {
  groups: FieldGroup[];
  values: Record<string, unknown>;
  onChange: (path: string, value: unknown) => void;
  disabled?: boolean;
}

function FlatFieldsRenderer({
  groups,
  values,
  onChange,
  disabled,
}: FlatFieldsRendererProps) {
  // Flatten all fields
  const normalFields: ProcessedField[] = [];
  const advancedFields: ProcessedField[] = [];

  for (const group of groups) {
    normalFields.push(...group.fields);
    advancedFields.push(...group.advancedFields);
  }

  // Sort by order
  normalFields.sort((a, b) => (a.hint.order ?? 1000) - (b.hint.order ?? 1000));
  advancedFields.sort((a, b) => (a.hint.order ?? 1000) - (b.hint.order ?? 1000));

  return (
    <div className="space-y-6">
      {/* Normal fields */}
      <div className="space-y-4">
        {normalFields.map((field) => (
          <FieldWithValue
            key={field.path}
            field={field}
            values={values}
            onChange={onChange}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Advanced fields */}
      {advancedFields.length > 0 && (
        <AdvancedFieldsSection
          fields={advancedFields}
          values={values}
          onChange={onChange}
          disabled={disabled}
        />
      )}
    </div>
  );
}

/**
 * Single field with value lookup
 */
interface FieldWithValueProps {
  field: ProcessedField;
  values: Record<string, unknown>;
  onChange: (path: string, value: unknown) => void;
  disabled?: boolean;
}

function FieldWithValue({
  field,
  values,
  onChange,
  disabled,
}: FieldWithValueProps) {
  const value = getNestedValue(values, field.path);

  return (
    <ConfigField
      field={field}
      value={value}
      onChange={onChange}
      disabled={disabled}
    />
  );
}

/**
 * Get nested value from object using dot path
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
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
 * Loading skeleton for the form
 */
function DynamicConfigFormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      {/* Simulate 2 card groups */}
      {[1, 2].map((i) => (
        <div key={i} className="rounded-lg border p-6 space-y-4">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-4">
            {[1, 2, 3].map((j) => (
              <div key={j} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-9 w-full" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default DynamicConfigForm;
