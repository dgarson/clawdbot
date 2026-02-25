import React, { useState } from "react";
import { cn } from "../lib/utils";

type ResourceType = "compute" | "storage" | "database" | "network" | "serverless" | "container";
type ResourceStatus = "running" | "stopped" | "pending" | "error" | "terminated";
type CloudProvider = "aws" | "gcp" | "azure" | "on-prem";

interface Resource {
  id: string;
  name: string;
  type: ResourceType;
  provider: CloudProvider;
  region: string;
  status: ResourceStatus;
  tags: Record<string, string>;
  costPerMonth: number;
  cpu: number;
  memory: number;
  storage: number;
  createdAt: string;
  lastModified: string;
  owner: string;
}

interface ResourceGroup {
  id: string;
  name: string;
  provider: CloudProvider;
  resourceCount: number;
  monthlyCost: number;
  region: string;
  environment: string;
}

interface CostBreakdown {
  category: ResourceType;
  cost: number;
  count: number;
  trend: number;
}

interface TagComplianceReport {
  rule: string;
  compliant: number;
  nonCompliant: number;
  totalResources: number;
}

const RESOURCES: Resource[] = [
  { id: "r001", name: "api-prod-01", type: "compute", provider: "aws", region: "us-east-1", status: "running", tags: { env: "prod", team: "platform", service: "api-gateway" }, costPerMonth: 280, cpu: 4, memory: 16, storage: 100, createdAt: "2024-01-15", lastModified: "2h ago", owner: "alice" },
  { id: "r002", name: "api-prod-02", type: "compute", provider: "aws", region: "us-east-1", status: "running", tags: { env: "prod", team: "platform", service: "api-gateway" }, costPerMonth: 280, cpu: 4, memory: 16, storage: 100, createdAt: "2024-01-15", lastModified: "2h ago", owner: "alice" },
  { id: "r003", name: "worker-prod-01", type: "compute", provider: "aws", region: "us-west-2", status: "running", tags: { env: "prod", team: "backend", service: "worker" }, costPerMonth: 140, cpu: 2, memory: 8, storage: 50, createdAt: "2024-02-01", lastModified: "1d ago", owner: "bob" },
  { id: "r004", name: "worker-prod-02", type: "compute", provider: "aws", region: "us-west-2", status: "stopped", tags: { env: "prod", team: "backend", service: "worker" }, costPerMonth: 0, cpu: 2, memory: 8, storage: 50, createdAt: "2024-02-01", lastModified: "3d ago", owner: "bob" },
  { id: "r005", name: "pg-primary", type: "database", provider: "aws", region: "us-east-1", status: "running", tags: { env: "prod", team: "data", service: "postgres" }, costPerMonth: 890, cpu: 8, memory: 32, storage: 500, createdAt: "2023-11-20", lastModified: "30d ago", owner: "carol" },
  { id: "r006", name: "pg-replica", type: "database", provider: "aws", region: "us-east-1", status: "running", tags: { env: "prod", team: "data", service: "postgres" }, costPerMonth: 890, cpu: 8, memory: 32, storage: 500, createdAt: "2023-11-20", lastModified: "30d ago", owner: "carol" },
  { id: "r007", name: "redis-cluster", type: "database", provider: "aws", region: "us-east-1", status: "running", tags: { env: "prod", team: "platform", service: "cache" }, costPerMonth: 340, cpu: 0, memory: 8, storage: 0, createdAt: "2024-01-10", lastModified: "14d ago", owner: "alice" },
  { id: "r008", name: "s3-assets-prod", type: "storage", provider: "aws", region: "us-east-1", status: "running", tags: { env: "prod", team: "platform" }, costPerMonth: 45, cpu: 0, memory: 0, storage: 2400, createdAt: "2023-10-01", lastModified: "1h ago", owner: "alice" },
  { id: "r009", name: "vpc-prod", type: "network", provider: "aws", region: "us-east-1", status: "running", tags: { env: "prod", team: "infra" }, costPerMonth: 120, cpu: 0, memory: 0, storage: 0, createdAt: "2023-09-15", lastModified: "60d ago", owner: "dave" },
  { id: "r010", name: "lambda-notifications", type: "serverless", provider: "aws", region: "us-east-1", status: "running", tags: { env: "prod", team: "platform", service: "notifications" }, costPerMonth: 12, cpu: 0, memory: 0.5, storage: 0, createdAt: "2024-03-01", lastModified: "2d ago", owner: "alice" },
  { id: "r011", name: "k8s-cluster-prod", type: "container", provider: "gcp", region: "us-central1", status: "running", tags: { env: "prod", team: "infra", service: "kubernetes" }, costPerMonth: 640, cpu: 32, memory: 128, storage: 1000, createdAt: "2024-01-05", lastModified: "1h ago", owner: "dave" },
  { id: "r012", name: "staging-api", type: "compute", provider: "aws", region: "us-west-2", status: "running", tags: { env: "staging", team: "platform" }, costPerMonth: 70, cpu: 1, memory: 4, storage: 20, createdAt: "2024-04-01", lastModified: "5d ago", owner: "bob" },
  { id: "r013", name: "old-ec2-test", type: "compute", provider: "aws", region: "eu-west-1", status: "stopped", tags: {}, costPerMonth: 0, cpu: 2, memory: 4, storage: 40, createdAt: "2023-07-12", lastModified: "8mo ago", owner: "unknown" },
  { id: "r014", name: "gcs-backup", type: "storage", provider: "gcp", region: "us-central1", status: "running", tags: { env: "prod", team: "data", purpose: "backup" }, costPerMonth: 28, cpu: 0, memory: 0, storage: 800, createdAt: "2024-02-14", lastModified: "12h ago", owner: "carol" },
];

