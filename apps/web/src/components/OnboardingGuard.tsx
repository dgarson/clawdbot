"use client";

import * as React from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useOnboardingCheck } from "@/hooks/useOnboardingCheck";
import { Loader2 } from "lucide-react";

/** Paths that should bypass the onboarding check */
const SKIP_PATHS = [
  "/onboarding",
  "/health",
  "/debug",
] as const;

interface OnboardingGuardProps {
  children: React.ReactNode;
}

/**
 * Guard component that redirects unconfigured users to onboarding.
 *
 * Renders a brief loading state while checking, then either:
 * - Redirects to /onboarding if not onboarded
 * - Renders children if onboarded or on a skip path
 *
 * Skip paths (no redirect):
 * - /onboarding (avoid redirect loop)
 * - /health (debugging)
 * - /debug (debugging)
 */
export function OnboardingGuard({ children }: OnboardingGuardProps) {
  const { isOnboarded, isLoading } = useOnboardingCheck();
  const location = useLocation();
  const navigate = useNavigate();
  const [hasChecked, setHasChecked] = React.useState(false);

  // Check if current path should skip onboarding check
  const shouldSkip = SKIP_PATHS.some((path) =>
    location.pathname.startsWith(path)
  );

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

    // Redirect to onboarding if not onboarded
    if (!isOnboarded) {
      navigate({ to: "/onboarding" });
    }

    setHasChecked(true);
  }, [isOnboarded, isLoading, shouldSkip, navigate]);

  // If on a skip path, render children immediately
  if (shouldSkip) {
    return <>{children}</>;
  }

  // Show minimal loading indicator while checking
  if (isLoading || (!hasChecked && !isOnboarded)) {
    return <OnboardingLoadingState />;
  }

  // If not onboarded, don't render children (redirect is happening)
  if (!isOnboarded) {
    return <OnboardingLoadingState />;
  }

  // Onboarded, render the app
  return <>{children}</>;
}

/**
 * Minimal loading state shown during onboarding check.
 * Uses a subtle, centered spinner to minimize visual disruption.
 */
function OnboardingLoadingState() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

export default OnboardingGuard;
