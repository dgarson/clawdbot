import { useState, useCallback, useRef, useEffect } from "react";

/**
 * Options for the useRetry hook.
 */
export interface UseRetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff (default: 1000) */
  baseDelay?: number;
  /** Maximum delay in ms between retries (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffFactor?: number;
  /** Add jitter to avoid thundering herd (default: true) */
  jitter?: boolean;
  /** Callback when all retries are exhausted */
  onExhausted?: (error: Error, attempts: number) => void;
  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: Error, nextDelayMs: number) => void;
  /** Determine if an error is retryable (default: all errors are retryable) */
  isRetryable?: (error: Error) => boolean;
}

export interface UseRetryState {
  /** Whether a retry operation is currently in progress */
  isRetrying: boolean;
  /** Number of retry attempts made so far */
  attemptCount: number;
  /** The last error encountered */
  lastError: Error | null;
  /** Whether all retries have been exhausted */
  isExhausted: boolean;
  /** Time in ms until next retry (null if not waiting) */
  nextRetryIn: number | null;
}

export interface UseRetryReturn<T> extends UseRetryState {
  /** Execute the operation with retry logic */
  execute: () => Promise<T | undefined>;
  /** Cancel any pending retry */
  cancel: () => void;
  /** Reset the retry state */
  reset: () => void;
}

/**
 * Calculate delay with exponential backoff and optional jitter.
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffFactor: number,
  jitter: boolean,
): number {
  const exponentialDelay = baseDelay * Math.pow(backoffFactor, attempt);
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  if (!jitter) return cappedDelay;
  // Full jitter: random value between 0 and cappedDelay
  return Math.random() * cappedDelay;
}

/**
 * React hook for retrying async operations with exponential backoff.
 *
 * Features:
 * - Exponential backoff with configurable base delay and multiplier
 * - Optional jitter to avoid thundering herd problems
 * - Countdown timer showing time until next retry
 * - Configurable retry count, max delay, and retryability check
 * - Cancel and reset controls
 *
 * @example
 * ```tsx
 * const { execute, isRetrying, attemptCount, lastError, cancel, reset } = useRetry(
 *   async () => {
 *     const response = await fetch('/api/data');
 *     if (!response.ok) throw new Error('Failed to fetch');
 *     return response.json();
 *   },
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 *
 * // Trigger the operation
 * const data = await execute();
 * ```
 */
export function useRetry<T>(
  operation: () => Promise<T>,
  options: UseRetryOptions = {},
): UseRetryReturn<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    jitter = true,
    onExhausted,
    onRetry,
    isRetryable = () => true,
  } = options;

  const [state, setState] = useState<UseRetryState>({
    isRetrying: false,
    attemptCount: 0,
    lastError: null,
    isExhausted: false,
    nextRetryIn: null,
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const mountedRef = useRef(true);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimers();
    };
  }, [clearTimers]);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    clearTimers();
    if (mountedRef.current) {
      setState((prev) => ({ ...prev, isRetrying: false, nextRetryIn: null }));
    }
  }, [clearTimers]);

  const reset = useCallback(() => {
    cancel();
    cancelledRef.current = false;
    if (mountedRef.current) {
      setState({
        isRetrying: false,
        attemptCount: 0,
        lastError: null,
        isExhausted: false,
        nextRetryIn: null,
      });
    }
  }, [cancel]);

  const execute = useCallback(async (): Promise<T | undefined> => {
    cancelledRef.current = false;
    clearTimers();
    setState((prev) => ({
      ...prev,
      isRetrying: true,
      attemptCount: 0,
      lastError: null,
      isExhausted: false,
      nextRetryIn: null,
    }));

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (cancelledRef.current || !mountedRef.current) return undefined;

      try {
        const result = await operation();
        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            isRetrying: false,
            lastError: null,
            nextRetryIn: null,
          }));
        }
        return result;
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));

        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            attemptCount: attempt + 1,
            lastError: error,
          }));
        }

        // Check if we should retry
        if (attempt >= maxRetries || !isRetryable(error)) {
          if (mountedRef.current) {
            setState((prev) => ({
              ...prev,
              isRetrying: false,
              isExhausted: true,
              nextRetryIn: null,
            }));
          }
          onExhausted?.(error, attempt + 1);
          return undefined;
        }

        // Calculate delay and wait
        const delay = calculateDelay(attempt, baseDelay, maxDelay, backoffFactor, jitter);
        onRetry?.(attempt + 1, error, delay);

        // Start countdown
        const startTime = Date.now();
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, nextRetryIn: Math.ceil(delay) }));
        }

        if (countdownRef.current) clearInterval(countdownRef.current);
        countdownRef.current = setInterval(() => {
          const remaining = Math.max(0, delay - (Date.now() - startTime));
          if (mountedRef.current) {
            setState((prev) => ({ ...prev, nextRetryIn: Math.ceil(remaining) }));
          }
          if (remaining <= 0 && countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
        }, 100);

        // Wait for the delay
        await new Promise<void>((resolve) => {
          timerRef.current = setTimeout(resolve, delay);
        });

        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }
    }

    return undefined;
  }, [operation, maxRetries, baseDelay, maxDelay, backoffFactor, jitter, onExhausted, onRetry, isRetryable, clearTimers]);

  return { ...state, execute, cancel, reset };
}

/**
 * Standalone retry utility for async functions (non-React).
 *
 * @example
 * ```ts
 * const data = await withRetry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { maxRetries: 3, baseDelay: 1000 }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Omit<UseRetryOptions, "onRetry" | "onExhausted"> & {
    onRetry?: (attempt: number, error: Error) => void;
  } = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    jitter = true,
    isRetryable = () => true,
    onRetry,
  } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));

      if (attempt >= maxRetries || !isRetryable(error)) {
        throw error;
      }

      const delay = calculateDelay(attempt, baseDelay, maxDelay, backoffFactor, jitter);
      onRetry?.(attempt + 1, error);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs this
  throw new Error("Retry exhausted");
}
