"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  WelcomeStep,
  RiskAcknowledgementStep,
  ModelProviderStep,
  GatewaySetupStep,
  SuccessStep,
  type ModelProvider,
  type GatewayMode,
} from "./steps";

// Step configuration
const STEPS = [
  { id: "welcome", title: "Welcome", canSkip: false },
  { id: "risk", title: "Acknowledgement", canSkip: false },
  { id: "provider", title: "AI Provider", canSkip: true },
  { id: "gateway", title: "Gateway", canSkip: true },
  { id: "success", title: "Complete", canSkip: false },
] as const;

interface OnboardingState {
  currentStep: number;
  riskAccepted: boolean;
  modelProvider: {
    provider: ModelProvider;
    apiKey: string;
    baseUrl?: string; // For local/Ollama models
  };
  gateway: {
    mode: GatewayMode;
    endpoint?: string;
  };
}

interface OnboardingWizardProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

export function OnboardingWizard({ onComplete, onCancel }: OnboardingWizardProps) {
  const navigate = useNavigate();

  const [state, setState] = React.useState<OnboardingState>({
    currentStep: 0,
    riskAccepted: false,
    modelProvider: {
      provider: "openai",
      apiKey: "",
      baseUrl: "",
    },
    gateway: {
      mode: "auto",
    },
  });

  const currentStepConfig = STEPS[state.currentStep];
  const isFirstStep = state.currentStep === 0;
  const isSuccessStep = currentStepConfig.id === "success";

  // Calculate progress percentage
  const progress = ((state.currentStep) / (STEPS.length - 1)) * 100;

  const canProceed = React.useMemo(() => {
    switch (currentStepConfig.id) {
      case "welcome":
        return true;
      case "risk":
        return state.riskAccepted;
      case "provider":
        // Require API key to be filled in to proceed (can't click Continue without it)
        // User must click "Skip for now" if they want to skip
        return state.modelProvider.apiKey.length > 0;
      case "gateway":
        return state.gateway.mode !== "remote" || (state.gateway.endpoint?.length ?? 0) > 0;
      case "success":
        return true;
      default:
        return false;
    }
  }, [currentStepConfig.id, state]);

  const handleNext = () => {
    if (state.currentStep < STEPS.length - 1) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  };

  const handleBack = () => {
    if (state.currentStep > 0) {
      setState((prev) => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  };

  const handleSkip = () => {
    handleNext();
  };

  const handleGoToDashboard = () => {
    onComplete?.();
    navigate({ to: "/" });
  };

  const handleStartChat = () => {
    onComplete?.();
    navigate({ to: "/conversations" });
  };

  const handleCancel = () => {
    onCancel?.();
    navigate({ to: "/" });
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header with progress */}
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <div className="flex items-center gap-4">
          {/* Back button (hidden on first step and success step) */}
          {!isFirstStep && !isSuccessStep && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="gap-1"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          )}
        </div>

        {/* Step indicator dots */}
        {!isSuccessStep && (
          <div className="flex items-center gap-2">
            {STEPS.slice(0, -1).map((step, index) => (
              <div
                key={step.id}
                className={cn(
                  "h-2 rounded-full transition-all duration-300",
                  index === state.currentStep
                    ? "w-8 bg-primary"
                    : index < state.currentStep
                      ? "w-2 bg-primary/60"
                      : "w-2 bg-muted"
                )}
              />
            ))}
          </div>
        )}

        {/* Close button */}
        {!isSuccessStep && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </Button>
        )}

        {/* Placeholder for layout balance on success */}
        {isSuccessStep && <div className="w-20" />}
      </header>

      {/* Progress bar */}
      {!isSuccessStep && (
        <div className="h-1 bg-muted">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto flex items-center justify-center">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {currentStepConfig.id === "welcome" && (
                <WelcomeStep onContinue={handleNext} />
              )}

              {currentStepConfig.id === "risk" && (
                <RiskAcknowledgementStep
                  accepted={state.riskAccepted}
                  onAcceptChange={(accepted) =>
                    setState((prev) => ({ ...prev, riskAccepted: accepted }))
                  }
                />
              )}

              {currentStepConfig.id === "provider" && (
                <ModelProviderStep
                  config={state.modelProvider}
                  onConfigChange={(config) =>
                    setState((prev) => ({ ...prev, modelProvider: config }))
                  }
                />
              )}

              {currentStepConfig.id === "gateway" && (
                <GatewaySetupStep
                  config={state.gateway}
                  onConfigChange={(config) =>
                    setState((prev) => ({ ...prev, gateway: config }))
                  }
                />
              )}

              {currentStepConfig.id === "success" && (
                <SuccessStep
                  onGoToDashboard={handleGoToDashboard}
                  onStartChat={handleStartChat}
                />
              )}

              {/* Footer with navigation buttons - now inside content flow */}
              {!isFirstStep && !isSuccessStep && (
                <footer className="flex items-center justify-between pt-5 mt-6 border-t">
                  <div>
                    {currentStepConfig.canSkip && (
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={handleSkip}
                        className="border-muted-foreground/30 hover:border-muted-foreground/50"
                      >
                        Skip for now
                      </Button>
                    )}
                  </div>

                  <div className="flex items-center gap-3 sm:gap-4">
                    <span className="text-sm sm:text-base text-muted-foreground">
                      Step {state.currentStep} of {STEPS.length - 1}
                    </span>
                    <Button
                      size="lg"
                      onClick={handleNext}
                      disabled={!canProceed}
                    >
                      {state.currentStep === STEPS.length - 2 ? "Finish" : "Continue"}
                      <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                    </Button>
                  </div>
                </footer>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

export default OnboardingWizard;
