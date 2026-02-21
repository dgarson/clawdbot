
import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ChevronDown, Check, X, Settings, Loader2, Clock } from "lucide-react";
import type { ToolCall } from "./types";

export interface ToolMeta {
  title?: string;
  description?: string;
  icon?: React.ElementType;
}

export interface ToolApprovalCardProps {
  toolCall: ToolCall;
  meta?: ToolMeta;
  className?: string;
  onApprove?: (toolCallId: string, modifiedArgs?: Record<string, unknown>) => void;
  onReject?: (toolCallId: string) => void;
}

const statusStyles: Record<
  ToolCall["status"],
  { label: string; icon: React.ElementType; intent: "default" | "warn" | "ok" | "bad" }
> = {
  pending: { label: "Awaiting approval", icon: Clock, intent: "warn" },
  approved: { label: "Approved", icon: Check, intent: "ok" },
  rejected: { label: "Rejected", icon: X, intent: "bad" },
  executing: { label: "Executing…", icon: Loader2, intent: "default" },
  complete: { label: "Complete", icon: Check, intent: "ok" },
  error: { label: "Error", icon: X, intent: "bad" },
};

function intentClasses(intent: "default" | "warn" | "ok" | "bad") {
  switch (intent) {
    case "ok":
      return "text-[color:var(--success)] bg-[color:var(--success)]/10 border-[color:var(--success)]/20";
    case "warn":
      return "text-[color:var(--warning)] bg-[color:var(--warning)]/10 border-[color:var(--warning)]/20";
    case "bad":
      return "text-destructive bg-destructive/10 border-destructive/20";
    default:
      return "text-muted-foreground bg-muted/40 border-border";
  }
}

export function ToolApprovalCard({
  toolCall,
  meta,
  className,
  onApprove,
  onReject,
}: ToolApprovalCardProps) {
  const [expanded, setExpanded] = React.useState(toolCall.status === "pending");
  const [editing, setEditing] = React.useState(false);
  const [editedArgs, setEditedArgs] = React.useState(
    JSON.stringify(toolCall.args, null, 2)
  );
  const [jsonError, setJsonError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setEditedArgs(JSON.stringify(toolCall.args, null, 2));
  }, [toolCall.args]);

  const status = statusStyles[toolCall.status];
  const StatusIcon = status.icon;
  const Icon = meta?.icon;
  const title = meta?.title ?? toolCall.toolName;

  const approve = () => {
    if (!onApprove) {return;}

    if (!editing) {
      onApprove(toolCall.toolCallId);
      return;
    }

    try {
      const parsed = JSON.parse(editedArgs) as Record<string, unknown>;
      setJsonError(null);
      setEditing(false);
      onApprove(toolCall.toolCallId, parsed);
    } catch {
      setJsonError("Invalid JSON");
    }
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/30"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
            {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            {meta?.description ? (
              <div className="truncate text-xs text-muted-foreground">
                {meta.description}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium",
              intentClasses(status.intent)
            )}
          >
            <StatusIcon
              className={cn("size-3", toolCall.status === "executing" && "animate-spin")}
            />
            <span className="whitespace-nowrap">{status.label}</span>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-border px-4 py-4 space-y-4">
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground">Arguments</div>
            {editing ? (
              <div className="space-y-2">
                <Textarea
                  value={editedArgs}
                  onChange={(e) => setEditedArgs(e.target.value)}
                  className="min-h-32 font-mono text-xs"
                />
                {jsonError ? (
                  <div className="text-xs text-destructive">{jsonError}</div>
                ) : null}
              </div>
            ) : (
              <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground/90 scrollbar-thin">
                {JSON.stringify(toolCall.args, null, 2)}
              </pre>
            )}
          </div>

          {toolCall.status === "complete" && toolCall.result != null ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Result</div>
              <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs text-foreground/90 scrollbar-thin">
                {typeof toolCall.result === "string"
                  ? toolCall.result
                  : JSON.stringify(toolCall.result, null, 2)}
              </pre>
            </div>
          ) : null}

          {toolCall.status === "error" && toolCall.error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {toolCall.error}
            </div>
          ) : null}

          {toolCall.status === "pending" ? (
            <div className="flex items-center gap-2">
              <Button size="sm" className="gap-2" onClick={approve}>
                <Check className="size-4" />
                {editing ? "Save & Approve" : "Approve"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="gap-2"
                onClick={() => onReject?.(toolCall.toolCallId)}
              >
                <X className="size-4" />
                Reject
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setEditing((v) => !v);
                  setJsonError(null);
                }}
              >
                <Settings className="size-4" />
                {editing ? "Cancel edit" : "Edit JSON"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
