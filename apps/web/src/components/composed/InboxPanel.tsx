
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ApprovalsQueue, MilestoneFeed } from "@/components/domain/approvals";
import { usePendingApprovals } from "@/hooks/usePendingApprovals";
import { useToolCallActions } from "@/hooks/useToolCallActions";

export interface InboxPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InboxPanel({ open, onOpenChange }: InboxPanelProps) {
  const approvals = usePendingApprovals();
  const { approveToolCall, rejectToolCall } = useToolCallActions(approvals);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[520px] sm:max-w-[520px] flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border px-5 py-3">
          <div className="flex items-center justify-between">
            <SheetTitle>Inbox</SheetTitle>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              asChild
            >
              <Link to="/approvals" onClick={() => onOpenChange(false)}>
                Open Inbox
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto">
          {/* Needs Attention */}
          <div className="px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Needs Attention
            </p>
            <ApprovalsQueue
              approvals={approvals}
              mode="compact"
              onApprove={(id) => { void approveToolCall(id); }}
              onReject={(id) => { void rejectToolCall(id); }}
            />
          </div>

          <Separator />

          {/* Goal Activity */}
          <div className="px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Goal Activity
            </p>
            <MilestoneFeed mode="compact" />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
