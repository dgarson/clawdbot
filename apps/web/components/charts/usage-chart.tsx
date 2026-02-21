"use client";

import * as React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ---------------------------------------------------------------------------
// Token Usage Area Chart
// ---------------------------------------------------------------------------

type UsageDataPoint = {
  date: string;
  tokens: number;
  cost: number;
};

const CHART_COLORS = {
  primary: "hsl(262 83% 58%)",
  primaryFaded: "hsl(262 83% 58% / 0.15)",
  secondary: "hsl(38 92% 50%)",
  secondaryFaded: "hsl(38 92% 50% / 0.15)",
};

function formatTokensShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return n.toString();
}

function formatCostShort(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

type CustomTooltipProps = {
  active?: boolean;
  payload?: Array<{ value: number; dataKey: string; color: string }>;
  label?: string;
};

function ChartTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.dataKey} className="text-xs text-muted-foreground">
          <span
            className="inline-block h-2 w-2 rounded-full mr-1.5"
            style={{ backgroundColor: entry.color }}
          />
          {entry.dataKey === "tokens"
            ? `${formatTokensShort(entry.value)} tokens`
            : formatCostShort(entry.value)}
        </p>
      ))}
    </div>
  );
}

export function TokenUsageChart({ data }: { data: UsageDataPoint[] }) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Token Usage Over Time</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          No usage data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Token Usage Over Time</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tokenGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART_COLORS.primary} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(240 4% 16% / 0.3)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(240 5% 65%)" }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatTokensShort}
                tick={{ fontSize: 11, fill: "hsl(240 5% 65%)" }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <ReTooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="tokens"
                stroke={CHART_COLORS.primary}
                fill="url(#tokenGradient)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.primary }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Cost Breakdown Pie Chart
// ---------------------------------------------------------------------------

type CostBreakdownItem = {
  name: string;
  value: number;
};

const PIE_COLORS = [
  "hsl(262 83% 58%)",  // primary violet
  "hsl(262 60% 72%)",  // light violet
  "hsl(38 92% 50%)",   // warning amber
  "hsl(142 76% 36%)",  // success green
  "hsl(199 89% 48%)",  // info blue
  "hsl(330 80% 60%)",  // pink
  "hsl(262 40% 45%)",  // muted violet
  "hsl(60 70% 50%)",   // yellow
];

export function CostBreakdownChart({ data }: { data: CostBreakdownItem[] }) {
  if (!data.length) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          No cost data for this period
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Cost Breakdown by Agent</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <ReTooltip
                formatter={(value: number) => formatCostShort(value)}
                contentStyle={{
                  background: "hsl(240 10% 6%)",
                  border: "1px solid hsl(240 4% 16%)",
                  borderRadius: "0.5rem",
                  fontSize: "0.75rem",
                }}
              />
              <Legend
                formatter={(value: string) => (
                  <span className="text-xs text-muted-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
