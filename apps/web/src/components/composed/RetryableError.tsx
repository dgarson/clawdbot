"use client";

import * as React from "react";
import { RefreshCw, Clock, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useRetry, type UseRetryOptions } from "@/hooks/useRetry";
import { cn } from "@/lib/utils";

export interface RetryableErrorProps {
  /** The error that occurred */
  error: Error | null;
  /** The async operation to retry */
  onRetry: () => Promise<unknown>;
  /** Options for retry behavior */
  retryOptions?: UseRetryOptions;
  /** Custom title (default: derived from error) */
  title?: string;
  /** Custom description (default: generic error message) */
  description?: string;
  /** Whether to show as inline or card variant */
  variant?: "inline" | "card";
  /** Additional CSS classes */
  className?: string;
  /** Whether to auto-retry on mount (default: false) */
  autoRetry?: boolean;
  /** Children to render when there's no error */
  children?: React.ReactNode;
}

/**
 * A retry-aware error component that wraps operations with
 * exponential backoff retry logic and visual feedback.
 *
 * Features:
 * - Automatic retry with exponential backoff
 * - Visual countdown to next retry
 * - Progress bar showing retry attempts
 * - Manual retry button
 * - Cancel button to stop auto-retry
 *
 * @example
 * ```tsx
 * <RetryableError
 *   error={queryError}
 *   onRetry={() => refetch()}
 *   retryOptions={{ maxRetries: 3, baseDelay: 2000 }}
 *   title="Failed to load agents"
 * >
 *   <AgentsList agents={data} />
 * </RetryableError>
 * ```
 */
export function RetryableError({
  error,
  onRetry,
  retryOptions = {},
  title,
  description,
  variant = "card",
  className,
  autoRetry = false,
  children,
}: RetryableErrorProps) {
  const maxRetries = retryOptions.maxRetries ?? 3;

  const {
    isRetrying,
    attemptCount,
    lastError,
    isExhausted,
    nextRetryIn,
    execute,
    cancel,
    reset,
  } = useRetry(onRetry, retryOptions);
  const previousErrorRef = React.useRef<Error | null>(error);

  // Auto-retry on mount if configured and there's an error
  React.useEffect(() => {
    if (error !== previousErrorRef.current) {
      reset();
      previousErrorRef.current = error;
    }

    if (autoRetry && error && !isRetrying && !isExhausted) {
      execute();
    }
    // Only run on mount or when error changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRetry, error]);

  // If no error, render children
  if (!error && !lastError) {
    return <>{children}</>;
  }

  const displayError = lastError ?? error;
  const displayTitle = title ?? "Something went wrong";
  const displayDescription =
    description ??
    (displayError?.message || "An unexpected error occurred. Please try again.");

  const progressPercent =
    maxRetries > 0 ? Math.min(100, (attemptCount / maxRetries) * 100) : 0;

  const formatCountdown = (ms: number): string => {
    if (ms <= 0) return "now";
    const seconds = Math.ceil(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const content = (
    <div className="space-y-4">
      {/* Icon + Title */}
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            isExhausted
              ? "bg-destructive/10"
              : isRetrying
                ? "bg-yellow-500/10"
                : "bg-destructive/10",
          )}
        >
          {isRetrying ? (
            <RefreshCw className="h-5 w-5 text-yellow-500 animate-spin" />
          ) : isExhausted ? (
            <XCircle className="h-5 w-5 text-destructive" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-medium">
            {isRetrying
              ? `Retrying... (attempt ${attemptCount + 1}/${maxRetries + 1})`
              : isExhausted
                ? `${displayTitle} — retries exhausted`
                : displayTitle}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {displayDescription}
          </p>
        </div>
      </div>

      {/* Progress bar (during retrying) */}
      {isRetrying && maxRetries > 0 && (
        <div className="space-y-1.5">
          <Progress value={progressPercent} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {attemptCount} of {maxRetries} retries
            </span>
            {nextRetryIn !== null && nextRetryIn > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Next retry in {formatCountdown(nextRetryIn)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {isRetrying ? (
          <Button variant="outline" size="sm" onClick={cancel}>
            Cancel
          </Button>
        ) : (
          <>
            <Button
              size="sm"
              onClick={() => {
                reset();
                execute();
              }}
              className="gap-1.5"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              {isExhausted ? "Try Again" : "Retry Now"}
            </Button>
          </>
        )}
      </div>
    </div>
  );

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "rounded-lg border border-destructive/20 bg-destructive/5 p-4",
          className,
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <Card className={cn("border-destructive/20", className)}>
      <CardContent className="p-5">{content}</CardContent>
    </Card>
  );
}

export default RetryableError;
