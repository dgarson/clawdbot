
import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MoreVertical,
  Pencil,
  Copy,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import { useModels } from "@/hooks/queries/useModels";
import type { Agent, AgentStatus } from "@/stores/useAgentStore";

// Model display names mapping
const MODEL_DISPLAY_NAMES: Record<string, string> = {
  "claude-3.5-sonnet": "Claude 3.5 Sonnet",
  "claude-3-opus": "Claude 3 Opus",
  "gpt-4o": "GPT-4o",
  "gpt-4-turbo": "GPT-4 Turbo",
  default: "Default Model",
};

function splitModelRef(value?: string): { provider?: string; modelId?: string } {
  if (!value) {return {};}
  const trimmed = value.trim();
  if (!trimmed) {return {};}
  const parts = trimmed.split("/");
  if (parts.length <= 1) {
    return { modelId: trimmed };
  }
  return { provider: parts[0], modelId: parts.slice(1).join("/") };
}

// Status badge variants
const STATUS_CONFIG: Record<
  AgentStatus,
  { label: string; variant: "success" | "secondary" | "warning" | "error" }
> = {
  online: { label: "Active", variant: "success" },
  offline: { label: "Inactive", variant: "secondary" },
  busy: { label: "Busy", variant: "warning" },
  paused: { label: "Paused", variant: "secondary" },
};

// Avatar colors based on name hash for visual variety
function getAvatarGradient(name: string): string {
  const gradients = [
    "from-blue-500 to-purple-500",
    "from-green-500 to-teal-500",
    "from-orange-500 to-red-500",
    "from-pink-500 to-rose-500",
    "from-indigo-500 to-blue-500",
    "from-amber-500 to-orange-500",
    "from-cyan-500 to-blue-500",
    "from-violet-500 to-purple-500",
  ];
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return gradients[hash % gradients.length];
}

export interface AgentCardProps {
  agent: Agent;
  onEdit?: (agent: Agent) => void;
  onDuplicate?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
  onToggleStatus?: (agent: Agent) => void;
  className?: string;
}

export function AgentCard({
  agent,
  onEdit,
  onDuplicate,
  onDelete,
  onToggleStatus,
  className,
}: AgentCardProps) {
  const { data: modelsData } = useModels();
  const statusConfig = STATUS_CONFIG[agent.status];
  const avatarGradient = getAvatarGradient(agent.name);
  const initials = agent.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // Model display - use role as fallback
  const modelRef = React.useMemo(() => splitModelRef(agent.model), [agent.model]);
  const modelEntry = React.useMemo(() => {
    if (!modelsData?.models || !modelRef.modelId) {return undefined;}
    if (modelRef.provider) {
      return modelsData.models.find(
        (model) => model.provider === modelRef.provider && model.id === modelRef.modelId
      );
    }
    return modelsData.models.find((model) => model.id === modelRef.modelId);
  }, [modelsData, modelRef]);

  const modelDisplay =
    modelEntry?.name ??
    (modelRef.modelId ? MODEL_DISPLAY_NAMES[modelRef.modelId] : undefined) ??
    MODEL_DISPLAY_NAMES[agent.role?.toLowerCase() ?? ""] ??
    agent.role ??
    "Assistant";

  const isActive = agent.status === "online" || agent.status === "busy";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
      whileHover={{ y: -2 }}
      className={className}
    >
      <Card className="p-5 transition-shadow hover:shadow-md">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <Avatar className="h-12 w-12 shrink-0">
            {agent.avatar ? (
              <AvatarImage src={agent.avatar} alt={agent.name} />
            ) : null}
            <AvatarFallback
              className={cn(
                "bg-gradient-to-br text-white font-semibold",
                avatarGradient
              )}
            >
              {initials}
            </AvatarFallback>
          </Avatar>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Name and Status row */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-foreground leading-tight">
                {agent.name}
              </h3>
              <Badge variant={statusConfig.variant} className="shrink-0">
                {statusConfig.label}
              </Badge>
            </div>

            {/* Role and task count */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs font-normal">
                {modelDisplay}
              </Badge>
              {agent.taskCount !== undefined && agent.taskCount > 0 && (
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {agent.taskCount} task{agent.taskCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Description */}
            {agent.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {agent.description}
              </p>
            )}
          </div>
        </div>

        {/* Actions - moved to bottom right */}
        <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit?.(agent)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit agent</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onToggleStatus?.(agent)}>
                  {isActive ? (
                    <>
                      <PowerOff className="mr-2 h-4 w-4" />
                      Deactivate
                    </>
                  ) : (
                    <>
                      <Power className="mr-2 h-4 w-4" />
                      Activate
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate?.(agent)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete?.(agent)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
      </Card>
    </motion.div>
  );
}

export default AgentCard;
