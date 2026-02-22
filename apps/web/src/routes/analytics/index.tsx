
import * as React from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  BarChart3,
  Calendar,
  Coins,
  Cpu,
  MessageCircle,
  RefreshCw,
  TrendingUp,
  Zap,
  Wrench,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/PageHeader";
import { useOptionalGateway } from "@/providers/GatewayProvider";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/analytics/")({
  component: AnalyticsPage,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface UsageTotals {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  totalTokens: number;
  totalCost: number;
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  missingCostEntries: number;
}

interface DailyEntry {
  date: string;
  tokens: number;
  cost: number;
  messages?: number;
  toolCalls?: number;
  errors?: number;
}

interface ModelEntry {
  provider?: string;
  model?: string;
  count: number;
  totals: UsageTotals;
}

interface AgentEntry {
  agentId: string;
  totals: UsageTotals;
}

interface ChannelEntry {
  channel: string;
  totals: UsageTotals;
}

interface MessageCounts {
  total: number;
  user: number;
  assistant: number;
  toolCalls: number;
  toolResults: number;
  errors: number;
}

interface ToolUsage {
  totalCalls: number;
  uniqueTools: number;
  tools: Array<{ name: string; count: number }>;
}

interface UsageResult {
  updatedAt: number;
  startDate: string;
  endDate: string;
  totals: UsageTotals;
  aggregates: {
    messages: MessageCounts;
    tools: ToolUsage;
    byModel: ModelEntry[];
    byProvider: ModelEntry[];
    byAgent: AgentEntry[];
    byChannel: ChannelEntry[];
    daily: DailyEntry[];
  };
  sessions: Array<{
    key: string;
    label?: string;
    agentId?: string;
    channel?: string;
    model?: string;
    usage: UsageTotals | null;
  }>;
}

