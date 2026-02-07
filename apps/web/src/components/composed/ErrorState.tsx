"use client";

import * as React from "react";
import { AlertCircle, RefreshCw, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type ErrorStateVariant = "inline" | "card";

export interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error description (user-friendly message) */
  description?: string;
  /** Variant: "inline" for small inline errors, "card" for full card display */
  variant?: ErrorStateVariant;
  /** Retry handler - shows "Try Again" button when provided */
  onRetry?: () => void;
  /** Whether a retry is currently in progress */
  isRetrying?: boolean;
  /** Optional "Learn More" link URL */
  learnMoreUrl?: string;
  /** Optional "Learn More" link text */
  learnMoreLabel?: string;
  /** Custom icon (defaults to AlertCircle) */
  icon?: React.ReactNode;
  /** Additional className */
  className?: string;
  /** Children to render below the error message */
  children?: React.ReactNode;
}

/**
 * Reusable error state component with retry functionality.
 * Use for displaying errors in config sections and data loading states.
 *
 * @example
 * // Inline variant (small, minimal)
 * <ErrorState
 *   variant="inline"
 *   title="Failed to load"
 *   description="Please check your connection."
 *   onRetry={refetch}
 * />
 *
 * @example
 * // Card variant (full, prominent)
 * <ErrorState
 *   variant="card"
 *   title="Gateway unreachable"
 *   description="Cannot connect to the gateway. Make sure it's running."
 *   onRetry={handleReconnect}
 *   learnMoreUrl="/docs/gateway"
 * />
 */
export function ErrorState({
  title = "Something went wrong",
  description,
  variant = "inline",
  onRetry,
  isRetrying = false,
  learnMoreUrl,
  learnMoreLabel = "Learn more",
  icon,
  className,
  children,
}: ErrorStateProps) {
  const IconElement = icon ?? (
    <AlertCircle className="h-5 w-5 text-destructive" />
  );

  if (variant === "inline") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center py-8 px-4 text-center",
          className
        )}
        role="alert"
        aria-live="polite"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 mb-3">
          {IconElement}
        </div>
        <h4 className="text-sm font-medium text-foreground mb-1">{title}</h4>
        {description && (
          <p className="text-sm text-muted-foreground max-w-sm mb-4">
            {description}
          </p>
        )}
        <div className="flex items-center gap-3">
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={isRetrying}
            >
              <RefreshCw
                className={cn("h-4 w-4", isRetrying && "animate-spin")}
              />
              {isRetrying ? "Retrying..." : "Try Again"}
            </Button>
          )}
          {learnMoreUrl && (
            <a
              href={learnMoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {learnMoreLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {children}
      </div>
    );
  }

  // Card variant
  return (
    <Card className={cn("border-destructive/50", className)} role="alert" aria-live="polite">
      <CardContent className="flex flex-col items-center justify-center py-8 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
          {React.isValidElement(icon) ? (
            React.cloneElement(icon as React.ReactElement<{ className?: string }>, {
              className: cn(
                "h-6 w-6 text-destructive",
                (icon as React.ReactElement<{ className?: string }>).props.className
              ),
            })
          ) : (
            <AlertCircle className="h-6 w-6 text-destructive" />
          )}
        </div>
        <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            {description}
          </p>
        )}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          {onRetry && (
            <Button onClick={onRetry} disabled={isRetrying}>
              <RefreshCw
                className={cn("h-4 w-4", isRetrying && "animate-spin")}
              />
              {isRetrying ? "Retrying..." : "Try Again"}
            </Button>
          )}
          {learnMoreUrl && (
            <Button variant="outline" asChild>
              <a
                href={learnMoreUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {learnMoreLabel}
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

/**
 * Pre-configured error states for common scenarios
 */
export const errorMessages = {
  agents: {
    title: "Failed to load agents",
    description:
      "We couldn't load your agents. Please check your connection and try again.",
  },
  gateway: {
    title: "Gateway unreachable",
    description:
      "Cannot connect to the gateway. Make sure it's running and try again.",
  },
  channels: {
    title: "Failed to get channel status",
    description:
      "Failed to get channel status. Some channels may not be available.",
  },
  health: {
    title: "Health check failed",
    description:
      "Unable to check system health. Please verify your connection and try again.",
  },
  config: {
    title: "Failed to load configuration",
    description:
      "We couldn't load your settings. Please check your connection and try again.",
  },
  generic: {
    title: "Something went wrong",
    description:
      "An unexpected error occurred. Please try again.",
  },
} as const;

export default ErrorState;
