"use client";

import { createFileRoute } from "@tanstack/react-router";
import { OnboardingWizard } from "@/components/domain/onboarding";
import { markOnboardingComplete } from "@/hooks/useOnboardingCheck";

export const Route = createFileRoute("/onboarding/")({
  component: OnboardingPage,
});

function OnboardingPage() {
  const handleComplete = () => {
    // Mark onboarding as complete in localStorage
    markOnboardingComplete();
  };

  const handleCancel = () => {
    // User cancelled onboarding - they can return later
    console.log("Onboarding cancelled");
  };

  return (
    <OnboardingWizard
      onComplete={handleComplete}
      onCancel={handleCancel}
    />
  );
}
