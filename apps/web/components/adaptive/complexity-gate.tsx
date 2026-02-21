"use client";
import * as React from "react";
import { useProficiency, type ProficiencyLevel } from "@/lib/stores/proficiency";

interface ComplexityGateProps {
  /** Minimum proficiency level required to show children */
  level: ProficiencyLevel;
  /** Content to show when proficiency is sufficient */
  children: React.ReactNode;
  /** Content to show instead when proficiency is below level (null = hide) */
  fallback?: React.ReactNode;
}

export function ComplexityGate({ level, children, fallback = null }: ComplexityGateProps) {
  const { isAtLeast } = useProficiency();
  if (isAtLeast(level)) return <>{children}</>;
  return <>{fallback}</>;
}
