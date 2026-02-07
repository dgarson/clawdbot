"use client";

import { Sparkles, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useUIStore } from "@/stores/useUIStore";
import { cn } from "@/lib/utils";

interface ModeToggleProps {
  className?: string;
}

/**
 * Beginner/Advanced mode toggle.
 * Reads and persists `powerUserMode` from the UI store.
 */
export function ModeToggle({ className }: ModeToggleProps) {
  const { powerUserMode, setPowerUserMode } = useUIStore();

  return (
    <label
      className={cn(
        "flex items-center gap-2 cursor-pointer select-none",
        className
      )}
    >
      <Sparkles
        className={cn(
          "size-3.5 transition-colors",
          !powerUserMode ? "text-primary" : "text-muted-foreground"
        )}
      />
      <span
        className={cn(
          "text-xs font-medium transition-colors",
          !powerUserMode ? "text-foreground" : "text-muted-foreground"
        )}
      >
        Simple
      </span>
      <Switch
        size="sm"
        checked={powerUserMode}
        onCheckedChange={setPowerUserMode}
      />
      <span
        className={cn(
          "text-xs font-medium transition-colors",
          powerUserMode ? "text-foreground" : "text-muted-foreground"
        )}
      >
        Advanced
      </span>
      <Zap
        className={cn(
          "size-3.5 transition-colors",
          powerUserMode ? "text-primary" : "text-muted-foreground"
        )}
      />
    </label>
  );
}
