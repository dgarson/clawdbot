import { toast, type ExternalToast } from "sonner";

/**
 * Toast notification helpers for consistent messaging across the app.
 * Uses Sonner for lightweight, accessible toast notifications.
 */

export type ToastOptions = ExternalToast;

/**
 * Show a success toast notification
 */
export function showSuccess(message: string, options?: ToastOptions) {
  return toast.success(message, options);
}

/**
 * Show an error toast notification
 */
export function showError(message: string, options?: ToastOptions) {
  return toast.error(message, options);
}

/**
 * Show an info toast notification
 */
export function showInfo(message: string, options?: ToastOptions) {
  return toast.info(message, options);
}

/**
 * Show a warning toast notification
 */
export function showWarning(message: string, options?: ToastOptions) {
  return toast.warning(message, options);
}

/**
 * Show a loading toast that can be updated
 */
export function showLoading(message: string, options?: ToastOptions) {
  return toast.loading(message, options);
}

/**
 * Show a promise-based toast that handles loading/success/error states
 */
export function showPromise<T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: unknown) => string);
  },
  options?: Omit<ToastOptions, "description">
) {
  return toast.promise(promise, { ...options, ...messages });
}

/**
 * Dismiss a specific toast or all toasts
 */
export function dismissToast(toastId?: string | number) {
  return toast.dismiss(toastId);
}

/**
 * Update an existing toast
 */
export function updateToast(
  toastId: string | number,
  message: string,
  options?: ToastOptions
) {
  return toast(message, { ...options, id: toastId });
}
