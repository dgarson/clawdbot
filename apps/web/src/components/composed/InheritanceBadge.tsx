import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useInheritanceStore } from "@/stores/useInheritanceStore";

interface InheritanceBadgeProps {
  agentId: string;
  field: string;
  defaultSource?: string;
}

export function InheritanceBadge({
  agentId,
  field,
  defaultSource = "System",
}: InheritanceBadgeProps) {
  const isUsingDefault = useInheritanceStore((state) =>
    state.isUsingDefault(agentId, field)
  );

  if (isUsingDefault) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="text-muted-foreground cursor-default">
            Using {defaultSource}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          This field inherits from {defaultSource.toLowerCase()} defaults. Customize to override.
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Badge variant="secondary">
      Custom
    </Badge>
  );
}
