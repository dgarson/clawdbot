import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Activity,
  AlertTriangle,
  RefreshCw,
  Users,
  Zap,
  XCircle,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  LayoutList,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { CardSkeleton, RouteErrorFallback } from "@/components/composed";
import { StatusBadge } from "@/components/composed/StatusBadge";
import { cn } from "@/lib/utils";
import {
  formatTokenCount,
  formatRelativeTime,
  formatCost,
  shortenSessionKey,
} from "@/lib/format";
import {
  useAgentDashboardData,
  type AgentDashboardEntry,
} from "@/hooks/queries/useAgentDashboard";
import type { AgentHealthStatus } from "@/hooks/queries/useAgentStatus";
import { useDebounce } from "@/hooks/useDebounce";

export const Route = createFileRoute("/agents/dashboard")({
  component: AgentsDashboardPage,
  errorComponent: RouteErrorFallback,
  validateSearch: (
    search: Record<string, unknown>
  ): { health?: HealthFilter; layout?: LayoutMode } => {
    const validStatuses: HealthFilter[] = [
      "all",
      "active",
      "stalled",
      "idle",
      "errored",
    ];
    const health = search.health as HealthFilter | undefined;
    const layout = search.layout as LayoutMode | undefined;
    return {
      health: health && validStatuses.includes(health) ? health : undefined,
      layout:
        layout && (layout === "grid" || layout === "list")
          ? layout
          : undefined,
    };
  },
});

// ── Types ──────────────────────────────────────────────────────────

type HealthFilter = "all" | AgentHealthStatus;
type SortOption = "recent" | "name" | "status" | "cost" | "tokens";
type LayoutMode = "grid" | "list";

const HEALTH_ORDER: Record<AgentHealthStatus, number> = {
  active: 0,
  errored: 1,
  stalled: 2,
  idle: 3,
};

const HEALTH_CONFIG: Record<
  AgentHealthStatus,
  {
    color: string;
    bgColor: string;
    icon: typeof Zap;
    label: string;
    pulse: boolean;
    statusBadge: "online" | "busy" | "paused" | "error";
  }
> = {
  active: {
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-500",
    icon: Zap,
    label: "Active",
    pulse: true,
    statusBadge: "online",
  },
  stalled: {
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-500",
    icon: AlertTriangle,
    label: "Stalled",
    pulse: true,
    statusBadge: "busy",
  },
  idle: {
    color: "text-gray-500 dark:text-gray-400",
    bgColor: "bg-gray-400",
    icon: Users,
    label: "Idle",
    pulse: false,
    statusBadge: "paused",
  },
  errored: {
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500",
    icon: XCircle,
    label: "Error",
    pulse: true,
    statusBadge: "error",
  },
};

// ── Summary Cards (reduced to primary + conditional alerts) ──────

