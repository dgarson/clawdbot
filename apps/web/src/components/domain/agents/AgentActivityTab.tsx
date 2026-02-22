
import * as React from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DetailPanel } from "@/components/composed/DetailPanel";
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Copy,
  ExternalLink,
  Link2,
  Search,
  Code,
  Zap,
  RefreshCw,
  ChevronDown,
} from "lucide-react";

interface AgentActivityTabProps {
  agentId: string;
  activities?: Activity[];
  onActivityClick?: (activity: Activity) => void;
  selectedActivityId?: string | null;
  onSelectedActivityIdChange?: (activityId: string | null, activity: Activity | null) => void;
}

type ActivityType =
  | "message"
  | "task_complete"
  | "task_start"
  | "task_live"
  | "error"
  | "search"
  | "code"
  | "ritual";

interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  progress?: number; // 0..100 (only shown for live tasks)
  sessionKey?: string;
  durationMs?: number;
  tokens?: number;
  costUsd?: number;
  toolCalls?: Array<{
    name: string;
    count?: number;
    status?: "running" | "done" | "error";
  }>;
  metadata?: Record<string, unknown>;
}

async function copyToClipboard(text: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

function buildActivityHref(agentId: string, activityId: string): string {
  const path = `/agents/${encodeURIComponent(agentId)}`;
  const search = new URLSearchParams({ tab: "activity", activityId }).toString();
  return `${path}?${search}`;
}

function buildActivityUrl(agentId: string, activityId: string): string {
  const href = buildActivityHref(agentId, activityId);
  const origin = globalThis.location?.origin;
  return origin ? `${origin}${href}` : href;
}

const activityConfig: Record<
  ActivityType,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  message: {
    icon: MessageSquare,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Message",
  },
  task_complete: {
    icon: CheckCircle2,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    label: "Completed",
  },
  task_start: {
    icon: Zap,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    label: "Started",
  },
  task_live: {
    icon: Loader2,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    label: "Live",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Error",
  },
  search: {
    icon: Search,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    label: "Search",
  },
  code: {
    icon: Code,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    label: "Code",
  },
  ritual: {
    icon: RefreshCw,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    label: "Ritual",
  },
};

