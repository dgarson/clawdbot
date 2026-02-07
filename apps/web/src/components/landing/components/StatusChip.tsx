import { cn } from "@/lib/utils";
import { Check, Loader2, Clock } from "lucide-react";

type ChipVariant = "done" | "in-progress" | "waiting";

interface StatusChipProps {
  variant: ChipVariant;
  label: string;
  className?: string;
}

const chipConfig: Record<
  ChipVariant,
  { icon: React.ElementType; color: string; bg: string }
> = {
  done: {
    icon: Check,
    color: "text-success",
    bg: "bg-success/15",
  },
  "in-progress": {
    icon: Loader2,
    color: "text-primary",
    bg: "bg-primary/15",
  },
  waiting: {
    icon: Clock,
    color: "text-warning",
    bg: "bg-warning/15",
  },
};

/** Status chip with icon + label — never relies on color alone. */
export function StatusChip({ variant, label, className }: StatusChipProps) {
  const { icon: Icon, color, bg } = chipConfig[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        bg,
        color,
        className
      )}
    >
      <Icon
        className={cn(
          "h-3 w-3",
          variant === "in-progress" && "animate-spin"
        )}
      />
      {label}
    </span>
  );
}
