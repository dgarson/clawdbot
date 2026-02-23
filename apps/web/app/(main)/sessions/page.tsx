"use client";

import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import type { SessionEntry, SessionsListResult } from "@/lib/gateway/types";
import { SessionExportDialog } from "@/components/shell/session-export-dialog";
import {
  Search,
  MessageSquare,
  RotateCcw,
  Trash2,
  ExternalLink,
  Bot,
  Loader2,
  Inbox,
  Download,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(ms: number | undefined): string {
  if (!ms) {return "—";}
  const diff = Date.now() - ms;
  if (diff < 60_000) {return "just now";}
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function formatTimestamp(ms: number | undefined): string {
  if (!ms) {return "—";}
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function channelBadgeColor(channel?: string): "default" | "secondary" | "outline" {
  if (!channel) {return "outline";}
  if (channel.startsWith("discord")) {return "default";}
  if (channel.startsWith("whatsapp")) {return "secondary";}
  return "outline";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SessionsPage() {
  const connected = useGatewayStore((s) => s.connected);
  const request = useGatewayStore((s) => s.request);

  const [sessions, setSessions] = React.useState<SessionEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [resettingIds, setResettingIds] = React.useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null);
  const [deletingIds, setDeletingIds] = React.useState<Set<string>>(new Set());
  const [exportSession, setExportSession] = React.useState<{ key: string; agentId?: string } | null>(null);

  // Load sessions
  const loadSessions = React.useCallback(async () => {
    if (!connected) {return;}
    try {
      const result = await request<SessionsListResult>("sessions.list", {});
      setSessions(result.sessions ?? []);
    } catch (err) {
      console.error("Failed to load sessions:", err);
    } finally {
      setLoading(false);
    }
  }, [connected, request]);

  React.useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  // Filtered sessions
  const filtered = React.useMemo(() => {
    if (!searchQuery.trim()) {return sessions;}
    const q = searchQuery.toLowerCase();
    return sessions.filter(
      (s) =>
        s.key.toLowerCase().includes(q) ||
        (s.agentId ?? "").toLowerCase().includes(q) ||
        (s.channel ?? "").toLowerCase().includes(q) ||
        (s.label ?? "").toLowerCase().includes(q) ||
        (s.derivedTitle ?? "").toLowerCase().includes(q)
    );
  }, [sessions, searchQuery]);

  // Actions
  const handleReset = async (sessionKey: string) => {
    setResettingIds((prev) => new Set(prev).add(sessionKey));
    try {
      await request("sessions.reset", { sessionKey });
      await loadSessions();
    } catch (err) {
      console.error("Failed to reset session:", err);
    } finally {
      setResettingIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionKey);
        return next;
      });
    }
  };

  const handleDelete = async (sessionKey: string) => {
    setDeletingIds((prev) => new Set(prev).add(sessionKey));
    try {
      await request("sessions.delete", { sessionKey });
      setSessions((prev) => prev.filter((s) => s.key !== sessionKey));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete session:", err);
    } finally {
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(sessionKey);
        return next;
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
        <p className="text-sm text-muted-foreground mt-1">
          <AdaptiveLabel
            beginner="View and manage your conversation sessions"
            standard="Active and historical agent sessions"
            expert="Session registry — reset, delete, or inspect chat history"
          />
        </p>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by key, agent, channel…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => { setLoading(true); void loadSessions(); }}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      <Separator />

      {/* Loading */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-4 w-48 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded" />
                <div className="h-4 w-20 bg-muted rounded ml-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        /* Empty state */
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-accent p-4 mb-4">
              <Inbox className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {searchQuery ? "No matching sessions" : "No sessions"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              {searchQuery
                ? "Try adjusting your search query."
                : "Sessions are created when agents start conversations. None exist yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        /* Session list */
        <ScrollArea className="max-h-[calc(100vh-280px)]">
          <div className="space-y-2">
            {/* Table header */}
            <div className="grid grid-cols-[1fr_120px_100px_100px_80px_140px] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
              <span>Session</span>
              <span>Agent</span>
              <span>Channel</span>
              <span>Created</span>
              <span className="text-right">Messages</span>
              <span className="text-right">Actions</span>
            </div>

            {filtered.map((session) => {
              const isConfirmingDelete = deleteConfirm === session.key;
              const isResetting = resettingIds.has(session.key);
              const isDeleting = deletingIds.has(session.key);

              return (
                <Card key={session.key} className="hover:bg-accent/50 transition-colors">
                  <CardContent className="p-0">
                    <div className="grid grid-cols-[1fr_120px_100px_100px_80px_140px] gap-3 px-4 py-3 items-center text-sm">
                      {/* Session key + title */}
                      <div className="min-w-0">
                        <div className="font-mono text-xs truncate" title={session.key}>
                          {session.key}
                        </div>
                        {session.derivedTitle && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {session.derivedTitle}
                          </div>
                        )}
                        {session.label && !session.derivedTitle && (
                          <div className="text-xs text-muted-foreground truncate mt-0.5">
                            {session.label}
                          </div>
                        )}
                      </div>

                      {/* Agent */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Bot className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="truncate text-xs">{session.agentId ?? "—"}</span>
                      </div>

                      {/* Channel */}
                      <div>
                        {session.channel ? (
                          <Badge variant={channelBadgeColor(session.channel)} className="text-xs truncate max-w-full">
                            {session.channel}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>

                      {/* Created */}
                      <div className="text-xs text-muted-foreground" title={session.createdAtMs ? new Date(session.createdAtMs).toISOString() : undefined}>
                        {formatTimestamp(session.createdAtMs)}
                      </div>

                      {/* Messages */}
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <MessageSquare className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs tabular-nums">
                            {session.messageCount ?? 0}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {relativeTime(session.lastActiveAtMs)}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Export transcript"
                          onClick={() => setExportSession({ key: session.key, agentId: session.agentId })}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="View chat history"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Reset session"
                          disabled={isResetting}
                          onClick={() => handleReset(session.key)}
                        >
                          {isResetting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3.5 w-3.5" />
                          )}
                        </Button>

                        {isConfirmingDelete ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={isDeleting}
                              onClick={() => handleDelete(session.key)}
                              className="h-7 text-xs px-2"
                            >
                              {isDeleting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                "Confirm"
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteConfirm(null)}
                              className="h-7 text-xs px-2"
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            title="Delete session"
                            onClick={() => setDeleteConfirm(session.key)}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Summary */}
          <div className="text-xs text-muted-foreground text-center mt-4 pb-2">
            {filtered.length} session{filtered.length !== 1 ? "s" : ""}
            {searchQuery && filtered.length !== sessions.length && (
              <span> (filtered from {sessions.length})</span>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Export Dialog */}
      {exportSession && (
        <SessionExportDialog
          open={!!exportSession}
          onOpenChange={(open) => !open && setExportSession(null)}
          sessionKey={exportSession.key}
          agentId={exportSession.agentId}
        />
      )}
    </div>
  );
}
