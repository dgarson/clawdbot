import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Progress state for an async operation.
 */
export interface OperationProgress {
  /** Current step index (0-based) */
  current: number;
  /** Total steps */
  total: number;
  /** Current step description */
  message?: string;
  /** Percentage complete (0-100) */
  percent: number;
}

/**
 * State for an async operation.
 */
export type OperationState = "idle" | "running" | "success" | "error";

/**
 * Options for the useAsyncOperation hook.
 */
export interface UseAsyncOperationOptions {
  /** Auto-reset to idle after success (ms). 0 = no auto-reset. Default: 3000 */
  autoResetMs?: number;
  /** Callback on success */
  onSuccess?: () => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface UseAsyncOperationReturn<T> {
  /** Current operation state */
  state: OperationState;
  /** Progress info (only during running state) */
  progress: OperationProgress | null;
  /** Error if state is "error" */
  error: Error | null;
  /** Result data if state is "success" */
  data: T | null;
  /** Whether the operation is currently running */
  isRunning: boolean;
  /** Whether the operation completed successfully */
  isSuccess: boolean;
  /** Whether the operation failed */
  isError: boolean;
  /** Start the operation */
  execute: (...args: unknown[]) => Promise<T | undefined>;
  /** Reset to idle state */
  reset: () => void;
  /** Update progress manually (for operations that report progress) */
  setProgress: (progress: Partial<OperationProgress>) => void;
}

/**
 * Hook for managing async operations with progress tracking.
 *
 * Provides state machine (idle → running → success/error) with optional
 * progress updates and auto-reset behavior.
 *
 * @example
 * ```tsx
 * const { execute, state, progress, error } = useAsyncOperation(
 *   async (setProgress) => {
 *     setProgress({ current: 0, total: 3, message: "Fetching data..." });
 *     const data = await fetchData();
 *     setProgress({ current: 1, message: "Processing..." });
 *     await process(data);
 *     setProgress({ current: 2, message: "Saving..." });
 *     await save(data);
 *     setProgress({ current: 3, message: "Done!" });
 *     return data;
 *   },
 *   { autoResetMs: 5000 }
 * );
 * ```
 */
export function useAsyncOperation<T>(
  operation: (
    setProgress: (progress: Partial<OperationProgress>) => void,
  ) => Promise<T>,
  options: UseAsyncOperationOptions = {},
): UseAsyncOperationReturn<T> {
  const { autoResetMs = 3000, onSuccess, onError } = options;

  const [state, setState] = useState<OperationState>("idle");
  const [progress, setProgressState] = useState<OperationProgress | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const mountedRef = useRef(true);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, []);

  const reset = useCallback(() => {
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    if (mountedRef.current) {
      setState("idle");
      setProgressState(null);
      setError(null);
      setData(null);
    }
  }, []);

  const setProgress = useCallback(
    (update: Partial<OperationProgress>) => {
      if (!mountedRef.current) return;
      setProgressState((prev) => {
        const next = {
          current: update.current ?? prev?.current ?? 0,
          total: update.total ?? prev?.total ?? 0,
          message: update.message ?? prev?.message,
          percent: 0,
        };
        next.percent =
          next.total > 0
            ? Math.min(100, Math.round((next.current / next.total) * 100))
            : 0;
        return next;
      });
    },
    [],
  );

  const execute = useCallback(
    async (..._args: unknown[]): Promise<T | undefined> => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }

      setState("running");
      setError(null);
      setData(null);
      setProgressState(null);

      try {
        const result = await operation(setProgress);

        if (mountedRef.current) {
          setState("success");
          setData(result);
          onSuccess?.();

          if (autoResetMs > 0) {
            resetTimerRef.current = setTimeout(() => {
              if (mountedRef.current) {
                setState("idle");
                setProgressState(null);
              }
            }, autoResetMs);
          }
        }

        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (mountedRef.current) {
          setState("error");
          setError(error);
          onError?.(error);
        }
        return undefined;
      }
    },
    [operation, setProgress, autoResetMs, onSuccess, onError],
  );

  return {
    state,
    progress,
    error,
    data,
    isRunning: state === "running",
    isSuccess: state === "success",
    isError: state === "error",
    execute,
    reset,
    setProgress,
  };
}
