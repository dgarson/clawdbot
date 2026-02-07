"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/composed";
import type { Agent } from "@/hooks/queries/useAgents";
import type { GatewaySessionRow } from "@/lib/api/sessions";
import { ChatBackendToggle } from "./ChatBackendToggle";
import { formatRelativeTime, getSessionLabel } from "./session-helpers";
import { useUIStore } from "@/stores/useUIStore";
import { Clock, MessagesSquare, Sparkles, FolderOpen } from "lucide-react";

export interface SessionOverviewPanelProps {
  agent: Agent;
  session?: GatewaySessionRow;
  messageCount: number;
  lastActiveAt?: number;
  workspaceDir?: string;
  chatBackend: "gateway" | "vercel-ai";
  onNewSession?: () => void;
  className?: string;
}

export function SessionOverviewPanel({
  agent,
  session,
  messageCount,
  lastActiveAt,
  workspaceDir,
  chatBackend,
  onNewSession,
  className,
}: SessionOverviewPanelProps) {
  const sessionLabel = session ? getSessionLabel(session) : "Current session";
  const powerUserMode = useUIStore((s) => s.powerUserMode);

  return (
    <Card className={cn("border-border/60 bg-card/40", className)}>
      <CardContent className="p-3 space-y-3">
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Session overview
          </p>
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <h2 className="text-sm font-semibold truncate leading-tight">{sessionLabel}</h2>
              <p className="text-[10px] text-muted-foreground truncate">
                {session?.key ?? "Awaiting session key"}
              </p>
            </div>
            <StatusBadge status={agent.status} size="sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <MessagesSquare className="h-3 w-3" />
              <span className="text-[11px]">Messages</span>
            </div>
            <p className="text-xs font-semibold">{messageCount}</p>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span className="text-[11px]">Last active</span>
            </div>
            <p className="text-xs font-semibold">
              {lastActiveAt ? formatRelativeTime(lastActiveAt) : "Waiting"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant="secondary" className="text-[9px] uppercase tracking-wide px-1.5 py-0.5">
            {chatBackend === "gateway" ? "Gateway" : "Vercel AI"}
          </Badge>
          {session?.thinkingLevel && (
            <Badge variant="outline" className="text-[9px] uppercase tracking-wide px-1.5 py-0.5">
              {session.thinkingLevel}
            </Badge>
          )}
          {session?.verboseLevel && (
            <Badge variant="outline" className="text-[9px] uppercase tracking-wide px-1.5 py-0.5">
              Verbose {session.verboseLevel}
            </Badge>
          )}
        </div>

        {workspaceDir && (
          <div className="rounded-md border border-border/50 bg-muted/30 px-2 py-1.5 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FolderOpen className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{workspaceDir}</span>
            </div>
          </div>
        )}

        {/* New session button is always visible */}
        <div className="grid gap-1.5">
          <Button
            size="sm"
            onClick={onNewSession}
            disabled={!onNewSession}
            className="h-8 text-xs"
          >
            New session
          </Button>
        </div>

        {/* Advanced controls: only visible in power user mode */}
        {powerUserMode && (
          <>
            <Separator className="bg-border/60" />
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Sparkles className="h-3 w-3" />
                Controls
              </div>
              <ChatBackendToggle />
              <div className="grid gap-1.5">
                <Button size="sm" variant="outline" disabled className="h-8 text-xs">
                  Settings (soon)
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default SessionOverviewPanel;
