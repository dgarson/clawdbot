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
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ModelCostChartLazy as ModelCostChart } from "@/components/charts/model-cost-chart";
import {
  CostBreakdownChartLazy as CostBreakdownChart,
} from "@/components/charts/lazy-charts";
import type { SessionsUsageResult } from "@/lib/gateway/types";
import {
  ArrowLeft,
  Calendar,
  Coins,
  RefreshCw,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

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

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const AUTO_REFRESH_MS = 60_000;

export default function CostAnalysisPage() {
  const { connected, request } = useGatewayStore();

  const [startDate, setStartDate] = React.useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toISODate(d);
  });
  const [endDate, setEndDate] = React.useState(() => toISODate(new Date()));

  const [data, setData] = React.useState<SessionsUsageResult | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!connected) {return;}
    setLoading(true);
    setError(null);
    try {
      const result = await request<SessionsUsageResult>("sessions.usage", {
        startDate,
        endDate,
        limit: 200,
      });
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cost data");
    } finally {
      setLoading(false);
    }
  }, [connected, request, startDate, endDate]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  React.useEffect(() => {
    if (!connected) {return;}
    const id = setInterval(() => void fetchData(), AUTO_REFRESH_MS);
    return () => clearInterval(id);
  }, [connected, fetchData]);

  const totals = data?.totals;
  const aggregates = data?.aggregates;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/analytics">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Analytics
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Cost Analysis</h1>
            <p className="text-sm text-muted-foreground">
              Detailed cost comparison by model, provider, and agent
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading || !connected}
        >
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {!connected && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 py-3">
            <WifiOff className="h-4 w-4 text-warning" />
            <p className="text-sm text-warning">Not connected to Gateway.</p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Date range */}
      <Card>
        <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
          <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">From</label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-40" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">To</label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-40" />
          </div>
          <div className="flex gap-2 sm:ml-auto">
            {[{ label: "7d", days: 7 }, { label: "30d", days: 30 }, { label: "90d", days: 90 }].map(({ label, days }) => (
              <Button key={label} variant="ghost" size="sm" onClick={() => {
                const end = new Date();
                const start = new Date();
                start.setDate(start.getDate() - days);
                setStartDate(toISODate(start));
                setEndDate(toISODate(end));
              }}>
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cost summary */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-3 w-20 rounded bg-muted mb-2" />
                <div className="h-7 w-24 rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : totals ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-l-4 border-l-amber-500">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Total Cost</p>
              <p className="text-2xl font-bold">{formatCost(totals.totalCost)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Input Cost</p>
              <p className="text-2xl font-bold">{formatCost(totals.inputCost)}</p>
              <p className="text-xs text-muted-foreground">{formatTokens(totals.input)} tokens</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Output Cost</p>
              <p className="text-2xl font-bold">{formatCost(totals.outputCost)}</p>
              <p className="text-xs text-muted-foreground">{formatTokens(totals.output)} tokens</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Cache Savings</p>
              <p className="text-2xl font-bold">{formatCost(totals.cacheReadCost)}</p>
              <p className="text-xs text-muted-foreground">{formatTokens(totals.cacheRead)} cached tokens</p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Charts */}
      {aggregates && (
        <div className="grid gap-4 md:grid-cols-2">
          <ModelCostChart
            title="Top Models by Cost"
            data={aggregates.byModel.slice(0, 10).map((m) => ({
              name: m.model ?? "unknown",
              cost: m.totals.totalCost,
              tokens: m.totals.totalTokens,
            }))}
          />
          <CostBreakdownChart
            data={aggregates.byProvider.map((p) => ({
              name: p.provider ?? "unknown",
              value: Math.round(p.totals.totalCost * 100),
            }))}
          />
        </div>
      )}

      {/* Model comparison table */}
      {aggregates && aggregates.byModel.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Model Cost Comparison</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Model</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Provider</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Requests</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Input</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Output</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">%</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregates.byModel.map((entry) => {
                    const pct = totals && totals.totalCost > 0 ? (entry.totals.totalCost / totals.totalCost) * 100 : 0;
                    return (
                      <tr key={`${entry.provider}-${entry.model}`} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">{entry.model ?? "unknown"}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{entry.provider ?? "unknown"}</Badge></td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums">{entry.count}</td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums">{formatTokens(entry.totals.input)}</td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums">{formatTokens(entry.totals.output)}</td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums font-medium">{formatCost(entry.totals.totalCost)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-primary/70" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Agent cost breakdown */}
      {aggregates && aggregates.byAgent.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cost by Agent</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Agent</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Tokens</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase">%</th>
                  </tr>
                </thead>
                <tbody>
                  {aggregates.byAgent.map((agent) => {
                    const pct = totals && totals.totalCost > 0 ? (agent.totals.totalCost / totals.totalCost) * 100 : 0;
                    return (
                      <tr key={agent.agentId} className="border-b last:border-0 hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium">{agent.agentId}</td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums">{formatTokens(agent.totals.totalTokens)}</td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums font-medium">{formatCost(agent.totals.totalCost)}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full bg-emerald-500/70" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Channel breakdown */}
      {aggregates && aggregates.byChannel.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cost by Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {aggregates.byChannel.map((ch) => {
                const pct = totals && totals.totalCost > 0 ? (ch.totals.totalCost / totals.totalCost) * 100 : 0;
                return (
                  <div key={ch.channel} className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs min-w-[80px] justify-center">{ch.channel}</Badge>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500/70" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <span className="text-xs tabular-nums font-medium w-20 text-right">{formatCost(ch.totals.totalCost)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !aggregates && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Coins className="h-8 w-8 text-muted-foreground mb-3 opacity-30" />
            <h3 className="text-lg font-semibold mb-1">No cost data</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              No usage data found for the selected date range.
            </p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Range: {data?.startDate ?? startDate} → {data?.endDate ?? endDate} ·{" "}
        {data?.sessions.length ?? 0} sessions · Auto-refresh: {AUTO_REFRESH_MS / 1000}s
      </p>
    </div>
  );
}
