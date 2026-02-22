import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type ResourceType = "apiCalls" | "storage" | "compute" | "bandwidth";

interface ResourceQuota {
  used: number;
  limit: number;
}

type QuotaMap = Record<ResourceType, ResourceQuota>;

type TenantStatus = "active" | "suspended" | "trial";
type PlanTier = "Free" | "Starter" | "Pro" | "Enterprise";

interface Tenant {
  id: string;
  name: string;
  plan: PlanTier;
  status: TenantStatus;
  quotas: QuotaMap;
}

interface QuotaAlert {
  id: string;
  tenantId: string;
  tenantName: string;
  resource: ResourceType;
  usagePercent: number;
  timestamp: string;
  severity: "warning" | "critical";
  recommendation: string;
}

type TabKey = "tenants" | "alerts" | "usage";

// ── Data ───────────────────────────────────────────────────────────────────

const RESOURCE_LABELS: Record<ResourceType, string> = {
  apiCalls: "API Calls",
  storage: "Storage (GB)",
  compute: "Compute (CPU hrs)",
  bandwidth: "Bandwidth (GB)",
};

const RESOURCE_UNITS: Record<ResourceType, string> = {
  apiCalls: "calls",
  storage: "GB",
  compute: "hrs",
  bandwidth: "GB",
};

const RESOURCE_ICONS: Record<ResourceType, string> = {
  apiCalls: "⚡",
  storage: "💾",
  compute: "🖥️",
  bandwidth: "🌐",
};

const initialTenants: Tenant[] = [
  {
    id: "t1",
    name: "Acme Corp",
    plan: "Enterprise",
    status: "active",
    quotas: {
      apiCalls: { used: 920000, limit: 1000000 },
      storage: { used: 410, limit: 500 },
      compute: { used: 780, limit: 1000 },
      bandwidth: { used: 1800, limit: 2000 },
    },
  },
  {
    id: "t2",
    name: "Veritas Inc",
    plan: "Pro",
    status: "active",
    quotas: {
      apiCalls: { used: 340000, limit: 500000 },
      storage: { used: 95, limit: 200 },
      compute: { used: 210, limit: 500 },
      bandwidth: { used: 620, limit: 1000 },
    },
  },
  {
    id: "t3",
    name: "Novo Labs",
    plan: "Enterprise",
    status: "active",
    quotas: {
      apiCalls: { used: 780000, limit: 1000000 },
      storage: { used: 480, limit: 500 },
      compute: { used: 920, limit: 1000 },
      bandwidth: { used: 1750, limit: 2000 },
    },
  },
  {
    id: "t4",
    name: "Helix Dynamics",
    plan: "Starter",
    status: "trial",
    quotas: {
      apiCalls: { used: 45000, limit: 100000 },
      storage: { used: 12, limit: 50 },
      compute: { used: 30, limit: 100 },
      bandwidth: { used: 80, limit: 200 },
    },
  },
  {
    id: "t5",
    name: "Pinnacle AI",
    plan: "Pro",
    status: "active",
    quotas: {
      apiCalls: { used: 490000, limit: 500000 },
      storage: { used: 185, limit: 200 },
      compute: { used: 360, limit: 500 },
      bandwidth: { used: 870, limit: 1000 },
    },
  },
  {
    id: "t6",
    name: "Cascade Systems",
    plan: "Enterprise",
    status: "active",
    quotas: {
      apiCalls: { used: 550000, limit: 1000000 },
      storage: { used: 220, limit: 500 },
      compute: { used: 400, limit: 1000 },
      bandwidth: { used: 950, limit: 2000 },
    },
  },
  {
    id: "t7",
    name: "Orion Health",
    plan: "Free",
    status: "suspended",
    quotas: {
      apiCalls: { used: 10500, limit: 10000 },
      storage: { used: 5.2, limit: 5 },
      compute: { used: 12, limit: 10 },
      bandwidth: { used: 22, limit: 20 },
    },
  },
  {
    id: "t8",
    name: "Meridian Tech",
    plan: "Starter",
    status: "active",
    quotas: {
      apiCalls: { used: 62000, limit: 100000 },
      storage: { used: 28, limit: 50 },
      compute: { used: 55, limit: 100 },
      bandwidth: { used: 110, limit: 200 },
    },
  },
  {
    id: "t9",
    name: "Atlas Ventures",
    plan: "Pro",
    status: "active",
    quotas: {
      apiCalls: { used: 410000, limit: 500000 },
      storage: { used: 170, limit: 200 },
      compute: { used: 475, limit: 500 },
      bandwidth: { used: 720, limit: 1000 },
    },
  },
  {
    id: "t10",
    name: "Solaris Energy",
    plan: "Enterprise",
    status: "trial",
    quotas: {
      apiCalls: { used: 120000, limit: 1000000 },
      storage: { used: 45, limit: 500 },
      compute: { used: 80, limit: 1000 },
      bandwidth: { used: 200, limit: 2000 },
    },
  },
];

