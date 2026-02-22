"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";

// ─── Lazy Chart Wrapper ──────────────────────────────────
// Reduces initial bundle by ~114 kB by deferring Recharts load

type UsageDataPoint = {
  date: string;
  tokens: number;
  cost: number;
};

type CostBreakdownItem = {
  name: string;
  value: number;
};

function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div
      className="flex items-center justify-center bg-muted/30 rounded-lg animate-pulse"
      style={{ height }}
    >
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-xs">Loading chart...</span>
      </div>
    </div>
  );
}

// Lazy-load the actual chart components
const LazyTokenUsageChart = React.lazy(() =>
  import("./usage-chart").then((mod) => ({ default: mod.TokenUsageChart }))
);

const LazyCostBreakdownChart = React.lazy(() =>
  import("./usage-chart").then((mod) => ({ default: mod.CostBreakdownChart }))
);

// ─── Exported Wrappers ───────────────────────────────────

export function TokenUsageChartLazy({ data }: { data: UsageDataPoint[] }) {
  return (
    <React.Suspense fallback={<ChartSkeleton height={300} />}>
      <LazyTokenUsageChart data={data} />
    </React.Suspense>
  );
}

export function CostBreakdownChartLazy({ data }: { data: CostBreakdownItem[] }) {
  return (
    <React.Suspense fallback={<ChartSkeleton height={300} />}>
      <LazyCostBreakdownChart data={data} />
    </React.Suspense>
  );
}
