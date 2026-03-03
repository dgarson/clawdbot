"use client";
import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Check,
  X,
  Shield,
  ChevronDown,
  ChevronUp,
  Terminal,
  Clock,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────
type PendingApproval = {
  id: string;
  agentId: string;
  agentName?: string;
  agentEmoji?: string;
  tool: string;
  description: string;
  command?: string;
  risk: "low" | "medium" | "high";
  requestedAt: number;
  sessionKey?: string;
};

// ─── Risk Colors ─────────────────────────────────────────
const RISK_COLORS = {
  low: { bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/20" },
  medium: { bg: "bg-amber-500/10", text: "text-amber-600", border: "border-amber-500/20" },
  high: { bg: "bg-red-500/10", text: "text-red-600", border: "border-red-500/20" },
};

// ─── Time Ago ────────────────────────────────────────────
function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) {return "just now";}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

// ─── Approval Item ───────────────────────────────────────
function ApprovalItem({
  approval,
  onApprove,
  onDeny,
}: {
  approval: PendingApproval;
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  const risk = RISK_COLORS[approval.risk];

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-lg ${risk.bg} border ${risk.border}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <span className="text-lg shrink-0">{approval.agentEmoji || "🤖"}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium truncate">
              {approval.agentName || approval.agentId}
            </span>
            <Badge variant="outline" className={`text-[10px] ${risk.text} ${risk.border}`}>
              {approval.risk}
            </Badge>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(approval.requestedAt)}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            <span className="font-mono">{approval.tool}</span>
            {approval.description && ` — ${approval.description}`}
          </p>
          {approval.command && (
            <div className="flex items-center gap-1 mt-1">
              <Terminal className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
              <code className="text-[10px] font-mono text-muted-foreground truncate">
                {approval.command}
              </code>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
          onClick={() => onDeny(approval.id)}
        >
          <X className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          className="h-7 px-3 text-xs"
          onClick={() => onApprove(approval.id)}
        >
          <Check className="h-3 w-3 mr-1" />
          Approve
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────
export function ApprovalBar() {
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);
  const addEventListener = useGatewayStore((s) => s.addEventListener);

  const [approvals, setApprovals] = React.useState<PendingApproval[]>([]);
  const [expanded, setExpanded] = React.useState(false);
  const [dismissed, setDismissed] = React.useState(false);

  // Listen for approval events
  React.useEffect(() => {
    if (!connected) {return;}

    const unsubPending = addEventListener("exec.pending", (payload: unknown) => {
      const data = payload as PendingApproval;
      setApprovals((prev) => {
        // Avoid duplicates
        if (prev.some((a) => a.id === data.id)) {return prev;}
        return [...prev, data];
      });
      setDismissed(false);
    });

    const unsubResolved = addEventListener("exec.resolved", (payload: unknown) => {
      const data = payload as { id: string };
      setApprovals((prev) => prev.filter((a) => a.id !== data.id));
    });

    // Initial load of pending approvals
    request<{ pending: PendingApproval[] }>("exec.pending.list", {})
      .then((result) => {
        if (result.pending?.length) {
          setApprovals(result.pending);
        }
      })
      .catch(() => {
        // Endpoint may not exist yet — that's fine
      });

    return () => {
      unsubPending();
      unsubResolved();
    };
  }, [connected, addEventListener, request]);

  const handleApprove = async (id: string) => {
    try {
      await request("exec.approve", { id });
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to approve:", err);
    }
  };

  const handleDeny = async (id: string) => {
    try {
      await request("exec.deny", { id });
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      console.error("Failed to deny:", err);
    }
  };

  const handleApproveAll = async () => {
    for (const approval of approvals) {
      try {
        await request("exec.approve", { id: approval.id });
      } catch {
        // Continue with others
      }
    }
    setApprovals([]);
  };

  // Don't render if no pending approvals or dismissed
  if (approvals.length === 0 || dismissed) {return null;}

  const highRisk = approvals.filter((a) => a.risk === "high").length;
  const visible = expanded ? approvals : approvals.slice(0, 2);

  return (
    <div className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border">
      <div className="max-w-5xl mx-auto px-4 py-2.5">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Shield className="h-4 w-4 text-primary" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-primary rounded-full flex items-center justify-center text-[8px] text-primary-foreground font-bold">
                {approvals.length}
              </span>
            </div>
            <span className="text-sm font-medium">
              {approvals.length} pending approval{approvals.length !== 1 ? "s" : ""}
            </span>
            {highRisk > 0 && (
              <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-600 border-red-500/20">
                <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                {highRisk} high risk
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {approvals.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={handleApproveAll}
              >
                <Check className="h-3 w-3 mr-1" />
                Approve All
              </Button>
            )}
            {approvals.length > 2 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Collapse
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    +{approvals.length - 2} more
                  </>
                )}
              </button>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="text-muted-foreground hover:text-foreground p-1 rounded"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Approval Items */}
        <div className="space-y-1.5">
          {visible.map((approval) => (
            <ApprovalItem
              key={approval.id}
              approval={approval}
              onApprove={handleApprove}
              onDeny={handleDeny}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
