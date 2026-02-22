import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type ResourceType = "ec2" | "rds" | "lambda" | "s3" | "elb" | "elasticache" | "ecs";
type WasteReason = "idle" | "oversized" | "unused" | "rightsizing" | "reserved" | "lifecycle";

interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  region: string;
  monthlyCost: number;
  wasteReason: WasteReason | null;
  wasteCost: number;
  utilization: number;
  recommendation: string | null;
  potentialSavings: number;
  owner: string;
  lastActivity: string;
}

interface SavingOpportunity {
  id: string;
  title: string;
  description: string;
  type: "rightsizing" | "reserved" | "idle" | "spot" | "lifecycle";
  resourceCount: number;
  monthlySavings: number;
  annualSavings: number;
  effort: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
  services: string[];
}

interface CostCategory {
  name: string;
  current: number;
  optimized: number;
  services: string;
}

// ── Sample Data ────────────────────────────────────────────────────────────

const resources: Resource[] = [
  {
    id: "r1", name: "api-prod-m5-4xl", type: "ec2", region: "us-east-1",
    monthlyCost: 420.48, wasteReason: "oversized", wasteCost: 210.24,
    utilization: 18, recommendation: "Downsize to m5.xlarge", potentialSavings: 210,
    owner: "platform-core", lastActivity: "2026-02-22T06:00:00Z",
  },
  {
    id: "r2", name: "ml-training-p3-8xl", type: "ec2", region: "us-east-1",
    monthlyCost: 2_840.00, wasteReason: "idle", wasteCost: 1_136.00,
    utilization: 8, recommendation: "Schedule off-hours shutdown; use spot instances for training",
    potentialSavings: 1_700, owner: "ml-team", lastActivity: "2026-02-21T18:00:00Z",
  },
  {
    id: "r3", name: "prod-postgres-db2", type: "rds", region: "us-east-1",
    monthlyCost: 680.00, wasteReason: "oversized", wasteCost: 340.00,
    utilization: 22, recommendation: "Downsize from db.r6g.2xlarge to db.r6g.large",
    potentialSavings: 340, owner: "data-eng", lastActivity: "2026-02-22T06:00:00Z",
  },
  {
    id: "r4", name: "prod-redis-cluster", type: "elasticache", region: "us-east-1",
    monthlyCost: 184.80, wasteReason: null, wasteCost: 0,
    utilization: 68, recommendation: null, potentialSavings: 0,
    owner: "platform-core", lastActivity: "2026-02-22T06:00:00Z",
  },
  {
    id: "r5", name: "staging-ec2-idle", type: "ec2", region: "us-west-2",
    monthlyCost: 82.40, wasteReason: "idle", wasteCost: 82.40,
    utilization: 0, recommendation: "Terminate — no traffic for 14 days",
    potentialSavings: 82, owner: "dev-ops", lastActivity: "2026-02-08T00:00:00Z",
  },
  {
    id: "r6", name: "log-archive-bucket", type: "s3", region: "us-east-1",
    monthlyCost: 124.00, wasteReason: "lifecycle", wasteCost: 68.20,
    utilization: 100, recommendation: "Add lifecycle policy to transition logs > 30d to Glacier",
    potentialSavings: 68, owner: "data-eng", lastActivity: "2026-02-22T06:00:00Z",
  },
  {
    id: "r7", name: "prod-lb-unused-rules", type: "elb", region: "us-east-1",
    monthlyCost: 28.40, wasteReason: "unused", wasteCost: 14.20,
    utilization: 12, recommendation: "Remove 3 unused listener rules",
    potentialSavings: 14, owner: "platform-core", lastActivity: "2026-02-22T06:00:00Z",
  },
  {
    id: "r8", name: "worker-queue-ecs", type: "ecs", region: "us-east-1",
    monthlyCost: 142.00, wasteReason: null, wasteCost: 0,
    utilization: 72, recommendation: null, potentialSavings: 0,
    owner: "backend", lastActivity: "2026-02-22T06:00:00Z",
  },
  {
    id: "r9", name: "batch-processor-lambda", type: "lambda", region: "us-east-1",
    monthlyCost: 8.40, wasteReason: null, wasteCost: 0,
    utilization: 94, recommendation: null, potentialSavings: 0,
    owner: "data-eng", lastActivity: "2026-02-22T06:00:00Z",
  },
  {
    id: "r10", name: "dev-rds-postgres", type: "rds", region: "us-east-1",
    monthlyCost: 86.40, wasteReason: "idle", wasteCost: 86.40,
    utilization: 2, recommendation: "Stop dev database during off-hours (save 70%)",
    potentialSavings: 62, owner: "engineering", lastActivity: "2026-02-21T17:00:00Z",
  },
];

