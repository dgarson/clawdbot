import React, { useState } from "react";
import { cn } from "../lib/utils";

type QuotaScope = "global" | "tenant" | "user" | "api-key";
type QuotaStatus = "ok" | "warning" | "critical" | "exceeded";
type QuotaUnit = "requests" | "tokens" | "compute" | "storage" | "bandwidth";
type ResetPeriod = "hourly" | "daily" | "weekly" | "monthly";

interface QuotaUsage {
  current: number;
  limit: number;
  unit: QuotaUnit;
  resetPeriod: ResetPeriod;
  lastReset: string;
  nextReset: string;
}

interface QuotaAlert {
  id: string;
  quotaId: string;
  threshold: number;
  notifyEmail: boolean;
  notifySlack: boolean;
}

interface ResourceQuota {
  id: string;
  name: string;
  scope: QuotaScope;
  entityId: string;
  entityName: string;
  status: QuotaStatus;
  usages: QuotaUsage[];
  alerts: QuotaAlert[];
  createdAt: string;
  updatedAt: string;
  notes: string;
}

interface UsageTrend {
  hour: string;
  requests: number;
  tokens: number;
  compute: number;
}

const QUOTAS: ResourceQuota[] = [
  {
    id: "q1",
    name: "Acme Corp Production",
    scope: "tenant",
    entityId: "t-001",
    entityName: "Acme Corp",
    status: "warning",
    usages: [
      { current: 845000, limit: 1000000, unit: "requests", resetPeriod: "monthly", lastReset: "2026-02-01", nextReset: "2026-03-01" },
      { current: 42000000, limit: 50000000, unit: "tokens", resetPeriod: "monthly", lastReset: "2026-02-01", nextReset: "2026-03-01" },
      { current: 680, limit: 1000, unit: "compute", resetPeriod: "daily", lastReset: "2026-02-22", nextReset: "2026-02-23" },
    ],
    alerts: [{ id: "a1", quotaId: "q1", threshold: 80, notifyEmail: true, notifySlack: true }],
    createdAt: "2026-01-01",
    updatedAt: "2026-02-22",
    notes: "Enterprise plan customer — monitor closely",
  },
  {
    id: "q2",
    name: "Globex Corp API",
    scope: "tenant",
    entityId: "t-002",
    entityName: "Globex Corp",
    status: "ok",
    usages: [
      { current: 120000, limit: 500000, unit: "requests", resetPeriod: "monthly", lastReset: "2026-02-01", nextReset: "2026-03-01" },
      { current: 6500000, limit: 25000000, unit: "tokens", resetPeriod: "monthly", lastReset: "2026-02-01", nextReset: "2026-03-01" },
      { current: 210, limit: 500, unit: "compute", resetPeriod: "daily", lastReset: "2026-02-22", nextReset: "2026-02-23" },
    ],
    alerts: [{ id: "a2", quotaId: "q2", threshold: 75, notifyEmail: true, notifySlack: false }],
    createdAt: "2026-01-15",
    updatedAt: "2026-02-20",
    notes: "",
  },
  {
    id: "q3",
    name: "Initech Dev Environment",
    scope: "tenant",
    entityId: "t-003",
    entityName: "Initech",
    status: "ok",
    usages: [
      { current: 8000, limit: 100000, unit: "requests", resetPeriod: "monthly", lastReset: "2026-02-01", nextReset: "2026-03-01" },
      { current: 400000, limit: 5000000, unit: "tokens", resetPeriod: "monthly", lastReset: "2026-02-01", nextReset: "2026-03-01" },
      { current: 15, limit: 100, unit: "compute", resetPeriod: "daily", lastReset: "2026-02-22", nextReset: "2026-02-23" },
    ],
    alerts: [],
    createdAt: "2026-02-10",
    updatedAt: "2026-02-21",
    notes: "Trial account",
  },
  {
    id: "q4",
    name: "Power User: alice@example.com",
    scope: "user",
    entityId: "u-901",
    entityName: "alice@example.com",
    status: "critical",
    usages: [
      { current: 9600, limit: 10000, unit: "requests", resetPeriod: "daily", lastReset: "2026-02-22", nextReset: "2026-02-23" },
      { current: 480000, limit: 500000, unit: "tokens", resetPeriod: "daily", lastReset: "2026-02-22", nextReset: "2026-02-23" },
    ],
    alerts: [{ id: "a4", quotaId: "q4", threshold: 90, notifyEmail: true, notifySlack: true }],
    createdAt: "2026-01-20",
    updatedAt: "2026-02-22",
    notes: "High-volume ML researcher",
  },
  {
    id: "q5",
    name: "API Key: prod-svc-key-7",
    scope: "api-key",
    entityId: "k-007",
    entityName: "prod-svc-key-7",
    status: "exceeded",
    usages: [
      { current: 5100, limit: 5000, unit: "requests", resetPeriod: "hourly", lastReset: "2026-02-22T14:00", nextReset: "2026-02-22T15:00" },
    ],
    alerts: [{ id: "a5", quotaId: "q5", threshold: 95, notifyEmail: false, notifySlack: true }],
    createdAt: "2026-02-01",
    updatedAt: "2026-02-22",
    notes: "Automated ingestion pipeline — review rate",
  },
  {
    id: "q6",
    name: "Global Storage Quota",
    scope: "global",
    entityId: "global",
    entityName: "Platform",
    status: "ok",
    usages: [
      { current: 2400, limit: 10000, unit: "storage", resetPeriod: "monthly", lastReset: "2026-02-01", nextReset: "2026-03-01" },
      { current: 890, limit: 5000, unit: "bandwidth", resetPeriod: "daily", lastReset: "2026-02-22", nextReset: "2026-02-23" },
    ],
    alerts: [{ id: "a6", quotaId: "q6", threshold: 85, notifyEmail: true, notifySlack: true }],
    createdAt: "2025-12-01",
    updatedAt: "2026-02-22",
    notes: "Platform-wide cap — alert ops before 85%",
  },
];

