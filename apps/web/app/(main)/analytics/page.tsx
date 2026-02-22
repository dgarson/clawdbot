"use client";

import * as React from "react";
import Link from "next/link";
import { useGatewayStore } from "@/lib/stores/gateway";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ComplexityGate } from "@/components/adaptive/complexity-gate";
import { AdaptiveLabel } from "@/components/adaptive/adaptive-label";
import {
  TokenUsageChartLazy as TokenUsageChart,
  CostBreakdownChartLazy as CostBreakdownChart,
} from "@/components/charts/lazy-charts";
import type { SessionsUsageResult } from "@/lib/gateway/types";
import {
  RefreshCw,
  Coins,
  Zap,
  Activity,
  Calendar,
  ArrowUpDown,
  WifiOff,
  Download,
  ArrowRight,
  MessageSquare,
  Terminal,
  FlaskConical,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SortField = "tokens" | "cost" | "requests" | "lastActiveAtMs";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCost(usd: number): string {
  if (usd >= 1) {return `$${usd.toFixed(2)}`;}
  if (usd >= 0.01) {return `$${usd.toFixed(3)}`;}
  if (usd >= 0.001) {return `$${usd.toFixed(4)}`;}
  return `$${usd.toFixed(6)}`;
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
      <td className="px-4 py-3">
        <div className="h-4 w-32 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-16 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-14 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-10 rounded bg-muted" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-24 rounded bg-muted" />
      </td>
    </tr>
  );
}

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
            active ? "text-foreground" : "text-muted-foreground/50",
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
// Sub-navigation links
// ---------------------------------------------------------------------------

function AnalyticsSubNav() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link href="/analytics/cost">
          <Coins className="h-3.5 w-3.5 mr-1.5" />
          Cost Analysis
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href="/analytics/activity">
          <Activity className="h-3.5 w-3.5 mr-1.5" />
          Live Activity
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link href="/analytics/experiments">
          <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
          Experiments
        </Link>
      </Button>
    </div>
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

