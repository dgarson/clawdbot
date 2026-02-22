import { createLazyFileRoute } from "@tanstack/react-router";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ApprovalsQueue, MilestoneFeed } from "@/components/domain/approvals";
import { usePendingApprovals } from "@/hooks/usePendingApprovals";
import { useToolCallActions } from "@/hooks/useToolCallActions";

export const Route = createLazyFileRoute("/approvals")({ component: ApprovalsPage });

function ApprovalsPage() {
  const approvals = usePendingApprovals();
  const { approveToolCall, rejectToolCall, approveAllForAgent, rejectAllForAgent } = useToolCallActions(approvals);

  // Low-risk agent IDs for the batch approve button
  const lowRiskAgentIds = [
    ...new Set(approvals.filter((a) => a.toolCall.risk === "low").map((a) => a.agentId)),
  ];

  const handleApproveAllLowRisk = async () => {
    for (const agentId of lowRiskAgentIds) {
      await approveAllForAgent(agentId);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Inbox</h1>
          {approvals.length > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
              {approvals.length}
            </span>
          )}
        </div>
        {lowRiskAgentIds.length > 0 && (
          <Button variant="outline" size="sm" onClick={() => { void handleApproveAllLowRisk(); }}>
            Approve All Low-Risk
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
        <ApprovalsQueue
          approvals={approvals}
          mode="full"
          onApprove={(id) => { void approveToolCall(id); }}
          onReject={(id) => { void rejectToolCall(id); }}
          onApproveAllForAgent={(agentId) => { void approveAllForAgent(agentId); }}
          onRejectAllForAgent={(agentId) => { void rejectAllForAgent(agentId); }}
        />

        <Separator />

        <div>
          <p className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Goal Activity
          </p>
          <MilestoneFeed mode="full" />
        </div>
      </div>
    </div>
  );
}