// Mock activity data
const generateMockActivities = (): Activity[] => [
  {
    id: "live-1",
    type: "task_live",
    title: "Running task: Context sync",
    description: "Refreshing workspace context and indexing recent events",
    progress: 42,
    timestamp: new Date(Date.now() - 90000).toISOString(),
    sessionKey: "session-ctx-sync",
    toolCalls: [
      { name: "context.fetch", count: 3, status: "running" },
      { name: "indexer.sync", count: 1, status: "running" },
    ],
  },
  {
    id: "1",
    type: "message",
    title: "Responded to user query",
    description: "Provided research summary on market trends",
    timestamp: new Date(Date.now() - 1800000).toISOString(),
    sessionKey: "session-research-1",
    durationMs: 92000,
    tokens: 2840,
    costUsd: 0.36,
    toolCalls: [{ name: "search.web", count: 4, status: "done" }],
  },
  {
    id: "2",
    type: "task_complete",
    title: "Completed task: Data Analysis",
    description: "Analyzed Q4 sales data and generated report",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    sessionKey: "session-data-4q",
    durationMs: 246000,
    tokens: 8120,
    costUsd: 1.42,
    toolCalls: [
      { name: "files.read", count: 6, status: "done" },
      { name: "python.exec", count: 2, status: "done" },
    ],
  },
  {
    id: "3",
    type: "search",
    title: "Web search performed",
    description: 'Searched for "latest AI developments 2024"',
    timestamp: new Date(Date.now() - 5400000).toISOString(),
    sessionKey: "session-research-1",
    durationMs: 18000,
    tokens: 640,
    costUsd: 0.08,
    toolCalls: [{ name: "search.web", count: 2, status: "done" }],
  },
  {
    id: "4",
    type: "code",
    title: "Code execution",
    description: "Executed Python script for data processing",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    sessionKey: "session-data-4q",
    durationMs: 54000,
    tokens: 980,
    costUsd: 0.11,
    toolCalls: [{ name: "python.exec", count: 1, status: "done" }],
  },
  {
    id: "5",
    type: "ritual",
    title: "Daily Standup Summary",
    description: "Automatically compiled and sent standup notes",
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    sessionKey: "session-ritual-standup",
    durationMs: 78000,
    tokens: 2100,
    costUsd: 0.28,
    toolCalls: [
      { name: "calendar.read", count: 1, status: "done" },
      { name: "email.send", count: 1, status: "done" },
    ],
  },
  {
    id: "6",
    type: "error",
    title: "API call failed",
    description: "External service temporarily unavailable",
    timestamp: new Date(Date.now() - 18000000).toISOString(),
    sessionKey: "session-ops-1",
    durationMs: 12000,
    tokens: 420,
    costUsd: 0.05,
    toolCalls: [{ name: "http.request", count: 1, status: "error" }],
  },
  {
    id: "7",
    type: "task_start",
    title: "Started task: Report Generation",
    description: "Beginning weekly metrics report",
    timestamp: new Date(Date.now() - 21600000).toISOString(),
    sessionKey: "session-metrics-1",
    toolCalls: [{ name: "files.read", count: 2, status: "running" }],
  },
  {
    id: "8",
    type: "message",
    title: "Answered question",
    description: "Explained technical concept to user",
    timestamp: new Date(Date.now() - 28800000).toISOString(),
    sessionKey: "session-support-1",
    durationMs: 64000,
    tokens: 1460,
    costUsd: 0.19,
  },
  {
    id: "9",
    type: "task_complete",
    title: "Completed task: Document Review",
    description: "Reviewed and annotated 15 pages of documentation",
    timestamp: new Date(Date.now() - 43200000).toISOString(),
    sessionKey: "session-docs-1",
    durationMs: 198000,
    tokens: 5340,
    costUsd: 0.78,
    toolCalls: [{ name: "files.annotate", count: 3, status: "done" }],
  },
  {
    id: "10",
    type: "search",
    title: "Research completed",
    description: "Found 12 relevant sources for user query",
    timestamp: new Date(Date.now() - 86400000).toISOString(),
    sessionKey: "session-research-1",
    durationMs: 42000,
    tokens: 1240,
    costUsd: 0.15,
    toolCalls: [{ name: "search.web", count: 3, status: "done" }],
  },
];

