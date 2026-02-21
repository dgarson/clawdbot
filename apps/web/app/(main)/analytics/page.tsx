"use client";

import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import { TokenUsageChartLazy as TokenUsageChart, CostBreakdownChartLazy as CostBreakdownChart } from "@/components/charts/lazy-charts";
import type { UsageStatus } from "@/lib/gateway/types";
import {
  RefreshCw,
  Coins,
  Zap,
  Activity,
  Calendar,
  ArrowUpDown,
  WifiOff,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SessionUsageRow = {
  sessionKey: string;
  agentId?: string;
  label?: string;
  tokens: number;
  cost: number;
  requests: number;
  lastActiveAtMs?: number;
};

type DailyUsagePoint = {
  date: string;
  tokens: number;
  cost: number;
};

type SortField = "tokens" | "cost" | "requests" | "lastActiveAtMs";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCost(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(1)}k`;}
  return n.toString();
}

function formatDate(ts?: number): string {
  if (!ts) {return "—";}
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
}: {
  title: string;
  value: string | number;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: "default" | "success" | "warning";
}) {
  const borderColors = {
    default: "",
    success: "border-l-4 border-l-emerald-500",
    warning: "border-l-4 border-l-amber-500",
  };

  return (
    <Card className={borderColors[variant]}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="rounded-lg bg-muted p-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-3 w-20 rounded bg-muted" />
            <div className="h-7 w-24 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
          </div>
          <div className="h-11 w-11 rounded-lg bg-muted" />
        </div>
      </CardContent>
    </Card>
  );
}

function TableRowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-4 w-14 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-4 w-10 rounded bg-muted" /></td>
      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-muted" /></td>
    </tr>
  );
}

// Chart placeholders removed — now using real Recharts components

// ---------------------------------------------------------------------------
// Sortable table header
// ---------------------------------------------------------------------------

function SortableHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const active = currentField === field;
  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors"
      onClick={() => onSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown
          className={cn(
            "h-3 w-3",
            active ? "text-foreground" : "text-muted-foreground/50"
          )}
        />
        {active && (
          <span className="text-[10px]">
            {currentDir === "asc" ? "↑" : "↓"}
          </span>
        )}
      </span>
    </th>
  );
}

// ---------------------------------------------------------------------------
// Empty table
// ---------------------------------------------------------------------------

function EmptyTable() {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Activity className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold mb-1">No usage data</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          <AdaptiveLabel
            beginner="Start chatting with your agent to see usage stats here."
            standard="No session usage data found for the selected date range."
            expert="No usage records returned for the queried interval."
          />
        </p>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const { connected, request } = useGatewayStore();

  // Date range (default: last 7 days)
  const [startDate, setStartDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return toISODate(d);
  });
  const [endDate, setEndDate] = React.useState(() => toISODate(new Date()));

  // Data
  const [usage, setUsage] = React.useState<UsageStatus | null>(null);
  const [sessions, setSessions] = React.useState<SessionUsageRow[]>([]);
  const [dailyUsage, setDailyUsage] = React.useState<DailyUsagePoint[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = React.useState<SortField>("cost");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  // Fetch data
  const fetchData = React.useCallback(async () => {
    if (!connected) {return;}
    setLoading(true);
    setError(null);
    try {
      const [usageResult, sessionsResult, dailyResult] = await Promise.all([
        request<UsageStatus>("usage.status", {
          startDate,
          endDate,
        }),
        request<{ sessions: SessionUsageRow[] }>("sessions.usage", {
          startDate,
          endDate,
        }),
        request<{ daily: DailyUsagePoint[] }>("usage.daily", {
          startDate,
          endDate,
        }).catch(() => ({ daily: [] as DailyUsagePoint[] })),
      ]);
      setUsage(usageResult);
      setSessions(sessionsResult.sessions ?? []);
      setDailyUsage(dailyResult.daily ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load analytics"
      );
    } finally {
      setLoading(false);
    }
  }, [connected, request, startDate, endDate]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Sort handler
  const handleSort = React.useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      } else {
        setSortField(field);
        setSortDir("desc");
      }
    },
    [sortField]
  );

  // Sorted sessions
  const sortedSessions = React.useMemo(() => {
    return [...sessions].toSorted((a, b) => {
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return sortDir === "asc"
        ? (aVal) - (bVal)
        : (bVal) - (aVal);
    });
  }, [sessions, sortField, sortDir]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <AdaptiveLabel
              beginner="Usage"
              standard="Analytics"
              expert="Usage Analytics"
            />
          </h1>
          <p className="text-sm text-muted-foreground">
            <AdaptiveLabel
              beginner="See how much your agent has been used."
              standard="Token usage, costs, and session activity."
              expert="Aggregated usage metrics, cost breakdown, and session-level telemetry."
            />
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading || !connected}
        >
          <RefreshCw
            className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")}
          />
          Refresh
        </Button>
      </div>

      {/* Connection warning */}
      {!connected && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-3">
            <WifiOff className="h-4 w-4 text-warning" />
            <p className="text-sm text-warning">
              Not connected to Gateway. Analytics data may be stale.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Date range picker */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">
              From
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">
              To
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex gap-2 sm:ml-auto">
            {/* Quick range presets */}
            {[
              { label: "7d", days: 7 },
              { label: "30d", days: 30 },
              { label: "90d", days: 90 },
            ].map(({ label, days }) => (
              <Button
                key={label}
                variant="ghost"
                size="sm"
                onClick={() => {
                  const end = new Date();
                  const start = new Date();
                  start.setDate(start.getDate() - days);
                  setStartDate(toISODate(start));
                  setEndDate(toISODate(end));
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Summary stats */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : usage ? (
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Total Tokens"
            value={formatTokens(usage.totalTokens)}
            description={`${usage.totalTokens.toLocaleString()} tokens`}
            icon={Zap}
          />
          <StatCard
            title="Total Cost"
            value={formatCost(usage.totalCost)}
            description="For selected period"
            icon={Coins}
            variant="warning"
          />
          <StatCard
            title="Active Sessions"
            value={usage.activeSessions}
            description="Sessions with activity"
            icon={Activity}
            variant="success"
          />
        </div>
      ) : null}

      {/* Charts */}
      <ComplexityGate level="standard">
        <div className="grid gap-4 md:grid-cols-2">
          <TokenUsageChart data={dailyUsage} />
          <CostBreakdownChart
            data={
              sessions.length > 0
                ? (() => {
                    // Aggregate cost by agentId
                    const costMap = new Map<string, number>();
                    for (const s of sessions) {
                      const key = s.agentId ?? "unknown";
                      costMap.set(key, (costMap.get(key) ?? 0) + s.cost);
                    }
                    return Array.from(costMap.entries())
                      .map(([name, value]) => ({ name, value }))
                      .toSorted((a, b) => b.value - a.value)
                      .slice(0, 8);
                  })()
                : []
            }
          />
        </div>
      </ComplexityGate>

      {/* Session usage table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">
            <AdaptiveLabel
              beginner="Session Details"
              standard="Session Usage"
              expert="Per-Session Telemetry"
            />
          </h2>
          <ComplexityGate level="expert">
            <Button variant="ghost" size="sm" disabled>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export CSV
            </Button>
          </ComplexityGate>
        </div>

        {loading ? (
          <Card>
            <ScrollArea className="w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Session</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Tokens</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Cost</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Requests</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Last Active</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <TableRowSkeleton key={i} />
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </Card>
        ) : sortedSessions.length === 0 ? (
          <EmptyTable />
        ) : (
          <Card>
            <ScrollArea className="w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Session
                    </th>
                    <SortableHeader
                      label="Tokens"
                      field="tokens"
                      currentField={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Cost"
                      field="cost"
                      currentField={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Requests"
                      field="requests"
                      currentField={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                    <SortableHeader
                      label="Last Active"
                      field="lastActiveAtMs"
                      currentField={sortField}
                      currentDir={sortDir}
                      onSort={handleSort}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedSessions.map((row) => (
                    <tr
                      key={row.sessionKey}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium truncate max-w-[200px]">
                            {row.label ?? row.sessionKey}
                          </span>
                          {row.agentId && (
                            <span className="text-xs text-muted-foreground">
                              {row.agentId}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums">
                        {formatTokens(row.tokens)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums">
                        {formatCost(row.cost)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums">
                        {row.requests}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(row.lastActiveAtMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </Card>
        )}
      </div>

      {/* Expert summary */}
      <ComplexityGate level="expert">
        <p className="text-xs text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""} ·{" "}
          Range: {startDate} → {endDate} ·{" "}
          Sorted by {sortField} {sortDir}
        </p>
      </ComplexityGate>
    </div>
  );
}
