"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { WorkflowLogEntry, WorkflowLogLevel } from "./types";
import { Trash2 } from "lucide-react";

const levelStyles: Record<WorkflowLogLevel, string> = {
  info: "text-muted-foreground",
  success: "text-[color:var(--success)]",
  warn: "text-[color:var(--warning)]",
  error: "text-destructive",
};

export function WorkflowLogPanel({
  open,
  onOpenChange,
  logs,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: WorkflowLogEntry[];
  onClear?: () => void;
}) {
  const [filter, setFilter] = React.useState<WorkflowLogLevel | "all">("all");

  const filtered = React.useMemo(() => {
    if (filter === "all") {return logs;}
    return logs.filter((l) => l.level === filter);
  }, [logs, filter]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[40vh] p-0">
        <SheetHeader className="flex-row items-center justify-between gap-3 border-b border-border">
          <SheetTitle>Execution Log</SheetTitle>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {(["all", "info", "success", "warn", "error"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setFilter(lvl)}
                  className={cn(
                    "rounded px-2 py-1 text-[10px] font-medium transition-colors",
                    filter === lvl
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground"
                  )}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={onClear}
              disabled={!onClear || logs.length === 0}
              aria-label="Clear logs"
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="selectable-text h-full overflow-y-auto p-3 font-mono text-xs scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No logs yet
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((l) => (
                <div key={l.id} className="flex items-start gap-3">
                  <span className="shrink-0 text-muted-foreground">{l.timestamp}</span>
                  <span className={cn("shrink-0 font-semibold uppercase text-[10px]", levelStyles[l.level])}>
                    {l.level}
                  </span>
                  {l.nodeId ? (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {l.nodeId}
                    </span>
                  ) : null}
                  <span className="text-foreground/90">{l.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