export function AgentActivityTab({
  agentId,
  activities: activitiesProp,
  onActivityClick,
  selectedActivityId: selectedActivityIdProp,
  onSelectedActivityIdChange,
}: AgentActivityTabProps) {
  void agentId;
  const [filter, setFilter] = React.useState<ActivityType | "all">("all");
  const [mockActivities] = React.useState<Activity[]>(() => generateMockActivities());
  const activities = activitiesProp ?? mockActivities;
  const [visibleCount, setVisibleCount] = React.useState(5);
  const [baseNow] = React.useState(() => Date.now());
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const isSelectionControlled = selectedActivityIdProp !== undefined;
  const [selectedActivityId, setSelectedActivityId] = React.useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const todayKey = new Date(baseNow).toLocaleDateString();
  const yesterdayKey = new Date(baseNow - 86400000).toLocaleDateString();

  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!isSelectionControlled) {return;}
    const next = selectedActivityIdProp ?? null;
    setSelectedActivityId(next);
    setDetailsOpen(Boolean(next));
  }, [isSelectionControlled, selectedActivityIdProp]);

  const filteredActivities = React.useMemo(() => {
    if (filter === "all") {return activities;}
    return activities.filter((a) => a.type === filter);
  }, [activities, filter]);

  const liveActivities = React.useMemo(() => {
    if (filter === "task_live") {return filteredActivities;}
    if (filter !== "all") {return [];}
    return activities.filter((a) => a.type === "task_live");
  }, [activities, filter, filteredActivities]);

  const timelineActivities = React.useMemo(() => {
    return filteredActivities.filter((a) => a.type !== "task_live");
  }, [filteredActivities]);

  const visibleActivities = timelineActivities.slice(0, visibleCount);
  const hasMore = visibleCount < timelineActivities.length;

  const formatRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const diffMs = nowMs - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) {return "Just now";}
    if (diffMins < 60) {return `${diffMins}m ago`;}
    if (diffHours < 24) {return `${diffHours}h ago`;}
    if (diffDays < 7) {return `${diffDays}d ago`;}
    return date.toLocaleDateString();
  };

  const formatDuration = (durationMs?: number) => {
    if (!durationMs || durationMs <= 0) {return "—";}
    const totalSeconds = Math.round(durationMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes === 0) {return `${seconds}s`;}
    return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
  };

  const formatCost = (costUsd?: number) => {
    if (costUsd === undefined) {return "—";}
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(costUsd);
  };

  const selectActivity = React.useCallback(
    (activity: Activity) => {
      setDetailsOpen(true);
      onActivityClick?.(activity);
      if (!isSelectionControlled) {setSelectedActivityId(activity.id);}
      onSelectedActivityIdChange?.(activity.id, activity);
    },
    [isSelectionControlled, onActivityClick, onSelectedActivityIdChange]
  );

  const selectedActivity = React.useMemo(() => {
    if (!selectedActivityId) {return null;}
    return activities.find((a) => a.id === selectedActivityId) ?? null;
  }, [activities, selectedActivityId]);

  const selectedSessionKey = React.useMemo(() => {
    if (!selectedActivity) {return undefined;}
    if (selectedActivity.sessionKey) {return selectedActivity.sessionKey;}
    const metaSession = selectedActivity.metadata?.sessionKey;
    return typeof metaSession === "string" ? metaSession : undefined;
  }, [selectedActivity]);

  React.useEffect(() => {
    if (!selectedActivityId) {return;}
    const selected = activities.find((a) => a.id === selectedActivityId);
    if (!selected) {return;}

    if (filter === "all") {return;}
    if (filter === selected.type) {return;}

    setFilter("all");
  }, [activities, selectedActivityId, filter]);

  React.useEffect(() => {
    if (!selectedActivityId) {return;}

    const indexInTimeline = timelineActivities.findIndex((a) => a.id === selectedActivityId);
    if (indexInTimeline === -1) {return;}
    if (indexInTimeline < visibleCount) {return;}
    setVisibleCount(indexInTimeline + 1);
  }, [selectedActivityId, timelineActivities, visibleCount]);

  const rowRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const registerRowRef = React.useCallback(
    (activityId: string) => (el: HTMLDivElement | null) => {
      if (el) {rowRefs.current.set(activityId, el);}
      else {rowRefs.current.delete(activityId);}
    },
    []
  );

  React.useEffect(() => {
    if (!detailsOpen || !selectedActivityId) {return;}
    const el = rowRefs.current.get(selectedActivityId);
    if (!el) {return;}
    el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [detailsOpen, selectedActivityId, visibleCount]);

  const handleCopy = React.useCallback(async (label: string, value: string) => {
    try {
      await copyToClipboard(value);
      toast.success(`${label} copied`);
    } catch (e) {
      toast.error(`Failed to copy ${label.toLowerCase()}`);
      console.error("[ActivityTimeline] copy failed:", e);
    }
  }, []);

  const relatedLinks = React.useMemo(() => {
    if (!selectedActivity) {return [];}
    const meta: Record<string, unknown> = selectedActivity.metadata ?? {};

    const items: Array<{ label: string; href: string; external: boolean }> = [];

    const href = meta.href;
    if (typeof href === "string" && href.length > 0) {
      items.push({ label: "Open related", href, external: !href.startsWith("/") });
    }

    const conversationId = meta.conversationId;
    if (typeof conversationId === "string" && conversationId.length > 0) {
      // Prefer session route for conversation links - use the conversationId as a session key
      items.push({
        label: "Open chat session",
        href: `/agents/${encodeURIComponent(agentId)}/session/${encodeURIComponent(conversationId)}`,
        external: false,
      });
    }

    const sessionKey = selectedActivity.sessionKey ?? meta.sessionKey;
    if (typeof sessionKey === "string" && sessionKey.length > 0) {
      items.push({
        label: "Open session",
        href: `/agents/${encodeURIComponent(agentId)}/session/${encodeURIComponent(sessionKey)}`,
        external: false,
      });
    }

    const workstreamId = meta.workstreamId;
    if (typeof workstreamId === "string" && workstreamId.length > 0) {
      items.push({ label: "Open workstream", href: `/workstreams/${encodeURIComponent(workstreamId)}`, external: false });
    }

    const goalId = meta.goalId;
    if (typeof goalId === "string" && goalId.length > 0) {
      items.push({ label: "Open goal", href: `/goals?goalId=${encodeURIComponent(goalId)}`, external: false });
    }

    const memoryId = meta.memoryId;
    if (typeof memoryId === "string" && memoryId.length > 0) {
      items.push({ label: "Open memory", href: `/memories?memoryId=${encodeURIComponent(memoryId)}`, external: false });
    }

    return items;
  }, [selectedActivity, agentId]);

  // Group activities by day
  const groupedActivities = React.useMemo(() => {
    const groups: { date: string; activities: Activity[] }[] = [];
    let currentDate = "";

    visibleActivities.forEach((activity) => {
      const activityDate = new Date(activity.timestamp).toLocaleDateString();
      if (activityDate !== currentDate) {
        currentDate = activityDate;
        groups.push({ date: activityDate, activities: [activity] });
      } else {
        groups[groups.length - 1].activities.push(activity);
      }
    });

    return groups;
  }, [visibleActivities]);

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Activity Timeline</h3>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as ActivityType | "all")}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activity</SelectItem>
            <SelectItem value="message">Messages</SelectItem>
            <SelectItem value="task_live">Live</SelectItem>
            <SelectItem value="task_complete">Completed</SelectItem>
            <SelectItem value="task_start">Started</SelectItem>
            <SelectItem value="search">Searches</SelectItem>
            <SelectItem value="code">Code</SelectItem>
            <SelectItem value="ritual">Rituals</SelectItem>
            <SelectItem value="error">Errors</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      {filteredActivities.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-medium">No activity found</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {filter !== "all"
                ? "Try adjusting your filter"
                : "This agent hasn't performed any actions yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Live / Active tasks */}
          {liveActivities.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium text-foreground">Live now</div>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {liveActivities.length}
                  </Badge>
                </div>
              </div>

              <div className="space-y-4">
                {liveActivities.map((activity, index) => {
                  const config = activityConfig[activity.type];
                  const Icon = config.icon;
                  const isFirst = index === 0;
                  const isLast = index === liveActivities.length - 1;
                  const isSelected = selectedActivityId === activity.id;

                  return (
                    <motion.div
                      key={activity.id}
                      ref={registerRowRef(activity.id)}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className="group relative pl-12"
                    >
                      {/* Connectors */}
                      {!isFirst && (
                        <div className="pointer-events-none absolute left-5 -top-[6px] z-0 h-4 w-px rounded-full bg-border transition-colors group-hover:bg-emerald-500/50" />
                      )}
                      {!isLast && (
                        <div className="pointer-events-none absolute left-5 top-[50px] -bottom-4 z-0 w-px rounded-full bg-border transition-colors group-hover:bg-emerald-500/50" />
                      )}

                      {/* Icon */}
                      <div className="absolute left-0 top-[10px] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background ring-1 ring-border shadow-sm transition-colors group-hover:ring-emerald-500/40">
                        <div
                          className={cn(
                            "relative flex h-8 w-8 items-center justify-center rounded-full bg-background"
                          )}
                        >
                          <div className={cn("absolute inset-0 rounded-full", config.bgColor)} />
                          <div className="absolute inset-0 rounded-full ring-1 ring-emerald-500/30 animate-pulse" />
                          <Icon className={cn("relative h-4 w-4 animate-spin", config.color)} />
                        </div>
                      </div>

                      {/* Content */}
                      <Card
                        className={cn(
                          "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/30 transition-colors",
                          isSelected && "border-emerald-500/40 ring-1 ring-emerald-500/20"
                        )}
                      >
                        <CardContent
                          className="cursor-pointer p-4"
                          role="button"
                          tabIndex={0}
                          aria-selected={isSelected}
                          onClick={() => selectActivity(activity)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              selectActivity(activity);
                            }
                          }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium text-sm truncate">
                                  {activity.title}
                                </h4>
                                <Badge
                                  variant="secondary"
                                  className={cn(
                                    "text-[10px] px-1.5 py-0",
                                    config.bgColor,
                                    config.color
                                  )}
                                >
                                  {config.label}
                                </Badge>
                              </div>
                              {activity.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {activity.description}
                                </p>
                              )}

                              {typeof activity.progress === "number" && (
                                <div className="mt-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                                    <span>Progress</span>
                                    <span className="font-mono">
                                      {Math.max(0, Math.min(100, Math.round(activity.progress)))}%
                                    </span>
                                  </div>
                                  <Progress value={Math.max(0, Math.min(100, activity.progress))} />
                                </div>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatRelativeTime(activity.timestamp)}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {groupedActivities.map((group) => (
            <div key={group.date}>
              {/* Date Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-border" />
	                <Badge variant="secondary" className="text-xs font-normal">
	                  {group.date === todayKey
	                    ? "Today"
	                    : group.date === yesterdayKey
	                      ? "Yesterday"
	                      : group.date}
	                </Badge>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* Activities */}
              <div className="space-y-4">
                {group.activities.map((activity, index) => {
                    const config = activityConfig[activity.type];
                    const Icon = config.icon;
                    const isFirst = index === 0;
                    const isLast = index === group.activities.length - 1;
                    const isSelected = selectedActivityId === activity.id;

                    return (
                      <motion.div
                        key={activity.id}
                        ref={registerRowRef(activity.id)}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.03 }}
                        className="group relative pl-12"
                      >
                        {/* Connectors */}
                        {!isFirst && (
                          <div className="pointer-events-none absolute left-5 -top-[6px] z-0 h-4 w-px rounded-full bg-border" />
                        )}
                        {!isLast && (
                          <div className="pointer-events-none absolute left-5 top-[50px] -bottom-4 z-0 w-px rounded-full bg-border" />
                        )}

                        {/* Icon */}
                        <div className="absolute left-0 top-[10px] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background ring-1 ring-border shadow-sm transition-colors group-hover:ring-primary/30">
                          <div
                            className={cn(
                              "relative flex h-8 w-8 items-center justify-center rounded-full bg-background"
                            )}
                          >
                            <div className={cn("absolute inset-0 rounded-full", config.bgColor)} />
                            <Icon className={cn("relative h-4 w-4", config.color)} />
                          </div>
                        </div>

                        {/* Content */}
                        <Card
                          className={cn(
                            "border-border/50 hover:border-primary/30 transition-colors",
                            isSelected && "border-primary/40 ring-1 ring-primary/15"
                          )}
                        >
                          <CardContent
                            className="cursor-pointer p-4"
                            role="button"
                            tabIndex={0}
                            aria-selected={isSelected}
                            onClick={() => selectActivity(activity)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                selectActivity(activity);
                              }
                            }}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="font-medium text-sm truncate">
                                    {activity.title}
                                  </h4>
                                  <Badge
                                    variant="secondary"
                                    className={cn(
                                      "text-[10px] px-1.5 py-0",
                                      config.bgColor,
                                      config.color
                                    )}
                                  >
                                    {config.label}
                                  </Badge>
                                </div>
                                {activity.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-2">
                                    {activity.description}
                                  </p>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {formatRelativeTime(activity.timestamp)}
                              </span>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                })}
              </div>
            </div>
          ))}

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => setVisibleCount((c) => c + 5)}
                className="gap-2"
              >
                <ChevronDown className="h-4 w-4" />
                Load More
              </Button>
            </div>
          )}
        </div>
      )}

      <DetailPanel
        open={detailsOpen && !!selectedActivity}
        onClose={() => {
          setDetailsOpen(false);
          if (!isSelectionControlled) {setSelectedActivityId(null);}
          onSelectedActivityIdChange?.(null, null);
        }}
        width="md"
        title={selectedActivity?.title ?? "Activity details"}
      >
        {selectedActivity ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-xs font-normal">
                {activityConfig[selectedActivity.type].label}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(selectedActivity.timestamp)}
              </span>
              <span className="text-xs text-muted-foreground font-mono break-all">
                {selectedActivity.id}
              </span>
            </div>

            {selectedActivity.description ? (
              <div className="text-sm text-muted-foreground">
                {selectedActivity.description}
              </div>
            ) : null}

            {selectedSessionKey ? (
              <div className="rounded-xl border border-border/60 bg-secondary/30 p-3">
                <div className="text-xs font-medium text-muted-foreground">
                  Session
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Button asChild size="sm" variant="outline" className="gap-2">
                    <Link to="/agents/$agentId/session/$sessionKey" params={{ agentId, sessionKey: selectedSessionKey }}>
                      <ExternalLink className="h-4 w-4" />
                      Open session
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() => handleCopy("Session key", selectedSessionKey)}
                  >
                    <Copy className="h-4 w-4" />
                    Copy session key
                  </Button>
                  <span className="text-xs text-muted-foreground font-mono break-all">
                    {selectedSessionKey}
                  </span>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy("ID", selectedActivity.id)}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy ID
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy("Link", buildActivityUrl(agentId, selectedActivity.id))}
                className="gap-2"
              >
                <Link2 className="h-4 w-4" />
                Copy link
              </Button>
              <Button
                asChild
                size="sm"
                variant="outline"
                className="gap-2"
              >
                <Link to={buildActivityHref(agentId, selectedActivity.id)} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy("JSON", JSON.stringify(selectedActivity, null, 2))}
                className="gap-2"
              >
                <Copy className="h-4 w-4" />
                Copy JSON
              </Button>
            </div>

            {relatedLinks.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">Actions</div>
                <div className="flex flex-wrap gap-2">
                  {relatedLinks.map((l) =>
                    l.external ? (
                      <Button
                        key={l.href}
                        size="sm"
                        variant="outline"
                        className="gap-2"
                        onClick={() => window.open(l.href, "_blank", "noopener,noreferrer")}
                      >
                        <ExternalLink className="h-4 w-4" />
                        {l.label}
                      </Button>
                    ) : (
                      <Button key={l.href} asChild size="sm" variant="outline" className="gap-2">
                        <Link to={l.href}>
                          <ExternalLink className="h-4 w-4" />
                          {l.label}
                        </Link>
                      </Button>
                    )
                  )}
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="text-xs font-medium text-muted-foreground">
                {selectedActivity.type === "task_live" ? "Live details" : "Details"}
              </div>

              {selectedActivity.type === "task_live" && typeof selectedActivity.progress === "number" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span className="font-mono">
                      {Math.max(0, Math.min(100, Math.round(selectedActivity.progress)))}%
                    </span>
                  </div>
                  <Progress value={Math.max(0, Math.min(100, selectedActivity.progress))} />
                </div>
              ) : null}

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Duration
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {formatDuration(selectedActivity.durationMs)}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Tokens
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {selectedActivity.tokens !== undefined
                      ? new Intl.NumberFormat("en-US").format(selectedActivity.tokens)
                      : "—"}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Est. cost
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {formatCost(selectedActivity.costUsd)}
                  </div>
                </div>
              </div>

              {selectedActivity.toolCalls && selectedActivity.toolCalls.length > 0 ? (
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    Tool uses
                  </div>
                  <div className="space-y-2 rounded-xl border border-border/60 bg-secondary/30 p-3">
                    {selectedActivity.toolCalls.map((tool, index) => (
                      <div key={`${tool.name}-${index}`} className="flex items-center justify-between gap-3 text-xs">
                        <div className="font-medium text-foreground">{tool.name}</div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          {tool.count !== undefined ? (
                            <span className="font-mono">{tool.count}x</span>
                          ) : null}
                          {tool.status ? (
                            <Badge variant="secondary" className="text-[10px]">
                              {tool.status === "done" ? "Done" : tool.status === "error" ? "Error" : "Running"}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedActivity.metadata && Object.keys(selectedActivity.metadata).length > 0 ? (
                <pre className="overflow-x-auto rounded-xl border border-border bg-background p-3 text-xs">
                  {JSON.stringify(selectedActivity.metadata, null, 2)}
                </pre>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No metadata attached.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Select an activity to see details.
          </div>
        )}
      </DetailPanel>
    </div>
  );
}

export default AgentActivityTab;
