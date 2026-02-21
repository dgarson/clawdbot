"use client";
import { useProficiencyStore } from "@/lib/stores/proficiency";

interface AdaptiveLabelProps {
  beginner: string;
  standard: string;
  expert: string;
  className?: string;
}

export function AdaptiveLabel({ beginner, standard, expert, className }: AdaptiveLabelProps) {
  const level = useProficiencyStore((s) => s.level);
  const labels = { beginner, standard, expert };
  return <span className={className}>{labels[level]}</span>;
}
