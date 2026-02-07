"use client";

import { Link } from "@tanstack/react-router";
import { ShieldAlert, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAgentStore } from "@/stores/useAgentStore";
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

  // Sum pending approvals across all agents
  const totalPending = agents.reduce(
    (sum, agent) => sum + (agent.pendingApprovals ?? 0),
    0
  );

  const agentsWithApprovals = agents.filter(
    (a) => (a.pendingApprovals ?? 0) > 0
  );

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
            {agentsWithApprovals.length === 1
              ? `${agentsWithApprovals[0].name} needs your review`
              : `${agentsWithApprovals.length} agents need your review`}
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
