/**
 * Optimistic UI update utilities.
 *
 * Pattern:
 *  1. Snapshot the current state
 *  2. Apply the optimistic change immediately (UI updates instantly)
 *  3. Perform the async API call
 *  4. On success: optionally refresh from server to reconcile
 *  5. On error: rollback to the snapshot and show an error toast
 */

import { toast } from "../components/toast.ts";

/**
 * Execute an async mutation with optimistic UI updates and automatic rollback on error.
 *
 * @param opts.apply    – apply the optimistic change to the state (called synchronously before the API call)
 * @param opts.rollback – restore the original state if the API call fails
 * @param opts.mutate   – the actual async API call
 * @param opts.refresh  – optional post-success refresh (e.g. reload from server for reconciliation)
 * @param opts.onError  – optional custom error handler (in addition to rollback)
 * @param opts.toastError – if true (default), show an error toast on failure
 * @param opts.errorTitle – optional title for the error toast
 */
export async function optimistic<T = void>(opts: {
  apply: () => void;
  rollback: () => void;
  mutate: () => Promise<T>;
  refresh?: () => Promise<void>;
  onError?: (err: unknown) => void;
  toastError?: boolean;
  errorTitle?: string;
}): Promise<T | undefined> {
  const { apply, rollback, mutate, refresh, onError, errorTitle } = opts;
  const showToast = opts.toastError !== false; // default true

  // Step 1: Apply the optimistic change immediately
  apply();

  try {
    // Step 2: Perform the real API call
    const result = await mutate();

    // Step 3: Optionally refresh from server for reconciliation
    if (refresh) {
      try {
        await refresh();
      } catch {
        // Refresh failure is non-critical; the optimistic state is still valid
      }
    }

    return result;
  } catch (err) {
    // Step 4: Rollback on error
    rollback();

    if (showToast) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error(message, errorTitle ?? "Action failed");
    }

    onError?.(err);
    return undefined;
  }
}

/**
 * Create a shallow snapshot of a value for later rollback.
 * Works with arrays (shallow copy) and plain objects (spread).
 */
export function snapshot<T>(value: T): T {
  if (Array.isArray(value)) {
    return [...value] as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    return { ...value };
  }
  return value;
}
