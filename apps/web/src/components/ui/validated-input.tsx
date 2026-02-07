"use client";

import * as React from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useFieldValidation } from "@/hooks/useFieldValidation";

export interface ValidatedInputProps
  extends Omit<React.ComponentProps<typeof Input>, "aria-invalid"> {
  /** Zod schema for validation */
  schema?: z.ZodSchema;
  /** Error message to display (overrides schema validation) */
  error?: string | null;
  /** Hint text shown below input */
  hint?: React.ReactNode;
  /** Debounce delay for validation in ms (default: 300) */
  debounceMs?: number;
  /** Skip validation for empty values (default: true) */
  skipEmpty?: boolean;
  /** Callback when validation state changes */
  onValidationChange?: (isValid: boolean, error: string | null) => void;
}

/**
 * Input with built-in Zod validation and error display.
 *
 * @example
 * ```tsx
 * <ValidatedInput
 *   schema={anthropicApiKeySchema}
 *   value={apiKey}
 *   onChange={(e) => setApiKey(e.target.value)}
 *   placeholder="sk-ant-..."
 *   hint="Get your API key from the Anthropic console"
 * />
 * ```
 */
export function ValidatedInput({
  schema,
  error: externalError,
  hint,
  debounceMs = 300,
  skipEmpty = true,
  className,
  value,
  onValidationChange,
  ...props
}: ValidatedInputProps) {
  // Use schema validation if provided
  const validation = useFieldValidation(
    schema ?? z.string(),
    value,
    { debounceMs, skipEmpty }
  );

  // External error takes precedence
  const displayError = externalError ?? validation.error;
  const isInvalid = !!displayError;

  // Notify parent of validation changes
  React.useEffect(() => {
    if (onValidationChange) {
      onValidationChange(validation.isValid, validation.error);
    }
  }, [validation.isValid, validation.error, onValidationChange]);

  return (
    <div className="space-y-1.5">
      <Input
        value={value}
        className={cn(
          isInvalid && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/20",
          className
        )}
        aria-invalid={isInvalid}
        {...props}
      />
      {/* Error message */}
      {displayError && (
        <p className="text-xs text-destructive animate-in fade-in slide-in-from-top-1 duration-200">
          {displayError}
        </p>
      )}
      {/* Hint text (only show if no error) */}
      {!displayError && hint && (
        <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

export default ValidatedInput;
