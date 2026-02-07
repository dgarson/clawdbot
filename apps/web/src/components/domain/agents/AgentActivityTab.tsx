"use client";

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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  MoreHorizontal,
} from "lucide-react";
import {
  formatRelativeTimeFromISO,
  formatDuration,
  formatTokenCount,
  formatCostPrecise,
} from "@/lib/format";

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
  progress?: number;
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

// Types that can be batched together when consecutive
const BATCHABLE_TYPES = new Set<ActivityType>(["search", "code"]);

interface BatchedActivity {
  kind: "single";
  activity: Activity;
}
interface BatchedGroup {
  kind: "batch";
  type: ActivityType;
  activities: Activity[];
  label: string;
}
type TimelineItem = BatchedActivity | BatchedGroup;

/** Group consecutive activities of the same batchable type */
function batchActivities(activities: Activity[]): TimelineItem[] {
  const items: TimelineItem[] = [];
  let i = 0;
  while (i < activities.length) {
    const activity = activities[i];
    if (BATCHABLE_TYPES.has(activity.type)) {
      const group: Activity[] = [activity];
      while (
        i + 1 < activities.length &&
        activities[i + 1].type === activity.type
      ) {
        i++;
        group.push(activities[i]);
      }
      if (group.length > 1) {
        const cfg = activityConfig[activity.type];
        items.push({
          kind: "batch",
          type: activity.type,
          activities: group,
          label: `${group.length} ${cfg.label.toLowerCase()}${group.length > 1 ? "es" : ""}`,
        });
      } else {
        items.push({ kind: "single", activity: group[0] });
      }
    } else {
      items.push({ kind: "single", activity });
    }
    i++;
  }
  return items;
}

