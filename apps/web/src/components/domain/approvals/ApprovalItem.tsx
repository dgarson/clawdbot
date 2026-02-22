
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ToolApprovalCard } from "@/components/domain/agentic-workflow/ToolApprovalCard";
import type { ToolCall, RiskLevel } from "@/components/domain/agentic-workflow/types";

export interface ApprovalItemProps {
  toolCall: ToolCall;
  agentName: string;
  agentId: string;
  createdAtMs: number;
  mode: "compact" | "full";
  onApprove: (toolCallId: string, modifiedArgs?: Record<string, unknown>) => void;
  onReject: (toolCallId: string) => void;
}

const riskColors: Record<RiskLevel, string> = {
  low: "bg-green-500/10 text-green-600 border-green-500/20",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  high: "bg-red-500/10 text-red-600 border-red-500/20",
};

export function ApprovalItem({
  toolCall,
  agentName,
  agentId: _agentId,
  createdAtMs,
  mode,
  onApprove,
  onReject,
}: ApprovalItemProps) {
  const [expanded, setExpanded] = useState(false);
  const risk = toolCall.risk ?? "medium";
  const age = formatDistanceToNow(new Date(createdAtMs), { addSuffix: true });

  if (mode === "full" && expanded) {
    return (
      <div className="rounded-lg border border-border">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="size-3 rotate-180" /> Collapse
        </button>
        <ToolApprovalCard
          toolCall={toolCall}
          onApprove={onApprove}
          onReject={onReject}
          className="border-0 shadow-none"
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border px-3 py-2",
        "hover:bg-accent/30 transition-colors",
      )}
    >
      <Badge variant="outline" className={cn("shrink-0 text-xs", riskColors[risk])}>
        {risk}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{toolCall.toolName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {agentName} · {age}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {mode === "full" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => setExpanded(true)}
          >
            <ChevronDown className="size-3" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={() => onReject(toolCall.toolCallId)}
        >
          Reject
        </Button>
        <Button
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => onApprove(toolCall.toolCallId)}
        >
          Approve
        </Button>
      </div>
    </div>
  );
}
