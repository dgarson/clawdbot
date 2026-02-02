"use client";

import * as React from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { showInfo, showWarning } from "@/lib/toast";
import { useAgents } from "@/hooks/queries/useAgents";
import { useAgentLiveUpdates } from "@/hooks/useAgentLiveUpdates";
import { useUIStore } from "@/stores/useUIStore";
import { derivePendingApprovalsSummary } from "@/lib/approvals/pending";

export type ApprovalAttentionNudgeProps = {
  pendingApprovals: number;
  pendingAgents: number;
  snoozeUntilMs: number;
  onReview: () => void;
  onOpenNext?: () => void;
  disableOpenNext?: boolean;
  onSnooze: (durationMs: number) => void;
  className?: string;
};

const SNOOZE_OPTIONS: Array<{ label: string; durationMs: number }> = [
  { label: "Snooze 5 minutes", durationMs: 5 * 60_000 },
  { label: "Snooze 15 minutes", durationMs: 15 * 60_000 },
  { label: "Snooze 1 hour", durationMs: 60 * 60_000 },
];

function plural(count: number, singular: string, pluralWord = `${singular}s`) {
  return count === 1 ? singular : pluralWord;
}

export function ApprovalAttentionNudge(props: ApprovalAttentionNudgeProps) {
  const now = Date.now();
  const snoozed = props.snoozeUntilMs > now;
  const show = props.pendingApprovals > 0 && !snoozed;

  return (
    <AnimatePresence initial={false}>
      {show ? (
        <motion.div
          key="approval-nudge"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          data-approval-nudge
          className={props.className}
        >
          <div className="w-full rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <div className="grid w-full grid-cols-[min-content_1fr_min-content] items-center gap-4">
              <AlertCircle className="h-7 w-7 text-amber-400 shrink-0 self-center" />
              <div className="min-w-0 space-y-1">
                <div className="text-sm font-medium leading-snug">
                  {props.pendingApprovals} {plural(props.pendingApprovals, "approval")}{" "}
                  {plural(props.pendingApprovals, "needs", "need")} your input
                </div>
                <div className="text-xs text-muted-foreground leading-snug">
                  Waiting across {props.pendingAgents} {plural(props.pendingAgents, "agent")}.{" "}
                  <Link
                    to="/agents"
                    search={{ status: "waiting" }}
                    className="underline underline-offset-4 hover:text-foreground"
                  >
                    View waiting agents
                  </Link>
                  .
                  <span className="ml-2">
                    Snooze hides reminders only. Approvals may fail later if an external token, ticket, or request expires.
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 self-center">
                {props.onOpenNext ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={props.onOpenNext}
                    disabled={props.disableOpenNext}
                    className={cn(
                      "transition",
                      props.disableOpenNext &&
                        "opacity-50 text-muted-foreground border-muted-foreground/30 line-through pointer-events-none"
                    )}
                  >
                    Open next
                  </Button>
                ) : null}
                <Button size="sm" onClick={props.onReview}>
                  Review
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="ghost" className="gap-2">
                      <Clock className="size-4" />
                      Snooze
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {SNOOZE_OPTIONS.map((opt) => (
                      <DropdownMenuItem
                        key={opt.label}
                        onSelect={() => props.onSnooze(opt.durationMs)}
                      >
                        {opt.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export type ApprovalAttentionNudgeConnectedProps = {
  className?: string;
};

export function ApprovalAttentionNudgeConnected(props: ApprovalAttentionNudgeConnectedProps) {
  const navigate = useNavigate();
  const { data: agents } = useAgents();
  const routerState = useRouterState();

  // Ensure we receive tool approval live updates even when the sidebar is hidden.
  useAgentLiveUpdates();

  const snoozeUntilMs = useUIStore((s) => s.attentionSnoozeUntilMs);
  const setSnoozeUntil = useUIStore((s) => s.setAttentionSnoozeUntilMs);
  const clearSnooze = useUIStore((s) => s.clearAttentionSnooze);

  const summary = React.useMemo(() => derivePendingApprovalsSummary(agents), [agents]);
  const currentAgentId = (() => {
    const params = routerState.location.params as Record<string, string> | undefined;
    return params?.agentId ?? null;
  })();
  const isViewingCurrentAgent =
    summary.pendingAgents === 1 &&
    summary.nextAgentId &&
    summary.nextAgentId === currentAgentId;
  const openNextDisabled = summary.pendingAgents <= 1 && isViewingCurrentAgent;

  const latestRef = React.useRef({
    pendingApprovals: summary.pendingApprovals,
    pendingAgents: summary.pendingAgents,
  });
  React.useEffect(() => {
    latestRef.current = {
      pendingApprovals: summary.pendingApprovals,
      pendingAgents: summary.pendingAgents,
    };
  }, [summary.pendingApprovals, summary.pendingAgents]);

  // When snoozed and there are still pending approvals, re-alert at the snooze boundary.
  React.useEffect(() => {
    if (summary.pendingApprovals <= 0) {
      if (snoozeUntilMs !== 0) clearSnooze();
      return;
    }

    const now = Date.now();
    if (snoozeUntilMs <= now) return;

    const ms = snoozeUntilMs - now;
    const id = window.setTimeout(() => {
      const { pendingApprovals, pendingAgents } = latestRef.current;
      clearSnooze();
      if (pendingApprovals > 0) {
        showWarning(
          `Reminder: ${pendingApprovals} ${plural(pendingApprovals, "approval")} waiting across ${pendingAgents} ${plural(pendingAgents, "agent")}.`
        );
      }
    }, ms);

    return () => window.clearTimeout(id);
  }, [summary.pendingApprovals, snoozeUntilMs, clearSnooze]);

  const onReview = React.useCallback(() => {
    navigate({ to: "/agents", search: { status: "waiting" } });
  }, [navigate]);

  const onOpenNext = React.useCallback(() => {
    if (!summary.nextAgentId) return;
    navigate({
      to: "/agents/$agentId",
      params: { agentId: summary.nextAgentId },
      search: { tab: "activity" },
    });
  }, [navigate, summary.nextAgentId]);

  const onSnooze = React.useCallback(
    (durationMs: number) => {
      const until = Date.now() + Math.max(1_000, durationMs);
      setSnoozeUntil(until);
      showInfo("Approval reminders snoozed.");
    },
    [setSnoozeUntil]
  );

  if (summary.pendingApprovals <= 0) return null;

  return (
    <ApprovalAttentionNudge
      pendingApprovals={summary.pendingApprovals}
      pendingAgents={summary.pendingAgents}
      snoozeUntilMs={snoozeUntilMs}
      onReview={onReview}
      onOpenNext={
        summary.nextAgentId
          ? onOpenNext
          : undefined
      }
      disableOpenNext={openNextDisabled}
      onSnooze={onSnooze}
      className={props.className}
    />
  );
}

export default ApprovalAttentionNudgeConnected;
