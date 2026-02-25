import React, { useState } from "react";
import { cn } from "../lib/utils";

type TierType = "starter" | "growth" | "enterprise" | "trial";
type TenantHealth = "healthy" | "warning" | "critical" | "churning";

interface TenantUsage {
  id: string;
  name: string;
  tier: TierType;
  health: TenantHealth;
  mau: number;
  mauLimit: number;
  apiCalls: number;
  apiLimit: number;
  storageGB: number;
  storageLimit: number;
  agentCount: number;
  agentLimit: number;
  mrr: number;
  joinedAt: string;
  lastActiveAt: string;
  overageCharges: number;
}

interface UsageTrend {
  month: string;
  apiCalls: number;
  mau: number;
  storageGB: number;
}

interface PlatformMetric {
  label: string;
  value: string;
  sub: string;
  trend: number;
  unit: string;
}

const TENANTS: TenantUsage[] = [
  {
    id: "t1", name: "Acme Corporation", tier: "enterprise", health: "healthy",
    mau: 842, mauLimit: 2000, apiCalls: 4821034, apiLimit: 10000000,
    storageGB: 128.4, storageLimit: 500, agentCount: 47, agentLimit: 100,
    mrr: 4999, joinedAt: "2024-06-15", lastActiveAt: "2026-02-22T14:30:00Z", overageCharges: 0,
  },
  {
    id: "t2", name: "TechFlow Inc.", tier: "growth", health: "warning",
    mau: 284, mauLimit: 300, apiCalls: 1892401, apiLimit: 2000000,
    storageGB: 42.1, storageLimit: 50, agentCount: 12, agentLimit: 15,
    mrr: 999, joinedAt: "2025-01-10", lastActiveAt: "2026-02-22T12:00:00Z", overageCharges: 45.00,
  },
  {
    id: "t3", name: "BuildCo", tier: "starter", health: "healthy",
    mau: 18, mauLimit: 50, apiCalls: 124892, apiLimit: 500000,
    storageGB: 2.3, storageLimit: 10, agentCount: 3, agentLimit: 5,
    mrr: 99, joinedAt: "2025-11-05", lastActiveAt: "2026-02-22T10:00:00Z", overageCharges: 0,
  },
  {
    id: "t4", name: "GlobalOps Ltd", tier: "enterprise", health: "critical",
    mau: 1941, mauLimit: 2000, apiCalls: 9842910, apiLimit: 10000000,
    storageGB: 489.2, storageLimit: 500, agentCount: 98, agentLimit: 100,
    mrr: 4999, joinedAt: "2024-03-01", lastActiveAt: "2026-02-22T14:28:00Z", overageCharges: 284.50,
  },
  {
    id: "t5", name: "Startup Labs", tier: "trial", health: "healthy",
    mau: 8, mauLimit: 20, apiCalls: 48210, apiLimit: 100000,
    storageGB: 0.8, storageLimit: 5, agentCount: 2, agentLimit: 3,
    mrr: 0, joinedAt: "2026-02-10", lastActiveAt: "2026-02-22T09:00:00Z", overageCharges: 0,
  },
  {
    id: "t6", name: "DataDriven Co", tier: "growth", health: "churning",
    mau: 42, mauLimit: 300, apiCalls: 182410, apiLimit: 2000000,
    storageGB: 8.4, storageLimit: 50, agentCount: 4, agentLimit: 15,
    mrr: 999, joinedAt: "2024-11-20", lastActiveAt: "2026-01-15T14:00:00Z", overageCharges: 0,
  },
  {
    id: "t7", name: "CloudFirst", tier: "enterprise", health: "healthy",
    mau: 1284, mauLimit: 2000, apiCalls: 7421984, apiLimit: 10000000,
    storageGB: 321.8, storageLimit: 500, agentCount: 72, agentLimit: 100,
    mrr: 4999, joinedAt: "2024-01-15", lastActiveAt: "2026-02-22T14:25:00Z", overageCharges: 0,
  },
];

