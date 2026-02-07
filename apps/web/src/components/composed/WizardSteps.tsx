"use client";

import { cn } from "@/lib/utils";

interface WizardStepsProps {
  steps: string[];
  currentStep: number;
  onStepChange?: (step: number) => void;
  className?: string;
}

export function WizardSteps({ steps, currentStep, onStepChange, className }: WizardStepsProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {steps.map((label, index) => {
        const isActive = index === currentStep;
        const isComplete = index < currentStep;
        const isClickable = onStepChange && index <= currentStep;

        return (
          <button
            key={label}
            type="button"
            onClick={isClickable ? () => onStepChange(index) : undefined}
            className={cn(
              "group inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition",
              isActive
                ? "border-primary/60 bg-primary/10 text-primary"
                : isComplete
                  ? "border-foreground/10 bg-foreground/5 text-foreground"
                  : "border-border text-muted-foreground",
              isClickable ? "hover:border-primary/40 hover:text-foreground" : "cursor-default"
            )}
            aria-current={isActive ? "step" : undefined}
          >
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border text-[10px]",
                isActive
                  ? "border-primary/40 bg-primary/20 text-primary"
                  : isComplete
                    ? "border-foreground/20 bg-foreground/10 text-foreground"
                    : "border-border text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <span className="whitespace-nowrap">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default WizardSteps;
