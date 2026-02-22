/**
 * ComplexityGate — Adaptive UX gating component
 *
 * Renders children only when the user's proficiency level meets the threshold.
 * Optionally renders a fallback (teaser, simplified version, or nothing).
 *
 * Usage:
 *   <ComplexityGate minLevel="advanced">
 *     <AdvancedControls />
 *   </ComplexityGate>
 *
 *   <ComplexityGate minLevel="intermediate" maxLevel="advanced" fallback={<SimpleTip />}>
 *     <IntermediateFeature />
 *   </ComplexityGate>
 *
 *   <ComplexityGate minLevel="expert" teaser="Unlock expert tools by exploring more features.">
 *     <ExpertPanel />
 *   </ComplexityGate>
 */

import React from "react";
import { useProficiency, ProficiencyLevel, PROFICIENCY_META } from "../stores/proficiencyStore";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ComplexityGateProps {
  /** Minimum proficiency level required to show content */
  minLevel: ProficiencyLevel;
  /** Maximum proficiency level that sees this content (optional) */
  maxLevel?: ProficiencyLevel;
  /** Content to show when level is met */
  children: React.ReactNode;
  /** Fallback content when level is NOT met (default: nothing) */
  fallback?: React.ReactNode;
  /**
   * If provided, shows a subtle teaser hint when level is not met.
   * Only shows if `fallback` is not provided.
   */
  teaser?: string;
  /** Class for the teaser container */
  teaserClassName?: string;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ComplexityGate({
  minLevel,
  maxLevel,
  children,
  fallback,
  teaser,
  teaserClassName,
}: ComplexityGateProps) {
  const { meetsLevel } = useProficiency();

  if (meetsLevel(minLevel, maxLevel)) {
    return <>{children}</>;
  }

  if (fallback !== undefined) {
    return <>{fallback}</>;
  }

  if (teaser) {
    return <GateTeaser minLevel={minLevel} message={teaser} className={teaserClassName} />;
  }

  return null;
}

// ─── Teaser ───────────────────────────────────────────────────────────────────

interface GateTeaserProps {
  minLevel: ProficiencyLevel;
  message: string;
  className?: string;
}

function GateTeaser({ minLevel, message, className }: GateTeaserProps) {
  const meta = PROFICIENCY_META[minLevel];
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-white/5 bg-white/3 px-3 py-2 text-xs text-white/30",
        className
      )}
      title={`Available at ${meta.label} level`}
    >
      <span className="shrink-0 opacity-50">{meta.emoji}</span>
      <span className="italic">{message}</span>
    </div>
  );
}

// ─── Convenience Variants ────────────────────────────────────────────────────

/** Only shows to intermediate+ users */
export function IntermediateFeature({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <ComplexityGate minLevel="intermediate" fallback={fallback}>
      {children}
    </ComplexityGate>
  );
}

/** Only shows to advanced+ users */
export function AdvancedFeature({
  children,
  fallback,
  teaser,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  teaser?: string;
}) {
  return (
    <ComplexityGate minLevel="advanced" fallback={fallback} teaser={teaser}>
      {children}
    </ComplexityGate>
  );
}

/** Only shows to expert users */
export function ExpertFeature({
  children,
  teaser,
}: {
  children: React.ReactNode;
  teaser?: string;
}) {
  return (
    <ComplexityGate minLevel="expert" teaser={teaser}>
      {children}
    </ComplexityGate>
  );
}