interface SummaryCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  iconColor,
  iconBg,
}: SummaryCardProps) {
  return (
    <Card className="border-border/50 bg-card/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg",
            iconBg
          )}
        >
          <Icon className={cn("h-5 w-5", iconColor)} />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DashboardSummary({
  summary,
}: {
  summary: ReturnType<typeof useAgentDashboardData>["summary"];
}) {
  return (
    <div className="space-y-3" aria-live="polite">
      {/* Primary stats — always visible */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          label="Agents"
          value={summary.total}
          icon={Users}
          iconColor="text-primary"
          iconBg="bg-primary/10"
        />
        <SummaryCard
          label="Active"
          value={summary.active}
          icon={Zap}
          iconColor="text-green-500"
          iconBg="bg-green-500/10"
        />
        <SummaryCard
          label="Total Tokens"
          value={formatTokenCount(summary.totalTokens)}
          icon={Activity}
          iconColor="text-blue-500"
          iconBg="bg-blue-500/10"
        />
        <SummaryCard
          label="Total Cost"
          value={formatCost(summary.totalCost)}
          icon={Activity}
          iconColor="text-purple-500"
          iconBg="bg-purple-500/10"
        />
      </div>

      {/* Alert chips — only shown when counts are non-zero */}
      {(summary.stalled > 0 || summary.errored > 0) && (
        <div className="flex items-center gap-2">
          {summary.errored > 0 && (
            <Badge
              variant="destructive"
              className="gap-1.5 px-2.5 py-1 text-xs"
            >
              <XCircle className="h-3 w-3" />
              {summary.errored} errored
            </Badge>
          )}
          {summary.stalled > 0 && (
            <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs border-yellow-500/50 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-3 w-3" />
              {summary.stalled} stalled
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

// ── Agent Card (grid view — decluttered) ────────────────────────

function AgentCard({
  entry,
  onClick,
}: {
  entry: AgentDashboardEntry;
  onClick: () => void;
}) {
  const config = HEALTH_CONFIG[entry.health];
  const recentSessions = [...entry.sessions]
    .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
    .slice(0, 3);

  return (
    <Card
      className={cn(
        "group border-border/50 bg-card/60 transition hover:border-primary/40 hover:shadow-sm cursor-pointer",
        entry.health === "errored" && "border-red-500/30",
        entry.health === "active" && "border-green-500/30"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
              {(entry.name?.[0] ?? entry.id[0]).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{entry.name}</h3>
                {entry.label && (
                  <Badge
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                  >
                    {entry.label}
                  </Badge>
                )}
                {entry.cronJobs.length > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] px-1.5 py-0 gap-1"
                  >
                    {entry.cronJobs.length} cron
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {entry.id}
                <span className="ml-2 text-muted-foreground/60">
                  {formatRelativeTime(entry.lastActivityAt)}
                </span>
              </p>
            </div>
          </div>
          <StatusBadge
            status={config.statusBadge}
            label={config.label}
            size="sm"
          />
        </div>

        {entry.currentTask && (
          <div className="rounded-md border border-border/50 bg-muted/30 p-3">
            <p className="text-xs uppercase text-muted-foreground">
              Current activity
            </p>
            <p className="text-sm text-foreground mt-1 line-clamp-2">
              {entry.currentTask}
            </p>
          </div>
        )}

        {/* Condensed metrics — sessions combined, no redundant health row */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Sessions</p>
            <p className="font-semibold">
              {entry.activeSessions} / {entry.sessionCount}
              <span className="text-xs font-normal text-muted-foreground ml-1">
                active
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tokens</p>
            <p className="font-semibold">
              {formatTokenCount(entry.tokensUsed)}
            </p>
          </div>
        </div>

        <div className="border-t border-border/60 pt-3">
          <p className="text-xs uppercase text-muted-foreground">
            Recent sessions
          </p>
          {recentSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">
              No recent sessions
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {recentSessions.map((session) => {
                const isActive = session.lastMessageAt
                  ? Date.now() - session.lastMessageAt < 5 * 60 * 1000
                  : false;
                const label =
                  session.derivedTitle ||
                  session.label ||
                  shortenSessionKey(session.key);
                return (
                  <div
                    key={session.key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 rounded-full",
                        isActive ? "bg-green-500" : "bg-muted-foreground"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate">{label}</p>
                      {session.lastMessageAt && (
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(session.lastMessageAt)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Agent Row (list view — compact) ─────────────────────────────

function AgentRow({
  entry,
  onClick,
  isSelected,
}: {
  entry: AgentDashboardEntry;
  onClick: () => void;
  isSelected: boolean;
}) {
  const config = HEALTH_CONFIG[entry.health];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "group flex items-center gap-4 rounded-lg border border-border/50 bg-card p-4 transition-colors cursor-pointer",
        entry.health === "errored" && "border-red-500/30",
        entry.health === "active" && "border-green-500/20",
        isSelected && "ring-1 ring-primary/30 border-primary/40"
      )}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Health Indicator */}
      <div className="flex-shrink-0">
        <div className="relative">
          <div className={cn("h-3 w-3 rounded-full", config.bgColor)} />
          {config.pulse && (
            <motion.div
              className={cn(
                "absolute inset-0 h-3 w-3 rounded-full",
                config.bgColor,
                "opacity-60"
              )}
              animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
      </div>

      {/* Agent Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{entry.name}</span>
          {entry.label && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {entry.label}
            </Badge>
          )}
          <span className={cn("text-xs font-medium", config.color)}>
            {config.label}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {entry.currentTask || "No active task"}
        </p>
      </div>

      {/* Resource Usage */}
      <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
        <div className="flex items-center gap-1">
          <Activity className="h-3 w-3" />
          <span>{formatTokenCount(entry.tokensUsed)}</span>
        </div>
        <span>{formatCost(entry.estimatedCost)}</span>
      </div>

      {/* Last Activity */}
      <span className="hidden md:inline text-xs text-muted-foreground flex-shrink-0">
        {formatRelativeTime(entry.lastActivityAt)}
      </span>

      {/* Drill-down arrow */}
      <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </motion.div>
  );
}

// ── Detail Panel Content (shared between Sheet and side panel) ───

function AgentDetailContent({
  entry,
  onNavigate,
}: {
  entry: AgentDashboardEntry;
  onNavigate: () => void;
}) {
  const config = HEALTH_CONFIG[entry.health];
  const recentSessions = [...entry.sessions]
    .sort((a, b) => (b.lastMessageAt ?? 0) - (a.lastMessageAt ?? 0))
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <StatusBadge
        status={config.statusBadge}
        label={config.label}
        size="md"
      />

      {entry.currentTask && (
        <div className="rounded-md border border-border/50 bg-muted/30 p-3">
          <p className="text-xs uppercase text-muted-foreground">
            Current activity
          </p>
          <p className="text-sm text-foreground mt-1">{entry.currentTask}</p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Resources</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
            <p className="text-[11px] uppercase text-muted-foreground">
              Tokens
            </p>
            <p className="font-mono font-medium">
              {entry.tokensUsed.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
            <p className="text-[11px] uppercase text-muted-foreground">Cost</p>
            <p className="font-mono font-medium">
              {formatCost(entry.estimatedCost)}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
            <p className="text-[11px] uppercase text-muted-foreground">
              Sessions
            </p>
            <p className="font-mono font-medium">
              {entry.activeSessions} / {entry.sessionCount}
            </p>
          </div>
          <div className="rounded-lg border border-border/50 bg-muted/20 p-2.5">
            <p className="text-[11px] uppercase text-muted-foreground">
              Last Active
            </p>
            <p className="font-medium">
              {formatRelativeTime(entry.lastActivityAt)}
            </p>
          </div>
        </div>
      </div>

      {recentSessions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Recent Sessions
          </p>
          <div className="space-y-1.5">
            {recentSessions.map((session) => {
              const isActive = session.lastMessageAt
                ? Date.now() - session.lastMessageAt < 5 * 60 * 1000
                : false;
              const label =
                session.derivedTitle ||
                session.label ||
                shortenSessionKey(session.key);
              return (
                <div
                  key={session.key}
                  className="flex items-center gap-2 text-sm rounded-md p-1.5 hover:bg-muted/30"
                >
                  <span
                    className={cn(
                      "h-2 w-2 rounded-full flex-shrink-0",
                      isActive ? "bg-green-500" : "bg-muted-foreground"
                    )}
                  />
                  <span className="truncate flex-1">{label}</span>
                  {session.lastMessageAt && (
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatRelativeTime(session.lastMessageAt)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2"
        onClick={onNavigate}
      >
        View Full Details
      </Button>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

function AgentsDashboardPage() {
  const navigate = useNavigate();
  const { health: searchHealth, layout: searchLayout } = Route.useSearch();

  const [searchQuery, setSearchQuery] = React.useState("");
  const [healthFilter, setHealthFilter] = React.useState<HealthFilter>(
    searchHealth || "all"
  );
  const [sortBy, setSortBy] = React.useState<SortOption>("recent");
  const [layoutMode, setLayoutMode] = React.useState<LayoutMode>(
    searchLayout || "grid"
  );
  const [selectedEntry, setSelectedEntry] =
    React.useState<AgentDashboardEntry | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [focusIndex, setFocusIndex] = React.useState(-1);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const listRef = React.useRef<HTMLDivElement>(null);

  const { entries, summary, lastUpdated, isLoading, isFetching, error, refetch } =
    useAgentDashboardData();

  // Sync URL health param
  React.useEffect(() => {
    if (searchHealth && searchHealth !== healthFilter) {
      setHealthFilter(searchHealth);
    }
  }, [searchHealth, healthFilter]);

  const handleHealthFilterChange = (value: HealthFilter) => {
    setHealthFilter(value);
    navigate({
      from: Route.fullPath,
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        health: value === "all" ? undefined : value,
      }),
      replace: true,
    });
  };

  const handleLayoutChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
    navigate({
      from: Route.fullPath,
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        layout: mode === "grid" ? undefined : mode,
      }),
      replace: true,
    });
  };

  // Filter and sort
  const filteredEntries = React.useMemo(() => {
    let result = [...entries];

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (entry) =>
          entry.name.toLowerCase().includes(query) ||
          entry.id.toLowerCase().includes(query) ||
          entry.currentTask?.toLowerCase().includes(query) ||
          entry.label?.toLowerCase().includes(query)
      );
    }

    if (healthFilter !== "all") {
      result = result.filter((entry) => entry.health === healthFilter);
    }

    switch (sortBy) {
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "status":
        result.sort(
          (a, b) => HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health]
        );
        break;
      case "cost":
        result.sort((a, b) => b.estimatedCost - a.estimatedCost);
        break;
      case "tokens":
        result.sort((a, b) => b.tokensUsed - a.tokensUsed);
        break;
      case "recent":
      default:
        result.sort((a, b) => {
          const healthDiff =
            HEALTH_ORDER[a.health] - HEALTH_ORDER[b.health];
          if (healthDiff !== 0) return healthDiff;
          return (b.lastActivityAt ?? 0) - (a.lastActivityAt ?? 0);
        });
        break;
    }

    return result;
  }, [entries, debouncedSearch, healthFilter, sortBy]);

  // On sub-lg screens, open a Sheet overlay; on lg+ the side panel is visible
  const handleAgentSelect = React.useCallback(
    (entry: AgentDashboardEntry) => {
      setSelectedEntry(entry);
      const isLargeScreen = window.matchMedia("(min-width: 1024px)").matches;
      if (!isLargeScreen) {
        setSheetOpen(true);
      }
    },
    []
  );

  const handleNavigateToAgent = React.useCallback(
    (entry: AgentDashboardEntry) => {
      navigate({
        to: "/agents/$agentId",
        params: { agentId: entry.id },
        search: { tab: "overview" },
      });
    },
    [navigate]
  );

  // Arrow key navigation + Escape to close panel
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedEntry(null);
        setSheetOpen(false);
        return;
      }

      if (!listRef.current?.contains(document.activeElement)) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((prev) =>
          Math.min(prev + 1, filteredEntries.length - 1)
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((prev) => Math.max(prev - 1, 0));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [filteredEntries.length]);

  // Focus the element at focusIndex
  React.useEffect(() => {
    if (focusIndex < 0) return;
    const items = listRef.current?.querySelectorAll("[role='button']");
    const target = items?.[focusIndex] as HTMLElement | undefined;
    target?.focus();
  }, [focusIndex]);

  // Auto-refresh relative timestamps
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
  React.useEffect(() => {
    const timer = setInterval(forceUpdate, 5_000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              Agent Dashboard
            </h1>
            <p className="mt-1 text-muted-foreground">
              Real-time overview of agent health, sessions, and resource usage.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isFetching && !isLoading && (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  ease: "linear",
                }}
              >
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </motion.div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>
        </motion.div>

        {/* Error */}
        {error ? (
          <Card className="border-destructive/50 bg-destructive/10">
            <CardContent className="p-6 text-center">
              <p className="text-destructive">
                Failed to load dashboard data
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Please check your gateway connection and try again.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Summary Cards */}
        {isLoading ? (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, index) => (
              <CardSkeleton key={index} />
            ))}
          </div>
        ) : (
          <DashboardSummary summary={summary} />
        )}

        {/* Filters + Layout Toggle */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search agents by name, task, or label..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-4 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <Select
            value={healthFilter}
            onValueChange={(v) =>
              handleHealthFilterChange(v as HealthFilter)
            }
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Health" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Health</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="stalled">Stalled</SelectItem>
              <SelectItem value="idle">Idle</SelectItem>
              <SelectItem value="errored">Errored</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as SortOption)}
          >
            <SelectTrigger className="w-[140px]">
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="status">Health</SelectItem>
              <SelectItem value="cost">Highest Cost</SelectItem>
              <SelectItem value="tokens">Most Tokens</SelectItem>
            </SelectContent>
          </Select>

          {/* Layout Toggle */}
          <div className="flex items-center border border-border rounded-md">
            <Button
              variant={layoutMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-r-none"
              onClick={() => handleLayoutChange("grid")}
              aria-label="Grid view"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={layoutMode === "list" ? "secondary" : "ghost"}
              size="icon"
              className="h-9 w-9 rounded-l-none"
              onClick={() => handleLayoutChange("list")}
              aria-label="List view"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Agent List/Grid */}
        {isLoading ? (
          <div
            className={cn(
              layoutMode === "grid"
                ? "grid gap-6 lg:grid-cols-2"
                : "space-y-2"
            )}
          >
            {[1, 2, 3, 4].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : filteredEntries.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="mt-4 text-lg font-medium">No agents found</h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm">
                {debouncedSearch || healthFilter !== "all"
                  ? "Try adjusting your search or filters"
                  : "Once agents start running, their health, sessions, and cron jobs will show here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <motion.div
            ref={listRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
            className={cn(
              layoutMode === "grid"
                ? "grid gap-6 lg:grid-cols-2"
                : "space-y-2"
            )}
            role="listbox"
            aria-label="Agent list"
          >
            {filteredEntries.map((entry) =>
              layoutMode === "grid" ? (
                <AgentCard
                  key={entry.id}
                  entry={entry}
                  onClick={() => handleAgentSelect(entry)}
                />
              ) : (
                <AgentRow
                  key={entry.id}
                  entry={entry}
                  onClick={() => handleAgentSelect(entry)}
                  isSelected={selectedEntry?.id === entry.id}
                />
              )
            )}
          </motion.div>
        )}

        {/* Timestamp footer */}
        {lastUpdated && (
          <p
            className="text-xs text-muted-foreground text-center"
            aria-live="polite"
          >
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
            {isFetching && " \u00B7 Refreshing..."}
          </p>
        )}
      </div>

      {/* Desktop side panel (lg+) */}
      {selectedEntry && (
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 360 }}
          exit={{ opacity: 0, width: 0 }}
          transition={{ duration: 0.2 }}
          className="hidden lg:block flex-shrink-0 border-l border-border pl-6"
        >
          <div className="sticky top-6 space-y-4">
            <div className="flex items-start justify-between">
              <h3 className="text-lg font-bold">{selectedEntry.name}</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedEntry(null)}
                aria-label="Close detail panel"
              >
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
            <AgentDetailContent
              entry={selectedEntry}
              onNavigate={() => handleNavigateToAgent(selectedEntry)}
            />
          </div>
        </motion.div>
      )}

      {/* Mobile Sheet overlay (sub-lg) */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>{selectedEntry?.name ?? "Agent Details"}</SheetTitle>
            <SheetDescription>
              {selectedEntry?.id ?? "Select an agent"}
            </SheetDescription>
          </SheetHeader>
          <div className="p-4 overflow-y-auto flex-1">
            {selectedEntry && (
              <AgentDetailContent
                entry={selectedEntry}
                onNavigate={() => {
                  setSheetOpen(false);
                  handleNavigateToAgent(selectedEntry);
                }}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
