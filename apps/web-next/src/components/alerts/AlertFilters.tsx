import React from "react";
import { cn } from "../../lib/utils";
import { getRovingTargetIndex } from "../../views/alert-center-utils";

export function AlertFilterPillGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string; icon?: React.ReactNode }>;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-1">
      <p className="text-[10px] uppercase tracking-wide text-fg-muted">{label}</p>
      <div
        className="flex flex-wrap gap-1"
        role="group"
        aria-label={`Filter by ${label.toLowerCase()}`}
        onKeyDown={(event) => {
          const pills = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-filter-pill='true']")
          );
          if (pills.length === 0) {return;}
          const activeIndex = pills.findIndex((pill) => pill === document.activeElement);
          const index = getRovingTargetIndex(activeIndex >= 0 ? activeIndex : 0, event.key, pills.length);
          if (index === null) {return;}
          event.preventDefault();
          pills[index]?.focus();
        }}
      >
        {options.map((option) => (
          <button
            key={option.value}
            data-filter-pill="true"
            onClick={() => onChange(option.value)}
            aria-pressed={value === option.value}
            className={cn(
              "text-xs px-2 py-1 rounded border transition-colors inline-flex items-center gap-1",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
              value === option.value
                ? "border-primary bg-indigo-950/40 text-indigo-300"
                : "border-tok-border text-fg-secondary hover:text-fg-primary"
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
}: {
  filters: Array<{
    value: string;
    onChange: (next: string) => void;
    options: Array<{ value: string; label: string }>;
    ariaLabel: string;
  }>;
}) {
  return (
    <div className="flex flex-wrap gap-3 mb-4">
      {filters.map((filter) => (
        <select
          key={filter.ariaLabel}
          value={filter.value}
          onChange={(event) => filter.onChange(event.target.value)}
          aria-label={filter.ariaLabel}
          className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
        >
          {filter.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ))}
    </div>
  );
}
