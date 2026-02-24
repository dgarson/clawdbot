import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

export function AlertRuleGroupSection({
  title,
  count,
  activeCount,
  expanded,
  onToggle,
  children,
  className,
  dotClassName,
}: {
  title: string;
  count: number;
  activeCount?: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  className?: string;
  dotClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-surface-1 overflow-hidden", className)}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center justify-between px-4 py-3 text-left",
          "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
        )}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          {dotClassName ? <span className={cn("h-2.5 w-2.5 rounded-full", dotClassName)} /> : null}
          <p className="text-sm font-semibold text-fg-primary">{title} ({count})</p>
          {activeCount !== undefined ? <span className="text-xs text-fg-muted">{activeCount} active</span> : null}
        </div>
        {expanded ? <ChevronDown className="size-4 text-fg-muted" /> : <ChevronRight className="size-4 text-fg-muted" />}
      </button>
      {expanded ? <div className="p-3 sm:p-4 space-y-3">{children}</div> : null}
    </section>
  );
}