export function AgentActivityTab({
  agentId,
  activities: activitiesProp,
  onActivityClick,
  selectedActivityId: selectedActivityIdProp,
  onSelectedActivityIdChange,
}: AgentActivityTabProps) {
  void agentId;
  const [filter, setFilter] = React.useState<ActivityType | "all">("all");
  // No mock data fallback — show empty state when no activities provided
  const activities = activitiesProp ?? [];
  const [visibleCount, setVisibleCount] = React.useState(5);
  const [baseNow] = React.useState(() => Date.now());
  const [nowMs, setNowMs] = React.useState(() => Date.now());
  const isSelectionControlled = selectedActivityIdProp !== undefined;
  const [selectedActivityId, setSelectedActivityId] = React.useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const [expandedBatches, setExpandedBatches] = React.useState<Set<string>>(new Set());
  const todayKey = new Date(baseNow).toLocaleDateString();
  const yesterdayKey = new Date(baseNow - 86400000).toLocaleDateString();

  React.useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  React.useEffect(() => {
    if (!isSelectionControlled) return;
    const next = selectedActivityIdProp ?? null;
    setSelectedActivityId(next);
    setDetailsOpen(Boolean(next));
  }, [isSelectionControlled, selectedActivityIdProp]);

  const filteredActivities = React.useMemo(() => {
    if (filter === "all") return activities;
    return activities.filter((a) => a.type === filter);
  }, [activities, filter]);

  const liveActivities = React.useMemo(() => {
    if (filter === "task_live") return filteredActivities;
    if (filter !== "all") return [];
    return activities.filter((a) => a.type === "task_live");
  }, [activities, filter, filteredActivities]);

  const timelineActivities = React.useMemo(() => {
    return filteredActivities.filter((a) => a.type !== "task_live");
  }, [filteredActivities]);

  const visibleActivities = timelineActivities.slice(0, visibleCount);
  const hasMore = visibleCount < timelineActivities.length;

  const selectActivity = React.useCallback(
    (activity: Activity) => {
      setDetailsOpen(true);
      onActivityClick?.(activity);
      if (!isSelectionControlled) setSelectedActivityId(activity.id);
      onSelectedActivityIdChange?.(activity.id, activity);
    },
    [isSelectionControlled, onActivityClick, onSelectedActivityIdChange]
  );

  const selectedActivity = React.useMemo(() => {
    if (!selectedActivityId) return null;
    return activities.find((a) => a.id === selectedActivityId) ?? null;
  }, [activities, selectedActivityId]);

  const selectedSessionKey = React.useMemo(() => {
    if (!selectedActivity) return undefined;
    if (selectedActivity.sessionKey) return selectedActivity.sessionKey;
    const metaSession = selectedActivity.metadata?.sessionKey;
    return typeof metaSession === "string" ? metaSession : undefined;
  }, [selectedActivity]);

  React.useEffect(() => {
    if (!selectedActivityId) return;
    const selected = activities.find((a) => a.id === selectedActivityId);
    if (!selected) return;
    if (filter === "all") return;
    if (filter === selected.type) return;
    setFilter("all");
  }, [activities, selectedActivityId, filter]);

  React.useEffect(() => {
    if (!selectedActivityId) return;
    const indexInTimeline = timelineActivities.findIndex((a) => a.id === selectedActivityId);
    if (indexInTimeline === -1) return;
    if (indexInTimeline < visibleCount) return;
    setVisibleCount(indexInTimeline + 1);
  }, [selectedActivityId, timelineActivities, visibleCount]);

  const rowRefs = React.useRef<Map<string, HTMLDivElement>>(new Map());
  const registerRowRef = React.useCallback(
    (activityId: string) => (el: HTMLDivElement | null) => {
      if (el) rowRefs.current.set(activityId, el);
      else rowRefs.current.delete(activityId);
    },
    []
  );

  React.useEffect(() => {
    if (!detailsOpen || !selectedActivityId) return;
    const el = rowRefs.current.get(selectedActivityId);
    if (!el) return;
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
    if (!selectedActivity) return [];
    const meta: Record<string, unknown> = selectedActivity.metadata ?? {};
    const items: Array<{ label: string; href: string; external: boolean }> = [];

    const href = meta.href;
    if (typeof href === "string" && href.length > 0) {
      items.push({ label: "Open related", href, external: !href.startsWith("/") });
    }
    const conversationId = meta.conversationId;
    if (typeof conversationId === "string" && conversationId.length > 0) {
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

  // Group visible activities by day, then batch consecutive similar ones
  const groupedTimeline = React.useMemo(() => {
    const groups: { date: string; items: TimelineItem[] }[] = [];
    let currentDate = "";
    let currentActivities: Activity[] = [];

    const flushGroup = () => {
      if (currentActivities.length > 0) {
        groups[groups.length - 1].items = batchActivities(currentActivities);
        currentActivities = [];
      }
    };

    visibleActivities.forEach((activity) => {
      const activityDate = new Date(activity.timestamp).toLocaleDateString();
      if (activityDate !== currentDate) {
        flushGroup();
        currentDate = activityDate;
        currentActivities = [activity];
        groups.push({ date: activityDate, items: [] });
      } else {
        currentActivities.push(activity);
      }
    });
    flushGroup();

    return groups;
  }, [visibleActivities]);

  const toggleBatch = (batchKey: string) => {
    setExpandedBatches((prev) => {
      const next = new Set(prev);
      if (next.has(batchKey)) next.delete(batchKey);
      else next.add(batchKey);
      return next;
    });
  };

  // Render a single activity row — lightweight for completed, card for live
  const renderActivityRow = (
    activity: Activity,
    index: number,
    isFirst: boolean,
    isLast: boolean,
    isLive: boolean,
  ) => {
    const config = activityConfig[activity.type];
    const Icon = config.icon;
    const isSelected = selectedActivityId === activity.id;

    // Inline stat line for completed items
    const statParts: string[] = [];
    if (activity.durationMs) statParts.push(formatDuration(activity.durationMs));
    if (activity.tokens) statParts.push(`${formatTokenCount(activity.tokens)} tokens`);
    if (activity.costUsd !== undefined) statParts.push(formatCostPrecise(activity.costUsd));
    const statLine = statParts.join(" \u00B7 ");

    if (isLive) {
      // Full card treatment for live/active tasks
      return (
        <motion.div
          key={activity.id}
          ref={registerRowRef(activity.id)}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.2, delay: index * 0.03 }}
          className="group relative pl-12"
        >
          {!isFirst && (
            <div className="pointer-events-none absolute left-5 -top-[6px] z-0 h-4 w-px rounded-full bg-border transition-colors group-hover:bg-emerald-500/50" />
          )}
          {!isLast && (
            <div className="pointer-events-none absolute left-5 top-[50px] -bottom-4 z-0 w-px rounded-full bg-border transition-colors group-hover:bg-emerald-500/50" />
          )}

          <div className="absolute left-0 top-[10px] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background ring-1 ring-border shadow-sm transition-colors group-hover:ring-emerald-500/40">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-background">
              <div className={cn("absolute inset-0 rounded-full", config.bgColor)} />
              <div className="absolute inset-0 rounded-full ring-1 ring-emerald-500/30 animate-pulse" />
              <Icon className={cn("relative h-4 w-4 animate-spin", config.color)} />
            </div>
          </div>

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
                    <h4 className="font-medium text-sm truncate">{activity.title}</h4>
                    <Badge
                      variant="secondary"
                      className={cn("text-[10px] px-1.5 py-0", config.bgColor, config.color)}
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
                  {formatRelativeTimeFromISO(activity.timestamp, nowMs)}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      );
    }

    // Lightweight borderless row for completed/historical activities
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
          <div className="pointer-events-none absolute left-5 top-[34px] -bottom-4 z-0 w-px rounded-full bg-border" />
        )}

        {/* Icon */}
        <div className="absolute left-0 top-[6px] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background ring-1 ring-border/60 shadow-sm transition-colors group-hover:ring-primary/30">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-background">
            <div className={cn("absolute inset-0 rounded-full", config.bgColor)} />
            <Icon className={cn("relative h-4 w-4", config.color)} />
          </div>
        </div>

        {/* Lightweight content — no Card wrapper */}
        <div
          className={cn(
            "cursor-pointer rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40",
            isSelected && "bg-muted/50 ring-1 ring-primary/15"
          )}
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
              <div className="flex items-center gap-2">
                <h4 className="font-medium text-sm truncate">{activity.title}</h4>
                <Badge
                  variant="secondary"
                  className={cn("text-[10px] px-1.5 py-0", config.bgColor, config.color)}
                >
                  {config.label}
                </Badge>
              </div>
              {activity.description && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {activity.description}
                </p>
              )}
              {/* Inline metadata stats */}
              {statLine && (
                <p className="text-xs text-muted-foreground/70 mt-1 font-mono">
                  {statLine}
                </p>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">
              {formatRelativeTimeFromISO(activity.timestamp, nowMs)}
            </span>
          </div>
        </div>
      </motion.div>
    );
  };

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
          {/* Live / Active tasks — always get full card treatment */}
          {liveActivities.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-foreground">Live now</div>
                <Badge variant="secondary" className="text-xs font-normal">
                  {liveActivities.length}
                </Badge>
              </div>
              <div className="space-y-4">
                {liveActivities.map((activity, index) =>
                  renderActivityRow(
                    activity,
                    index,
                    index === 0,
                    index === liveActivities.length - 1,
                    true,
                  )
                )}
              </div>
            </div>
          )}

          {groupedTimeline.map((group) => (
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

              {/* Timeline Items */}
              <div className="space-y-3">
                {group.items.map((item, index) => {
                  if (item.kind === "single") {
                    return renderActivityRow(
                      item.activity,
                      index,
                      index === 0,
                      index === group.items.length - 1,
                      false,
                    );
                  }

                  // Batched group
                  const batchKey = `batch-${item.activities[0].id}`;
                  const isExpanded = expandedBatches.has(batchKey);
                  const cfg = activityConfig[item.type];
                  const BatchIcon = cfg.icon;

                  return (
                    <div key={batchKey} className="relative pl-12">
                      {index > 0 && (
                        <div className="pointer-events-none absolute left-5 -top-[6px] z-0 h-4 w-px rounded-full bg-border" />
                      )}
                      {index < group.items.length - 1 && (
                        <div className="pointer-events-none absolute left-5 top-[34px] -bottom-4 z-0 w-px rounded-full bg-border" />
                      )}

                      <div className="absolute left-0 top-[6px] z-10 flex h-10 w-10 items-center justify-center rounded-full bg-background ring-1 ring-border/60 shadow-sm">
                        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-background">
                          <div className={cn("absolute inset-0 rounded-full", cfg.bgColor)} />
                          <BatchIcon className={cn("relative h-4 w-4", cfg.color)} />
                        </div>
                      </div>

                      <div
                        className="cursor-pointer rounded-lg px-3 py-2.5 transition-colors hover:bg-muted/40"
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleBatch(batchKey)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleBatch(batchKey);
                          }
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-sm">
                            {item.label}
                          </h4>
                          <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", cfg.bgColor, cfg.color)}>
                            {item.activities.length}
                          </Badge>
                          <ChevronDown
                            className={cn(
                              "h-3 w-3 text-muted-foreground transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="ml-3 mt-1 space-y-1 border-l border-border/50 pl-4">
                          {item.activities.map((activity) => {
                            const isSelected = selectedActivityId === activity.id;
                            return (
                              <div
                                key={activity.id}
                                ref={registerRowRef(activity.id)}
                                className={cn(
                                  "cursor-pointer rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/40",
                                  isSelected && "bg-muted/50"
                                )}
                                role="button"
                                tabIndex={0}
                                onClick={() => selectActivity(activity)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    selectActivity(activity);
                                  }
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate">{activity.title}</span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatRelativeTimeFromISO(activity.timestamp, nowMs)}
                                  </span>
                                </div>
                                {activity.description && (
                                  <p className="text-xs text-muted-foreground truncate">
                                    {activity.description}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
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

      {/* Detail Panel — reorganized: session first, dev actions in overflow menu */}
      <DetailPanel
        open={detailsOpen && !!selectedActivity}
        onClose={() => {
          setDetailsOpen(false);
          if (!isSelectionControlled) setSelectedActivityId(null);
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
                {formatRelativeTimeFromISO(selectedActivity.timestamp, nowMs)}
              </span>
            </div>

            {selectedActivity.description ? (
              <div className="text-sm text-muted-foreground">
                {selectedActivity.description}
              </div>
            ) : null}

            {/* Session section — promoted to top of actions */}
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
                  <span className="text-xs text-muted-foreground font-mono break-all">
                    {selectedSessionKey}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Primary actions + overflow menu for dev actions */}
            <div className="flex flex-wrap items-center gap-2">
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

              {/* Developer actions — grouped in overflow menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">More actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleCopy("ID", selectedActivity.id)}>
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    Copy ID
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleCopy("JSON", JSON.stringify(selectedActivity, null, 2))}>
                    <Copy className="h-3.5 w-3.5 mr-2" />
                    Copy JSON
                  </DropdownMenuItem>
                  {selectedSessionKey && (
                    <DropdownMenuItem onClick={() => handleCopy("Session key", selectedSessionKey)}>
                      <Copy className="h-3.5 w-3.5 mr-2" />
                      Copy session key
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
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
                    {selectedActivity.durationMs ? formatDuration(selectedActivity.durationMs) : "\u2014"}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Tokens
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {selectedActivity.tokens !== undefined
                      ? new Intl.NumberFormat("en-US").format(selectedActivity.tokens)
                      : "\u2014"}
                  </div>
                </div>
                <div className="rounded-lg border border-border/60 bg-secondary/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    Est. cost
                  </div>
                  <div className="mt-1 text-sm font-medium text-foreground">
                    {formatCostPrecise(selectedActivity.costUsd)}
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
