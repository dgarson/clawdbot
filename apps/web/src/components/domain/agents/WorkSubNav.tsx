
import * as React from "react";
import { cn } from "@/lib/utils";
import { Briefcase, RefreshCw } from "lucide-react";

interface WorkSubNavProps {
  activeSection: "workstreams" | "rituals";
  onSectionChange: (section: "workstreams" | "rituals") => void;
}

export function WorkSubNav({ activeSection, onSectionChange }: WorkSubNavProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-lg bg-secondary/30 p-1">
      <button
        type="button"
        onClick={() => onSectionChange("workstreams")}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
          activeSection === "workstreams"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        <Briefcase className="h-4 w-4" />
        Workstreams
      </button>
      <button
        type="button"
        onClick={() => onSectionChange("rituals")}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors",
          activeSection === "rituals"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "bg-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        <RefreshCw className="h-4 w-4" />
        Rituals
      </button>
    </div>
  );
}

export default WorkSubNav;
