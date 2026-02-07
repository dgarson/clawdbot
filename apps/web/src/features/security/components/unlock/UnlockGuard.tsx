"use client";

import * as React from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useSecurity, useNeedsUnlock } from "../../SecurityProvider";
import { shouldSkipUnlock } from "../../lib/security-config";

interface UnlockGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component that redirects to unlock screen if needed.
 *
 * Renders a brief loading state while checking, then either:
 * - Redirects to /unlock if locked
 * - Renders children if unlocked or on a skip path
 *
 * Skip paths (no redirect):
 * - /unlock (avoid redirect loop)
 * - /onboarding (onboarding flow)
 * - /health (debugging)
 * - /debug (debugging)
 */
export function UnlockGuard({ children }: UnlockGuardProps) {
  const { isLoading } = useSecurity();
  const needsUnlock = useNeedsUnlock();
  const location = useLocation();
  const navigate = useNavigate();
  const [hasChecked, setHasChecked] = React.useState(false);

  // Check if current path should skip unlock check
  const shouldSkip = shouldSkipUnlock(location.pathname);

  React.useEffect(() => {
    // Don't redirect if we should skip
    if (shouldSkip) {
      setHasChecked(true);
      return;
    }

    // Wait for loading to complete
    if (isLoading) {
      return;
    }

    // Redirect to unlock if needed
    if (needsUnlock) {
      navigate({ to: "/unlock" });
    }

    setHasChecked(true);
  }, [needsUnlock, isLoading, shouldSkip, navigate]);

  // If on a skip path, render children immediately
  if (shouldSkip) {
    return <>{children}</>;
  }

  // Show minimal loading indicator while checking
  if (isLoading || (!hasChecked && needsUnlock)) {
    return <UnlockLoadingState />;
  }

  // If needs unlock, don't render children (redirect is happening)
  if (needsUnlock) {
    return <UnlockLoadingState />;
  }

  // Unlocked, render the app
  return <>{children}</>;
}

/**
 * Minimal loading state shown during unlock check.
 */
function UnlockLoadingState() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export default UnlockGuard;
