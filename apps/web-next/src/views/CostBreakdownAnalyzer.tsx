import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "overview" | "services" | "anomalies" | "savings";
type Severity = "critical" | "high" | "medium" | "low";
type SavingsType = "reserved" | "rightsizing" | "idle";
type Effort = "low" | "medium" | "high";

interface ServiceData {
  id: string;
  name: string;
  category: string;
  currentCost: number;
  lastMonthCost: number;
  costPerUnit: number;
  unitLabel: string;
  trend: number[];
  dailyCosts: number[];
  resources: ResourceDetail[];
}

interface ResourceDetail {
  id: string;
  name: string;
  type: string;
  cost: number;
  region: string;
}

interface AnomalyData {
  id: string;
  severity: Severity;
  description: string;
  resource: string;
  estimatedWaste: number;
  recommendedAction: string;
  detectedAt: string;
  resolved: boolean;
}

interface SavingsRec {
  id: string;
  type: SavingsType;
  service: string;
  description: string;
  currentCost: number;
  optimizedCost: number;
  monthlySavings: number;
  effort: Effort;
  currentInstance?: string;
  recommendedInstance?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const SERVICES: ServiceData[] = [
  {
    id: "ec2",
    name: "EC2 Compute",
    category: "Compute",
    currentCost: 18420,
    lastMonthCost: 16890,
    costPerUnit: 0.085,
    unitLabel: "/hr",
    trend: [14200, 15100, 16890, 17200, 18100, 18420],
    dailyCosts: [580,610,595,620,640,605,590,615,630,645,610,595,620,635,650,620,600,615,630,645,610,595,620,635,650,620,600,615,630,645],
    resources: [
      { id: "r1", name: "prod-api-cluster",  type: "c5.2xlarge", cost: 8200, region: "us-east-1" },
      { id: "r2", name: "worker-fleet",      type: "m5.xlarge",  cost: 5100, region: "us-west-2" },
      { id: "r3", name: "analytics-batch",   type: "r5.4xlarge", cost: 3200, region: "us-east-1" },
      { id: "r4", name: "staging-cluster",   type: "t3.large",   cost: 1920, region: "eu-west-1" },
    ],
  },
  {
    id: "eks",
    name: "EKS Kubernetes",
    category: "Compute",
    currentCost: 5680,
    lastMonthCost: 4920,
    costPerUnit: 0.10,
    unitLabel: "/hr",
    trend: [3800, 4100, 4500, 4920, 5200, 5680],
    dailyCosts: [180,182,185,188,190,185,182,185,188,192,194,188,185,188,192,194,190,186,184,188,192,194,190,186,184,188,192,194,190,186],
    resources: [
      { id: "r16", name: "prod-cluster-nodes",   type: "m5.xlarge",        cost: 4200, region: "us-east-1" },
      { id: "r17", name: "prod-cluster-control", type: "EKS Control Plane", cost: 1480, region: "us-east-1" },
    ],
  },
  {
    id: "rds",
    name: "RDS Database",
    category: "Database",
    currentCost: 9840,
    lastMonthCost: 9840,
    costPerUnit: 0.24,
    unitLabel: "/hr",
    trend: [8900, 9100, 9400, 9840, 9840, 9840],
    dailyCosts: [320,320,320,320,320,320,320,320,320,320,320,340,340,340,340,340,340,340,320,320,320,320,320,320,320,320,320,320,320,320],
    resources: [
      { id: "r5", name: "prod-postgres-primary", type: "db.r5.2xlarge", cost: 5200, region: "us-east-1" },
      { id: "r6", name: "prod-postgres-replica", type: "db.r5.xlarge",  cost: 2800, region: "us-east-1" },
      { id: "r7", name: "analytics-aurora",      type: "db.r5.large",   cost: 1840, region: "us-east-1" },
    ],
  },
  {
    id: "elasticache",
    name: "ElastiCache",
    category: "Database",
    currentCost: 2160,
    lastMonthCost: 2160,
    costPerUnit: 0.068,
    unitLabel: "/hr",
    trend: [2160, 2160, 2160, 2160, 2160, 2160],
    dailyCosts: [72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72,72],
    resources: [
      { id: "r18", name: "session-cache-cluster", type: "cache.r6g.large", cost: 1440, region: "us-east-1" },
      { id: "r19", name: "query-cache",           type: "cache.t3.medium", cost:  720, region: "us-east-1" },
    ],
  },
  {
    id: "s3",
    name: "S3 Storage",
    category: "Storage",
    currentCost: 4210,
    lastMonthCost: 3980,
    costPerUnit: 0.023,
    unitLabel: "/GB",
    trend: [2800, 3100, 3500, 3800, 3980, 4210],
    dailyCosts: [130,132,134,136,138,140,138,136,140,142,144,140,138,142,144,146,142,140,138,140,142,144,140,142,144,146,142,140,138,140],
    resources: [
      { id: "r8",  name: "media-assets-prod", type: "Standard",    cost: 2100, region: "us-east-1" },
      { id: "r9",  name: "logs-archive",      type: "Standard-IA", cost:  890, region: "us-east-1" },
      { id: "r10", name: "backups",           type: "Glacier",     cost: 1220, region: "us-east-1" },
    ],
  },
  {
    id: "cloudfront",
    name: "CloudFront CDN",
    category: "Network",
    currentCost: 3120,
    lastMonthCost: 2890,
    costPerUnit: 0.0085,
    unitLabel: "/req",
    trend: [2200, 2400, 2600, 2800, 2890, 3120],
    dailyCosts: [95,98,102,105,108,102,98,100,104,108,110,104,100,104,108,110,106,102,100,104,108,110,106,102,100,104,108,110,106,102],
    resources: [
      { id: "r11", name: "prod-cdn-distribution", type: "Distribution", cost: 2400, region: "global" },
      { id: "r12", name: "staging-cdn",           type: "Distribution", cost:  720, region: "global" },
    ],
  },
  {
    id: "lambda",
    name: "Lambda Functions",
    category: "Compute",
    currentCost: 2840,
    lastMonthCost: 3120,
    costPerUnit: 0.0000002,
    unitLabel: "/req",
    trend: [3600, 3400, 3200, 3120, 3000, 2840],
    dailyCosts: [100,98,96,94,92,90,94,96,98,96,94,92,94,96,98,96,94,92,90,92,94,96,98,96,94,92,90,92,94,96],
    resources: [
      { id: "r13", name: "api-handlers",     type: "Function", cost: 1600, region: "us-east-1" },
      { id: "r14", name: "event-processors", type: "Function", cost:  840, region: "us-east-1" },
      { id: "r15", name: "cron-jobs",        type: "Function", cost:  400, region: "us-east-1" },
    ],
  },
  {
    id: "cloudwatch",
    name: "CloudWatch",
    category: "Observability",
    currentCost: 1680,
    lastMonthCost: 1520,
    costPerUnit: 0.30,
    unitLabel: "/GB ingested",
    trend: [1100, 1200, 1350, 1450, 1520, 1680],
    dailyCosts: [52,54,55,56,58,54,52,55,57,59,56,54,55,57,59,57,55,53,55,57,59,57,55,53,55,57,59,57,55,53],
    resources: [
      { id: "r26", name: "log-groups-prod",    type: "Log Groups", cost: 980, region: "us-east-1" },
      { id: "r27", name: "metrics-dashboards", type: "Metrics",    cost: 700, region: "us-east-1" },
    ],
  },
  {
    id: "waf",
    name: "WAF & Shield",
    category: "Security",
    currentCost: 1240,
    lastMonthCost: 1240,
    costPerUnit: 5.00,
    unitLabel: "/rule/mo",
    trend: [1240, 1240, 1240, 1240, 1240, 1240],
    dailyCosts: [41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41,41],
    resources: [
      { id: "r23", name: "prod-waf-rules",  type: "WebACL", cost: 840, region: "us-east-1" },
      { id: "r24", name: "shield-advanced", type: "Shield", cost: 400, region: "global"    },
    ],
  },
  {
    id: "cognito",
    name: "Cognito Auth",
    category: "Security",
    currentCost: 890,
    lastMonthCost: 810,
    costPerUnit: 0.0055,
    unitLabel: "/MAU",
    trend: [600, 680, 740, 800, 810, 890],
    dailyCosts: [28,29,30,30,31,29,28,30,31,32,30,29,30,31,32,30,29,30,31,32,30,29,30,31,32,30,29,30,31,30],
    resources: [
      { id: "r22", name: "prod-user-pool", type: "User Pool", cost: 890, region: "us-east-1" },
    ],
  },
  {
    id: "sqs",
    name: "SQS Queues",
    category: "Messaging",
    currentCost: 480,
    lastMonthCost: 420,
    costPerUnit: 0.40,
    unitLabel: "/1M req",
    trend: [320, 350, 380, 400, 420, 480],
    dailyCosts: [14,15,15,16,16,17,15,15,16,16,17,16,15,16,17,17,16,15,16,17,16,15,16,17,16,15,16,17,16,15],
    resources: [
      { id: "r20", name: "order-processing-queue", type: "Standard", cost: 280, region: "us-east-1" },
      { id: "r21", name: "notification-queue",     type: "FIFO",     cost: 200, region: "us-east-1" },
    ],
  },
  {
    id: "route53",
    name: "Route 53 DNS",
    category: "Network",
    currentCost: 320,
    lastMonthCost: 310,
    costPerUnit: 0.50,
    unitLabel: "/zone/mo",
    trend: [290, 295, 300, 305, 310, 320],
    dailyCosts: [10,10,11,10,11,10,10,11,10,11,11,10,11,10,11,11,10,11,10,11,11,10,11,10,11,11,10,11,10,11],
    resources: [
      { id: "r25", name: "prod-hosted-zones", type: "Hosted Zone", cost: 320, region: "global" },
    ],
  },
];

const ANOMALIES: AnomalyData[] = [
  {
    id: "a1",
    severity: "critical",
    description: "EC2 spend spiked 42% over weekend — unscheduled batch job left running",
    resource: "analytics-batch (r5.4xlarge, us-east-1)",
    estimatedWaste: 1840,
    recommendedAction: "terminate",
    detectedAt: "2026-02-20",
    resolved: false,
  },
  {
    id: "a2",
    severity: "high",
    description: "RDS snapshot retention set to 35 days — policy requires 7",
    resource: "prod-postgres-primary (us-east-1)",
    estimatedWaste: 620,
    recommendedAction: "reserved",
    detectedAt: "2026-02-18",
    resolved: false,
  },
  {
    id: "a3",
    severity: "high",
    description: "CloudWatch log ingestion up 40% — verbose debug logging left on in prod",
    resource: "log-groups-prod (us-east-1)",
    estimatedWaste: 380,
    recommendedAction: "right-size",
    detectedAt: "2026-02-21",
    resolved: false,
  },
  {
    id: "a4",
    severity: "medium",
    description: "4 idle NAT Gateways detected with <1% traffic utilization",
    resource: "nat-gw-staging-* (eu-west-1)",
    estimatedWaste: 290,
    recommendedAction: "terminate",
    detectedAt: "2026-02-19",
    resolved: false,
  },
  {
    id: "a5",
    severity: "medium",
    description: "EKS node group over-provisioned — CPU utilization avg 12% across 6 nodes",
    resource: "prod-cluster-nodes (m5.xlarge x6)",
    estimatedWaste: 1200,
    recommendedAction: "right-size",
    detectedAt: "2026-02-17",
    resolved: false,
  },
  {
    id: "a6",
    severity: "low",
    description: "S3 Intelligent-Tiering not enabled — 82% of objects are cold (>30 days unaccessed)",
    resource: "media-assets-prod (us-east-1)",
    estimatedWaste: 420,
    recommendedAction: "right-size",
    detectedAt: "2026-02-15",
    resolved: false,
  },
];

const SAVINGS: SavingsRec[] = [
  {
    id: "s1",
    type: "reserved",
    service: "EC2 Compute",
    description: "Convert prod-api-cluster to 1-year Reserved Instances (35% discount)",
    currentCost: 8200,
    optimizedCost: 5330,
    monthlySavings: 2870,
    effort: "low",
    currentInstance: "On-Demand c5.2xlarge",
    recommendedInstance: "1yr RI c5.2xlarge",
  },
  {
    id: "s2",
    type: "reserved",
    service: "RDS Database",
    description: "Convert prod-postgres-primary to Reserved Instance",
    currentCost: 5200,
    optimizedCost: 3380,
    monthlySavings: 1820,
    effort: "low",
    currentInstance: "On-Demand db.r5.2xlarge",
    recommendedInstance: "1yr RI db.r5.2xlarge",
  },
  {
    id: "s3",
    type: "reserved",
    service: "ElastiCache",
    description: "Convert session-cache-cluster to Reserved Nodes (35% discount)",
    currentCost: 1440,
    optimizedCost: 936,
    monthlySavings: 504,
    effort: "low",
    currentInstance: "On-Demand cache.r6g.large",
    recommendedInstance: "1yr RI cache.r6g.large",
  },
  {
    id: "s4",
    type: "rightsizing",
    service: "EC2 Compute",
    description: "Downsize analytics-batch — avg CPU 18%, avg RAM 24% over 30 days",
    currentCost: 3200,
    optimizedCost: 1600,
    monthlySavings: 1600,
    effort: "medium",
    currentInstance: "r5.4xlarge",
    recommendedInstance: "r5.2xlarge",
  },
  {
    id: "s5",
    type: "rightsizing",
    service: "EKS Kubernetes",
    description: "Scale EKS node group from 6 → 4 nodes (avg cluster utilization 12%)",
    currentCost: 4200,
    optimizedCost: 2800,
    monthlySavings: 1400,
    effort: "medium",
    currentInstance: "6× m5.xlarge",
    recommendedInstance: "4× m5.xlarge",
  },
  {
    id: "s6",
    type: "rightsizing",
    service: "RDS Database",
    description: "Downsize analytics-aurora — avg CPU 8%, peak connections 12/100",
    currentCost: 1840,
    optimizedCost: 920,
    monthlySavings: 920,
    effort: "medium",
    currentInstance: "db.r5.large",
    recommendedInstance: "db.t3.medium",
  },
  {
    id: "s7",
    type: "idle",
    service: "EC2 Compute",
    description: "staging-cluster has received zero traffic for 14 consecutive days",
    currentCost: 1920,
    optimizedCost: 0,
    monthlySavings: 1920,
    effort: "low",
  },
  {
    id: "s8",
    type: "idle",
    service: "CloudFront CDN",
    description: "staging-cdn distribution — 0 requests in last 30 days",
    currentCost: 720,
    optimizedCost: 0,
    monthlySavings: 720,
    effort: "low",
  },
  {
    id: "s9",
    type: "idle",
    service: "S3 Storage",
    description: "logs-archive last accessed 90+ days ago — migrate to Glacier Deep Archive",
    currentCost: 890,
    optimizedCost: 178,
    monthlySavings: 712,
    effort: "low",
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTHS = ["Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];

const CATEGORY_COLORS: Record<string, string> = {
  Compute: "bg-primary",
  Database: "bg-emerald-500",
  Storage: "bg-amber-500",
  Network: "bg-sky-500",
  Messaging: "bg-purple-500",
  Security: "bg-rose-500",
  Observability: "bg-orange-500",
};

const TYPE_LABELS: Record<SavingsType, string> = {
  reserved: "Reserved Instances",
  rightsizing: "Rightsizing",
  idle: "Idle Cleanup",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number): string {
  if (amount >= 1000) {return "$" + (amount / 1000).toFixed(1) + "k";}
  return "$" + amount.toLocaleString();
}

function pctChange(current: number, prev: number): { pct: number; down: boolean } {
  const pct = ((current - prev) / prev) * 100;
  return { pct: Math.abs(pct), down: current < prev };
}

// ─── Primitive Chart Components ───────────────────────────────────────────────

function MiniBar({ values, color = "bg-primary" }: { values: number[]; color?: string }) {
  const max = Math.max(...values);
  return (
    <div className="flex items-end gap-px h-6">
      {values.map((v, i) => (
        <div
          key={i}
          className={cn("w-2 rounded-sm opacity-75", color)}
          style={{ height: `${Math.max(8, (v / max) * 100)}%` }}
        />
      ))}
    </div>
  );
}

function HorizBar({ value, max, color = "bg-primary" }: { value: number; max: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden flex-1">
      <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

function VertBarChart({
  data,
  labels,
  colorFn,
}: {
  data: number[];
  labels: string[];
  colorFn?: (i: number) => string;
}) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-2" style={{ height: "120px" }}>
      {data.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-1 flex-1 h-full justify-end">
          <div
            className={cn("w-full rounded-t", colorFn ? colorFn(i) : "bg-primary")}
            style={{ height: `${Math.max(4, (v / max) * 96)}px` }}
          />
          <span className="text-xs text-[var(--color-text-muted)] shrink-0">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

function DailyBarChart({ values }: { values: number[] }) {
  const max = Math.max(...values);
  return (
    <div className="flex items-end gap-px" style={{ height: "80px" }}>
      {values.map((v, i) => (
        <div
          key={i}
          title={`Day ${i + 1}: $${v}`}
          className="flex-1 rounded-t-sm bg-primary opacity-70 hover:opacity-100 transition-opacity cursor-default"
          style={{ height: `${Math.max(4, (v / max) * 76)}px` }}
        />
      ))}
    </div>
  );
}

// ─── Shared Badges ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: Severity }) {
  const map: Record<Severity, string> = {
    critical: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    high:     "bg-amber-500/20 text-amber-400 border-amber-500/30",
    medium:   "bg-yellow-500/20 text-yellow-400 border-yellow-600/30",
    low:      "bg-[var(--color-surface-3)]/40 text-[var(--color-text-secondary)] border-[var(--color-border)]",
  };
  return (
    <span className={cn("px-2 py-0.5 text-xs rounded-full border font-semibold capitalize", map[severity])}>
      {severity}
    </span>
  );
}

function EffortBadge({ effort }: { effort: Effort }) {
  const map: Record<Effort, string> = {
    low:    "bg-emerald-500/10 text-emerald-400",
    medium: "bg-amber-500/10 text-amber-400",
    high:   "bg-rose-500/10 text-rose-400",
  };
  return (
    <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium capitalize", map[effort])}>
      {effort} effort
    </span>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab() {
  const currentTotal  = SERVICES.reduce((sum, s) => sum + s.currentCost, 0);
  const lastTotal     = SERVICES.reduce((sum, s) => sum + s.lastMonthCost, 0);
  const forecasted    = Math.round(currentTotal * 1.095);
  const { pct, down } = pctChange(currentTotal, lastTotal);

  const monthlyTotals = MONTHS.map((_, mi) =>
    SERVICES.reduce((sum, s) => sum + (s.trend[mi] ?? 0), 0)
  );

  const topFive = [...SERVICES].toSorted((a, b) => b.currentCost - a.currentCost).slice(0, 5);

  const categories = Array.from(new Set(SERVICES.map((s) => s.category)));

  const kpis = [
    { label: "Current Month",    value: fmtCurrency(currentTotal), sub: "as of Feb 22",     cls: "text-[var(--color-text-primary)]"      },
    { label: "Last Month",       value: fmtCurrency(lastTotal),    sub: "January 2026",     cls: "text-[var(--color-text-primary)]"   },
    {
      label: "MoM Change",
      value: `${down ? "↓" : "↑"} ${pct.toFixed(1)}%`,
      sub:   down ? "Spend decreased" : "Spend increased",
      cls:   down ? "text-emerald-400" : "text-rose-400",
    },
    { label: "Forecast (Feb)",   value: fmtCurrency(forecasted),   sub: "YoY +18.4%",       cls: "text-amber-400"  },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">{k.label}</p>
            <p className={cn("text-2xl font-bold", k.cls)}>{k.value}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* 6-month trend */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-5">6-Month Cost Trend</h3>
        <VertBarChart
          data={monthlyTotals}
          labels={MONTHS}
          colorFn={(i) => (i === MONTHS.length - 1 ? "bg-primary" : "bg-indigo-900")}
        />
        <div className="mt-4 flex flex-wrap gap-3 border-t border-[var(--color-border)] pt-4">
          {categories.map((cat) => (
            <div key={cat} className="flex items-center gap-1.5">
              <div className={cn("w-2.5 h-2.5 rounded-sm", CATEGORY_COLORS[cat] ?? "bg-[var(--color-surface-3)]")} />
              <span className="text-xs text-[var(--color-text-secondary)]">{cat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top 5 drivers */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Top 5 Cost Drivers</h3>
        <div className="space-y-3">
          {topFive.map((s, i) => {
            const share = ((s.currentCost / currentTotal) * 100).toFixed(1);
            return (
              <div key={s.id} className="flex items-center gap-3">
                <span className="text-xs text-[var(--color-text-muted)] w-4 shrink-0">{i + 1}</span>
                <span className="text-sm text-[var(--color-text-primary)] w-36 shrink-0 truncate">{s.name}</span>
                <HorizBar
                  value={s.currentCost}
                  max={topFive[0].currentCost}
                  color={CATEGORY_COLORS[s.category] ?? "bg-primary"}
                />
                <span className="text-sm font-semibold text-[var(--color-text-primary)] w-16 text-right shrink-0">
                  {fmtCurrency(s.currentCost)}
                </span>
                <span className="text-xs text-[var(--color-text-muted)] w-12 text-right shrink-0">{share}%</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: By Service ──────────────────────────────────────────────────────────

function ServicesTab() {
  const [filter,   setFilter]   = useState("");
  const [selected, setSelected] = useState<ServiceData | null>(null);

  const filtered = SERVICES.filter(
    (s) =>
      s.name.toLowerCase().includes(filter.toLowerCase()) ||
      s.category.toLowerCase().includes(filter.toLowerCase())
  );

  if (selected) {
    const ch = pctChange(selected.currentCost, selected.lastMonthCost);
    return (
      <div className="space-y-5">
        <button
          onClick={() => setSelected(null)}
          className="text-sm text-primary hover:text-indigo-300 transition-colors"
        >
          ← Back to services
        </button>

        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5">
          <div className="flex items-start justify-between mb-5">
            <div>
              <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{selected.name}</h2>
              <span className="text-xs text-[var(--color-text-muted)]">{selected.category}</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-[var(--color-text-primary)]">{fmtCurrency(selected.currentCost)}</p>
              <p className={cn("text-xs mt-0.5", ch.down ? "text-emerald-400" : "text-rose-400")}>
                {ch.down ? "↓" : "↑"} {ch.pct.toFixed(1)}% vs last month
              </p>
            </div>
          </div>

          <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-3 uppercase tracking-wider">Daily Cost — Last 30 Days</p>
          <DailyBarChart values={selected.dailyCosts} />
          <div className="flex justify-between mt-1">
            <span className="text-xs text-[var(--color-text-muted)]">Feb 1</span>
            <span className="text-xs text-[var(--color-text-muted)]">Feb 22</span>
          </div>
        </div>

        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Resource Breakdown</p>
          <div className="space-y-2">
            {selected.resources.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-[var(--color-surface-2)] rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm text-[var(--color-text-primary)] font-medium">{r.name}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{r.type} · {r.region}</p>
                </div>
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{fmtCurrency(r.cost)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        placeholder="Filter by service or category..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-primary transition-colors"
      />
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2.5 border-b border-[var(--color-border)] text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
          <span className="col-span-3">Service</span>
          <span className="col-span-2 text-right">Cost</span>
          <span className="col-span-2 text-right">MoM</span>
          <span className="col-span-3 text-right">Per Unit</span>
          <span className="col-span-2 text-right">Trend</span>
        </div>
        {filtered.map((s) => {
          const ch = pctChange(s.currentCost, s.lastMonthCost);
          return (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className="w-full grid grid-cols-12 px-4 py-3 border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/40 text-left transition-colors last:border-0"
            >
              <div className="col-span-3">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">{s.name}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className={cn("w-1.5 h-1.5 rounded-full", CATEGORY_COLORS[s.category] ?? "bg-[var(--color-surface-3)]")} />
                  <span className="text-xs text-[var(--color-text-muted)]">{s.category}</span>
                </div>
              </div>
              <span className="col-span-2 text-sm font-semibold text-[var(--color-text-primary)] text-right self-center">
                {fmtCurrency(s.currentCost)}
              </span>
              <span className={cn("col-span-2 text-xs font-semibold text-right self-center", ch.down ? "text-emerald-400" : "text-rose-400")}>
                {ch.down ? "↓" : "↑"}{ch.pct.toFixed(1)}%
              </span>
              <span className="col-span-3 text-xs text-[var(--color-text-secondary)] text-right self-center font-mono">
                ${s.costPerUnit.toFixed(4)}{s.unitLabel}
              </span>
              <div className="col-span-2 self-center flex justify-end">
                <MiniBar values={s.trend} color={CATEGORY_COLORS[s.category] ?? "bg-primary"} />
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-sm text-[var(--color-text-muted)] text-center py-10">No services match your filter.</p>
        )}
      </div>
    </div>
  );
}

// ─── Tab: Anomalies ───────────────────────────────────────────────────────────

function AnomaliesTab() {
  const [resolvedIds, setResolvedIds] = useState<string[]>([]);

  const markResolved   = (id: string) => setResolvedIds((prev) => [...prev, id]);
  const markUnresolved = (id: string) => setResolvedIds((prev) => prev.filter((x) => x !== id));

  const active   = ANOMALIES.filter((a) => !resolvedIds.includes(a.id));
  const resolved = ANOMALIES.filter((a) =>  resolvedIds.includes(a.id));
  const totalWaste = active.reduce((sum, a) => sum + a.estimatedWaste, 0);

  const actionColor: Record<string, string> = {
    terminate:   "text-rose-400",
    "right-size": "text-amber-400",
    reserved:    "text-primary",
  };

  return (
    <div className="space-y-5">
      {/* Banner */}
      <div className="flex items-center justify-between bg-rose-500/10 border border-rose-500/20 rounded-xl px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-rose-400">{active.length} Active Anomalies</p>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            Est. waste:{" "}
            <span className="font-semibold text-rose-400">{fmtCurrency(totalWaste)}/mo</span>
          </p>
        </div>
        <div className="w-10 h-10 bg-rose-500/20 rounded-full flex items-center justify-center text-xl">
          ⚠
        </div>
      </div>

      {/* Active anomalies */}
      {active.length === 0 && (
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-10 text-center">
          <p className="text-[var(--color-text-muted)] text-sm">All anomalies resolved 🎉</p>
        </div>
      )}
      {active.map((a) => (
        <div key={a.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-center gap-2 flex-wrap">
              <SeverityBadge severity={a.severity} />
              <span className="text-xs text-[var(--color-text-muted)]">{a.detectedAt}</span>
            </div>
            <button
              onClick={() => markResolved(a.id)}
              className="text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] px-3 py-1.5 rounded-lg transition-colors shrink-0 font-medium"
            >
              Mark resolved
            </button>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">{a.description}</p>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Resource:{" "}
            <span className="text-[var(--color-text-primary)] font-mono">{a.resource}</span>
          </p>
          <div className="flex items-center justify-between bg-[var(--color-surface-2)] rounded-lg px-4 py-2.5">
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Estimated waste</p>
              <p className="text-sm font-bold text-rose-400">{fmtCurrency(a.estimatedWaste)}/mo</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--color-text-muted)] mb-0.5">Recommended action</p>
              <p className={cn("text-sm font-semibold capitalize", actionColor[a.recommendedAction] ?? "text-[var(--color-text-secondary)]")}>
                {a.recommendedAction}
              </p>
            </div>
          </div>
        </div>
      ))}

      {/* Resolved section */}
      {resolved.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[var(--color-text-muted)] font-semibold uppercase tracking-wider px-1">
            Resolved ({resolved.length})
          </p>
          {resolved.map((a) => (
            <div key={a.id} className="bg-[var(--color-surface-1)]/50 border border-[var(--color-border)]/50 rounded-xl px-5 py-3 opacity-50 hover:opacity-70 transition-opacity">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <SeverityBadge severity={a.severity} />
                  <p className="text-sm text-[var(--color-text-secondary)] truncate">{a.description}</p>
                </div>
                <button
                  onClick={() => markUnresolved(a.id)}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors shrink-0"
                >
                  Reopen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Savings ─────────────────────────────────────────────────────────────

function SavingsTab() {
  const [filter, setFilter] = useState<"all" | SavingsType>("all");

  const totalSavings = SAVINGS.reduce((sum, s) => sum + s.monthlySavings, 0);

  const byType: Record<SavingsType, number> = {
    reserved:    SAVINGS.filter((s) => s.type === "reserved").reduce((n, s) => n + s.monthlySavings, 0),
    rightsizing: SAVINGS.filter((s) => s.type === "rightsizing").reduce((n, s) => n + s.monthlySavings, 0),
    idle:        SAVINGS.filter((s) => s.type === "idle").reduce((n, s) => n + s.monthlySavings, 0),
  };

  const typeAccent: Record<SavingsType, string> = {
    reserved:    "text-primary",
    rightsizing: "text-amber-400",
    idle:        "text-rose-400",
  };

  const typeActive: Record<SavingsType, string> = {
    reserved:    "bg-primary text-[var(--color-text-primary)]",
    rightsizing: "bg-amber-600 text-[var(--color-text-primary)]",
    idle:        "bg-rose-600 text-[var(--color-text-primary)]",
  };

  const filtered = filter === "all" ? SAVINGS : SAVINGS.filter((s) => s.type === filter);

  const filterOptions: ("all" | SavingsType)[] = ["all", "reserved", "rightsizing", "idle"];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center">
        <p className="text-sm text-[var(--color-text-secondary)] mb-1">Total Potential Monthly Savings</p>
        <p className="text-5xl font-bold text-emerald-400">{fmtCurrency(totalSavings)}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          {fmtCurrency(totalSavings * 12)}/yr · {SAVINGS.length} recommendations
        </p>
      </div>

      {/* Breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {(["reserved", "rightsizing", "idle"] as SavingsType[]).map((t) => (
          <div key={t} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 text-center">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">{TYPE_LABELS[t]}</p>
            <p className={cn("text-xl font-bold", typeAccent[t])}>{fmtCurrency(byType[t])}</p>
            <p className="text-xs text-[var(--color-text-muted)]">/mo</p>
          </div>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {filterOptions.map((opt) => (
          <button
            key={opt}
            onClick={() => setFilter(opt)}
            className={cn(
              "px-3 py-1.5 text-xs rounded-lg font-medium transition-colors capitalize",
              filter === opt
                ? opt === "all" ? "bg-primary text-[var(--color-text-primary)]" : typeActive[opt]
                : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)]"
            )}
          >
            {opt === "all" ? "All" : TYPE_LABELS[opt]}
          </button>
        ))}
      </div>

      {/* Recommendation cards */}
      <div className="space-y-3">
        {filtered.map((rec) => (
          <div key={rec.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={cn("text-xs font-semibold uppercase tracking-wide", typeAccent[rec.type])}>
                    {TYPE_LABELS[rec.type]}
                  </span>
                  <span className="text-[var(--color-text-muted)] text-xs">·</span>
                  <span className="text-xs text-[var(--color-text-muted)]">{rec.service}</span>
                  <EffortBadge effort={rec.effort} />
                </div>
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{rec.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-bold text-emerald-400">{fmtCurrency(rec.monthlySavings)}</p>
                <p className="text-xs text-[var(--color-text-muted)]">saved/mo</p>
              </div>
            </div>

            {rec.currentInstance && rec.recommendedInstance && (
              <div className="flex items-stretch gap-2 bg-[var(--color-surface-2)] rounded-lg p-3 mb-3">
                <div className="flex-1 text-center">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Current</p>
                  <p className="text-xs font-mono text-[var(--color-text-primary)]">{rec.currentInstance}</p>
                  <p className="text-sm font-bold text-[var(--color-text-primary)] mt-1">{fmtCurrency(rec.currentCost)}/mo</p>
                </div>
                <div className="flex items-center text-[var(--color-text-muted)] text-sm">→</div>
                <div className="flex-1 text-center">
                  <p className="text-xs text-[var(--color-text-muted)] mb-1">Recommended</p>
                  <p className="text-xs font-mono text-[var(--color-text-primary)]">{rec.recommendedInstance}</p>
                  <p className="text-sm font-bold text-emerald-400 mt-1">{fmtCurrency(rec.optimizedCost)}/mo</p>
                </div>
              </div>
            )}

            <button className="w-full bg-primary hover:bg-primary text-[var(--color-text-primary)] text-xs font-semibold py-2 rounded-lg transition-colors">
              Apply Recommendation
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function CostBreakdownAnalyzer() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const tabs: { id: Tab; label: string; badge?: string; badgeCls?: string }[] = [
    { id: "overview",   label: "Overview"   },
    { id: "services",   label: "By Service" },
    { id: "anomalies",  label: "Anomalies",  badge: "6",  badgeCls: "bg-rose-500"    },
    { id: "savings",    label: "Savings",    badge: "9",  badgeCls: "bg-emerald-600" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Cost Breakdown Analyzer</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">AWS · All Regions · February 2026</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--color-text-muted)]">Data source</p>
            <p className="text-xs font-mono text-[var(--color-text-secondary)]">http://127.0.0.1:8080/api/costs</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-1 mb-6">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-sm font-medium rounded-lg transition-colors",
                activeTab === t.id
                  ? "bg-primary text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              {t.label}
              {t.badge && (
                <span className={cn("text-xs font-bold text-[var(--color-text-primary)] px-1.5 py-0.5 rounded-full leading-none", t.badgeCls)}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "overview"  && <OverviewTab  />}
        {activeTab === "services"  && <ServicesTab  />}
        {activeTab === "anomalies" && <AnomaliesTab />}
        {activeTab === "savings"   && <SavingsTab   />}
      </div>
    </div>
  );
}
