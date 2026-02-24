import React from "react";
import { cn } from "../lib/utils";

export type BreadcrumbItem = {
  id: string;
  label: string;
  icon?: string;
  onSelect?: () => void;
  isCurrent?: boolean;
};

interface AppBreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function AppBreadcrumbs({ items, className }: AppBreadcrumbsProps) {
  if (items.length === 0) {return null;}

  return (
    <nav aria-label="Breadcrumb" className={cn("flex min-w-0 items-center gap-2 text-sm", className)}>
      {items.map((item, index) => (
        <React.Fragment key={item.id}>
          {index > 0 && <span className="text-muted-foreground/30" aria-hidden="true">/</span>}
          {item.onSelect && !item.isCurrent ? (
            <button
              onClick={item.onSelect}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-muted-foreground/65 transition-colors hover:bg-secondary/40 hover:text-foreground"
              title={item.label}
            >
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              <span className="truncate whitespace-nowrap">{item.label}</span>
            </button>
          ) : (
            <span
              className={cn(
                "inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1",
                item.isCurrent ? "text-foreground font-medium" : "text-muted-foreground/65"
              )}
              title={item.label}
            >
              {item.icon && <span aria-hidden="true">{item.icon}</span>}
              <span className="truncate whitespace-nowrap">{item.label}</span>
            </span>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}
