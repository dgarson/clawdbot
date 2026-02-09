"use client";

import * as React from "react";
import { AlertTriangle, Info, Shield, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { ScopeDefinition, ScopeRiskLevel } from "@/lib/scopes";

interface ScopeCheckboxProps {
  scope: ScopeDefinition;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function getRiskColor(risk: ScopeRiskLevel): string {
  switch (risk) {
    case "high":
      return "text-red-500";
    case "medium":
      return "text-yellow-500";
    default:
      return "text-green-500";
  }
}

function RiskIcon({ risk }: { risk: ScopeRiskLevel }) {
  const colorClass = getRiskColor(risk);
  switch (risk) {
    case "high":
      return <AlertTriangle className={cn("h-3.5 w-3.5", colorClass)} />;
    case "medium":
      return <Info className={cn("h-3.5 w-3.5", colorClass)} />;
    default:
      return <Shield className={cn("h-3.5 w-3.5", colorClass)} />;
  }
}

function getRiskBadgeClasses(risk: ScopeRiskLevel): string {
  switch (risk) {
    case "high":
      return "border-red-500/30 bg-red-500/10 text-red-700";
    case "medium":
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-700";
    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  }
}

export function ScopeCheckbox({
  scope,
  checked,
  disabled,
  onCheckedChange,
}: ScopeCheckboxProps) {
  const isDisabled = disabled || scope.required;
  const [showExamples, setShowExamples] = React.useState(false);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        checked ? "border-primary/40 bg-primary/5" : "border-border",
        isDisabled && "opacity-60"
      )}
    >
      <Checkbox
        id={`scope-${scope.id}`}
        checked={checked}
        disabled={isDisabled}
        onCheckedChange={onCheckedChange}
        className="mt-0.5"
      />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <label
            htmlFor={`scope-${scope.id}`}
            className={cn(
              "text-sm font-medium leading-none cursor-pointer",
              isDisabled && "cursor-not-allowed"
            )}
          >
            {scope.label}
          </label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <RiskIcon risk={scope.risk} />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="capitalize">{scope.risk} risk permission</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {scope.required && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Required
            </Badge>
          )}
          {scope.recommended && !scope.required && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Recommended
            </Badge>
          )}
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0 capitalize", getRiskBadgeClasses(scope.risk))}
          >
            {scope.risk} risk
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{scope.description}</p>
        {scope.examples && scope.examples.length > 0 && (
          <div className="mt-2 space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
              <button
                type="button"
                onClick={() => setShowExamples((prev) => !prev)}
                className="hover:text-foreground"
              >
                {showExamples ? "Hide examples" : "Show examples"}
              </button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="hover:text-foreground underline-offset-2">
                      Hover for examples
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="space-y-1">
                      {scope.examples.map((example) => (
                        <p key={example}>{example}</p>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            {showExamples && (
              <div className="flex flex-wrap gap-1">
                {scope.examples.slice(0, 4).map((example) => (
                  <Badge
                    key={example}
                    variant="outline"
                    className="text-[10px] font-normal"
                  >
                    {example}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ScopeCheckbox;
