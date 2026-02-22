import * as React from "react";

/**
 * Hook for managing dynamic config form state
 */
export function useDynamicConfigForm() {
  const [values, setValues] = React.useState<Record<string, unknown>>({});
  const [initialValues, setInitialValues] = React.useState<Record<string, unknown>>({});

  const isDirty = React.useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  const reset = React.useCallback(() => {
    setValues(initialValues);
  }, [initialValues]);

  const initialize = React.useCallback((config: Record<string, unknown>) => {
    setValues(config);
    setInitialValues(config);
  }, []);

  return {
    values,
    setValues,
    isDirty,
    reset,
    initialize,
  };
}