const opportunities: SavingOpportunity[] = [
  {
    id: "op1", title: "Rightsize EC2 Instances",
    description: "4 EC2 instances consistently below 25% CPU/memory utilization. Downsize to next smaller instance type.",
    type: "rightsizing", resourceCount: 4, monthlySavings: 680, annualSavings: 8160,
    effort: "medium", risk: "low", services: ["api-prod", "worker-service"],
  },
  {
    id: "op2", title: "Reserved Instance Savings",
    description: "Convert 6 on-demand EC2 instances to 1-year reserved. These have been running > 3 months continuously.",
    type: "reserved", resourceCount: 6, monthlySavings: 1240, annualSavings: 14880,
    effort: "low", risk: "low", services: ["prod-cluster", "data-service"],
  },
  {
    id: "op3", title: "Terminate Idle Resources",
    description: "3 resources with zero or near-zero utilization for > 7 days. Safe to terminate or stop.",
    type: "idle", resourceCount: 3, monthlySavings: 310, annualSavings: 3720,
    effort: "low", risk: "low", services: ["staging-ec2-idle", "dev-rds"],
  },
  {
    id: "op4", title: "Spot Instances for ML Training",
    description: "ML training jobs are interruptible workloads — using spot instances instead of on-demand saves 70-80%.",
    type: "spot", resourceCount: 2, monthlySavings: 2100, annualSavings: 25200,
    effort: "high", risk: "medium", services: ["ml-training-p3-8xl", "ml-featurization"],
  },
  {
    id: "op5", title: "S3 Lifecycle Policies",
    description: "Add Intelligent-Tiering and Glacier transition policies to log and backup buckets.",
    type: "lifecycle", resourceCount: 3, monthlySavings: 186, annualSavings: 2232,
    effort: "low", risk: "low", services: ["log-archive-bucket", "prod-backups"],
  },
];

