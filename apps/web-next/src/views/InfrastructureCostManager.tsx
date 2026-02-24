import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = "AWS" | "GCP" | "Azure";
type ResourceType = "Compute" | "Storage" | "Network" | "Database" | "Cache" | "Queue" | "CDN" | "DNS";
type EffortLevel = "low" | "medium" | "high";
type RecommendationType = "rightsizing" | "reserved" | "idle" | "storage" | "network";
type TabId = "overview" | "resources" | "budgets" | "recommendations";

interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  provider: Provider;
  region: string;
  monthlyCost: number;
  tags: string[];
  costHistory: number[];
  rightsizingRec: string | null;
  rightsizingSavings: number | null;
  utilization: number;
  instanceType: string;
}

interface Budget {
  id: string;
  name: string;
  category: string;
  allocated: number;
  spent: number;
  forecast: number;
  alertThreshold: number;
  period: string;
  notes: string;
  owner: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  type: RecommendationType;
  provider: Provider;
  resourceName: string;
  estimatedSavings: number;
  effort: EffortLevel;
  dismissed: boolean;
  applied: boolean;
  priority: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const RESOURCES: Resource[] = [
  {
    id: "r-001",
    name: "prod-api-cluster",
    type: "Compute",
    provider: "AWS",
    region: "us-east-1",
    monthlyCost: 4820.5,
    tags: ["production", "api", "critical"],
    costHistory: [3900, 4100, 4250, 4180, 4400, 4550, 4620, 4700, 4750, 4800, 4810, 4820],
    rightsizingRec: "Downsize from m5.2xlarge to m5.xlarge — peak CPU avg 38%",
    rightsizingSavings: 1240,
    utilization: 38,
    instanceType: "m5.2xlarge x6",
  },
  {
    id: "r-002",
    name: "data-warehouse-prod",
    type: "Database",
    provider: "GCP",
    region: "us-central1",
    monthlyCost: 3610.0,
    tags: ["production", "analytics", "bigquery"],
    costHistory: [2800, 2950, 3100, 3200, 3300, 3400, 3450, 3500, 3520, 3580, 3600, 3610],
    rightsizingRec: null,
    rightsizingSavings: null,
    utilization: 74,
    instanceType: "BigQuery On-Demand",
  },
  {
    id: "r-003",
    name: "cdn-global-assets",
    type: "CDN",
    provider: "AWS",
    region: "global",
    monthlyCost: 2140.75,
    tags: ["production", "cdn", "assets"],
    costHistory: [1800, 1850, 1900, 1950, 2000, 2050, 2080, 2100, 2110, 2120, 2135, 2140],
    rightsizingRec: "Enable CloudFront compression — est. 15% bandwidth reduction",
    rightsizingSavings: 321,
    utilization: 62,
    instanceType: "CloudFront",
  },
  {
    id: "r-004",
    name: "postgres-primary",
    type: "Database",
    provider: "AWS",
    region: "us-east-1",
    monthlyCost: 1890.0,
    tags: ["production", "postgres", "rds"],
    costHistory: [1700, 1720, 1750, 1780, 1800, 1820, 1840, 1860, 1870, 1875, 1885, 1890],
    rightsizingRec: "Switch to Aurora Serverless v2 for variable workloads",
    rightsizingSavings: 560,
    utilization: 55,
    instanceType: "db.r6g.2xlarge",
  },
  {
    id: "r-005",
    name: "ml-training-vms",
    type: "Compute",
    provider: "GCP",
    region: "us-west1",
    monthlyCost: 5430.0,
    tags: ["ml", "training", "gpu"],
    costHistory: [2100, 3200, 4100, 3800, 4500, 5000, 5100, 5200, 5300, 5350, 5400, 5430],
    rightsizingRec: "Use preemptible/spot instances for batch training jobs",
    rightsizingSavings: 2172,
    utilization: 45,
    instanceType: "n1-standard-32 + T4 GPU x3",
  },
  {
    id: "r-006",
    name: "blob-storage-archive",
    type: "Storage",
    provider: "Azure",
    region: "eastus",
    monthlyCost: 890.25,
    tags: ["archive", "compliance", "cold"],
    costHistory: [780, 800, 810, 825, 840, 850, 860, 870, 875, 880, 885, 890],
    rightsizingRec: "Move data older than 90 days to Archive tier",
    rightsizingSavings: 267,
    utilization: 88,
    instanceType: "Azure Blob Cool + Archive",
  },
  {
    id: "r-007",
    name: "redis-session-cache",
    type: "Cache",
    provider: "AWS",
    region: "us-east-1",
    monthlyCost: 640.0,
    tags: ["production", "cache", "session"],
    costHistory: [580, 590, 600, 610, 615, 620, 625, 628, 630, 635, 638, 640],
    rightsizingRec: "Reduce cluster from 6 nodes to 4 — memory utilization avg 41%",
    rightsizingSavings: 213,
    utilization: 41,
    instanceType: "cache.r6g.large x6",
  },
  {
    id: "r-008",
    name: "event-bus-queues",
    type: "Queue",
    provider: "AWS",
    region: "us-east-1",
    monthlyCost: 320.5,
    tags: ["production", "sqs", "events"],
    costHistory: [280, 285, 290, 295, 300, 305, 308, 310, 312, 315, 318, 320],
    rightsizingRec: null,
    rightsizingSavings: null,
    utilization: 67,
    instanceType: "SQS Standard + FIFO",
  },
  {
    id: "r-009",
    name: "dev-k8s-cluster",
    type: "Compute",
    provider: "GCP",
    region: "us-central1",
    monthlyCost: 1240.0,
    tags: ["development", "k8s", "non-prod"],
    costHistory: [1100, 1120, 1150, 1180, 1200, 1210, 1215, 1220, 1225, 1230, 1235, 1240],
    rightsizingRec: "Schedule cluster shutdown outside business hours (weeknights + weekends)",
    rightsizingSavings: 868,
    utilization: 22,
    instanceType: "GKE Autopilot",
  },
  {
    id: "r-010",
    name: "vpc-nat-gateways",
    type: "Network",
    provider: "AWS",
    region: "us-east-1",
    monthlyCost: 480.0,
    tags: ["production", "network", "nat"],
    costHistory: [400, 420, 430, 440, 450, 455, 460, 465, 468, 470, 475, 480],
    rightsizingRec: "Consolidate NAT Gateways from 3 AZs to shared endpoint in dev/staging",
    rightsizingSavings: 144,
    utilization: 30,
    instanceType: "NAT Gateway x3",
  },
];

const BUDGETS: Budget[] = [
  {
    id: "b-001",
    name: "Production Infrastructure",
    category: "Compute & Database",
    allocated: 18000,
    spent: 16780,
    forecast: 19200,
    alertThreshold: 90,
    period: "Feb 2026",
    notes: "Includes API cluster, RDS, and Redis. ML training VMs budgeted separately. Watch for forecast overage — spike from new data pipeline.",
    owner: "Platform Core",
  },
  {
    id: "b-002",
    name: "ML & Data Platform",
    category: "Compute & Storage",
    allocated: 7500,
    spent: 9040,
    forecast: 9800,
    alertThreshold: 80,
    period: "Feb 2026",
    notes: "Over budget due to unplanned training runs for new recommendation model. Working with ML team to switch to spot instances. Xavier approved temporary overage.",
    owner: "ML Squad",
  },
  {
    id: "b-003",
    name: "Development & Staging",
    category: "All Resources",
    allocated: 4000,
    spent: 2890,
    forecast: 3100,
    alertThreshold: 85,
    period: "Feb 2026",
    notes: "Under budget. Consider scheduling automation to reduce further. Dev K8s cluster is primary driver — recommend auto-shutdown policy.",
    owner: "Product & UI Squad",
  },
  {
    id: "b-004",
    name: "CDN & Networking",
    category: "Network & CDN",
    allocated: 3500,
    spent: 3140,
    forecast: 3480,
    alertThreshold: 92,
    period: "Feb 2026",
    notes: "Approaching threshold. Asset optimization initiative should reduce CDN costs by Q2. NAT gateway consolidation in progress.",
    owner: "Platform Core",
  },
  {
    id: "b-005",
    name: "Azure Archive & Compliance",
    category: "Storage",
    allocated: 1200,
    spent: 890,
    forecast: 960,
    alertThreshold: 80,
    period: "Feb 2026",
    notes: "Compliance data storage. Steady growth pattern. Migration to archive tier planned for March will reduce costs by ~30%.",
    owner: "Infrastructure",
  },
];

const RECOMMENDATIONS: Recommendation[] = [
  {
    id: "rec-001",
    title: "Rightsize prod-api-cluster",
    description: "EC2 instances in prod-api-cluster are running at 38% average CPU utilization. Downsizing from m5.2xlarge to m5.xlarge across 6 nodes would maintain headroom while significantly reducing cost. Load testing confirms this handles 2x current peak traffic.",
    type: "rightsizing",
    provider: "AWS",
    resourceName: "prod-api-cluster",
    estimatedSavings: 1240,
    effort: "medium",
    dismissed: false,
    applied: false,
    priority: 1,
  },
  {
    id: "rec-002",
    title: "Switch ML training to spot/preemptible instances",
    description: "ml-training-vms uses on-demand GPU instances for batch training jobs that are fault-tolerant and can be checkpointed. Switching to preemptible instances (GCP) provides 60-80% savings with negligible impact on training throughput for non-time-sensitive jobs.",
    type: "rightsizing",
    provider: "GCP",
    resourceName: "ml-training-vms",
    estimatedSavings: 2172,
    effort: "low",
    dismissed: false,
    applied: false,
    priority: 2,
  },
  {
    id: "rec-003",
    title: "Purchase Reserved Instances for RDS",
    description: "postgres-primary has run continuously for 14+ months with stable usage. Converting from on-demand to a 1-year reserved instance (partial upfront) delivers ~31% savings. The instance type and size are unlikely to change given stable workload patterns.",
    type: "reserved",
    provider: "AWS",
    resourceName: "postgres-primary",
    estimatedSavings: 587,
    effort: "low",
    dismissed: false,
    applied: false,
    priority: 3,
  },
  {
    id: "rec-004",
    title: "Schedule dev-k8s-cluster auto-shutdown",
    description: "dev-k8s-cluster is running 24/7 but shows near-zero traffic outside 09:00–19:00 weekdays. Implementing a scheduled shutdown policy (weeknights + weekends) reduces active hours from 720 to ~250/month — a 65% reduction in compute cost.",
    type: "idle",
    provider: "GCP",
    resourceName: "dev-k8s-cluster",
    estimatedSavings: 868,
    effort: "low",
    dismissed: false,
    applied: false,
    priority: 4,
  },
  {
    id: "rec-005",
    title: "Enable CloudFront compression & caching optimization",
    description: "cdn-global-assets serves uncompressed JS/CSS assets and has suboptimal cache TTLs causing high origin request rates. Enabling Gzip/Brotli compression and extending cache TTLs to 7 days for static assets will reduce bandwidth costs and origin load.",
    type: "network",
    provider: "AWS",
    resourceName: "cdn-global-assets",
    estimatedSavings: 321,
    effort: "low",
    dismissed: false,
    applied: false,
    priority: 5,
  },
  {
    id: "rec-006",
    title: "Reduce Redis cluster size",
    description: "redis-session-cache cluster of 6 nodes shows 41% average memory utilization with a peak of 68%. Reducing to 4 nodes provides sufficient capacity (2x peak headroom) while removing 2 underutilized nodes. Rolling replacement ensures zero downtime.",
    type: "rightsizing",
    provider: "AWS",
    resourceName: "redis-session-cache",
    estimatedSavings: 213,
    effort: "medium",
    dismissed: false,
    applied: false,
    priority: 6,
  },
  {
    id: "rec-007",
    title: "Migrate cold Azure blobs to Archive tier",
    description: "blob-storage-archive contains 42TB of compliance data with access frequency under 0.2% per month. Moving data older than 90 days from Cool to Archive tier reduces per-GB storage cost from $0.01 to $0.00099. Retrieval SLA shift from ms to hours is acceptable for compliance archives.",
    type: "storage",
    provider: "Azure",
    resourceName: "blob-storage-archive",
    estimatedSavings: 267,
    effort: "low",
    dismissed: false,
    applied: false,
    priority: 7,
  },
  {
    id: "rec-008",
    title: "Consolidate NAT Gateways in dev/staging",
    description: "vpc-nat-gateways deploys one NAT Gateway per AZ in dev and staging environments. Production multi-AZ redundancy is justified, but dev/staging can share a single NAT Gateway with minimal availability risk. This eliminates 4 of 6 non-prod NAT Gateways.",
    type: "idle",
    provider: "AWS",
    resourceName: "vpc-nat-gateways",
    estimatedSavings: 144,
    effort: "medium",
    dismissed: false,
    applied: false,
    priority: 8,
  },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatCurrencyFull(amount: number): string {
  return "$" + amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getBudgetStatus(spent: number, allocated: number, threshold: number): "safe" | "warning" | "danger" {
  const pct = (spent / allocated) * 100;
  if (pct >= 100) {return "danger";}
  if (pct >= threshold) {return "warning";}
  return "safe";
}

function getBudgetStatusColor(status: "safe" | "warning" | "danger"): string {
  if (status === "danger") {return "bg-rose-500";}
  if (status === "warning") {return "bg-amber-400";}
  return "bg-emerald-500";
}

function getBudgetTextColor(status: "safe" | "warning" | "danger"): string {
  if (status === "danger") {return "text-rose-400";}
  if (status === "warning") {return "text-amber-400";}
  return "text-emerald-400";
}

function getEffortColor(effort: EffortLevel): string {
  if (effort === "low") {return "text-emerald-400 bg-emerald-400/10";}
  if (effort === "medium") {return "text-amber-400 bg-amber-400/10";}
  return "text-rose-400 bg-rose-400/10";
}

function getProviderColor(provider: Provider): string {
  if (provider === "AWS") {return "text-amber-400 bg-amber-400/10";}
  if (provider === "GCP") {return "text-blue-400 bg-blue-400/10";}
  return "text-indigo-400 bg-indigo-400/10";
}

function getTypeColor(type: ResourceType): string {
  const map: Record<ResourceType, string> = {
    Compute: "text-violet-400 bg-violet-400/10",
    Storage: "text-cyan-400 bg-cyan-400/10",
    Network: "text-sky-400 bg-sky-400/10",
    Database: "text-emerald-400 bg-emerald-400/10",
    Cache: "text-orange-400 bg-orange-400/10",
    Queue: "text-pink-400 bg-pink-400/10",
    CDN: "text-teal-400 bg-teal-400/10",
    DNS: "text-slate-400 bg-slate-400/10",
  };
  return map[type];
}

function getRecTypeLabel(type: RecommendationType): string {
  const map: Record<RecommendationType, string> = {
    rightsizing: "Rightsizing",
    reserved: "Reserved Instance",
    idle: "Idle Resource",
    storage: "Storage Tier",
    network: "Network Opt.",
  };
  return map[type];
}

function getRecTypeColor(type: RecommendationType): string {
  const map: Record<RecommendationType, string> = {
    rightsizing: "text-violet-400 bg-violet-400/10",
    reserved: "text-indigo-400 bg-indigo-400/10",
    idle: "text-rose-400 bg-rose-400/10",
    storage: "text-cyan-400 bg-cyan-400/10",
    network: "text-sky-400 bg-sky-400/10",
  };
  return map[type];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", className)}>
      {children}
    </span>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-zinc-900 border border-zinc-800 rounded-lg", className)}>
      {children}
    </div>
  );
}

function ProgressBar({
  value,
  max,
  colorClass,
  height = "h-2",
}: {
  value: number;
  max: number;
  colorClass: string;
  height?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div className={cn("w-full bg-zinc-800 rounded-full overflow-hidden", height)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", colorClass)}
        style={{ width: pct + "%" }}
      />
    </div>
  );
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────

function OverviewTab() {
  const totalCompute = RESOURCES.filter((r) => r.type === "Compute").reduce((s, r) => s + r.monthlyCost, 0);
  const totalStorage = RESOURCES.filter((r) => r.type === "Storage").reduce((s, r) => s + r.monthlyCost, 0);
  const totalNetwork = RESOURCES.filter((r) => r.type === "Network" || r.type === "CDN" || r.type === "DNS").reduce((s, r) => s + r.monthlyCost, 0);
  const totalDatabase = RESOURCES.filter((r) => r.type === "Database").reduce((s, r) => s + r.monthlyCost, 0);
  const grandTotal = RESOURCES.reduce((s, r) => s + r.monthlyCost, 0);

  const awsTotal = RESOURCES.filter((r) => r.provider === "AWS").reduce((s, r) => s + r.monthlyCost, 0);
  const gcpTotal = RESOURCES.filter((r) => r.provider === "GCP").reduce((s, r) => s + r.monthlyCost, 0);
  const azureTotal = RESOURCES.filter((r) => r.provider === "Azure").reduce((s, r) => s + r.monthlyCost, 0);
  const maxProvider = Math.max(awsTotal, gcpTotal, azureTotal);

  const budgetTotal = BUDGETS.reduce((s, b) => s + b.allocated, 0);
  const spentTotal = BUDGETS.reduce((s, b) => s + b.spent, 0);

  const topResources = [...RESOURCES].toSorted((a, b) => b.monthlyCost - a.monthlyCost).slice(0, 6);

  const summaryCards = [
    { label: "Compute", value: totalCompute, color: "text-violet-400", bg: "bg-violet-400/10", pct: (totalCompute / grandTotal) * 100 },
    { label: "Database", value: totalDatabase, color: "text-emerald-400", bg: "bg-emerald-400/10", pct: (totalDatabase / grandTotal) * 100 },
    { label: "Network & CDN", value: totalNetwork, color: "text-sky-400", bg: "bg-sky-400/10", pct: (totalNetwork / grandTotal) * 100 },
    { label: "Storage", value: totalStorage, color: "text-cyan-400", bg: "bg-cyan-400/10", pct: (totalStorage / grandTotal) * 100 },
  ];

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {summaryCards.map((c) => (
          <Card key={c.label} className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">{c.label}</span>
              <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", c.color, c.bg)}>
                {c.pct.toFixed(1)}%
              </span>
            </div>
            <div className={cn("text-2xl font-bold", c.color)}>{formatCurrency(c.value)}</div>
            <div className="mt-2">
              <ProgressBar value={c.value} max={grandTotal} colorClass={c.color.replace("text-", "bg-")} />
            </div>
          </Card>
        ))}
      </div>

      {/* Total cost banner */}
      <Card className="p-4 flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-400 mb-1">Total Monthly Spend</div>
          <div className="text-3xl font-bold text-white">{formatCurrencyFull(grandTotal)}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-zinc-400 mb-1">vs Budget</div>
          <div className={cn("text-xl font-semibold", spentTotal > budgetTotal ? "text-rose-400" : "text-emerald-400")}>
            {spentTotal > budgetTotal ? "+" : ""}{formatCurrency(spentTotal - budgetTotal)}
          </div>
          <div className="text-xs text-zinc-500">{((spentTotal / budgetTotal) * 100).toFixed(1)}% of {formatCurrency(budgetTotal)} budget</div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Budget vs Actual */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Budget vs Actual — Feb 2026</h3>
          <div className="space-y-4">
            {BUDGETS.map((b) => {
              const status = getBudgetStatus(b.spent, b.allocated, b.alertThreshold);
              const pct = (b.spent / b.allocated) * 100;
              return (
                <div key={b.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-zinc-300 truncate max-w-[180px]">{b.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn("text-xs font-medium", getBudgetTextColor(status))}>
                        {pct.toFixed(0)}%
                      </span>
                      <span className="text-xs text-zinc-500">{formatCurrency(b.spent)} / {formatCurrency(b.allocated)}</span>
                    </div>
                  </div>
                  <ProgressBar value={b.spent} max={b.allocated} colorClass={getBudgetStatusColor(status)} />
                </div>
              );
            })}
          </div>
        </Card>

        {/* Provider Breakdown */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-white mb-4">Provider Breakdown</h3>
          <div className="space-y-5">
            {[
              { name: "AWS" as Provider, total: awsTotal },
              { name: "GCP" as Provider, total: gcpTotal },
              { name: "Azure" as Provider, total: azureTotal },
            ].map((p) => (
              <div key={p.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <Badge className={getProviderColor(p.name)}>{p.name}</Badge>
                    <span className="text-sm text-zinc-400">{((p.total / grandTotal) * 100).toFixed(1)}% of spend</span>
                  </div>
                  <span className="text-sm font-medium text-white">{formatCurrency(p.total)}</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      p.name === "AWS" ? "bg-amber-400" : p.name === "GCP" ? "bg-blue-400" : "bg-indigo-400"
                    )}
                    style={{ width: ((p.total / maxProvider) * 100) + "%" }}
                  />
                </div>
              </div>
            ))}

            <div className="pt-2 border-t border-zinc-800">
              <div className="text-xs text-zinc-500 mb-2">Resource count by provider</div>
              <div className="flex gap-3">
                {(["AWS", "GCP", "Azure"] as Provider[]).map((p) => {
                  const count = RESOURCES.filter((r) => r.provider === p).length;
                  return (
                    <div key={p} className="flex items-center gap-1.5">
                      <Badge className={getProviderColor(p)}>{p}</Badge>
                      <span className="text-xs text-zinc-400">{count} resources</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Top Spending Resources */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Top Spending Resources</h3>
        <div className="space-y-2">
          {topResources.map((r, i) => (
            <div key={r.id} className="flex items-center gap-3 py-2 border-b border-zinc-800 last:border-0">
              <span className="text-zinc-600 text-sm w-5 text-right">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-medium text-white truncate">{r.name}</span>
                  <Badge className={getTypeColor(r.type)}>{r.type}</Badge>
                  <Badge className={getProviderColor(r.provider)}>{r.provider}</Badge>
                </div>
                <div className="text-xs text-zinc-500">{r.region} · {r.instanceType}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-white">{formatCurrency(r.monthlyCost)}<span className="text-zinc-500 text-xs">/mo</span></div>
                <div className="w-24 mt-1">
                  <ProgressBar value={r.monthlyCost} max={topResources[0].monthlyCost} colorClass="bg-indigo-500" height="h-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Resources Tab ────────────────────────────────────────────────────────────

const MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"];

function ResourcesTab() {
  const [search, setSearch] = useState("");
  const [filterProvider, setFilterProvider] = useState<Provider | "All">("All");
  const [filterType, setFilterType] = useState<ResourceType | "All">("All");
  const [selectedId, setSelectedId] = useState<string>(RESOURCES[0].id);

  const filtered = RESOURCES.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = r.name.toLowerCase().includes(q) || r.tags.some((t) => t.toLowerCase().includes(q));
    const matchProvider = filterProvider === "All" || r.provider === filterProvider;
    const matchType = filterType === "All" || r.type === filterType;
    return matchSearch && matchProvider && matchType;
  });

  const selected = RESOURCES.find((r) => r.id === selectedId) ?? RESOURCES[0];
  const maxCostHistory = Math.max(...selected.costHistory);

  return (
    <div className="flex gap-4 h-full" style={{ minHeight: "600px" }}>
      {/* Left Panel */}
      <div className="w-80 shrink-0 flex flex-col gap-3">
        {/* Search + filters */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Search resources or tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-md px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <div className="flex gap-2">
            <select
              value={filterProvider}
              onChange={(e) => setFilterProvider(e.target.value as Provider | "All")}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All Providers</option>
              <option value="AWS">AWS</option>
              <option value="GCP">GCP</option>
              <option value="Azure">Azure</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as ResourceType | "All")}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-md px-2 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
            >
              <option value="All">All Types</option>
              <option value="Compute">Compute</option>
              <option value="Database">Database</option>
              <option value="Storage">Storage</option>
              <option value="Network">Network</option>
              <option value="Cache">Cache</option>
              <option value="Queue">Queue</option>
              <option value="CDN">CDN</option>
            </select>
          </div>
          <div className="text-xs text-zinc-500">{filtered.length} of {RESOURCES.length} resources</div>
        </div>

        {/* Resource List */}
        <div className="flex-1 overflow-y-auto space-y-1.5">
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => setSelectedId(r.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-colors",
                selectedId === r.id
                  ? "bg-indigo-600/20 border-indigo-500/50"
                  : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-white truncate">{r.name}</span>
                <span className="text-sm font-semibold text-white shrink-0 ml-2">{formatCurrency(r.monthlyCost)}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge className={getTypeColor(r.type)}>{r.type}</Badge>
                <Badge className={getProviderColor(r.provider)}>{r.provider}</Badge>
                <span className="text-xs text-zinc-500">{r.region}</span>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-zinc-500 text-sm">No resources match your filters</div>
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 min-w-0 space-y-4">
        <Card className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-white">{selected.name}</h2>
              <div className="text-sm text-zinc-400 mt-0.5">{selected.instanceType} · {selected.region}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-white">{formatCurrencyFull(selected.monthlyCost)}</div>
              <div className="text-xs text-zinc-500">per month</div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getTypeColor(selected.type)}>{selected.type}</Badge>
            <Badge className={getProviderColor(selected.provider)}>{selected.provider}</Badge>
            <span className="text-xs text-zinc-400">Utilization:</span>
            <span className={cn("text-xs font-medium", selected.utilization < 40 ? "text-rose-400" : selected.utilization < 70 ? "text-amber-400" : "text-emerald-400")}>
              {selected.utilization}%
            </span>
            {selected.tags.map((tag) => (
              <Badge key={tag} className="text-zinc-300 bg-zinc-800">{tag}</Badge>
            ))}
          </div>
        </Card>

        {/* Cost History Chart */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-white mb-4">12-Month Cost History</h3>
          <div className="flex items-end gap-1.5" style={{ height: "120px" }}>
            {selected.costHistory.map((cost, i) => {
              const heightPct = (cost / maxCostHistory) * 100;
              const isLast = i === selected.costHistory.length - 1;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end" style={{ height: "96px" }}>
                    <div
                      className={cn("w-full rounded-t transition-all duration-300", isLast ? "bg-indigo-500" : "bg-zinc-700 hover:bg-zinc-600")}
                      style={{ height: heightPct + "%" }}
                      title={formatCurrency(cost)}
                    />
                  </div>
                  <span className="text-xs text-zinc-500">{MONTHS[i]}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-zinc-500">
            <span>Min: {formatCurrency(Math.min(...selected.costHistory))}</span>
            <span>Max: {formatCurrency(maxCostHistory)}</span>
            <span>Avg: {formatCurrency(Math.round(selected.costHistory.reduce((a, b) => a + b, 0) / selected.costHistory.length))}</span>
          </div>
        </Card>

        {/* Rightsizing */}
        {selected.rightsizingRec && selected.rightsizingSavings && (
          <Card className="p-4 border-amber-500/30">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-400/10 flex items-center justify-center shrink-0">
                <span className="text-amber-400 text-sm font-bold">!</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="text-sm font-semibold text-amber-400">Rightsizing Recommendation</h4>
                  <span className="text-sm font-semibold text-emerald-400">
                    Save {formatCurrency(selected.rightsizingSavings)}/mo
                  </span>
                </div>
                <p className="text-sm text-zinc-400">{selected.rightsizingRec}</p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Budgets Tab ──────────────────────────────────────────────────────────────

function BudgetsTab() {
  const [selectedBudgetId, setSelectedBudgetId] = useState<string>(BUDGETS[0].id);
  const selected = BUDGETS.find((b) => b.id === selectedBudgetId) ?? BUDGETS[0];
  const status = getBudgetStatus(selected.spent, selected.allocated, selected.alertThreshold);

  const totalSavingsAvailable = RECOMMENDATIONS.filter((r) => !r.dismissed && !r.applied).reduce((s, r) => s + r.estimatedSavings, 0);

  return (
    <div className="flex gap-4" style={{ minHeight: "600px" }}>
      {/* Budget List */}
      <div className="w-72 shrink-0 space-y-2">
        <div className="text-xs text-zinc-500 mb-3">
          {BUDGETS.length} budgets · {formatCurrency(totalSavingsAvailable)}/mo optimization available
        </div>
        {BUDGETS.map((b) => {
          const st = getBudgetStatus(b.spent, b.allocated, b.alertThreshold);
          const pct = (b.spent / b.allocated) * 100;
          return (
            <button
              key={b.id}
              onClick={() => setSelectedBudgetId(b.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-colors",
                selectedBudgetId === b.id
                  ? "bg-indigo-600/20 border-indigo-500/50"
                  : "bg-zinc-900 border-zinc-800 hover:bg-zinc-800"
              )}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-white truncate">{b.name}</span>
                <span className={cn("text-xs font-semibold shrink-0 ml-2", getBudgetTextColor(st))}>
                  {pct.toFixed(0)}%
                </span>
              </div>
              <div className="mb-1.5">
                <ProgressBar value={b.spent} max={b.allocated} colorClass={getBudgetStatusColor(st)} />
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>{formatCurrency(b.spent)} spent</span>
                <span>of {formatCurrency(b.allocated)}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail Panel */}
      <div className="flex-1 space-y-4">
        <Card className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">{selected.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge className="text-zinc-300 bg-zinc-800">{selected.category}</Badge>
                <span className="text-sm text-zinc-400">{selected.period}</span>
                <span className="text-xs text-zinc-500">Owner: {selected.owner}</span>
              </div>
            </div>
            <Badge className={cn(getBudgetTextColor(status), status === "safe" ? "bg-emerald-400/10" : status === "warning" ? "bg-amber-400/10" : "bg-rose-400/10")}>
              {status === "safe" ? "On Track" : status === "warning" ? "Near Threshold" : "Over Budget"}
            </Badge>
          </div>

          {/* Cost breakdown */}
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: "Allocated", value: selected.allocated, color: "text-zinc-300" },
              { label: "Spent", value: selected.spent, color: getBudgetTextColor(status) },
              { label: "Forecast", value: selected.forecast, color: selected.forecast > selected.allocated ? "text-rose-400" : "text-emerald-400" },
            ].map((item) => (
              <div key={item.label} className="bg-zinc-800 rounded-lg p-3">
                <div className="text-xs text-zinc-500 mb-1">{item.label}</div>
                <div className={cn("text-xl font-bold", item.color)}>{formatCurrency(item.value)}</div>
              </div>
            ))}
          </div>

          {/* Progress */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Budget Utilization</span>
              <span>{((selected.spent / selected.allocated) * 100).toFixed(1)}%</span>
            </div>
            <ProgressBar value={selected.spent} max={selected.allocated} colorClass={getBudgetStatusColor(status)} height="h-3" />

            <div className="flex justify-between text-xs text-zinc-500 mb-1 mt-3">
              <span>Forecast vs Allocated</span>
              <span className={selected.forecast > selected.allocated ? "text-rose-400" : "text-emerald-400"}>
                {((selected.forecast / selected.allocated) * 100).toFixed(1)}%
              </span>
            </div>
            <ProgressBar
              value={selected.forecast}
              max={selected.allocated}
              colorClass={selected.forecast > selected.allocated ? "bg-rose-400" : "bg-emerald-400"}
              height="h-3"
            />
          </div>

          {/* Alert Threshold */}
          <div className="flex items-center gap-3 p-3 bg-zinc-800 rounded-lg mb-4">
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Alert Threshold</div>
              <div className="text-sm font-semibold text-amber-400">{selected.alertThreshold}% ({formatCurrency(selected.allocated * selected.alertThreshold / 100)})</div>
            </div>
            <div className="h-8 w-px bg-zinc-700" />
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Remaining</div>
              <div className={cn("text-sm font-semibold", selected.allocated - selected.spent >= 0 ? "text-emerald-400" : "text-rose-400")}>
                {formatCurrency(Math.abs(selected.allocated - selected.spent))}
                {selected.allocated - selected.spent >= 0 ? " under" : " over"}
              </div>
            </div>
            <div className="h-8 w-px bg-zinc-700" />
            <div>
              <div className="text-xs text-zinc-500 mb-0.5">Forecast Variance</div>
              <div className={cn("text-sm font-semibold", selected.forecast <= selected.allocated ? "text-emerald-400" : "text-rose-400")}>
                {selected.forecast <= selected.allocated ? "-" : "+"}{formatCurrency(Math.abs(selected.forecast - selected.allocated))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <div className="text-xs text-zinc-500 mb-1.5">Notes</div>
            <p className="text-sm text-zinc-300 leading-relaxed">{selected.notes}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Recommendations Tab ─────────────────────────────────────────────────────

function RecommendationsTab() {
  const [recs, setRecs] = useState<Recommendation[]>(RECOMMENDATIONS);
  const [filterType, setFilterType] = useState<RecommendationType | "All">("All");
  const [filterEffort, setFilterEffort] = useState<EffortLevel | "All">("All");

  const activeRecs = recs.filter((r) => !r.dismissed && !r.applied);
  const appliedRecs = recs.filter((r) => r.applied);
  const dismissedRecs = recs.filter((r) => r.dismissed);

  const filtered = activeRecs.filter((r) => {
    const matchType = filterType === "All" || r.type === filterType;
    const matchEffort = filterEffort === "All" || r.effort === filterEffort;
    return matchType && matchEffort;
  });

  const totalSavings = filtered.reduce((s, r) => s + r.estimatedSavings, 0);

  function applyRec(id: string) {
    setRecs((prev) => prev.map((r) => (r.id === id ? { ...r, applied: true } : r)));
  }

  function dismissRec(id: string) {
    setRecs((prev) => prev.map((r) => (r.id === id ? { ...r, dismissed: true } : r)));
  }

  return (
    <div className="space-y-5">
      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Active Recommendations", value: activeRecs.length, color: "text-white" },
          { label: "Total Potential Savings", value: formatCurrency(activeRecs.reduce((s, r) => s + r.estimatedSavings, 0)) + "/mo", color: "text-emerald-400" },
          { label: "Applied", value: appliedRecs.length, color: "text-indigo-400" },
          { label: "Dismissed", value: dismissedRecs.length, color: "text-zinc-500" },
        ].map((s) => (
          <Card key={s.label} className="p-3">
            <div className="text-xs text-zinc-500 mb-1">{s.label}</div>
            <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as RecommendationType | "All")}
          className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="All">All Types</option>
          <option value="rightsizing">Rightsizing</option>
          <option value="reserved">Reserved Instances</option>
          <option value="idle">Idle Resource</option>
          <option value="storage">Storage Tier</option>
          <option value="network">Network Opt.</option>
        </select>
        <select
          value={filterEffort}
          onChange={(e) => setFilterEffort(e.target.value as EffortLevel | "All")}
          className="bg-zinc-800 border border-zinc-700 rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="All">All Effort Levels</option>
          <option value="low">Low Effort</option>
          <option value="medium">Medium Effort</option>
          <option value="high">High Effort</option>
        </select>
        {(filterType !== "All" || filterEffort !== "All") && (
          <span className="text-sm text-zinc-400">
            {filtered.length} shown · {formatCurrency(totalSavings)}/mo potential
          </span>
        )}
      </div>

      {/* Recommendation Cards */}
      <div className="space-y-3">
        {filtered.map((rec) => (
          <Card key={rec.id} className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-sm font-semibold text-white">{rec.title}</span>
                  <Badge className={getRecTypeColor(rec.type)}>{getRecTypeLabel(rec.type)}</Badge>
                  <Badge className={getProviderColor(rec.provider)}>{rec.provider}</Badge>
                  <Badge className={getEffortColor(rec.effort)}>{rec.effort} effort</Badge>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed mb-3">{rec.description}</p>
                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>Resource: <span className="text-zinc-300">{rec.resourceName}</span></span>
                  <span>Priority: <span className="text-zinc-300">#{rec.priority}</span></span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3 shrink-0">
                <div className="text-right">
                  <div className="text-xs text-zinc-500 mb-0.5">Est. Monthly Savings</div>
                  <div className="text-xl font-bold text-emerald-400">{formatCurrency(rec.estimatedSavings)}</div>
                  <div className="text-xs text-zinc-500">{formatCurrency(rec.estimatedSavings * 12)}/yr</div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => dismissRec(rec.id)}
                    className="px-3 py-1.5 text-xs text-zinc-400 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-md transition-colors"
                  >
                    Dismiss
                  </button>
                  <button
                    onClick={() => applyRec(rec.id)}
                    className="px-3 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors font-medium"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          </Card>
        ))}

        {filtered.length === 0 && activeRecs.length > 0 && (
          <div className="text-center py-10 text-zinc-500">No recommendations match your filters</div>
        )}

        {activeRecs.length === 0 && (
          <Card className="p-8 text-center">
            <div className="text-emerald-400 text-2xl font-bold mb-2">All caught up!</div>
            <div className="text-zinc-400 text-sm">All recommendations have been applied or dismissed.</div>
          </Card>
        )}
      </div>

      {/* Applied / Dismissed sections */}
      {appliedRecs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-400 mb-2">Applied ({appliedRecs.length})</h3>
          <div className="space-y-2">
            {appliedRecs.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg opacity-60">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400 font-medium">✓ Applied</span>
                  <span className="text-sm text-zinc-300">{rec.title}</span>
                  <Badge className={getProviderColor(rec.provider)}>{rec.provider}</Badge>
                </div>
                <span className="text-sm text-emerald-400 font-medium">{formatCurrency(rec.estimatedSavings)}/mo</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dismissedRecs.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-zinc-400 mb-2">Dismissed ({dismissedRecs.length})</h3>
          <div className="space-y-2">
            {dismissedRecs.map((rec) => (
              <div key={rec.id} className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg opacity-40">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 font-medium">Dismissed</span>
                  <span className="text-sm text-zinc-400">{rec.title}</span>
                </div>
                <button
                  onClick={() => setRecs((prev) => prev.map((r) => (r.id === rec.id ? { ...r, dismissed: false } : r)))}
                  className="text-xs text-indigo-400 hover:text-indigo-300"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "resources", label: "Resources" },
  { id: "budgets", label: "Budgets" },
  { id: "recommendations", label: "Recommendations" },
];

export default function InfrastructureCostManager() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  const totalMonthly = RESOURCES.reduce((s, r) => s + r.monthlyCost, 0);
  const activeRecCount = RECOMMENDATIONS.filter((r) => !r.dismissed && !r.applied).length;

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Infrastructure Cost Manager</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Monitor, analyze, and optimize cloud infrastructure spend across AWS, GCP, and Azure
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-zinc-500">Total Monthly</div>
            <div className="text-xl font-bold text-white">{formatCurrencyFull(totalMonthly)}</div>
          </div>
          <div className="h-10 w-px bg-zinc-800" />
          <div className="text-right">
            <div className="text-xs text-zinc-500">Optimizations</div>
            <div className="text-xl font-bold text-emerald-400">{activeRecCount} available</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900 border border-zinc-800 rounded-lg p-1 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-colors",
              activeTab === tab.id
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === "overview" && <OverviewTab />}
        {activeTab === "resources" && <ResourcesTab />}
        {activeTab === "budgets" && <BudgetsTab />}
        {activeTab === "recommendations" && <RecommendationsTab />}
      </div>
    </div>
  );
}