const initialAlerts: QuotaAlert[] = [
  {
    id: "a1",
    tenantId: "t1",
    tenantName: "Acme Corp",
    resource: "apiCalls",
    usagePercent: 92,
    timestamp: "2026-02-22T03:12:00Z",
    severity: "critical",
    recommendation: "Upgrade to higher API tier or implement rate limiting",
  },
  {
    id: "a2",
    tenantId: "t3",
    tenantName: "Novo Labs",
    resource: "storage",
    usagePercent: 96,
    timestamp: "2026-02-22T02:45:00Z",
    severity: "critical",
    recommendation: "Expand storage allocation or archive old data",
  },
  {
    id: "a3",
    tenantId: "t3",
    tenantName: "Novo Labs",
    resource: "compute",
    usagePercent: 92,
    timestamp: "2026-02-22T02:30:00Z",
    severity: "critical",
    recommendation: "Scale compute quota or optimize workloads",
  },
  {
    id: "a4",
    tenantId: "t5",
    tenantName: "Pinnacle AI",
    resource: "apiCalls",
    usagePercent: 98,
    timestamp: "2026-02-22T01:58:00Z",
    severity: "critical",
    recommendation: "Immediate upgrade required — nearing hard limit",
  },
  {
    id: "a5",
    tenantId: "t1",
    tenantName: "Acme Corp",
    resource: "bandwidth",
    usagePercent: 90,
    timestamp: "2026-02-22T01:20:00Z",
    severity: "warning",
    recommendation: "Monitor bandwidth; consider CDN offloading",
  },
  {
    id: "a6",
    tenantId: "t7",
    tenantName: "Orion Health",
    resource: "apiCalls",
    usagePercent: 105,
    timestamp: "2026-02-21T23:40:00Z",
    severity: "critical",
    recommendation: "Account suspended — exceeded all resource limits",
  },
  {
    id: "a7",
    tenantId: "t9",
    tenantName: "Atlas Ventures",
    resource: "compute",
    usagePercent: 95,
    timestamp: "2026-02-22T00:15:00Z",
    severity: "critical",
    recommendation: "Increase compute quota before workload failures occur",
  },
  {
    id: "a8",
    tenantId: "t5",
    tenantName: "Pinnacle AI",
    resource: "storage",
    usagePercent: 92.5,
    timestamp: "2026-02-21T22:10:00Z",
    severity: "critical",
    recommendation: "Storage nearing capacity — clean up or expand",
  },
  {
    id: "a9",
    tenantId: "t5",
    tenantName: "Pinnacle AI",
    resource: "bandwidth",
    usagePercent: 87,
    timestamp: "2026-02-21T20:05:00Z",
    severity: "warning",
    recommendation: "Bandwidth usage trending high — review transfer patterns",
  },
  {
    id: "a10",
    tenantId: "t1",
    tenantName: "Acme Corp",
    resource: "compute",
    usagePercent: 78,
    timestamp: "2026-02-21T18:30:00Z",
    severity: "warning",
    recommendation: "Compute usage elevated — plan for scaling if trend continues",
  },
];