const GROUPS: ResourceGroup[] = [
  { id: "g1", name: "prod-us-east", provider: "aws", resourceCount: 8, monthlyCost: 2657, region: "us-east-1", environment: "production" },
  { id: "g2", name: "prod-us-west", provider: "aws", resourceCount: 3, monthlyCost: 210, region: "us-west-2", environment: "production" },
  { id: "g3", name: "prod-gcp-central", provider: "gcp", resourceCount: 2, monthlyCost: 668, region: "us-central1", environment: "production" },
  { id: "g4", name: "prod-eu", provider: "aws", resourceCount: 1, monthlyCost: 0, region: "eu-west-1", environment: "testing" },
];

const COST_BREAKDOWN: CostBreakdown[] = [
  { category: "database", cost: 2120, count: 3, trend: 2.1 },
  { category: "compute", cost: 770, count: 6, trend: -1.5 },
  { category: "container", cost: 640, count: 1, trend: 8.3 },
  { category: "network", cost: 120, count: 1, trend: 0 },
  { category: "storage", cost: 73, count: 2, trend: 4.2 },
  { category: "serverless", cost: 12, count: 1, trend: -12.0 },
];

const TAG_COMPLIANCE: TagComplianceReport[] = [
  { rule: "env tag required", compliant: 12, nonCompliant: 2, totalResources: 14 },
  { rule: "team tag required", compliant: 11, nonCompliant: 3, totalResources: 14 },
  { rule: "owner tag required", compliant: 9, nonCompliant: 5, totalResources: 14 },
  { rule: "service tag required", compliant: 8, nonCompliant: 6, totalResources: 14 },
];

const typeIcon: Record<ResourceType, string> = {
  compute: "🖥️", storage: "💾", database: "🗄️", network: "🌐", serverless: "⚡", container: "📦",
};

const providerColor: Record<CloudProvider, string> = {
  aws:     "text-orange-400",
  gcp:     "text-blue-400",
  azure:   "text-sky-400",
  "on-prem": "text-[var(--color-text-secondary)]",
};

const providerBadge: Record<CloudProvider, string> = {
  aws:     "bg-orange-500/10 border-orange-500/20 text-orange-400",
  gcp:     "bg-blue-500/10 border-blue-500/20 text-blue-400",
  azure:   "bg-sky-500/10 border-sky-500/20 text-sky-400",
  "on-prem": "bg-[var(--color-surface-3)] border-[var(--color-surface-3)] text-[var(--color-text-secondary)]",
};

