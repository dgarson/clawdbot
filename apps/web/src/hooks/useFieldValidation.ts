/**
 * Field validation hook with debouncing.
 * Uses Zod schemas to validate form field values in real-time.
 */
import { useMemo, useState } from "react";
import { z } from "zod";
import { useDebounce } from "./useDebounce";

export interface FieldValidationResult {
  /** Whether the current value is valid */
  isValid: boolean;
  /** Error message if invalid, null if valid or empty */
  error: string | null;
  /** Whether validation is currently pending (debounce in progress) */
  isPending: boolean;
}

export interface UseFieldValidationOptions {
  /** Debounce delay in milliseconds (default: 300ms) */
  debounceMs?: number;
  /** Skip validation for empty values (default: true) */
  skipEmpty?: boolean;
  /** Validate immediately without debounce on first input */
  validateOnMount?: boolean;
}

/**
 * Hook for real-time field validation with debouncing.
 *
 * @param schema - Zod schema to validate against
 * @param value - Current field value
 * @param options - Validation options
 * @returns Validation result with isValid, error, and isPending
 *
 * @example
 * ```tsx
 * const { isValid, error } = useFieldValidation(
 *   anthropicApiKeySchema,
 *   apiKey
 * );
 *
 * return (
 *   <div>
 *     <Input
 *       value={apiKey}
 *       onChange={(e) => setApiKey(e.target.value)}
 *       aria-invalid={!isValid && !!error}
 *     />
 *     {error && <span className="text-destructive text-xs">{error}</span>}
 *   </div>
 * );
 * ```
 */
export function useFieldValidation<T>(
  schema: z.ZodSchema<T>,
  value: unknown,
  options: UseFieldValidationOptions = {}
): FieldValidationResult {
  const {
    debounceMs = 300,
    skipEmpty = true,
    validateOnMount = false,
  } = options;

  // Debounce the value
  const debouncedValue = useDebounce(value, debounceMs);

  // Track if debounce is pending
  const isPending = value !== debouncedValue;

  // Track if user has interacted (value has ever been non-empty)
  // Use lazy initialization to capture interaction from first non-empty value
  const [hasInteracted, setHasInteracted] = useState(() => {
    if (validateOnMount) {return true;}
    return value !== undefined && value !== "";
  });

  // Mark as interacted when value becomes non-empty (only update once)
  if (!hasInteracted && value !== undefined && value !== "") {
    setHasInteracted(true);
  }

  // Memoize validation result
  const validationResult = useMemo((): FieldValidationResult => {
    // Skip validation if not interacted yet
    if (!hasInteracted) {
      return { isValid: true, error: null, isPending: false };
    }

    // Skip validation for empty values if configured
    if (skipEmpty) {
      const isEmpty = debouncedValue === "" || debouncedValue === undefined || debouncedValue === null;
      if (isEmpty) {
        return { isValid: true, error: null, isPending };
      }
    }

    // Validate with schema
    const result = schema.safeParse(debouncedValue);

    if (result.success) {
      return { isValid: true, error: null, isPending };
    }

    // Extract first error message
    const firstError = result.error.issues[0];
    return {
      isValid: false,
      error: firstError?.message ?? "Invalid value",
      isPending,
    };
  }, [schema, debouncedValue, hasInteracted, skipEmpty, isPending]);

  return validationResult;
}

/**
 * Hook for validating multiple fields at once.
 *
 * @param validations - Array of validation results
 * @returns Combined validation state
 *
 * @example
 * ```tsx
 * const apiKeyValidation = useFieldValidation(apiKeySchema, apiKey);
 * const portValidation = useFieldValidation(portSchema, port);
 *
 * const { allValid, hasErrors } = useMultiFieldValidation([
 *   apiKeyValidation,
 *   portValidation,
 * ]);
 * ```
 */
export function useMultiFieldValidation(
  validations: FieldValidationResult[]
): {
  allValid: boolean;
  hasErrors: boolean;
  anyPending: boolean;
  errors: (string | null)[];
} {
  const errors = validations.map((v) => v.error);
  const hasErrors = errors.some((e) => e !== null);
  const allValid = validations.every((v) => v.isValid);
  const anyPending = validations.some((v) => v.isPending);

  return { allValid, hasErrors, anyPending, errors };
}

/**
 * Creates a validation handler that can be used for onChange with immediate feedback.
 * Returns both the validation result and the updated value.
 */
export function createFieldValidator<T>(
  schema: z.ZodSchema<T>
): (value: unknown) => { value: unknown; isValid: boolean; error: string | null } {
  return (value: unknown) => {
    const result = schema.safeParse(value);
    if (result.success) {
      return { value, isValid: true, error: null };
    }
    const firstError = result.error.issues[0];
    return {
      value,
      isValid: false,
      error: firstError?.message ?? "Invalid value",
    };
  };
}
