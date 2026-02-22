
import { Link } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { ApprovalsQueue, MilestoneFeed } from "@/components/domain/approvals";
import { usePendingApprovals } from "@/hooks/usePendingApprovals";
import { useOptionalGateway } from "@/providers/GatewayProvider";
import { useAgentStore } from "@/stores/useAgentStore";
import { showError, showSuccess } from "@/lib/toast";

export interface InboxPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InboxPanel({ open, onOpenChange }: InboxPanelProps) {
  const approvals = usePendingApprovals();
  const gatewayCtx = useOptionalGateway();
  const updateAgentWith = useAgentStore((s) => s.updateAgentWith);

  const handleApprove = async (toolCallId: string) => {
    const approval = approvals.find((a) => a.toolCall.toolCallId === toolCallId);
    if (!approval) return;
    if (!gatewayCtx?.isConnected) {
      showError("Gateway not connected.");
      return;
    }
    try {
      await gatewayCtx.client.request("tool.approve", { toolCallId });
      updateAgentWith(approval.agentId, (agent) => {
        const remaining = (agent.pendingToolCallIds ?? []).filter((id) => id !== toolCallId);
        return { ...agent, pendingToolCallIds: remaining, pendingApprovals: remaining.length };
      });
      showSuccess("Approved.");
    } catch {
      showError("Failed to approve. The request may have expired.");
    }
  };

  const handleReject = async (toolCallId: string) => {
    const approval = approvals.find((a) => a.toolCall.toolCallId === toolCallId);
    if (!approval) return;
    if (!gatewayCtx?.isConnected) {
      showError("Gateway not connected.");
      return;
    }
    try {
      await gatewayCtx.client.request("tool.reject", { toolCallId, reason: "Denied by operator" });
      updateAgentWith(approval.agentId, (agent) => {
        const remaining = (agent.pendingToolCallIds ?? []).filter((id) => id !== toolCallId);
        return { ...agent, pendingToolCallIds: remaining, pendingApprovals: remaining.length };
      });
      showSuccess("Rejected.");
    } catch {
      showError("Failed to reject. The request may have expired.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[380px] flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle>Inbox</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Needs Attention */}
          <div className="px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Needs Attention
            </p>
            <ApprovalsQueue
              approvals={approvals}
              mode="compact"
              onApprove={(id) => { void handleApprove(id); }}
              onReject={(id) => { void handleReject(id); }}
            />
            {approvals.length > 0 && (
              <Link
                to="/approvals"
                onClick={() => onOpenChange(false)}
                className="mt-2 block text-center text-xs text-primary hover:underline"
              >
                View all approvals
              </Link>
            )}
          </div>

          <Separator />

          {/* Goal Activity */}
          <div className="px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Goal Activity
            </p>
            <MilestoneFeed mode="compact" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