const statusDot: Record<ResourceStatus, string> = {
  running:    "bg-emerald-400",
  stopped:    "bg-[var(--color-surface-3)]",
  pending:    "bg-amber-400 animate-pulse",
  error:      "bg-rose-400 animate-pulse",
  terminated: "bg-[var(--color-surface-3)]",
};

const statusColor: Record<ResourceStatus, string> = {
  running:    "text-emerald-400",
  stopped:    "text-[var(--color-text-muted)]",
  pending:    "text-amber-400",
  error:      "text-rose-400",
  terminated: "text-[var(--color-text-muted)]",
};

export default function ResourceInventoryDashboard() {
  const [tab, setTab] = useState<"inventory" | "groups" | "costs" | "compliance">("inventory");
  const [selected, setSelected] = useState<Resource | null>(RESOURCES[0]);
  const [typeFilter, setTypeFilter] = useState<"all" | ResourceType>("all");
  const [providerFilter, setProviderFilter] = useState<"all" | CloudProvider>("all");

  const filtered = RESOURCES.filter(r =>
    (typeFilter === "all" || r.type === typeFilter) &&
    (providerFilter === "all" || r.provider === providerFilter)
  );

  const running = RESOURCES.filter(r => r.status === "running").length;
  const stopped = RESOURCES.filter(r => r.status === "stopped").length;
  const totalCost = RESOURCES.reduce((s, r) => s + r.costPerMonth, 0);
  const maxCost = Math.max(...COST_BREAKDOWN.map(c => c.cost));

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Resource Inventory</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{RESOURCES.length} resources across {GROUPS.length} groups</p>
          </div>
          <button className="px-3 py-1.5 rounded-lg bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-xs font-medium text-[var(--color-text-primary)] transition-colors">Export CSV</button>
        </div>
        {/* Stats */}
        <div className="flex gap-4 mt-3">
          {[
            { label: "Running", value: running, color: "text-emerald-400" },
            { label: "Stopped", value: stopped, color: "text-[var(--color-text-muted)]" },
            { label: "Monthly Cost", value: `$${totalCost.toLocaleString()}`, color: "text-[var(--color-text-primary)]" },
            { label: "AWS", value: RESOURCES.filter(r => r.provider === "aws").length, color: "text-orange-400" },
            { label: "GCP", value: RESOURCES.filter(r => r.provider === "gcp").length, color: "text-blue-400" },
          ].map(s => (
            <div key={s.label}>
              <span className={cn("text-base font-bold", s.color)}>{s.value}</span>
              <span className="text-[var(--color-text-muted)] text-xs ml-1.5">{s.label}</span>
            </div>
          ))}
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(["inventory", "groups", "costs", "compliance"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                tab === t ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]")}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Inventory Tab */}
        {tab === "inventory" && (
          <div className="flex h-full">
            {/* Left */}
            <div className="w-[50%] flex-none border-r border-[var(--color-border)] flex flex-col">
              {/* Filters */}
              <div className="flex-none px-4 py-2.5 border-b border-[var(--color-border)] space-y-1.5">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-[10px] text-[var(--color-text-muted)] mr-1">Type:</span>
                  {(["all", "compute", "database", "storage", "container", "network", "serverless"] as const).map(t => (
                    <button key={t} onClick={() => setTypeFilter(t)}
                      className={cn("px-2 py-0.5 rounded text-[11px] capitalize transition-colors",
                        typeFilter === t ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}>
                      {t === "all" ? "All" : `${typeIcon[t as ResourceType]} ${t}`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--color-text-muted)] mr-1">Cloud:</span>
                  {(["all", "aws", "gcp", "azure"] as const).map(p => (
                    <button key={p} onClick={() => setProviderFilter(p)}
                      className={cn("px-2 py-0.5 rounded text-[11px] uppercase transition-colors",
                        providerFilter === p ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filtered.map(res => (
                  <button key={res.id} onClick={() => setSelected(res)} className={cn(
                    "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-1)] transition-colors",
                    selected?.id === res.id && "bg-[var(--color-surface-1)] border-l-2 border-l-indigo-500"
                  )}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("w-1.5 h-1.5 rounded-full flex-none", statusDot[res.status])} />
                        <span className="text-sm">{typeIcon[res.type]}</span>
                        <span className="text-sm font-medium text-[var(--color-text-primary)] font-mono truncate">{res.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-none">
                        <span className={cn("px-1.5 py-0.5 rounded border text-[10px]", providerBadge[res.provider])}>{res.provider.toUpperCase()}</span>
                        {res.costPerMonth > 0 && (
                          <span className="text-xs text-[var(--color-text-secondary)]">${res.costPerMonth}/mo</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1 pl-5 text-[10px] text-[var(--color-text-muted)]">
                      <span className={statusColor[res.status]}>{res.status}</span>
                      <span>{res.region}</span>
                      {res.cpu > 0 && <span>{res.cpu} vCPU</span>}
                      {res.memory > 0 && <span>{res.memory}GB RAM</span>}
                      {res.storage > 0 && <span>{res.storage}GB</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {/* Right: detail */}
            <div className="flex-1 overflow-y-auto p-5">
              {selected && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{typeIcon[selected.type]}</span>
                      <div>
                        <h2 className="font-mono text-base font-semibold text-[var(--color-text-primary)]">{selected.name}</h2>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={cn("px-1.5 py-0.5 rounded border text-[10px]", providerBadge[selected.provider])}>{selected.provider.toUpperCase()}</span>
                          <span className="text-xs text-[var(--color-text-muted)]">{selected.region}</span>
                          <span className={cn("text-xs font-medium", statusColor[selected.status])}>{selected.status}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Specs */}
                  <div className="grid grid-cols-3 gap-3">
                    {selected.cpu > 0 && (
                      <div className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)] text-center">
                        <div className="text-lg font-bold text-[var(--color-text-primary)]">{selected.cpu}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">vCPU</div>
                      </div>
                    )}
                    {selected.memory > 0 && (
                      <div className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)] text-center">
                        <div className="text-lg font-bold text-[var(--color-text-primary)]">{selected.memory}GB</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">Memory</div>
                      </div>
                    )}
                    {selected.storage > 0 && (
                      <div className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)] text-center">
                        <div className="text-lg font-bold text-[var(--color-text-primary)]">{selected.storage}GB</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">Storage</div>
                      </div>
                    )}
                    {selected.costPerMonth > 0 && (
                      <div className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)] text-center">
                        <div className="text-lg font-bold text-emerald-400">${selected.costPerMonth}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">Per Month</div>
                      </div>
                    )}
                  </div>
                  {/* Metadata */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                    <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Details</div>
                    <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                      <div><span className="text-[var(--color-text-muted)]">ID: </span><span className="font-mono text-[var(--color-text-primary)]">{selected.id}</span></div>
                      <div><span className="text-[var(--color-text-muted)]">Owner: </span><span className="text-[var(--color-text-primary)]">{selected.owner}</span></div>
                      <div><span className="text-[var(--color-text-muted)]">Created: </span><span className="text-[var(--color-text-primary)]">{selected.createdAt}</span></div>
                      <div><span className="text-[var(--color-text-muted)]">Modified: </span><span className="text-[var(--color-text-primary)]">{selected.lastModified}</span></div>
                    </div>
                  </div>
                  {/* Tags */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                    <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">Tags</div>
                    {Object.keys(selected.tags).length === 0 ? (
                      <div className="text-xs text-amber-400">⚠ No tags — non-compliant</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(selected.tags).map(([k, v]) => (
                          <span key={k} className="px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-xs font-mono">
                            <span className="text-primary">{k}</span><span className="text-[var(--color-text-muted)]">=</span><span className="text-[var(--color-text-primary)]">{v}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Groups Tab */}
        {tab === "groups" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-3">
              {GROUPS.map(g => (
                <div key={g.id} className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)] hover:border-[var(--color-border)] transition-colors">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[var(--color-text-primary)]">{g.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{g.region} · {g.environment}</div>
                    </div>
                    <div className="flex items-center gap-4 text-right">
                      <div>
                        <div className="text-sm font-bold text-[var(--color-text-primary)]">{g.resourceCount}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">resources</div>
                      </div>
                      <div>
                        <div className="text-sm font-bold text-emerald-400">${g.monthlyCost.toLocaleString()}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">per month</div>
                      </div>
                      <span className={cn("px-2 py-1 rounded border text-xs", providerBadge[g.provider])}>{g.provider.toUpperCase()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Costs Tab */}
        {tab === "costs" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)] mb-4">
              <div className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Cost by Resource Type</div>
              <div className="space-y-3">
                {COST_BREAKDOWN.toSorted((a, b) => b.cost - a.cost).map(cb => (
                  <div key={cb.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span>{typeIcon[cb.category]}</span>
                        <span className="text-[var(--color-text-primary)] capitalize">{cb.category}</span>
                        <span className="text-[var(--color-text-muted)]">{cb.count} resources</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn("text-[10px]", cb.trend > 0 ? "text-rose-400" : cb.trend < 0 ? "text-emerald-400" : "text-[var(--color-text-muted)]")}>
                          {cb.trend > 0 ? "↑" : cb.trend < 0 ? "↓" : "→"} {Math.abs(cb.trend)}%
                        </span>
                        <span className="text-[var(--color-text-primary)] font-semibold">${cb.cost.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="w-full bg-[var(--color-surface-2)] rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{ width: `${(cb.cost / maxCost) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Total Monthly</span>
                <span className="font-bold text-[var(--color-text-primary)]">${totalCost.toLocaleString()}</span>
              </div>
            </div>
            {/* Top cost resources */}
            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
              <div className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Top Cost Resources</div>
              <div className="space-y-2">
                {RESOURCES.filter(r => r.costPerMonth > 0).toSorted((a, b) => b.costPerMonth - a.costPerMonth).slice(0, 6).map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3 text-xs">
                    <span className="text-[var(--color-text-muted)] w-4">{i + 1}.</span>
                    <span>{typeIcon[r.type]}</span>
                    <span className="font-mono text-[var(--color-text-primary)] flex-1">{r.name}</span>
                    <span className={cn("text-[10px]", providerColor[r.provider])}>{r.provider.toUpperCase()}</span>
                    <span className="text-emerald-400 font-semibold">${r.costPerMonth}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Compliance Tab */}
        {tab === "compliance" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-4">
              <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
                <div className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Tag Compliance</div>
                <div className="space-y-4">
                  {TAG_COMPLIANCE.map(tc => {
                    const pct = Math.round((tc.compliant / tc.totalResources) * 100);
                    return (
                      <div key={tc.rule}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-[var(--color-text-primary)] capitalize">{tc.rule}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-emerald-400">{tc.compliant} compliant</span>
                            <span className="text-rose-400">{tc.nonCompliant} missing</span>
                            <span className={cn("font-bold", pct >= 90 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-rose-400")}>{pct}%</span>
                          </div>
                        </div>
                        <div className="w-full bg-[var(--color-surface-2)] rounded-full h-2">
                          <div className={cn("h-2 rounded-full", pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-amber-500" : "bg-rose-500")}
                            style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Non-compliant resources */}
              <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
                <div className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Non-Compliant Resources</div>
                <div className="space-y-2">
                  {RESOURCES.filter(r => Object.keys(r.tags).length < 3).map(r => (
                    <div key={r.id} className="flex items-center gap-3 bg-[var(--color-surface-0)] rounded-lg px-3 py-2">
                      <span>{typeIcon[r.type]}</span>
                      <span className="font-mono text-xs text-[var(--color-text-primary)] flex-1">{r.name}</span>
                      <div className="flex gap-1">
                        {["env", "team", "owner", "service"].filter(tag => !r.tags[tag]).map(tag => (
                          <span key={tag} className="px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-400">missing:{tag}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
