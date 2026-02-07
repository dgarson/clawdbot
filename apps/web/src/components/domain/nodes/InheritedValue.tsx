/**
 * InheritedValue - renders a value with an "inherited" indicator when the
 * value comes from defaults rather than a direct override.
 *
 * Shows the effective value prominently so users always know what's active,
 * with a subtle badge when the value is inherited.
 */

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ArrowDownFromLine } from "lucide-react";

interface InheritedValueProps {
  /** The effective/resolved value to display. */
  value: string;
  /** Whether this value is inherited from defaults (true) or directly set. */
  inherited: boolean;
  /** Optional label for what the default source is. */
  source?: string;
  className?: string;
}

export function InheritedValue({
  value,
  inherited,
  source = "defaults",
  className,
}: InheritedValueProps) {
  if (!inherited) {
    return <span className={cn("font-medium text-foreground", className)}>{value}</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn("inline-flex items-center gap-1.5", className)}>
            <span className="text-foreground/70">{value}</span>
            <ArrowDownFromLine className="h-3 w-3 text-muted-foreground/60" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Inherited from {source}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * InheritedBadge - a compact badge to indicate inherited status.
 */
export function InheritedBadge({ source = "default" }: { source?: string }) {
  return (
    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 text-muted-foreground font-normal gap-1">
      <ArrowDownFromLine className="h-2.5 w-2.5" />
      {source}
    </Badge>
  );
}
