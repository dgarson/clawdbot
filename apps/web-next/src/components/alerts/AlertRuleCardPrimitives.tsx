import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export interface AlertRuleStatItem {
  label: string;
  value: string;
}

export function AlertRuleStatsRail({
  stats,
  className,
}: {
  stats: AlertRuleStatItem[];
  className?: string;
}) {
  return (
    <div className={cn("w-40 shrink-0 self-center rounded-lg border border-tok-border bg-surface-2/60 px-3 py-2", className)}>
      <div className="space-y-1.5">
        {stats.map((stat) => (
          <div key={stat.label} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-fg-muted">{stat.label}</span>
            <span className="text-fg-primary font-mono">{stat.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlertSeveritySummaryPill({
  label,
  total,
  activeCount,
  expanded,
  onToggle,
  className,
  countClassName,
  countSurfaceClassName,
}: {
  label: string;
  total: number;
  activeCount: number;
  expanded: boolean;
  onToggle: () => void;
  className?: string;
  countClassName?: string;
  countSurfaceClassName?: string;
}) {
  return (
    <button
      type="button"
      data-severity-pill="true"
      onClick={onToggle}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-xs transition-colors",
        "focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none",
        className
      )}
    >
      <span className="font-semibold">{label}</span>
      <span className={cn("rounded-md px-2 py-0.5 font-mono text-sm leading-tight", countSurfaceClassName, countClassName)}>
        {total}
      </span>
      <span className="text-[11px] text-fg-muted">{activeCount} active</span>
      {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
    </button>
  );
}

export function AlertGroupPresetButtons({
  onP1Only,
  onExpandAll,
  onCollapseAll,
}: {
  onP1Only: () => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={onP1Only}
        className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-[11px] text-rose-200 hover:bg-rose-500/20 transition-colors"
      >
        Suggested: P0/P1 only
      </button>
      <button
        type="button"
        onClick={onExpandAll}
        className="rounded-full border border-tok-border bg-surface-2 px-2.5 py-1 text-[11px] text-fg-secondary hover:text-fg-primary transition-colors"
      >
        Expand all
      </button>
      <button
        type="button"
        onClick={onCollapseAll}
        className="rounded-full border border-tok-border bg-surface-2 px-2.5 py-1 text-[11px] text-fg-secondary hover:text-fg-primary transition-colors"
      >
        Collapse all
      </button>
    </div>
  );
}

export function AlertTargetPills({
  targets,
  className,
}: {
  targets: string[];
  className?: string;
}) {
  return (
    <div className={cn("mt-1.5 flex flex-wrap gap-1.5", className)}>
      {targets.map((target) => (
        <span
          key={target}
          className="text-[10px] px-2 py-0.5 rounded-full border border-tok-border bg-surface-2 text-fg-secondary font-mono"
        >
          {target}
        </span>
      ))}
    </div>
  );
}

export interface AlertFilterPillOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

export function AlertFilterPillGroup({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: AlertFilterPillOption[];
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
              value === option.value
                ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200"
                : "border-tok-border bg-surface-2 text-fg-secondary hover:text-fg-primary hover:bg-surface-2/80"
            )}
          >
            {option.icon}
            <span>{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function AlertSelectFilterBar({
  filters,
  className,
}: {
  filters: Array<{
    value: string;
    onChange: (value: string) => void;
    ariaLabel: string;
    options: Array<{ value: string; label: string }>;
  }>;
  className?: string;
}) {
  return (
    <div className={cn("mb-4 flex flex-wrap gap-2", className)}>
      {filters.map((filter) => (
        <div key={filter.ariaLabel} className="relative">
          <span className="sr-only">{filter.ariaLabel}</span>
          <select
            value={filter.value}
            onChange={(event) => filter.onChange(event.target.value)}
            aria-label={filter.ariaLabel}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3 py-2 text-xs text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}