const AUTO_REFRESH_MS = 30_000;

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
  const [data, setData] = React.useState<SessionsUsageResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Sorting
  const [sortField, setSortField] = React.useState<SortField>("cost");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  // Fetch data from the rich sessions.usage API
  const fetchData = React.useCallback(async () => {
    if (!connected) {return;}
    setLoading(true);
    setError(null);
    try {
      const result = await request<SessionsUsageResult>("sessions.usage", {
        startDate,
        endDate,
        limit: 100,
      });
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load analytics",
      );
    } finally {
      setLoading(false);
    }
  }, [connected, request, startDate, endDate]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Auto-refresh every 30s
  React.useEffect(() => {
    if (!connected) {return;}
    const id = setInterval(() => void fetchData(), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [connected, fetchData]);

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
    [sortField],
  );

  // Sorted sessions
  const sortedSessions = React.useMemo(() => {
    if (!data?.sessions) {return [];}
    return [...data.sessions].toSorted((a, b) => {
      let aVal = 0;
      let bVal = 0;
      switch (sortField) {
        case "tokens":
          aVal = a.usage?.totalTokens ?? 0;
          bVal = b.usage?.totalTokens ?? 0;
          break;
        case "cost":
          aVal = a.usage?.totalCost ?? 0;
          bVal = b.usage?.totalCost ?? 0;
          break;
        case "requests":
          aVal = a.usage?.messageCounts?.total ?? 0;
          bVal = b.usage?.messageCounts?.total ?? 0;
          break;
        case "lastActiveAtMs":
          aVal = a.updatedAt ?? 0;
          bVal = b.updatedAt ?? 0;
          break;
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [data, sortField, sortDir]);

  const totals = data?.totals;
  const aggregates = data?.aggregates;

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
        <div className="flex items-center gap-2">
          <AnalyticsSubNav />
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading || !connected}
          >
            <RefreshCw
              className={cn(
                "mr-1.5 h-3.5 w-3.5",
                loading && "animate-spin",
              )}
            />
            Refresh
          </Button>
        </div>
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
        <div className="grid gap-4 md:grid-cols-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : totals ? (
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Total Tokens"
            value={formatTokens(totals.totalTokens)}
            description={`${totals.input.toLocaleString()} in · ${totals.output.toLocaleString()} out`}
            icon={Zap}
          />
          <StatCard
            title="Total Cost"
            value={formatCost(totals.totalCost)}
            description="For selected period"
            icon={Coins}
            variant="warning"
          />
          <StatCard
            title="Sessions"
            value={data?.sessions.length ?? 0}
            description="With activity in range"
            icon={MessageSquare}
            variant="success"
          />
          <StatCard
            title="Tool Calls"
            value={aggregates?.tools.totalCalls ?? 0}
            description={`${aggregates?.tools.uniqueTools ?? 0} unique tools`}
            icon={Terminal}
          />
        </div>
      ) : null}

      {/* Latency + Messages summary row */}
      <ComplexityGate level="standard">
        {aggregates && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Messages</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-lg font-bold">{aggregates.messages.user}</p>
                    <p className="text-xs text-muted-foreground">User</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{aggregates.messages.assistant}</p>
                    <p className="text-xs text-muted-foreground">Assistant</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-destructive">
                      {aggregates.messages.errors}
                    </p>
                    <p className="text-xs text-muted-foreground">Errors</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            {aggregates.latency && aggregates.latency.count > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" /> Latency
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold">{aggregates.latency.avgMs.toFixed(0)}ms</p>
                      <p className="text-xs text-muted-foreground">Avg</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{aggregates.latency.p95Ms.toFixed(0)}ms</p>
                      <p className="text-xs text-muted-foreground">p95</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold">{aggregates.latency.maxMs.toFixed(0)}ms</p>
                      <p className="text-xs text-muted-foreground">Max</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            {aggregates.tools.tools.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Top Tools</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1.5">
                    {aggregates.tools.tools.slice(0, 5).map((tool) => (
                      <div key={tool.name} className="flex items-center justify-between text-sm">
                        <span className="truncate text-muted-foreground">{tool.name}</span>
                        <Badge variant="secondary" className="text-xs tabular-nums">
                          {tool.count}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </ComplexityGate>

      {/* Charts */}
      <ComplexityGate level="standard">
        <div className="grid gap-4 md:grid-cols-2">
          <TokenUsageChart data={aggregates?.daily ?? []} />
          <CostBreakdownChart
            data={
              aggregates?.byAgent
                ? aggregates.byAgent
                    .map((a) => ({
                      name: a.agentId,
                      value: Math.round(a.totals.totalCost * 100),
                    }))
                    .filter((a) => a.value > 0)
                    .slice(0, 8)
                : []
            }
          />
        </div>
      </ComplexityGate>

      {/* Model breakdown quick view */}
      <ComplexityGate level="standard">
        {aggregates && aggregates.byModel.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Cost by Model</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/analytics/cost">
                    Full analysis <ArrowRight className="ml-1 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {aggregates.byModel.slice(0, 5).map((entry) => {
                  const maxCost = aggregates.byModel[0]?.totals.totalCost ?? 1;
                  const pct = maxCost > 0 ? (entry.totals.totalCost / maxCost) * 100 : 0;
                  return (
                    <div key={`${entry.provider}-${entry.model}`} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="truncate">
                          <span className="text-muted-foreground">{entry.provider}/</span>
                          {entry.model}
                        </span>
                        <span className="font-mono text-xs tabular-nums">
                          {formatCost(entry.totals.totalCost)} · {formatTokens(entry.totals.totalTokens)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary/70"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Session
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Tokens
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Cost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Messages
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">
                      Last Active
                    </th>
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
                      label="Messages"
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
                      key={row.key}
                      className="border-b last:border-0 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/analytics/sessions/${encodeURIComponent(row.key)}`}
                          className="flex flex-col hover:underline"
                        >
                          <span className="text-sm font-medium truncate max-w-[200px]">
                            {row.label ?? row.key}
                          </span>
                          {row.agentId && (
                            <span className="text-xs text-muted-foreground">
                              {row.agentId}
                              {row.model && ` · ${row.model}`}
                            </span>
                          )}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums">
                        {formatTokens(row.usage?.totalTokens ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums">
                        {formatCost(row.usage?.totalCost ?? 0)}
                      </td>
                      <td className="px-4 py-3 text-sm tabular-nums">
                        {row.usage?.messageCounts?.total ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {formatDate(row.updatedAt)}
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
          {data?.sessions.length ?? 0} session
          {(data?.sessions.length ?? 0) !== 1 ? "s" : ""} · Range:{" "}
          {data?.startDate ?? startDate} → {data?.endDate ?? endDate} · Sorted
          by {sortField} {sortDir} · Auto-refresh: {AUTO_REFRESH_MS / 1000}s
        </p>
      </ComplexityGate>
    </div>
  );
}
