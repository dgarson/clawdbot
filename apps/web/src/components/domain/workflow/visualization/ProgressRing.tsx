"use client";

import { cn } from "@/lib/utils";

export function ProgressRing({
  progress,
  size = 40,
  strokeWidth = 3,
  className,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(100, progress));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <svg
      width={size}
      height={size}
      className={cn("rotate-[-90deg]", className)}
      aria-label={`Progress ${clamped}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-border"
        opacity={0.35}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={`${circumference} ${circumference}`}
        strokeDashoffset={offset}
        className="text-primary transition-[stroke-dashoffset] duration-300 ease-out"
      />
    </svg>
  );
}
