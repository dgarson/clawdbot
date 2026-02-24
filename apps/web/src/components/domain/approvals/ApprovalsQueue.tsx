
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ApprovalItem } from "./ApprovalItem";
import type { RiskLevel, ToolCall } from "@/components/domain/agentic-workflow/types";

// Adapt these types to match what the agent store actually provides
export interface PendingApproval {
  toolCall: ToolCall;
  agentId: string;
  agentName: string;
  createdAtMs: number;
}

export interface ApprovalsQueueProps {
  approvals: PendingApproval[];
  resolvedCount?: number;
  mode: "compact" | "full";
  onApprove: (toolCallId: string, modifiedArgs?: Record<string, unknown>) => void;
  onReject: (toolCallId: string) => void;
  onApproveAllForAgent?: (agentId: string) => void;
  onRejectAllForAgent?: (agentId: string) => void;
}

type FilterChip = "all" | RiskLevel | "resolved";

const COMPACT_MAX = 8;
const GROUP_THRESHOLD = 3;

export function ApprovalsQueue({
  approvals,
  resolvedCount = 0,
  mode,
  onApprove,
  onReject,
  onApproveAllForAgent,
  onRejectAllForAgent,
}: ApprovalsQueueProps) {
  const [filter, setFilter] = useState<FilterChip>("all");
  const [resolvedExpanded, setResolvedExpanded] = useState(false);

  // compact: only high/medium, oldest first, max 8
  const visibleApprovals =
    mode === "compact"
      ? approvals
          .filter((a) => a.toolCall.risk === "high" || a.toolCall.risk === "medium")
          .toSorted((a, b) => a.createdAtMs - b.createdAtMs)
          .slice(0, COMPACT_MAX)
      : filter === "all"
        ? approvals
        : approvals.filter((a) => a.toolCall.risk === filter);

  // Group by agent when 3+ items from same agent (full mode only)
  const grouped = mode === "full" ? buildGroups(visibleApprovals, GROUP_THRESHOLD) : null;

  if (visibleApprovals.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No pending approvals</p>;
  }

  return (
    <div className="space-y-2">
      {mode === "full" && (
        <div className="flex flex-wrap gap-1.5 pb-1">
          {(["all", "high", "medium", "low"] as const).map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => setFilter(chip)}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                filter === chip
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {chip === "all" ? "All" : chip.charAt(0).toUpperCase() + chip.slice(1)}
            </button>
          ))}
        </div>
      )}

      {grouped
        ? grouped.map((group) =>
            group.isGroup ? (
              <AgentGroupCard
                key={group.agentId}
                group={group}
                onApproveAll={() => onApproveAllForAgent?.(group.agentId)}
                onRejectAll={() => onRejectAllForAgent?.(group.agentId)}
                onApprove={onApprove}
                onReject={onReject}
              />
            ) : (
              <ApprovalItem
                key={group.items[0].toolCall.toolCallId}
                {...group.items[0]}
                mode="full"
                onApprove={onApprove}
                onReject={onReject}
              />
            ),
          )
        : visibleApprovals.map((a) => (
            <ApprovalItem
              key={a.toolCall.toolCallId}
              {...a}
              mode={mode}
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}

      {mode === "full" && resolvedCount > 0 && (
        <button
          type="button"
          onClick={() => setResolvedExpanded((v) => !v)}
          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronDown
            className={`size-3 transition-transform ${resolvedExpanded ? "rotate-180" : ""}`}
          />
          {resolvedExpanded ? "Hide" : `Show ${resolvedCount} resolved today`}
        </button>
      )}
    </div>
  );
}

// --- helpers ---

interface GroupEntry {
  agentId: string;
  agentName: string;
  items: PendingApproval[];
  isGroup: boolean;
}

function buildGroups(approvals: PendingApproval[], threshold: number): GroupEntry[] {
  const byAgent = new Map<string, PendingApproval[]>();
  for (const a of approvals) {
    const list = byAgent.get(a.agentId) ?? [];
    list.push(a);
    byAgent.set(a.agentId, list);
  }
  const result: GroupEntry[] = [];
  for (const [agentId, items] of byAgent) {
    result.push({
      agentId,
      agentName: items[0].agentName,
      items,
      isGroup: items.length >= threshold,
    });
  }
  return result;
}

function AgentGroupCard({
  group,
  onApproveAll,
  onRejectAll,
  onApprove,
  onReject,
}: {
  group: GroupEntry;
  onApproveAll: () => void;
  onRejectAll: () => void;
  onApprove: ApprovalsQueueProps["onApprove"];
  onReject: ApprovalsQueueProps["onReject"];
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-lg border border-border">
      <div className="flex items-center gap-3 px-3 py-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          <ChevronDown className={`size-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          <span className="text-sm font-medium">{group.agentName}</span>
          <Badge variant="secondary" className="text-xs">
            {group.items.length} pending
          </Badge>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={onRejectAll}
        >
          Reject All
        </Button>
        <Button size="sm" className="h-7 px-2 text-xs" onClick={onApproveAll}>
          Approve All
        </Button>
      </div>
      {expanded && (
        <div className="border-t border-border px-3 pb-3 pt-2 space-y-2">
          {group.items.map((a) => (
            <ApprovalItem
              key={a.toolCall.toolCallId}
              {...a}
              mode="full"
              onApprove={onApprove}
              onReject={onReject}
            />
          ))}
        </div>
      )}
    </div>
  );
}
