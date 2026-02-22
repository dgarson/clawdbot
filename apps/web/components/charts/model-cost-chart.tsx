"use client";

import * as React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ModelCostDataPoint = {
  name: string;
  cost: number;
  tokens: number;
};

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; payload: ModelCostDataPoint }>;
  label?: string;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCost(usd: number): string {
  if (usd >= 1) {return `$${usd.toFixed(2)}`;}
  if (usd >= 0.01) {return `$${usd.toFixed(3)}`;}
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(1)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(0)}k`;}
  return n.toString();
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function ChartTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) {return null;}
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-1">{item.name}</p>
      <p className="text-xs text-muted-foreground">Cost: {formatCost(item.cost)}</p>
      <p className="text-xs text-muted-foreground">Tokens: {formatTokens(item.tokens)}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------

export function ModelCostChart({
  data,
  title = "Cost by Model",
}: {
  data: ModelCostDataPoint[];
  title?: string;
}) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          No model cost data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 8, right: 32, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(240 4% 16% / 0.3)"
                horizontal={false}
              />
              <XAxis
                type="number"
                tickFormatter={(v: number) => formatCost(v)}
                tick={{ fontSize: 11, fill: "hsl(240 5% 65%)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "hsl(240 5% 65%)" }}
                tickLine={false}
                axisLine={false}
                width={140}
              />
              <ReTooltip content={<ChartTooltip />} />
              <Bar
                dataKey="cost"
                fill="hsl(262 83% 58%)"
                radius={[0, 4, 4, 0]}
                maxBarSize={28}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Lazy wrapper
// ---------------------------------------------------------------------------

const LazyModelCostChart = React.lazy(() =>
  import("./model-cost-chart").then((mod) => ({
    default: mod.ModelCostChart,
  })),
);

export function ModelCostChartLazy(props: {
  data: ModelCostDataPoint[];
  title?: string;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center h-[300px] bg-muted/30 rounded-lg animate-pulse">
          <span className="text-xs text-muted-foreground">Loading chart…</span>
        </div>
      }
    >
      <LazyModelCostChart {...props} />
    </React.Suspense>
  );
}