const TREND_DATA: UsageTrend[] = [
  { hour: "08:00", requests: 12000, tokens: 600000, compute: 28 },
  { hour: "09:00", requests: 28000, tokens: 1400000, compute: 52 },
  { hour: "10:00", requests: 45000, tokens: 2200000, compute: 78 },
  { hour: "11:00", requests: 62000, tokens: 3100000, compute: 95 },
  { hour: "12:00", requests: 38000, tokens: 1900000, compute: 64 },
  { hour: "13:00", requests: 41000, tokens: 2050000, compute: 70 },
  { hour: "14:00", requests: 55000, tokens: 2750000, compute: 88 },
  { hour: "15:00", requests: 48000, tokens: 2400000, compute: 81 },
];

function statusColor(s: QuotaStatus) {
  if (s === "ok") {return "text-emerald-400";}
  if (s === "warning") {return "text-amber-400";}
  if (s === "critical") {return "text-orange-400";}
  return "text-rose-400";
}
function statusBg(s: QuotaStatus) {
  if (s === "ok") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "warning") {return "bg-amber-400/10 text-amber-400";}
  if (s === "critical") {return "bg-orange-400/10 text-orange-400";}
  return "bg-rose-400/10 text-rose-400";
}
function scopeBg(s: QuotaScope) {
  if (s === "global") {return "bg-purple-500/10 text-purple-400";}
  if (s === "tenant") {return "bg-primary/10 text-primary";}
  if (s === "user") {return "bg-cyan-500/10 text-cyan-400";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]";
}
function pct(usage: QuotaUsage) {
  return Math.min((usage.current / usage.limit) * 100, 100);
}
function barColor(p: number) {
  if (p >= 100) {return "bg-rose-500";}
  if (p >= 90) {return "bg-orange-500";}
  if (p >= 75) {return "bg-amber-500";}
  return "bg-primary";
}
function fmt(n: number) {
  if (n >= 1_000_000) {return (n / 1_000_000).toFixed(1) + "M";}
  if (n >= 1_000) {return (n / 1_000).toFixed(1) + "K";}
  return String(n);
}