const categories: CostCategory[] = [
  { name: "Compute (EC2/ECS)", current: 4_240, optimized: 2_180, services: "EC2, ECS, EKS" },
  { name: "Database (RDS/ElastiCache)", current: 864, optimized: 524, services: "RDS, ElastiCache" },
  { name: "ML/GPU (P3/G4)", current: 2_840, optimized: 820, services: "EC2 P/G series" },
  { name: "Storage (S3/EFS)", current: 284, optimized: 182, services: "S3, EFS" },
  { name: "Networking (LB/DTO)", current: 142, optimized: 124, services: "ELB, Data Transfer" },
  { name: "Functions (Lambda)", current: 18, optimized: 14, services: "Lambda" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function typeColor(t: ResourceType): string {
  const map: Record<ResourceType, string> = {
    ec2:          "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    rds:          "bg-blue-500/20 text-blue-400 border-blue-500/30",
    lambda:       "bg-amber-500/20 text-amber-400 border-amber-500/30",
    s3:           "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    elb:          "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
    elasticache:  "bg-rose-500/20 text-rose-400 border-rose-500/30",
    ecs:          "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  return map[t];
}

function wasteColor(reason: WasteReason | null): string {
  if (!reason) return "text-emerald-400";
  const map: Record<WasteReason, string> = {
    idle:        "text-rose-400",
    oversized:   "text-amber-400",
    unused:      "text-rose-400",
    rightsizing: "text-amber-400",
    reserved:    "text-indigo-400",
    lifecycle:   "text-blue-400",
  };
  return map[reason];
}

function effortColor(e: SavingOpportunity["effort"]): string {
  return e === "low" ? "text-emerald-400" : e === "medium" ? "text-amber-400" : "text-rose-400";
}

function riskColor(r: SavingOpportunity["risk"]): string {
  return r === "low" ? "text-emerald-400" : r === "medium" ? "text-amber-400" : "text-rose-400";
}

// ── Tabs ───────────────────────────────────────────────────────────────────

function OverviewTab() {
  const totalCurrent = categories.reduce((a, c) => a + c.current, 0);
  const totalOptimized = categories.reduce((a, c) => a + c.optimized, 0);
  const totalSavings = totalCurrent - totalOptimized;
  const wasteResources = resources.filter((r) => r.wasteCost > 0);
  const totalWaste = wasteResources.reduce((a, r) => a + r.wasteCost, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Monthly Spend", value: "$" + totalCurrent.toLocaleString(), color: "text-white" },
          { label: "Potential Savings", value: "$" + totalSavings.toLocaleString(), color: "text-emerald-400" },
          { label: "Waste Identified", value: "$" + Math.round(totalWaste).toLocaleString(), color: "text-rose-400" },
          { label: "Resources at Risk", value: wasteResources.length, color: "text-amber-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className={cn("text-3xl font-bold", kpi.color)}>{kpi.value}</div>
            <div className="text-sm text-zinc-400 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Cost by Category: Current vs Optimized</h3>
        <div className="space-y-4">
          {categories.map((cat) => {
            const maxCost = Math.max(...categories.map((c) => c.current));
            const savings = cat.current - cat.optimized;
            return (
              <div key={cat.name}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-300">{cat.name}</span>
                  <span className="text-emerald-400">save ${savings.toLocaleString()}</span>
                </div>
                <div className="relative">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-zinc-800 rounded h-3 overflow-hidden">
                      <div className="h-full bg-zinc-600 relative" style={{ width: (cat.current / maxCost * 100) + "%" }}>
                        <div className="absolute inset-0 bg-emerald-500" style={{ width: (cat.optimized / cat.current * 100) + "%" }} />
                      </div>
                    </div>
                    <span className="text-xs text-zinc-400 w-16 text-right">${cat.current.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-emerald-500" /><span className="text-zinc-400">Optimized</span></div>
          <div className="flex items-center gap-1"><div className="w-3 h-2 rounded bg-zinc-600" /><span className="text-zinc-400">Current overspend</span></div>
        </div>
      </div>
    </div>
  );
}

function OpportunitiesTab() {
  const [selected, setSelected] = useState<SavingOpportunity | null>(null);
  const total = opportunities.reduce((a, o) => a + o.monthlySavings, 0);

  return (
    <div className="space-y-3">
      <div className="text-sm text-zinc-400 mb-4">
        Total potential savings: <span className="text-emerald-400 font-semibold">${total.toLocaleString()}/month</span> · {" "}
        <span className="text-emerald-300 font-semibold">${(total * 12).toLocaleString()}/year</span>
      </div>
      {opportunities.sort((a, b) => b.monthlySavings - a.monthlySavings).map((op) => (
        <div
          key={op.id}
          className={cn(
            "rounded-xl border p-4 cursor-pointer transition-all",
            selected?.id === op.id ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
          )}
          onClick={() => setSelected(selected?.id === op.id ? null : op)}
        >
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{op.title}</span>
                <span className="text-xs bg-zinc-800 text-zinc-400 rounded px-2 py-0.5 capitalize">{op.type}</span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{op.description}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-emerald-400 font-bold">${op.monthlySavings.toLocaleString()}/mo</div>
              <div className="text-xs text-zinc-500">{op.resourceCount} resources</div>
            </div>
          </div>
          {selected?.id === op.id && (
            <div className="mt-4 border-t border-zinc-800 pt-4 grid grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-zinc-500">Monthly</div>
                <div className="text-emerald-400 font-bold">${op.monthlySavings.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-zinc-500">Annual</div>
                <div className="text-emerald-400 font-bold">${op.annualSavings.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-zinc-500">Effort</div>
                <div className={cn("capitalize", effortColor(op.effort))}>{op.effort}</div>
              </div>
              <div>
                <div className="text-zinc-500">Risk</div>
                <div className={cn("capitalize", riskColor(op.risk))}>{op.risk}</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ResourcesTab() {
  const [filter, setFilter] = useState<"all" | "waste">("waste");

  const visible = filter === "waste"
    ? resources.filter((r) => r.wasteCost > 0)
    : resources;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["all", "waste"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors",
              filter === f ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            {f === "waste" ? "Waste Only" : "All Resources"}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {visible.map((res) => (
          <div key={res.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="flex items-center gap-3">
              <span className={cn("text-xs px-1.5 py-0.5 rounded border uppercase", typeColor(res.type))}>{res.type}</span>
              <span className="font-medium text-white text-sm">{res.name}</span>
              <span className="text-xs text-zinc-500">{res.region}</span>
              <span className="ml-auto text-sm font-semibold text-white">${res.monthlyCost.toFixed(0)}/mo</span>
              {res.wasteCost > 0 && (
                <span className="text-xs text-rose-400">waste: ${res.wasteCost.toFixed(0)}</span>
              )}
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-xs text-zinc-500 w-24">Utilization</span>
              <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                <div
                  className={cn("h-1.5 rounded-full", res.utilization < 30 ? "bg-rose-500" : res.utilization < 70 ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: Math.max(1, res.utilization) + "%" }}
                />
              </div>
              <span className="text-xs text-zinc-400 w-8 text-right">{res.utilization}%</span>
            </div>
            {res.recommendation && (
              <div className="mt-2 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded px-3 py-1.5">
                💡 {res.recommendation} — save ${res.potentialSavings}/mo
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const TABS = ["Overview", "Opportunities", "Resources"] as const;
type Tab = typeof TABS[number];

export default function InfrastructureCostOptimizer() {
  const [tab, setTab] = useState<Tab>("Overview");

  const totalSavings = opportunities.reduce((a, o) => a + o.monthlySavings, 0);
  const wasteCount = resources.filter((r) => r.wasteCost > 0).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Infrastructure Cost Optimizer</h1>
        <p className="text-zinc-400 text-sm">
          Cloud spend analysis and waste reduction — {wasteCount} wasteful resources, ${totalSavings.toLocaleString()}/month recoverable
        </p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-zinc-400 hover:text-white"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && <OverviewTab />}
      {tab === "Opportunities" && <OpportunitiesTab />}
      {tab === "Resources" && <ResourcesTab />}
    </div>
  );
}
