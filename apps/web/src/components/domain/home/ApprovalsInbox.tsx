"use client";

import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAgentStore } from "@/stores/useAgentStore";
import { useToolApprovals } from "@/hooks/queries/useToolApprovals";
import { parseAgentSessionKey } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ApprovalsInboxProps {
  className?: string;
}

/**
 * Prominent card shown when there are pending agent approvals.
 * Designed to be impossible to miss (safety UX).
 */
export function ApprovalsInbox({ className }: ApprovalsInboxProps) {
  const agents = useAgentStore((s) => s.agents);
  const { data: toolApprovals } = useToolApprovals();

  const approvals = toolApprovals?.approvals ?? null;
  const approvalsByAgent = React.useMemo(() => {
    if (!approvals) {
      return null;
    }
    const map = new Map<string, number>();
    let unknown = 0;
    for (const approval of approvals) {
      const resolvedAgentId =
        approval.agentId ??
        (approval.sessionKey ? parseAgentSessionKey(approval.sessionKey)?.agentId : null);
      if (!resolvedAgentId) {
        unknown += 1;
        continue;
      }
      map.set(resolvedAgentId, (map.get(resolvedAgentId) ?? 0) + 1);
    }
    return { map, unknown };
  }, [approvals]);

  // Sum pending approvals across all agents
  const totalPending =
    approvals?.length ??
    agents.reduce((sum, agent) => sum + (agent.pendingApprovals ?? 0), 0);

  const agentsWithApprovals = approvalsByAgent
    ? agents.filter((agent) => approvalsByAgent.map.has(agent.id))
    : agents.filter((a) => (a.pendingApprovals ?? 0) > 0);
  const unknownAgentApprovals = approvalsByAgent?.unknown ?? 0;
  const totalAgentsWithApprovals = approvalsByAgent
    ? agentsWithApprovals.length + (unknownAgentApprovals > 0 ? 1 : 0)
    : agentsWithApprovals.length;

  if (totalPending === 0) {
    return null;
  }

  return (
    <Card
      className={cn(
        "border-warning/40 bg-warning/5 shadow-sm",
        className
      )}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warning/15">
          <ShieldAlert className="size-5 text-warning" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">
              Pending approvals
            </p>
            <Badge variant="warning" className="text-xs">
              {totalPending}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalAgentsWithApprovals === 1
              ? `${agentsWithApprovals[0]?.name ?? "An agent"} needs your review`
              : `${totalAgentsWithApprovals} agents need your review`}
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/agent-status">
            Review
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
