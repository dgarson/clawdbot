"use client";

import * as React from "react";
import { AlertTriangle, Home, RefreshCw, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUIStore } from "@/stores/useUIStore";
import * as Collapsible from "@radix-ui/react-collapsible";
import { cn } from "@/lib/utils";

export interface ErrorFallbackProps {
  error?: Error;
  onReset?: () => void;
  onGoHome?: () => void;
}

export function ErrorFallback({ error, onReset, onGoHome }: ErrorFallbackProps) {
  const powerUserMode = useUIStore((s) => s.powerUserMode);
  const [showDetails, setShowDetails] = React.useState(false);

  const handleGoHome = React.useCallback(() => {
    if (onGoHome) {
      onGoHome();
    } else {
      window.location.href = "/";
    }
  }, [onGoHome]);

  const handleRefresh = React.useCallback(() => {
    if (onReset) {
      onReset();
    } else {
      window.location.reload();
    }
  }, [onReset]);

  return (
    <div className="flex min-h-[400px] w-full items-center justify-center p-6">
      <Card className="w-full max-w-md border-destructive/50">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            An unexpected error occurred. Please try refreshing the page or go
            back to the home screen.
          </p>

          {/* Error Details (Power User Mode or collapsible) */}
          {error && (
            <Collapsible.Root
              open={powerUserMode || showDetails}
              onOpenChange={setShowDetails}
            >
              {!powerUserMode && (
                <Collapsible.Trigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-between text-muted-foreground"
                  >
                    <span>View error details</span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 transition-transform",
                        showDetails && "rotate-180"
                      )}
                    />
                  </Button>
                </Collapsible.Trigger>
              )}
              <Collapsible.Content>
                <div className="mt-2 rounded-lg bg-muted/50 p-3">
                  <p className="mb-1 text-xs font-medium text-muted-foreground">
                    Error Message:
                  </p>
                  <pre className="whitespace-pre-wrap text-xs text-destructive">
                    {error.message}
                  </pre>
                  {powerUserMode && error.stack && (
                    <>
                      <p className="mb-1 mt-3 text-xs font-medium text-muted-foreground">
                        Stack Trace:
                      </p>
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-[10px] text-muted-foreground">
                        {error.stack}
                      </pre>
                    </>
                  )}
                </div>
              </Collapsible.Content>
            </Collapsible.Root>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleGoHome}
            >
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
            <Button className="flex-1" onClick={handleRefresh}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ErrorFallback;