interface CostSummary {
  updatedAt: number;
  days: number;
  daily: Array<UsageTotals & { date: string }>;
  totals: UsageTotals;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function formatCost(n: number): string {
  if (n === 0) return "$0.00";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}

function formatDate(s: string): string {
  return new Date(s + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function getDefaultDates(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// ─── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | null;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {trend && (
              trend === "up" ? (
                <ArrowUpRight className="size-4 text-emerald-500" />
              ) : (
                <ArrowDownRight className="size-4 text-red-500" />
              )
            )}
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Icon className="size-5 text-primary" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Daily Chart (CSS-based bar chart) ───────────────────────────────────────

function DailyChart({
  data,
  metric,
  label,
}: {
  data: DailyEntry[];
  metric: "tokens" | "cost";
  label: string;
}) {
  const values = data.map((d) => (metric === "tokens" ? d.tokens : d.cost));
  const max = Math.max(...values, 1);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-[2px] h-32">
          {data.map((day, i) => {
            const val = values[i] ?? 0;
            const pct = (val / max) * 100;
            return (
              <div
                key={day.date}
                className="group relative flex-1 flex flex-col items-center justify-end"
              >
                <div
                  className="w-full rounded-t bg-primary/80 hover:bg-primary transition-colors cursor-default min-h-[2px]"
                  style={{ height: `${Math.max(pct, 1.5)}%` }}
                />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                  <div className="rounded-md bg-popover text-popover-foreground shadow-md border border-border px-2.5 py-1.5 text-xs whitespace-nowrap">
                    <div className="font-medium">{formatDate(day.date)}</div>
                    <div>
                      {metric === "tokens" ? formatTokens(val) : formatCost(val)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* X-axis labels — show first, middle, last */}
        {data.length > 0 && (
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span>{formatDate(data[0]!.date)}</span>
            {data.length > 2 && (
              <span>{formatDate(data[Math.floor(data.length / 2)]!.date)}</span>
            )}
            <span>{formatDate(data[data.length - 1]!.date)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Model Breakdown ─────────────────────────────────────────────────────────

function ModelBreakdown({ models }: { models: ModelEntry[] }) {
  const sorted = [...models].sort(
    (a, b) => b.totals.totalCost - a.totals.totalCost
  );
  const totalCost = sorted.reduce((s, m) => s + m.totals.totalCost, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Cpu className="size-4" />
          By Model
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground">No model data</p>
        )}
        {sorted.slice(0, 8).map((m) => {
          const pct = totalCost > 0 ? (m.totals.totalCost / totalCost) * 100 : 0;
          const label = [m.provider, m.model].filter(Boolean).join("/") || "unknown";
          return (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-mono text-xs truncate max-w-[180px]">{label}</span>
                <span className="text-muted-foreground text-xs">
                  {formatCost(m.totals.totalCost)} · {formatTokens(m.totals.totalTokens)}
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Agent Breakdown ─────────────────────────────────────────────────────────

function AgentBreakdown({ agents }: { agents: AgentEntry[] }) {
  const sorted = [...agents].sort(
    (a, b) => b.totals.totalCost - a.totals.totalCost
  );
  const totalCost = sorted.reduce((s, a) => s + a.totals.totalCost, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Zap className="size-4" />
          By Agent
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground">No agent data</p>
        )}
        {sorted.slice(0, 10).map((a) => {
          const pct = totalCost > 0 ? (a.totals.totalCost / totalCost) * 100 : 0;
          return (
            <div key={a.agentId} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium truncate max-w-[180px]">{a.agentId}</span>
                <span className="text-muted-foreground text-xs">
                  {formatCost(a.totals.totalCost)} · {formatTokens(a.totals.totalTokens)}
                </span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Top Tools ───────────────────────────────────────────────────────────────

function TopTools({ tools }: { tools: ToolUsage }) {
  const sorted = [...tools.tools].sort((a, b) => b.count - a.count);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Wrench className="size-4" />
          Top Tools
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
          <span>{tools.totalCalls.toLocaleString()} calls</span>
          <Separator orientation="vertical" className="h-3" />
          <span>{tools.uniqueTools} unique tools</span>
        </div>
        <div className="space-y-2">
          {sorted.slice(0, 8).map((t) => {
            const pct =
              tools.totalCalls > 0 ? (t.count / tools.totalCalls) * 100 : 0;
            return (
              <div key={t.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono truncate max-w-[200px]">{t.name}</span>
                  <span className="text-muted-foreground">
                    {t.count.toLocaleString()}
                  </span>
                </div>
                <Progress value={pct} className="h-1" />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Session Table ───────────────────────────────────────────────────────────

function SessionTable({
  sessions,
}: {
  sessions: UsageResult["sessions"];
}) {
  const [expanded, setExpanded] = React.useState(false);
  const sorted = [...sessions]
    .filter((s) => s.usage)
    .sort((a, b) => (b.usage?.totalCost ?? 0) - (a.usage?.totalCost ?? 0));
  const display = expanded ? sorted : sorted.slice(0, 10);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            Sessions ({sorted.length})
          </CardTitle>
          {sorted.length > 10 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="gap-1 text-xs h-7"
            >
              {expanded ? (
                <>
                  <ChevronUp className="size-3" /> Show less
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" /> Show all
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Session</th>
                <th className="pb-2 pr-4 font-medium text-right">Tokens</th>
                <th className="pb-2 pr-4 font-medium text-right">Cost</th>
                <th className="pb-2 font-medium">Model</th>
              </tr>
            </thead>
            <tbody>
              {display.map((s) => (
                <tr
                  key={s.key}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs truncate max-w-[200px]">
                        {s.label || s.agentId || s.key}
                      </span>
                      {s.channel && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {s.channel}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-xs">
                    {formatTokens(s.usage?.totalTokens ?? 0)}
                  </td>
                  <td className="py-2 pr-4 text-right font-mono text-xs">
                    {formatCost(s.usage?.totalCost ?? 0)}
                  </td>
                  <td className="py-2 font-mono text-xs text-muted-foreground truncate max-w-[150px]">
                    {s.model || "—"}
                  </td>
                </tr>
              ))}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No sessions in this date range
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Loading Skeleton ────────────────────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

function AnalyticsPage() {
  const gateway = useOptionalGateway();
  const client = gateway?.isConnected ? gateway.client : null;

  const defaults = React.useMemo(getDefaultDates, []);
  const [startDate, setStartDate] = React.useState(defaults.start);
  const [endDate, setEndDate] = React.useState(defaults.end);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [usageData, setUsageData] = React.useState<UsageResult | null>(null);
  const [costData, setCostData] = React.useState<CostSummary | null>(null);

  const fetchData = React.useCallback(async () => {
    if (!client) return;
    setLoading(true);
    setError(null);
    try {
      const [sessionsRes, costRes] = await Promise.all([
        client.request("sessions.usage", {
          startDate,
          endDate,
          limit: 1000,
          includeContextWeight: true,
        }),
        client.request("usage.cost", { startDate, endDate }),
      ]);
      if (sessionsRes) setUsageData(sessionsRes as UsageResult);
      if (costRes) setCostData(costRes as CostSummary);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [client, startDate, endDate]);

  React.useEffect(() => {
    if (client) void fetchData();
  }, [client, fetchData]);

  const totals = usageData?.totals;
  const agg = usageData?.aggregates;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Token usage, costs, and session metrics"
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Calendar className="size-4 text-muted-foreground" />
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8 w-[130px] text-xs"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8 w-[130px] text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchData}
              disabled={loading}
              className="gap-2"
            >
              <RefreshCw className={cn("size-4", loading && "animate-spin")} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Error */}
      {error && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="py-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Not connected */}
      {!client && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="mx-auto mb-3 size-8 opacity-40" />
            <p>Connect to the gateway to view analytics</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {client && loading && !usageData && <AnalyticsSkeleton />}

      {/* Data */}
      {client && totals && agg && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Tokens"
              value={formatTokens(totals.totalTokens)}
              subtitle={`${formatTokens(totals.input)} in / ${formatTokens(totals.output)} out`}
              icon={TrendingUp}
            />
            <StatCard
              title="Total Cost"
              value={formatCost(totals.totalCost)}
              subtitle={costData ? `${costData.days} days` : undefined}
              icon={Coins}
            />
            <StatCard
              title="Messages"
              value={agg.messages.total.toLocaleString()}
              subtitle={`${agg.messages.user} user · ${agg.messages.assistant} assistant`}
              icon={MessageCircle}
            />
            <StatCard
              title="Tool Calls"
              value={agg.tools.totalCalls.toLocaleString()}
              subtitle={`${agg.tools.uniqueTools} unique tools`}
              icon={Wrench}
            />
          </div>

          {/* Token / cost breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-5 space-y-1.5 text-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Token Breakdown</p>
                <div className="flex justify-between"><span>Input</span><span className="font-mono">{formatTokens(totals.input)}</span></div>
                <div className="flex justify-between"><span>Output</span><span className="font-mono">{formatTokens(totals.output)}</span></div>
                <div className="flex justify-between"><span>Cache Read</span><span className="font-mono">{formatTokens(totals.cacheRead)}</span></div>
                <div className="flex justify-between"><span>Cache Write</span><span className="font-mono">{formatTokens(totals.cacheWrite)}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 space-y-1.5 text-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Cost Breakdown</p>
                <div className="flex justify-between"><span>Input</span><span className="font-mono">{formatCost(totals.inputCost)}</span></div>
                <div className="flex justify-between"><span>Output</span><span className="font-mono">{formatCost(totals.outputCost)}</span></div>
                <div className="flex justify-between"><span>Cache Read</span><span className="font-mono">{formatCost(totals.cacheReadCost)}</span></div>
                <div className="flex justify-between"><span>Cache Write</span><span className="font-mono">{formatCost(totals.cacheWriteCost)}</span></div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 space-y-1.5 text-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Message Breakdown</p>
                <div className="flex justify-between"><span>User</span><span className="font-mono">{agg.messages.user.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Assistant</span><span className="font-mono">{agg.messages.assistant.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Tool Calls</span><span className="font-mono">{agg.messages.toolCalls.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Tool Results</span><span className="font-mono">{agg.messages.toolResults.toLocaleString()}</span></div>
                {agg.messages.errors > 0 && (
                  <div className="flex justify-between text-destructive"><span>Errors</span><span className="font-mono">{agg.messages.errors.toLocaleString()}</span></div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-5 space-y-1.5 text-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Sessions</p>
                <div className="flex justify-between"><span>Total</span><span className="font-mono">{usageData.sessions.length.toLocaleString()}</span></div>
                <div className="flex justify-between"><span>Channels</span><span className="font-mono">{agg.byChannel.length}</span></div>
                <div className="flex justify-between"><span>Models</span><span className="font-mono">{agg.byModel.length}</span></div>
                <div className="flex justify-between"><span>Agents</span><span className="font-mono">{agg.byAgent.length}</span></div>
              </CardContent>
            </Card>
          </div>

          {/* Daily charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <DailyChart data={agg.daily} metric="tokens" label="Daily Token Usage" />
            <DailyChart data={agg.daily} metric="cost" label="Daily Cost" />
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModelBreakdown models={agg.byModel} />
            <AgentBreakdown agents={agg.byAgent} />
            <TopTools tools={agg.tools} />
          </div>

          {/* Session table */}
          <SessionTable sessions={usageData.sessions} />
        </motion.div>
      )}
    </div>
  );
}