const TRENDS: UsageTrend[] = [
  { month: "Sep", apiCalls: 18421, mau: 2841, storageGB: 892 },
  { month: "Oct", apiCalls: 21084, mau: 3124, storageGB: 981 },
  { month: "Nov", apiCalls: 24932, mau: 3489, storageGB: 1042 },
  { month: "Dec", apiCalls: 22841, mau: 3201, storageGB: 1089 },
  { month: "Jan", apiCalls: 28491, mau: 3842, storageGB: 1124 },
  { month: "Feb", apiCalls: 31248, mau: 4219, storageGB: 1198 },
];

const PLATFORM_METRICS: PlatformMetric[] = [
  { label: "Total MRR", value: "$12,094", sub: "across all tenants", trend: 8.4, unit: "%" },
  { label: "Active Tenants", value: "6", sub: "of 7 total (1 churning)", trend: -14.3, unit: "%" },
  { label: "Platform API Calls", value: "24.4M", sub: "this month", trend: 12.1, unit: "%" },
  { label: "Total Storage", value: "993 GB", sub: "of 1,115 GB provisioned", trend: 4.2, unit: "%" },
  { label: "Overage Revenue", value: "$329.50", sub: "from 2 tenants", trend: 22.4, unit: "%" },
];

const TABS = ["Overview", "Tenants", "Usage Trends", "Alerts"] as const;
type Tab = typeof TABS[number];

const tierColor: Record<TierType, string> = {
  starter:    "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/30",
  growth:     "text-primary bg-primary/10 border-primary/30",
  enterprise: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  trial:      "text-blue-400 bg-blue-400/10 border-blue-400/30",
};

const healthColor: Record<TenantHealth, string> = {
  healthy:  "text-emerald-400",
  warning:  "text-amber-400",
  critical: "text-rose-400",
  churning: "text-[var(--color-text-secondary)]",
};

const healthBg: Record<TenantHealth, string> = {
  healthy:  "bg-emerald-400",
  warning:  "bg-amber-400",
  critical: "bg-rose-400",
  churning: "bg-[var(--color-surface-3)]",
};

function usagePct(used: number, limit: number): number {
  return Math.min(100, Math.round((used / limit) * 100));
}

function usageColor(pct: number): string {
  if (pct >= 95) {return "bg-rose-500";}
  if (pct >= 80) {return "bg-amber-500";}
  return "bg-primary";
}