function QuotaBar({ usage }: { usage: QuotaUsage }) {
  const p = pct(usage);
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-1">
        <span className="capitalize">{usage.unit}</span>
        <span>{fmt(usage.current)} / {fmt(usage.limit)} <span className="text-[var(--color-text-muted)]">({p.toFixed(1)}%)</span></span>
      </div>
      <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", barColor(p))} style={{ width: `${p}%` }} />
      </div>
      <div className="text-xs text-[var(--color-text-muted)] mt-1">Resets {usage.resetPeriod} · next {usage.nextReset}</div>
    </div>
  );
}

function TrendChart({ data }: { data: UsageTrend[] }) {
  const maxReq = Math.max(...data.map(d => d.requests));
  return (
    <div>
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full bg-[var(--color-surface-2)] rounded-sm overflow-hidden flex flex-col-reverse" style={{ height: "80px" }}>
              <div className="bg-primary rounded-sm" style={{ height: `${(d.requests / maxReq) * 100}%` }} />
            </div>
            <span className="text-xs text-[var(--color-text-muted)]">{d.hour}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResourceQuotaManager() {
  const [tab, setTab] = useState<"quotas" | "alerts" | "trends" | "settings">("quotas");
  const [scopeFilter, setScopeFilter] = useState<QuotaScope | "all">("all");
  const [statusFilter, setStatusFilter] = useState<QuotaStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<ResourceQuota | null>(null);

  const filtered = QUOTAS.filter(q => {
    if (scopeFilter !== "all" && q.scope !== scopeFilter) {return false;}
    if (statusFilter !== "all" && q.status !== statusFilter) {return false;}
    if (search && !q.name.toLowerCase().includes(search.toLowerCase()) && !q.entityName.toLowerCase().includes(search.toLowerCase())) {return false;}
    return true;
  });

  const alerts = QUOTAS.filter(q => q.status === "critical" || q.status === "exceeded");
  const statusCounts: Record<QuotaStatus, number> = { ok: 0, warning: 0, critical: 0, exceeded: 0 };
  QUOTAS.forEach(q => { statusCounts[q.status]++; });

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Resource Quota Manager</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Monitor and manage usage limits across tenants, users, and API keys</p>
        </div>
        <div className="flex gap-2">
          {alerts.length > 0 && (
            <span className="bg-rose-500/10 text-rose-400 text-xs px-2 py-1 rounded-full border border-rose-500/30">
              {alerts.length} quota{alerts.length > 1 ? "s" : ""} over limit
            </span>
          )}
          <button className="bg-primary hover:bg-primary text-[var(--color-text-primary)] text-sm px-3 py-1.5 rounded-lg transition-colors">
            + New Quota
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-[var(--color-border)] px-6">
        <div className="flex gap-6">
          {(["quotas", "alerts", "trends", "settings"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "py-3 text-sm font-medium border-b-2 capitalize transition-colors",
                tab === t ? "border-primary text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {t}
              {t === "alerts" && alerts.length > 0 && (
                <span className="ml-1.5 bg-rose-500 text-[var(--color-text-primary)] text-xs px-1.5 rounded-full">{alerts.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* QUOTAS TAB */}
        {tab === "quotas" && (
          <div className="flex h-full">
            {/* List */}
            <div className="w-96 border-r border-[var(--color-border)] flex flex-col">
              {/* Filters */}
              <div className="p-4 border-b border-[var(--color-border)] space-y-3">
                <input
                  type="text"
                  placeholder="Search quotas..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full bg-[var(--color-surface-2)] text-sm rounded-lg px-3 py-2 text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex gap-2">
                  <select
                    value={scopeFilter}
                    onChange={e => setScopeFilter(e.target.value as QuotaScope | "all")}
                    className="flex-1 bg-[var(--color-surface-2)] text-sm rounded-lg px-2 py-1.5 text-[var(--color-text-primary)] outline-none"
                  >
                    <option value="all">All Scopes</option>
                    <option value="global">Global</option>
                    <option value="tenant">Tenant</option>
                    <option value="user">User</option>
                    <option value="api-key">API Key</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as QuotaStatus | "all")}
                    className="flex-1 bg-[var(--color-surface-2)] text-sm rounded-lg px-2 py-1.5 text-[var(--color-text-primary)] outline-none"
                  >
                    <option value="all">All Status</option>
                    <option value="ok">OK</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                    <option value="exceeded">Exceeded</option>
                  </select>
                </div>
              </div>
              <div className="overflow-y-auto flex-1">
                {filtered.map(q => (
                  <button
                    key={q.id}
                    onClick={() => setSelected(q)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-1)] transition-colors",
                      selected?.id === q.id && "bg-[var(--color-surface-1)] border-l-2 border-l-indigo-500"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{q.name}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full ml-2 shrink-0", statusBg(q.status))}>
                        {q.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded", scopeBg(q.scope))}>{q.scope}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{q.usages.length} metric{q.usages.length > 1 ? "s" : ""}</span>
                    </div>
                    {/* Quick usage bars */}
                    <div className="mt-2 space-y-1">
                      {q.usages.slice(0, 2).map((u, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-[var(--color-text-muted)] w-16 truncate capitalize">{u.unit}</span>
                          <div className="flex-1 h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                            <div className={cn("h-full rounded-full", barColor(pct(u)))} style={{ width: `${pct(u)}%` }} />
                          </div>
                          <span className="text-xs text-[var(--color-text-muted)] w-10 text-right">{pct(u).toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-[var(--color-text-muted)]">
                    <span className="text-3xl mb-2">📭</span>
                    <span className="text-sm">No quotas match filters</span>
                  </div>
                )}
              </div>
            </div>

            {/* Detail */}
            <div className="flex-1 overflow-y-auto">
              {selected ? (
                <div className="p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">{selected.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", scopeBg(selected.scope))}>{selected.scope}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBg(selected.status))}>{selected.status}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">Entity: {selected.entityName}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-sm px-3 py-1.5 rounded-lg text-[var(--color-text-primary)] transition-colors">Edit</button>
                      <button className="bg-rose-900/50 hover:bg-rose-900 text-rose-400 text-sm px-3 py-1.5 rounded-lg transition-colors">Delete</button>
                    </div>
                  </div>

                  {/* Usage metrics */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-5 mb-4">
                    <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Usage Metrics</h3>
                    {selected.usages.map((u, i) => (
                      <QuotaBar key={i} usage={u} />
                    ))}
                  </div>

                  {/* Alerts config */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-5 mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Alert Thresholds</h3>
                      <button className="text-xs text-primary hover:text-indigo-300">+ Add Alert</button>
                    </div>
                    {selected.alerts.length > 0 ? (
                      selected.alerts.map(a => (
                        <div key={a.id} className="bg-[var(--color-surface-2)] rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <span className="text-sm text-[var(--color-text-primary)]">Alert at <span className="text-amber-400">{a.threshold}%</span></span>
                            <div className="flex gap-3 mt-1">
                              <span className={cn("text-xs", a.notifyEmail ? "text-emerald-400" : "text-[var(--color-text-muted)]")}>✉ Email</span>
                              <span className={cn("text-xs", a.notifySlack ? "text-emerald-400" : "text-[var(--color-text-muted)]")}>💬 Slack</span>
                            </div>
                          </div>
                          <button className="text-[var(--color-text-muted)] hover:text-rose-400 text-sm transition-colors">✕</button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--color-text-muted)]">No alerts configured</p>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="bg-[var(--color-surface-1)] rounded-xl p-5">
                    <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Metadata</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-[var(--color-text-muted)] text-xs mb-0.5">Created</div>
                        <div className="text-[var(--color-text-primary)]">{selected.createdAt}</div>
                      </div>
                      <div>
                        <div className="text-[var(--color-text-muted)] text-xs mb-0.5">Updated</div>
                        <div className="text-[var(--color-text-primary)]">{selected.updatedAt}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-[var(--color-text-muted)] text-xs mb-0.5">Notes</div>
                        <div className="text-[var(--color-text-primary)]">{selected.notes || <span className="text-[var(--color-text-muted)]">—</span>}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-[var(--color-text-muted)]">
                  <span className="text-4xl mb-3">⛽</span>
                  <span className="text-sm">Select a quota to view details</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ALERTS TAB */}
        {tab === "alerts" && (
          <div className="p-6">
            <div className="grid grid-cols-4 gap-4 mb-6">
              {(["ok", "warning", "critical", "exceeded"] as QuotaStatus[]).map(s => (
                <div key={s} className="bg-[var(--color-surface-1)] rounded-xl p-4 text-center">
                  <div className={cn("text-2xl font-bold", statusColor(s))}>{statusCounts[s]}</div>
                  <div className="text-xs text-[var(--color-text-secondary)] capitalize mt-1">{s}</div>
                </div>
              ))}
            </div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Active Issues ({alerts.length})</h3>
            <div className="space-y-3">
              {alerts.length === 0 ? (
                <div className="bg-[var(--color-surface-1)] rounded-xl p-8 text-center text-[var(--color-text-muted)]">
                  <span className="text-3xl block mb-2">✅</span>
                  All quotas within limits
                </div>
              ) : (
                alerts.map(q => (
                  <div key={q.id} className="bg-[var(--color-surface-1)] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className="font-medium text-[var(--color-text-primary)]">{q.name}</span>
                        <span className={cn("ml-2 text-xs px-2 py-0.5 rounded-full", statusBg(q.status))}>{q.status}</span>
                      </div>
                      <button className="text-xs bg-amber-900/40 text-amber-400 px-2 py-1 rounded hover:bg-amber-900/60 transition-colors">
                        Reset Quota
                      </button>
                    </div>
                    {q.usages.map((u, i) => {
                      const p = pct(u);
                      if (p < 90) {return null;}
                      return <QuotaBar key={i} usage={u} />;
                    })}
                    {q.notes && <p className="text-xs text-[var(--color-text-muted)] mt-2">Note: {q.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TRENDS TAB */}
        {tab === "trends" && (
          <div className="p-6">
            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 mb-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Hourly Request Volume (Today)</h3>
              <p className="text-xs text-[var(--color-text-muted)] mb-4">Aggregated across all scopes</p>
              <TrendChart data={TREND_DATA} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              {TREND_DATA.slice(-3).map((d, i) => (
                <div key={i} className="bg-[var(--color-surface-1)] rounded-xl p-4">
                  <div className="text-xs text-[var(--color-text-muted)] mb-2">{d.hour}</div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">Requests</span>
                      <span className="text-primary">{fmt(d.requests)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">Tokens</span>
                      <span className="text-purple-400">{fmt(d.tokens)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">Compute</span>
                      <span className="text-cyan-400">{d.compute} vCPU·s</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {tab === "settings" && (
          <div className="p-6 max-w-2xl">
            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 mb-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Default Limits</h3>
              <div className="space-y-3">
                {[
                  { label: "Default Tenant Monthly Requests", value: "1,000,000" },
                  { label: "Default Tenant Monthly Tokens", value: "50,000,000" },
                  { label: "Default User Daily Requests", value: "10,000" },
                  { label: "Default API Key Hourly Requests", value: "5,000" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-primary)]">{item.label}</span>
                    <input
                      type="text"
                      defaultValue={item.value}
                      className="bg-[var(--color-surface-2)] text-sm text-[var(--color-text-primary)] rounded px-3 py-1.5 w-36 outline-none focus:ring-1 focus:ring-indigo-500 text-right"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 mb-4">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Enforcement</h3>
              <div className="space-y-3">
                {[
                  { label: "Hard cap on exceeded quotas", enabled: true },
                  { label: "Grace period (15 min) before blocking", enabled: false },
                  { label: "Auto-notify tenant on 80% threshold", enabled: true },
                  { label: "Allow quota purchase upgrades", enabled: true },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-[var(--color-text-primary)]">{item.label}</span>
                    <div className={cn(
                      "w-10 h-5 rounded-full relative cursor-pointer transition-colors",
                      item.enabled ? "bg-primary" : "bg-[var(--color-surface-3)]"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                        item.enabled ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button className="bg-primary hover:bg-primary text-[var(--color-text-primary)] text-sm px-4 py-2 rounded-lg transition-colors">
              Save Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
