"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type UnlockStep = "connect" | "unlock" | "enter";

interface StepIndicatorProps {
  currentStep: UnlockStep;
  className?: string;
}

const STEPS: { key: UnlockStep; label: string }[] = [
  { key: "connect", label: "Connect" },
  { key: "unlock", label: "Unlock" },
  { key: "enter", label: "Enter Console" },
];

function stepIndex(step: UnlockStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

/**
 * Visual stepper for the Console Access flow: Connect -> Unlock -> Enter Console.
 */
export function StepIndicator({ currentStep, className }: StepIndicatorProps) {
  const current = stepIndex(currentStep);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {STEPS.map((step, i) => {
        const isComplete = i < current;
        const isActive = i === current;

        return (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={cn(
                  "h-px w-6 sm:w-10 transition-colors",
                  isComplete ? "bg-primary" : "bg-border"
                )}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors",
                  isComplete && "bg-primary text-primary-foreground",
                  isActive && "bg-primary/15 text-primary ring-1 ring-primary/30",
                  !isComplete && !isActive && "bg-muted text-muted-foreground"
                )}
              >
                {isComplete ? <Check className="size-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "hidden text-xs font-medium sm:inline transition-colors",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
