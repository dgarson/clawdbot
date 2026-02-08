import * as React from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { CalendarDays, PencilLine, ScrollText, Trash2, Users } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAgents } from "@/hooks/queries/useAgents";
import { useSessions } from "@/hooks/queries/useSessions";
import { useDebounce } from "@/hooks/useDebounce";
import {
  parseAgentSessionKey,
  patchSession,
  deleteSession,
  type GatewaySessionRow,
  type SessionPatchParams,
} from "@/lib/api/sessions";
import { sessionKeys } from "@/hooks/queries/useSessions";
import { RouteErrorFallback } from "@/components/composed";

export const Route = createFileRoute("/sessions/")({
  component: SessionsPage,
  errorComponent: RouteErrorFallback,
});

type SessionStatus = "active" | "stale" | "idle";

type ThinkingLevel = "off" | "low" | "medium" | "high";

const thinkingLevelOptions: { value: ThinkingLevel; label: string }[] = [
  { value: "off", label: "Off" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const ACTIVE_THRESHOLD_MS = 5 * 60 * 1000;
const STALE_THRESHOLD_MS = 30 * 60 * 1000;

function getSessionStatus(session: GatewaySessionRow, now: number): SessionStatus {
  if (!session.lastMessageAt) {
    return "idle";
  }
  const age = now - session.lastMessageAt;
  if (age < ACTIVE_THRESHOLD_MS) {
    return "active";
  }
  if (age < STALE_THRESHOLD_MS) {
    return "stale";
  }
  return "idle";
}

function statusVariant(status: SessionStatus): "success" | "warning" | "secondary" {
  switch (status) {
    case "active":
      return "success";
    case "stale":
      return "warning";
    default:
      return "secondary";
  }
}

function formatRelativeTime(timestamp?: number, baseNow?: number) {
  if (!timestamp) {
    return "—";
  }
  const now = baseNow ?? Date.now();
  const diff = now - timestamp;
  const absDiff = Math.abs(diff);
  const isPast = diff >= 0;

  if (absDiff < 60000) {
    return isPast ? "Just now" : "In less than a minute";
  }
  if (absDiff < 3600000) {
    const mins = Math.floor(absDiff / 60000);
    return isPast ? `${mins}m ago` : `In ${mins}m`;
  }
  if (absDiff < 86400000) {
    const hours = Math.floor(absDiff / 3600000);
    return isPast ? `${hours}h ago` : `In ${hours}h`;
  }
  const days = Math.floor(absDiff / 86400000);
  return isPast ? `${days}d ago` : `In ${days}d`;
}

function normalizeLabelInput(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function SessionsPage() {
  const queryClient = useQueryClient();
  const { data: sessionsResult, isLoading, error } = useSessions();
  const { data: agents } = useAgents();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<SessionStatus | "all">("all");
  const [agentFilter, setAgentFilter] = React.useState("all");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [labelEdits, setLabelEdits] = React.useState<Record<string, string>>({});
  const [thinkingEdits, setThinkingEdits] = React.useState<Record<string, string>>({});
  const debouncedSearch = useDebounce(searchQuery, 300);
  const baseNow = Date.now();

  const patchMutation = useMutation({
    mutationFn: async (payload: SessionPatchParams) => patchSession(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
    },
    onError: (err) => {
      toast.error(`Failed to update session: ${err instanceof Error ? err.message : "Unknown error"}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (key: string) => deleteSession(key, false),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionKeys.lists() });
      toast.success("Session deleted");
    },
    onError: (err) => {
      toast.error(`Failed to delete session: ${err instanceof Error ? err.message : "Unknown error"}`);
    },
  });

  React.useEffect(() => {
    if (!sessionsResult?.sessions) {
      return;
    }
    setLabelEdits((prev) => {
      const next = { ...prev };
      sessionsResult.sessions.forEach((session) => {
        if (!(session.key in next)) {
          next[session.key] = session.label ?? "";
        }
      });
      return next;
    });
    setThinkingEdits((prev) => {
      const next = { ...prev };
      sessionsResult.sessions.forEach((session) => {
        if (!(session.key in next)) {
          next[session.key] = session.thinkingLevel ?? "default";
        }
      });
      return next;
    });
  }, [sessionsResult?.sessions]);

  const agentOptions = React.useMemo(() => {
    const entries = agents ?? [];
    return entries.map((agent) => ({ id: agent.id, name: agent.name }));
  }, [agents]);

  const filteredSessions = React.useMemo(() => {
    const sessions = sessionsResult?.sessions ?? [];
    const now = Date.now();

    const startTimestamp = startDate
      ? new Date(`${startDate}T00:00:00`).getTime()
      : null;
    const endTimestamp = endDate
      ? new Date(`${endDate}T23:59:59`).getTime()
      : null;

    return sessions.filter((session) => {
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        const matches = [
          session.label,
          session.derivedTitle,
          session.lastMessage,
          session.key,
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(query));
        if (!matches) {
          return false;
        }
      }

      const status = getSessionStatus(session, now);
      if (statusFilter !== "all" && status !== statusFilter) {
        return false;
      }

      const agentId = parseAgentSessionKey(session.key)?.agentId ?? "unknown";
      if (agentFilter !== "all" && agentId !== agentFilter) {
        return false;
      }

      if (startTimestamp || endTimestamp) {
        if (!session.lastMessageAt) {
          return false;
        }
        if (startTimestamp && session.lastMessageAt < startTimestamp) {
          return false;
        }
        if (endTimestamp && session.lastMessageAt > endTimestamp) {
          return false;
        }
      }

      return true;
    });
  }, [sessionsResult?.sessions, debouncedSearch, statusFilter, agentFilter, startDate, endDate]);

  const handleLabelCommit = (session: GatewaySessionRow) => {
    const nextLabel = normalizeLabelInput(labelEdits[session.key] ?? "");
    const currentLabel = normalizeLabelInput(session.label ?? "");

    if (nextLabel === currentLabel) {
      return;
    }

    patchMutation.mutate({
      key: session.key,
      label: nextLabel,
    });
  };

  const handleThinkingLevelChange = (session: GatewaySessionRow, value: string) => {
    setThinkingEdits((prev) => ({ ...prev, [session.key]: value }));
    const thinkingLevel = value === "default" ? null : (value as ThinkingLevel);
    patchMutation.mutate({
      key: session.key,
      thinkingLevel,
    });
  };

  const handleDelete = (sessionKey: string) => {
    const confirmed = window.confirm("Delete this session? This cannot be undone.");
    if (!confirmed) {
      return;
    }
    deleteMutation.mutate(sessionKey);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Sessions
              </h1>
              <p className="text-muted-foreground">
                Manage session metadata, labels, and thinking levels
              </p>
            </div>
          </div>
        </motion.div>

        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative flex-1 min-w-[220px]">
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search sessions..."
                  />
                </div>

                <Select
                  value={statusFilter}
                  onValueChange={(value) => setStatusFilter(value as SessionStatus | "all")}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="stale">Stale</SelectItem>
                    <SelectItem value="idle">Idle</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={agentFilter}
                  onValueChange={setAgentFilter}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agents</SelectItem>
                    {agentOptions.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                    className="w-[150px]"
                  />
                  <span className="text-sm text-muted-foreground">to</span>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(event) => setEndDate(event.target.value)}
                    className="w-[150px]"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>All Sessions</CardTitle>
              <CardDescription>
                {filteredSessions.length} of {sessionsResult?.sessions.length ?? 0} sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[560px]">
                <div className="space-y-3">
                  {isLoading && (
                    <div className="text-sm text-muted-foreground">Loading sessions...</div>
                  )}
                  {error && (
                    <div className="text-sm text-destructive">Failed to load sessions.</div>
                  )}
                  {!isLoading && !error && filteredSessions.length === 0 && (
                    <div className="text-sm text-muted-foreground">No sessions match your filters.</div>
                  )}
                  {filteredSessions.map((session) => {
                    const agentInfo = parseAgentSessionKey(session.key);
                    const agentName = agentInfo
                      ? agentOptions.find((agent) => agent.id === agentInfo.agentId)?.name
                      : "Unknown";
                    const status = getSessionStatus(session, baseNow);
                    const labelValue = labelEdits[session.key] ?? session.label ?? "";
                    const thinkingValue = thinkingEdits[session.key] ?? session.thinkingLevel ?? "default";

                    return (
                      <div
                        key={session.key}
                        className="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                          <div className="flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant={statusVariant(status)} className="uppercase text-xs">
                                {status}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">
                                {session.messageCount ?? 0} messages
                              </Badge>
                              {session.derivedTitle && !session.label && (
                                <Badge variant="outline" className="text-xs">
                                  Suggested: {session.derivedTitle}
                                </Badge>
                              )}
                            </div>

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <div className="flex-1">
                                <label className="text-xs text-muted-foreground">Label</label>
                                <div className="mt-1 flex items-center gap-2">
                                  <Input
                                    value={labelValue}
                                    onChange={(event) =>
                                      setLabelEdits((prev) => ({
                                        ...prev,
                                        [session.key]: event.target.value,
                                      }))
                                    }
                                    onBlur={() => handleLabelCommit(session)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") {
                                        handleLabelCommit(session);
                                      }
                                    }}
                                    placeholder={session.derivedTitle ?? "Add label"}
                                  />
                                  <PencilLine className="h-4 w-4 text-muted-foreground" />
                                </div>
                              </div>

                              <div className="w-full sm:w-[180px]">
                                <label className="text-xs text-muted-foreground">Thinking</label>
                                <Select
                                  value={thinkingValue}
                                  onValueChange={(value) => handleThinkingLevelChange(session, value)}
                                >
                                  <SelectTrigger className="mt-1">
                                    <SelectValue placeholder="Default" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="default">Default</SelectItem>
                                    {thinkingLevelOptions.map((level) => (
                                      <SelectItem key={level.value} value={level.value}>
                                        {level.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 text-sm text-muted-foreground xl:text-right">
                            <div>
                              <div className="text-xs uppercase text-muted-foreground">Agent</div>
                              <div className="text-sm text-foreground">
                                {agentName ?? "Unknown"}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs uppercase text-muted-foreground">Last activity</div>
                              <div className="text-sm text-foreground">
                                {formatRelativeTime(session.lastMessageAt, baseNow)}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            {agentInfo ? (
                              <Button asChild variant="outline" size="sm">
                                <Link
                                  to="/agents/$agentId/session/$sessionKey"
                                  params={{ agentId: agentInfo.agentId, sessionKey: session.key }}
                                  search={{ newSession: false }}
                                >
                                  Open
                                </Link>
                              </Button>
                            ) : null}
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                            >
                              <Link
                                to="/logs"
                                search={{
                                  agentId: agentInfo?.agentId,
                                  sessionKey: session.key,
                                }}
                              >
                                <ScrollText className="mr-2 h-4 w-4" />
                                Logs
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(session.key)}
                              disabled={deleteMutation.isPending}
                              aria-label="Delete session"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