const usageHistory: Record<ResourceType, number[]> = {
  apiCalls: [65, 72, 68, 80, 85, 78, 88],
  storage: [55, 58, 60, 62, 65, 68, 72],
  compute: [70, 74, 68, 82, 90, 85, 88],
  bandwidth: [50, 62, 58, 75, 80, 72, 78],
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Helpers ────────────────────────────────────────────────────────────────

function pct(used: number, limit: number): number {
  if (limit === 0) return 0;
  return Math.round((used / limit) * 100);
}

function barColor(percent: number): string {
  if (percent > 90) return "bg-rose-400";
  if (percent >= 70) return "bg-amber-400";
  return "bg-emerald-400";
}

function barTextColor(percent: number): string {
  if (percent > 90) return "text-rose-400";
  if (percent >= 70) return "text-amber-400";
  return "text-emerald-400";
}

function statusBadge(status: TenantStatus): { label: string; cls: string } {
  switch (status) {
    case "active":
      return { label: "Active", cls: "bg-emerald-400/15 text-emerald-400" };
    case "suspended":
      return { label: "Suspended", cls: "bg-rose-400/15 text-rose-400" };
    case "trial":
      return { label: "Trial", cls: "bg-amber-400/15 text-amber-400" };
  }
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(n % 1 === 0 ? 0 : 1);
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function aggregateQuotas(tenants: Tenant[]): QuotaMap {
  const result: QuotaMap = {
    apiCalls: { used: 0, limit: 0 },
    storage: { used: 0, limit: 0 },
    compute: { used: 0, limit: 0 },
    bandwidth: { used: 0, limit: 0 },
  };
  for (const t of tenants) {
    for (const key of Object.keys(result) as ResourceType[]) {
      result[key].used += t.quotas[key].used;
      result[key].limit += t.quotas[key].limit;
    }
  }
  return result;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  const capped = Math.min(percent, 100);
  return (
    <div className={cn("h-2 w-full rounded-full bg-zinc-800", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-300", barColor(percent))}
        style={{ width: `${capped}%` }}
      />
    </div>
  );
}

function OverviewCard({
  resource,
  quota,
}: {
  resource: ResourceType;
  quota: ResourceQuota;
}) {
  const percent = pct(quota.used, quota.limit);
  const unit = RESOURCE_UNITS[resource];
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{RESOURCE_ICONS[resource]}</span>
          <span className="text-sm font-medium text-zinc-400">
            {RESOURCE_LABELS[resource]}
          </span>
        </div>
        <span className={cn("text-sm font-semibold", barTextColor(percent))}>
          {percent}%
        </span>
      </div>
      <ProgressBar percent={percent} />
      <div className="text-xs text-zinc-400">
        {formatNumber(quota.used)} / {formatNumber(quota.limit)} {unit}
      </div>
    </div>
  );
}

function QuotaEditorModal({
  tenant,
  onSave,
  onClose,
}: {
  tenant: Tenant;
  onSave: (tenantId: string, updated: QuotaMap) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<QuotaMap>(
    JSON.parse(JSON.stringify(tenant.quotas)) as QuotaMap
  );

  const handleLimitChange = (resource: ResourceType, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) return;
    setDraft((prev) => ({
      ...prev,
      [resource]: { ...prev[resource], limit: num },
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div>
            <h3 className="text-lg font-semibold text-white">{tenant.name}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">
              Edit resource quotas — {tenant.plan} plan
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors text-xl leading-none px-1"
          >
            ✕
          </button>
        </div>

        {/* Fields */}
        <div className="px-6 py-5 space-y-4">
          {(Object.keys(RESOURCE_LABELS) as ResourceType[]).map((res) => {
            const p = pct(draft[res].used, draft[res].limit);
            return (
              <div key={res} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-zinc-400 flex items-center gap-1.5">
                    <span>{RESOURCE_ICONS[res]}</span>
                    {RESOURCE_LABELS[res]}
                  </label>
                  <span className={cn("text-xs font-medium", barTextColor(p))}>
                    {formatNumber(draft[res].used)} used ({p}%)
                  </span>
                </div>
                <input
                  type="number"
                  min={0}
                  value={draft[res].limit}
                  onChange={(e) => handleLimitChange(res, e.target.value)}
                  className="w-full rounded-lg bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <ProgressBar percent={p} />
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(tenant.id, draft)}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

function UsageChart({
  selectedResource,
  onSelectResource,
}: {
  selectedResource: ResourceType;
  onSelectResource: (r: ResourceType) => void;
}) {
  const data = usageHistory[selectedResource];
  const maxVal = Math.max(...data);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">
          7-Day Usage Trend
        </h3>
        <select
          value={selectedResource}
          onChange={(e) => onSelectResource(e.target.value as ResourceType)}
          className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {(Object.keys(RESOURCE_LABELS) as ResourceType[]).map((r) => (
            <option key={r} value={r}>
              {RESOURCE_LABELS[r]}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end gap-2 h-40">
        {data.map((val, i) => {
          const heightPct = maxVal > 0 ? (val / maxVal) * 100 : 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className={cn("text-[10px] font-medium", barTextColor(val))}>
                {val}%
              </span>
              <div className="w-full flex items-end h-28">
                <div
                  className={cn(
                    "w-full rounded-t-md transition-all duration-300",
                    barColor(val)
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span className="text-[10px] text-zinc-500">{DAY_LABELS[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function ResourceQuotaManager() {
  const [tenants, setTenants] = useState<Tenant[]>(initialTenants);
  const [activeTab, setActiveTab] = useState<TabKey>("tenants");
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [chartResource, setChartResource] = useState<ResourceType>("apiCalls");

  const aggregated = aggregateQuotas(tenants);
  const resources: ResourceType[] = ["apiCalls", "storage", "compute", "bandwidth"];

  const handleSaveQuota = (tenantId: string, updated: QuotaMap) => {
    setTenants((prev) =>
      prev.map((t) => (t.id === tenantId ? { ...t, quotas: updated } : t))
    );
    setEditingTenant(null);
  };

  const handleToggleSuspend = (tenantId: string) => {
    setTenants((prev) =>
      prev.map((t) =>
        t.id === tenantId
          ? { ...t, status: t.status === "suspended" ? "active" : "suspended" }
          : t
      )
    );
  };

  const tabs: { key: TabKey; label: string; icon: string }[] = [
    { key: "tenants", label: "Tenants", icon: "👥" },
    { key: "alerts", label: "Alerts", icon: "🔔" },
    { key: "usage", label: "Usage", icon: "📊" },
  ];

  const alertCount = initialAlerts.filter((a) => a.severity === "critical").length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Resource Quota Manager</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Monitor and manage multi-tenant resource allocation
        </p>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {resources.map((r) => (
          <OverviewCard key={r} resource={r} quota={aggregated[r]} />
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === tab.key
                ? "text-white"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <span>{tab.icon}</span>
            {tab.label}
            {tab.key === "alerts" && alertCount > 0 && (
              <span className="ml-1 bg-rose-400/20 text-rose-400 text-[10px] font-semibold rounded-full px-1.5 py-0.5">
                {alertCount}
              </span>
            )}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content: Tenants */}
      {activeTab === "tenants" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Tenant
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider min-w-[160px]">
                    API Quota
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Storage
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Compute
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => {
                  const apiPct = pct(tenant.quotas.apiCalls.used, tenant.quotas.apiCalls.limit);
                  const storagePct = pct(tenant.quotas.storage.used, tenant.quotas.storage.limit);
                  const computePct = pct(tenant.quotas.compute.used, tenant.quotas.compute.limit);
                  const badge = statusBadge(tenant.status);

                  return (
                    <tr
                      key={tenant.id}
                      className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <span className="font-medium text-white">{tenant.name}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-zinc-400">{tenant.plan}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <ProgressBar percent={apiPct} className="flex-1" />
                          <span className={cn("text-xs font-medium w-10 text-right", barTextColor(apiPct))}>
                            {apiPct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <ProgressBar percent={storagePct} className="flex-1 max-w-[80px]" />
                          <span className={cn("text-xs font-medium w-10 text-right", barTextColor(storagePct))}>
                            {storagePct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <ProgressBar percent={computePct} className="flex-1 max-w-[80px]" />
                          <span className={cn("text-xs font-medium w-10 text-right", barTextColor(computePct))}>
                            {computePct}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            "inline-block text-xs font-medium rounded-full px-2.5 py-1",
                            badge.cls
                          )}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setEditingTenant(tenant)}
                            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:text-white hover:border-indigo-500 hover:bg-indigo-500/10 transition-colors"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            onClick={() => handleToggleSuspend(tenant.id)}
                            className={cn(
                              "text-xs px-3 py-1.5 rounded-lg border transition-colors",
                              tenant.status === "suspended"
                                ? "border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                                : "border-zinc-700 text-zinc-400 hover:text-rose-400 hover:border-rose-500/40 hover:bg-rose-500/10"
                            )}
                          >
                            {tenant.status === "suspended" ? "▶ Activate" : "⏸ Suspend"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab content: Alerts */}
      {activeTab === "alerts" && (
        <div className="space-y-3">
          {initialAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "bg-zinc-900 border rounded-xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3",
                alert.severity === "critical"
                  ? "border-rose-500/30"
                  : "border-amber-500/30"
              )}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-lg">
                  {alert.severity === "critical" ? "🚨" : "⚠️"}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-white text-sm">
                      {alert.tenantName}
                    </span>
                    <span className="text-xs text-zinc-500">·</span>
                    <span className="text-xs text-zinc-400">
                      {RESOURCE_LABELS[alert.resource]}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full",
                        alert.usagePercent > 100
                          ? "bg-rose-400/20 text-rose-400"
                          : alert.usagePercent > 90
                          ? "bg-rose-400/15 text-rose-400"
                          : "bg-amber-400/15 text-amber-400"
                      )}
                    >
                      {alert.usagePercent}%
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1 truncate">
                    {alert.recommendation}
                  </p>
                </div>
              </div>
              <div className="text-xs text-zinc-500 whitespace-nowrap sm:text-right">
                {formatTimestamp(alert.timestamp)}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab content: Usage */}
      {activeTab === "usage" && (
        <UsageChart
          selectedResource={chartResource}
          onSelectResource={setChartResource}
        />
      )}

      {/* Editor modal */}
      {editingTenant && (
        <QuotaEditorModal
          tenant={editingTenant}
          onSave={handleSaveQuota}
          onClose={() => setEditingTenant(null)}
        />
      )}
    </div>
  );
}
