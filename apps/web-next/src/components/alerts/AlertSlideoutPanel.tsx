import React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export function AlertSlideoutPanel({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <aside
      aria-hidden={!open}
      className={cn(
        "fixed right-0 top-0 h-full w-full max-w-md border-l border-tok-border bg-surface-0 shadow-2xl z-40",
        "transition-transform duration-200",
        open ? "translate-x-0" : "translate-x-full pointer-events-none"
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b border-tok-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-fg-primary">{title}</h3>
          {subtitle ? <p className="text-xs text-fg-muted mt-0.5">{subtitle}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close panel"
          className="rounded-md p-1.5 text-fg-muted hover:text-fg-primary hover:bg-surface-2 transition-colors"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="h-[calc(100%-57px)] overflow-y-auto p-4">{children}</div>
    </aside>
  );
}

