"use client";

import * as React from "react";
import { useGatewayStore } from "@/lib/stores/gateway";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FlaskConical,
  RefreshCw,
  WifiOff,
  CheckCircle2,
  Clock,
  BarChart2,
  Sparkles,
  SplitSquareHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExperimentStatus = "active" | "completed" | "draft" | "paused";

type ExperimentVariant = {
  id: string;
  name: string;
  weight: number;
  sampleCount?: number;
  metrics?: Record<string, number>;
};

type Experiment = {
  id: string;
  name: string;
  description?: string;
  status: ExperimentStatus;
  startedAt?: string;
  endedAt?: string;
  variants: ExperimentVariant[];
  primaryMetric?: string;
};

type ExperimentsListResult = {
  experiments: Experiment[];
};

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: ExperimentStatus }) {
  const variants: Record<ExperimentStatus, { label: string; cls: string }> = {
    active: { label: "Active", cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30" },
    completed: { label: "Completed", cls: "bg-muted/60 text-muted-foreground border-border" },
    draft: { label: "Draft", cls: "bg-blue-500/10 text-blue-600 border-blue-500/30" },
    paused: { label: "Paused", cls: "bg-amber-500/10 text-amber-600 border-amber-500/30" },
  };
  const { label, cls } = variants[status] ?? variants.draft;
  return (
    <Badge variant="outline" className={cn("text-xs", cls)}>
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// Experiment card
// ---------------------------------------------------------------------------

function ExperimentCard({ experiment }: { experiment: Experiment }) {
  const chartData = experiment.variants.map((v) => ({
    name: v.name,
    weight: v.weight,
    samples: v.sampleCount ?? 0,
    ...v.metrics,
  }));

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base truncate">{experiment.name}</CardTitle>
              <StatusBadge status={experiment.status} />
            </div>
            {experiment.description && (
              <p className="text-sm text-muted-foreground">{experiment.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              {experiment.startedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Started {new Date(experiment.startedAt).toLocaleDateString()}
                </span>
              )}
              {experiment.endedAt && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Ended {new Date(experiment.endedAt).toLocaleDateString()}
                </span>
              )}
              {experiment.primaryMetric && (
                <span className="flex items-center gap-1">
                  <BarChart2 className="h-3 w-3" />
                  Primary: <code className="font-mono">{experiment.primaryMetric}</code>
                </span>
              )}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
            Variant Distribution
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted" />
              <XAxis type="number" domain={[0, 100]} unit="%" className="text-xs" />
              <YAxis type="category" dataKey="name" width={80} className="text-xs" tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(v: number) => [`${v}%`, "Weight"]}
                contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
              />
              <Bar dataKey="weight" fill="hsl(var(--primary))" radius={[0, 3, 3, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="py-2 text-left text-xs font-medium text-muted-foreground uppercase">Variant</th>
              <th className="py-2 text-right text-xs font-medium text-muted-foreground uppercase">Weight</th>
              <th className="py-2 text-right text-xs font-medium text-muted-foreground uppercase">Samples</th>
              {experiment.primaryMetric && (
                <th className="py-2 text-right text-xs font-medium text-muted-foreground uppercase">
                  {experiment.primaryMetric}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {experiment.variants.map((v) => (
              <tr key={v.id} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                <td className="py-2 font-medium">{v.name}</td>
                <td className="py-2 text-right tabular-nums">{v.weight}%</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {v.sampleCount?.toLocaleString() ?? "—"}
                </td>
                {experiment.primaryMetric && (
                  <td className="py-2 text-right tabular-nums">
                    {v.metrics?.[experiment.primaryMetric] != null
                      ? v.metrics[experiment.primaryMetric].toFixed(3)
                      : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Coming soon card
// ---------------------------------------------------------------------------

function ComingSoonCard() {
  return (
    <Card className="border-dashed border-2 bg-gradient-to-br from-violet-500/5 to-blue-500/5">
      <CardContent className="py-10 flex flex-col items-center text-center gap-4">
        <div className="rounded-full bg-violet-500/10 p-4">
          <SplitSquareHorizontal className="h-8 w-8 text-violet-500" />
        </div>
        <div>
          <h3 className="text-lg font-bold mb-1">A/B Experiments</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Run controlled experiments to compare model configurations, prompt strategies,
            tool sets, and agent behaviors. Measure real-world performance on your workloads.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 w-full max-w-md">
          {[
            { icon: FlaskConical, title: "Model A/B", desc: "Compare models head-to-head on real traffic" },
            { icon: BarChart2, title: "Metric Tracking", desc: "Latency, cost, quality, and success rates" },
            { icon: Sparkles, title: "Auto-rollout", desc: "Gradually shift traffic to the winning variant" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-lg border bg-card p-3 text-left">
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold">{title}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Clock className="h-3 w-3" />
          Coming in OBS-04
        </Badge>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExperimentsPage() {
  const { connected, request } = useGatewayStore();

  const [experiments, setExperiments] = React.useState<Experiment[] | null>(null);
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchExperiments = React.useCallback(async () => {
    if (!connected) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await request<ExperimentsListResult>("experiments.list", {});
      setExperiments(result.experiments ?? []);
      setAvailable(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isNotFound =
        msg.includes("not found") ||
        msg.includes("unknown method") ||
        msg.includes("not supported") ||
        msg.includes("METHOD_NOT_FOUND") ||
        msg.includes("404");
      setAvailable(false);
      if (!isNotFound) {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [connected, request]);

  React.useEffect(() => {
    void fetchExperiments();
  }, [fetchExperiments]);

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FlaskConical className="h-6 w-6" />
            Experiments
          </h1>
          <p className="text-sm text-muted-foreground">
            A/B test models, prompts, and agent configurations
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void fetchExperiments()}
          disabled={loading || !connected}
        >
          <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Connection warning */}
      {!connected && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="flex items-center gap-3 py-3">
            <WifiOff className="h-4 w-4 text-yellow-600" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">Not connected to Gateway.</p>
          </CardContent>
        </Card>
      )}

      {/* Non-fatal error */}
      {error && available === false && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="py-3">
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="py-8">
                <div className="space-y-3">
                  <div className="h-5 w-48 rounded bg-muted" />
                  <div className="h-3 w-72 rounded bg-muted" />
                  <div className="h-32 w-full rounded bg-muted mt-4" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Not available */}
      {!loading && available === false && <ComingSoonCard />}

      {/* Available but empty */}
      {!loading && available === true && experiments?.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-muted p-4 mb-3">
              <FlaskConical className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">No experiments yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Create your first experiment to start comparing model configurations or prompt strategies.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Experiments list */}
      {!loading && available === true && experiments && experiments.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {experiments.length} experiment{experiments.length !== 1 ? "s" : ""}
            {" · "}
            {experiments.filter((e) => e.status === "active").length} active
          </p>
          {experiments.map((exp) => (
            <ExperimentCard key={exp.id} experiment={exp} />
          ))}
        </div>
      )}
    </div>
  );
}