export default function TenantUsageDashboard(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("Overview");
  const [selectedTenant, setSelectedTenant] = useState<TenantUsage>(TENANTS[0]);
  const [healthFilter, setHealthFilter] = useState<TenantHealth | "all">("all");
  const [tierFilter, setTierFilter] = useState<TierType | "all">("all");

  const filteredTenants = TENANTS.filter((t) => {
    if (healthFilter !== "all" && t.health !== healthFilter) {return false;}
    if (tierFilter !== "all" && t.tier !== tierFilter) {return false;}
    return true;
  });

  const maxTrend = Math.max(...TRENDS.map(t => t.apiCalls));

  const warningCount = TENANTS.filter(t => t.health === "warning" || t.health === "critical").length;
  const churningCount = TENANTS.filter(t => t.health === "churning").length;

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Tenant Usage Dashboard</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Multi-tenant platform usage monitoring, quota management, and churn signals</p>
        </div>
        <div className="flex items-center gap-3">
          {warningCount > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-rose-400/10 border border-rose-400/30 text-rose-400">
              ⚠ {warningCount} at-risk
            </span>
          )}
          {churningCount > 0 && (
            <span className="text-xs px-2 py-1 rounded bg-[var(--color-surface-3)]/10 border border-[var(--color-surface-3)]/30 text-[var(--color-text-secondary)]">
              {churningCount} churning
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-[var(--color-border)] shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t transition-colors border-b-2 -mb-px",
              tab === t
                ? "text-primary border-primary"
                : "text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* ── OVERVIEW ── */}
        {tab === "Overview" && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {PLATFORM_METRICS.map((m) => (
                <div key={m.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                  <div className="text-xs text-[var(--color-text-secondary)]">{m.label}</div>
                  <div className="text-xl font-bold mt-1">{m.value}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{m.sub}</div>
                  <div className={cn("text-xs font-mono mt-1", m.trend >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    {m.trend >= 0 ? "▲" : "▼"} {Math.abs(m.trend)}{m.unit}
                  </div>
                </div>
              ))}
            </div>

            {/* Tier distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
                <h3 className="text-sm font-medium mb-4">Tier Distribution</h3>
                {(["enterprise", "growth", "starter", "trial"] as const).map((tier) => {
                  const count = TENANTS.filter(t => t.tier === tier).length;
                  return (
                    <div key={tier} className="flex items-center gap-3 mb-3">
                      <div className="w-20 text-xs capitalize text-[var(--color-text-secondary)]">{tier}</div>
                      <div className="flex-1 h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${(count / TENANTS.length) * 100}%` }} />
                      </div>
                      <div className="w-6 text-xs text-right text-[var(--color-text-primary)]">{count}</div>
                    </div>
                  );
                })}
              </div>

              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
                <h3 className="text-sm font-medium mb-4">Health Status</h3>
                {(["healthy", "warning", "critical", "churning"] as const).map((h) => {
                  const count = TENANTS.filter(t => t.health === h).length;
                  return (
                    <div key={h} className="flex items-center gap-3 mb-3">
                      <div className="w-2 h-2 rounded-full shrink-0 mt-0.5" style={{ backgroundColor: h === "healthy" ? "#34d399" : h === "warning" ? "#fbbf24" : h === "critical" ? "#f87171" : "#71717a" }} />
                      <div className="w-16 text-xs capitalize text-[var(--color-text-secondary)]">{h}</div>
                      <div className="flex-1 h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", healthBg[h as TenantHealth])} style={{ width: `${(count / TENANTS.length) * 100}%` }} />
                      </div>
                      <div className="w-6 text-xs text-right text-[var(--color-text-primary)]">{count}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── TENANTS ── */}
        {tab === "Tenants" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <div className="flex gap-1">
                <span className="text-xs text-[var(--color-text-muted)] self-center mr-1">Health:</span>
                {(["all", "healthy", "warning", "critical", "churning"] as const).map((h) => (
                  <button key={h} onClick={() => setHealthFilter(h)}
                    className={cn("px-2 py-0.5 text-[10px] rounded border transition-colors",
                      healthFilter === h ? "bg-primary/20 border-primary text-indigo-300" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)]"
                    )}>{h}</button>
                ))}
              </div>
              <div className="flex gap-1">
                <span className="text-xs text-[var(--color-text-muted)] self-center mr-1">Tier:</span>
                {(["all", "enterprise", "growth", "starter", "trial"] as const).map((t) => (
                  <button key={t} onClick={() => setTierFilter(t)}
                    className={cn("px-2 py-0.5 text-[10px] rounded border transition-colors",
                      tierFilter === t ? "bg-primary/20 border-primary text-indigo-300" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)]"
                    )}>{t}</button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {filteredTenants.map((tenant) => {
                const apiPct = usagePct(tenant.apiCalls, tenant.apiLimit);
                const mauPct = usagePct(tenant.mau, tenant.mauLimit);
                const storagePct = usagePct(tenant.storageGB, tenant.storageLimit);
                return (
                  <div
                    key={tenant.id}
                    onClick={() => setSelectedTenant(tenant)}
                    className={cn(
                      "bg-[var(--color-surface-1)] border rounded-lg p-5 cursor-pointer transition-colors",
                      selectedTenant.id === tenant.id ? "border-primary/50" : "border-[var(--color-border)] hover:border-[var(--color-border)]"
                    )}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-2.5 h-2.5 rounded-full shrink-0 mt-0.5", healthBg[tenant.health])} />
                        <div>
                          <div className="text-sm font-semibold">{tenant.name}</div>
                          <div className="text-xs text-[var(--color-text-muted)]">Joined {tenant.joinedAt} · MRR: ${tenant.mrr.toLocaleString()}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", tierColor[tenant.tier])}>{tenant.tier}</span>
                        <span className={cn("text-xs", healthColor[tenant.health])}>{tenant.health}</span>
                        {tenant.overageCharges > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400">
                            +${tenant.overageCharges} overage
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: "API Calls", pct: apiPct, used: (tenant.apiCalls / 1000000).toFixed(1) + "M", limit: (tenant.apiLimit / 1000000) + "M" },
                        { label: "MAU", pct: mauPct, used: tenant.mau.toLocaleString(), limit: tenant.mauLimit.toLocaleString() },
                        { label: "Storage", pct: storagePct, used: tenant.storageGB.toFixed(1) + " GB", limit: tenant.storageLimit + " GB" },
                      ].map((u) => (
                        <div key={u.label}>
                          <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
                            <span>{u.label}</span>
                            <span className={cn(u.pct >= 95 ? "text-rose-400" : u.pct >= 80 ? "text-amber-400" : "text-[var(--color-text-secondary)]")}>{u.pct}%</span>
                          </div>
                          <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", usageColor(u.pct))} style={{ width: `${u.pct}%` }} />
                          </div>
                          <div className="text-[10px] text-[var(--color-text-muted)] mt-1">{u.used} / {u.limit}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── USAGE TRENDS ── */}
        {tab === "Usage Trends" && (
          <div className="space-y-6">
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
              <h3 className="text-sm font-medium mb-4">Platform API Calls (6 months, thousands)</h3>
              <div className="flex items-end gap-3 h-36">
                {TRENDS.map((t) => {
                  const h = Math.round((t.apiCalls / maxTrend) * 120);
                  return (
                    <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[10px] text-[var(--color-text-secondary)]">{(t.apiCalls / 1000).toFixed(0)}k</div>
                      <div className="w-full bg-primary rounded-t" style={{ height: h }} />
                      <div className="text-[10px] text-[var(--color-text-muted)]">{t.month}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
                <h3 className="text-sm font-medium mb-4">MAU Growth</h3>
                <div className="flex items-end gap-2 h-24">
                  {TRENDS.map((t) => {
                    const maxMau = Math.max(...TRENDS.map(x => x.mau));
                    const h = Math.round((t.mau / maxMau) * 80);
                    return (
                      <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-emerald-500 rounded-t" style={{ height: h }} />
                        <div className="text-[10px] text-[var(--color-text-muted)]">{t.month}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
                <h3 className="text-sm font-medium mb-4">Storage Growth (GB)</h3>
                <div className="flex items-end gap-2 h-24">
                  {TRENDS.map((t) => {
                    const maxSto = Math.max(...TRENDS.map(x => x.storageGB));
                    const h = Math.round((t.storageGB / maxSto) * 80);
                    return (
                      <div key={t.month} className="flex-1 flex flex-col items-center gap-1">
                        <div className="w-full bg-amber-500 rounded-t" style={{ height: h }} />
                        <div className="text-[10px] text-[var(--color-text-muted)]">{t.month}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── ALERTS ── */}
        {tab === "Alerts" && (
          <div className="space-y-3">
            {TENANTS.filter(t => t.health !== "healthy").map((t) => {
              const apiPct = usagePct(t.apiCalls, t.apiLimit);
              const mauPct = usagePct(t.mau, t.mauLimit);
              const storagePct = usagePct(t.storageGB, t.storageLimit);
              const alerts: string[] = [];
              if (apiPct >= 90) {alerts.push(`API calls at ${apiPct}% of limit`);}
              if (mauPct >= 90) {alerts.push(`MAU at ${mauPct}% of limit`);}
              if (storagePct >= 90) {alerts.push(`Storage at ${storagePct}% of limit`);}
              if (t.health === "churning") {alerts.push("Usage declining — possible churn risk");}
              if (t.overageCharges > 0) {alerts.push(`Overage charges: $${t.overageCharges}`);}
              return (
                <div key={t.id} className={cn("bg-[var(--color-surface-1)] rounded-lg p-4 border",
                  t.health === "critical" ? "border-rose-500/40" :
                  t.health === "warning" ? "border-amber-500/40" : "border-[var(--color-border)]"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("text-sm font-semibold", healthColor[t.health])}>{t.name}</span>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", tierColor[t.tier])}>{t.tier}</span>
                    <span className="text-xs text-[var(--color-text-secondary)] ml-auto">${t.mrr}/mo</span>
                  </div>
                  <div className="space-y-1">
                    {alerts.length > 0 ? alerts.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-[var(--color-text-primary)]">
                        <span className={cn(t.health === "critical" ? "text-rose-400" : "text-amber-400")}>•</span>
                        {a}
                      </div>
                    )) : (
                      <div className="text-xs text-[var(--color-text-muted)]">No active alerts</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
