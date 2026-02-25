import React, { useState } from "react";
import { cn } from "../lib/utils";

type SLAStatus = "compliant" | "at-risk" | "breached" | "paused";
type SLATier = "platinum" | "gold" | "silver" | "bronze";
type IncidentSeverity = "critical" | "high" | "medium" | "low";

interface SLAMetric {
  name: string;
  target: number;
  actual: number;
  unit: string;
}

interface SLAViolation {
  id: string;
  date: string;
  duration: string;
  impact: string;
  rootCause: string;
  resolved: boolean;
  penalty: number;
}

interface SLAContract {
  id: string;
  customer: string;
  tier: SLATier;
  status: SLAStatus;
  startDate: string;
  renewalDate: string;
  metrics: SLAMetric[];
  uptimeTarget: number;
  uptimeActual: number;
  responseTarget: number;
  responseActual: number;
  resolutionTarget: number;
  resolutionActual: number;
  violations: SLAViolation[];
  creditsUsed: number;
  creditsAvailable: number;
  healthScore: number;
  incidentCount: number;
  contactName: string;
  contactEmail: string;
}

interface TrendPoint {
  date: string;
  value: number;
}

interface SLAIncident {
  id: string;
  contractId: string;
  customer: string;
  severity: IncidentSeverity;
  title: string;
  openedAt: string;
  resolvedAt: string | null;
  slaDeadline: string;
  breached: boolean;
  assignee: string;
}

const CONTRACTS: SLAContract[] = [
  {
    id: "c1", customer: "Acme Corporation", tier: "platinum", status: "compliant",
    startDate: "2025-01-01", renewalDate: "2026-12-31",
    uptimeTarget: 99.99, uptimeActual: 99.97, responseTarget: 15, responseActual: 12,
    resolutionTarget: 240, resolutionActual: 198,
    metrics: [
      { name: "Uptime", target: 99.99, actual: 99.97, unit: "%" },
      { name: "Response Time", target: 15, actual: 12, unit: "min" },
      { name: "Resolution Time", target: 240, actual: 198, unit: "min" },
      { name: "Error Rate", target: 0.1, actual: 0.06, unit: "%" },
    ],
    violations: [
      { id: "v1", date: "2026-01-15", duration: "47 min", impact: "Partial service degradation", rootCause: "Network congestion in us-east-1", resolved: true, penalty: 2500 },
    ],
    creditsUsed: 2500, creditsAvailable: 50000, healthScore: 94, incidentCount: 3,
    contactName: "Sarah Chen", contactEmail: "s.chen@acme.com",
  },
  {
    id: "c2", customer: "TechFlow Inc", tier: "gold", status: "at-risk",
    startDate: "2025-03-01", renewalDate: "2026-02-28",
    uptimeTarget: 99.9, uptimeActual: 99.81, responseTarget: 30, responseActual: 34,
    resolutionTarget: 480, resolutionActual: 452,
    metrics: [
      { name: "Uptime", target: 99.9, actual: 99.81, unit: "%" },
      { name: "Response Time", target: 30, actual: 34, unit: "min" },
      { name: "Resolution Time", target: 480, actual: 452, unit: "min" },
      { name: "Error Rate", target: 0.5, actual: 0.38, unit: "%" },
    ],
    violations: [
      { id: "v2", date: "2026-02-01", duration: "2h 15min", impact: "API timeouts affecting 40% of requests", rootCause: "Database connection pool exhaustion", resolved: true, penalty: 5000 },
      { id: "v3", date: "2026-02-10", duration: "35 min", impact: "Slow response times", rootCause: "Scheduled maintenance overrun", resolved: true, penalty: 1800 },
    ],
    creditsUsed: 6800, creditsAvailable: 20000, healthScore: 72, incidentCount: 8,
    contactName: "Marcus Wong", contactEmail: "m.wong@techflow.com",
  },
  {
    id: "c3", customer: "GlobalRetail Co", tier: "platinum", status: "breached",
    startDate: "2024-07-01", renewalDate: "2026-06-30",
    uptimeTarget: 99.99, uptimeActual: 99.91, responseTarget: 15, responseActual: 28,
    resolutionTarget: 240, resolutionActual: 380,
    metrics: [
      { name: "Uptime", target: 99.99, actual: 99.91, unit: "%" },
      { name: "Response Time", target: 15, actual: 28, unit: "min" },
      { name: "Resolution Time", target: 240, actual: 380, unit: "min" },
      { name: "Error Rate", target: 0.1, actual: 0.22, unit: "%" },
    ],
    violations: [
      { id: "v4", date: "2026-02-05", duration: "5h 42min", impact: "Full outage — checkout system unavailable", rootCause: "Cascading database failure post-migration", resolved: true, penalty: 25000 },
      { id: "v5", date: "2026-02-18", duration: "1h 10min", impact: "Degraded performance", rootCause: "Traffic spike without auto-scale trigger", resolved: true, penalty: 8000 },
    ],
    creditsUsed: 33000, creditsAvailable: 60000, healthScore: 48, incidentCount: 14,
    contactName: "Elena Vasquez", contactEmail: "e.vasquez@globalretail.com",
  },
  {
    id: "c4", customer: "StartupXYZ", tier: "silver", status: "compliant",
    startDate: "2025-09-01", renewalDate: "2026-08-31",
    uptimeTarget: 99.5, uptimeActual: 99.78, responseTarget: 60, responseActual: 44,
    resolutionTarget: 720, resolutionActual: 611,
    metrics: [
      { name: "Uptime", target: 99.5, actual: 99.78, unit: "%" },
      { name: "Response Time", target: 60, actual: 44, unit: "min" },
      { name: "Resolution Time", target: 720, actual: 611, unit: "min" },
      { name: "Error Rate", target: 1.0, actual: 0.71, unit: "%" },
    ],
    violations: [],
    creditsUsed: 0, creditsAvailable: 5000, healthScore: 98, incidentCount: 1,
    contactName: "Jake Kim", contactEmail: "j.kim@startupxyz.io",
  },
  {
    id: "c5", customer: "MedCore Systems", tier: "gold", status: "paused",
    startDate: "2025-06-01", renewalDate: "2026-05-31",
    uptimeTarget: 99.9, uptimeActual: 99.9, responseTarget: 30, responseActual: 30,
    resolutionTarget: 480, resolutionActual: 480,
    metrics: [
      { name: "Uptime", target: 99.9, actual: 99.9, unit: "%" },
      { name: "Response Time", target: 30, actual: 30, unit: "min" },
      { name: "Resolution Time", target: 480, actual: 480, unit: "min" },
      { name: "Error Rate", target: 0.5, actual: 0.5, unit: "%" },
    ],
    violations: [],
    creditsUsed: 0, creditsAvailable: 15000, healthScore: 85, incidentCount: 0,
    contactName: "Dr. Raj Patel", contactEmail: "r.patel@medcore.org",
  },
];

const INCIDENTS: SLAIncident[] = [
  { id: "i1", contractId: "c3", customer: "GlobalRetail Co", severity: "critical", title: "Checkout service outage", openedAt: "2026-02-05 09:14", resolvedAt: "2026-02-05 14:56", slaDeadline: "2026-02-05 13:14", breached: true, assignee: "Ops Team Alpha" },
  { id: "i2", contractId: "c2", customer: "TechFlow Inc", severity: "high", title: "API response times degraded", openedAt: "2026-02-10 16:22", resolvedAt: "2026-02-10 16:57", slaDeadline: "2026-02-10 18:22", breached: false, assignee: "Backend Team" },
  { id: "i3", contractId: "c1", customer: "Acme Corporation", severity: "medium", title: "Network latency spikes", openedAt: "2026-02-15 11:03", resolvedAt: "2026-02-15 11:50", slaDeadline: "2026-02-15 15:03", breached: false, assignee: "Network Ops" },
  { id: "i4", contractId: "c3", customer: "GlobalRetail Co", severity: "high", title: "Performance degradation on search", openedAt: "2026-02-18 14:45", resolvedAt: "2026-02-18 15:55", slaDeadline: "2026-02-18 18:45", breached: false, assignee: "Platform Team" },
  { id: "i5", contractId: "c2", customer: "TechFlow Inc", severity: "medium", title: "Webhook delivery delays", openedAt: "2026-02-20 08:30", resolvedAt: null, slaDeadline: "2026-02-20 16:30", breached: false, assignee: "Integration Squad" },
];

const UPTIME_TREND: TrendPoint[] = [
  { date: "Aug", value: 99.94 }, { date: "Sep", value: 99.97 }, { date: "Oct", value: 99.92 },
  { date: "Nov", value: 99.89 }, { date: "Dec", value: 99.95 }, { date: "Jan", value: 99.93 },
  { date: "Feb", value: 99.91 },
];

function statusColor(s: SLAStatus) {
  if (s === "compliant") {return "text-emerald-400";}
  if (s === "at-risk") {return "text-amber-400";}
  if (s === "breached") {return "text-rose-400";}
  return "text-[var(--color-text-secondary)]";
}
function statusBg(s: SLAStatus) {
  if (s === "compliant") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "at-risk") {return "bg-amber-400/10 text-amber-400";}
  if (s === "breached") {return "bg-rose-400/10 text-rose-400";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]";
}
function tierBadge(t: SLATier) {
  if (t === "platinum") {return "bg-primary/20 text-indigo-300";}
  if (t === "gold") {return "bg-amber-400/20 text-amber-300";}
  if (t === "silver") {return "bg-[var(--color-surface-3)]/20 text-[var(--color-text-primary)]";}
  return "bg-orange-700/20 text-orange-300";
}
function severityColor(s: IncidentSeverity) {
  if (s === "critical") {return "text-rose-400";}
  if (s === "high") {return "text-orange-400";}
  if (s === "medium") {return "text-amber-400";}
  return "text-emerald-400";
}
function severityBg(s: IncidentSeverity) {
  if (s === "critical") {return "bg-rose-400/10 text-rose-400";}
  if (s === "high") {return "bg-orange-400/10 text-orange-400";}
  if (s === "medium") {return "bg-amber-400/10 text-amber-400";}
  return "bg-emerald-400/10 text-emerald-400";
}

function MetricBar({ label, target, actual, unit, invert = false }: { label: string; target: number; actual: number; unit: string; invert?: boolean }) {
  const good = invert ? actual <= target : actual >= target;
  const pct = invert
    ? Math.min(100, (target / Math.max(actual, 0.01)) * 100)
    : Math.min(100, (actual / target) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-[var(--color-text-secondary)]">{label}</span>
        <span className={good ? "text-emerald-400" : "text-rose-400"}>
          {actual}{unit} <span className="text-[var(--color-text-muted)]">/ {target}{unit} target</span>
        </span>
      </div>
      <div className="h-2 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", good ? "bg-emerald-500" : "bg-rose-500")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function UptimeTrendChart({ points }: { points: TrendPoint[] }) {
  const values = points.map(p => p.value);
  const min = Math.min(...values) - 0.05;
  const max = Math.max(...values) + 0.02;
  const range = max - min || 0.1;
  return (
    <div className="flex items-end gap-2 h-20">
      {points.map(p => {
        const heightPct = ((p.value - min) / range) * 100;
        const ok = p.value >= 99.9;
        return (
          <div key={p.date} className="flex flex-col items-center gap-1 flex-1">
            <div className="w-full flex items-end" style={{ height: 56 }}>
              <div
                className={cn("w-full rounded-t", ok ? "bg-emerald-500" : "bg-rose-500")}
                style={{ height: `${heightPct}%`, minHeight: 4 }}
                title={`${p.value}%`}
              />
            </div>
            <span className="text-[10px] text-[var(--color-text-muted)]">{p.date}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function SLAComplianceTracker() {
  const [activeView, setActiveView] = useState<"sla-compliance">("sla-compliance");
  const [tab, setTab] = useState<"overview" | "contracts" | "incidents" | "credits">("overview");
  const [selectedContract, setSelectedContract] = useState<SLAContract | null>(null);
  const [filterStatus, setFilterStatus] = useState<SLAStatus | "all">("all");
  const [filterTier, setFilterTier] = useState<SLATier | "all">("all");

  void activeView;

  const filtered = CONTRACTS.filter(c => {
    if (filterStatus !== "all" && c.status !== filterStatus) {return false;}
    if (filterTier !== "all" && c.tier !== filterTier) {return false;}
    return true;
  });

  const totalContracts = CONTRACTS.length;
  const compliantCount = CONTRACTS.filter(c => c.status === "compliant").length;
  const atRiskCount = CONTRACTS.filter(c => c.status === "at-risk").length;
  const breachedCount = CONTRACTS.filter(c => c.status === "breached").length;
  const totalCreditsUsed = CONTRACTS.reduce((s, c) => s + c.creditsUsed, 0);
  const openIncidents = INCIDENTS.filter(i => !i.resolvedAt).length;
  const avgHealth = Math.round(CONTRACTS.reduce((s, c) => s + c.healthScore, 0) / CONTRACTS.length);

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "contracts", label: "Contracts" },
    { id: "incidents", label: "Incidents" },
    { id: "credits", label: "Credits & Penalties" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">SLA Compliance Tracker</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Service Level Agreement monitoring across all customer contracts</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-lg text-[var(--color-text-primary)] transition-colors">Export Report</button>
          <button className="px-3 py-1.5 text-sm bg-primary hover:bg-primary rounded-lg text-[var(--color-text-primary)] transition-colors">+ New Contract</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Compliant", value: compliantCount, total: totalContracts, color: "text-emerald-400" },
          { label: "At Risk", value: atRiskCount, total: totalContracts, color: "text-amber-400" },
          { label: "Breached", value: breachedCount, total: totalContracts, color: "text-rose-400" },
          { label: "Avg Health", value: `${avgHealth}%`, total: null, color: "text-primary" },
        ].map(k => (
          <div key={k.label} className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
            <div className="text-xs text-[var(--color-text-muted)] mb-1">{k.label}</div>
            <div className={cn("text-2xl font-bold", k.color)}>{k.value}</div>
            {k.total !== null && <div className="text-xs text-[var(--color-text-muted)] mt-1">of {k.total} contracts</div>}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Credits Issued (YTD)</div>
          <div className="text-2xl font-bold text-rose-400">${totalCreditsUsed.toLocaleString()}</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Open Incidents</div>
          <div className="text-2xl font-bold text-amber-400">{openIncidents}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)] mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedContract(null); }}
            className={cn("px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px", tab === t.id ? "border-primary text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Status distribution */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Contract Status Distribution</h3>
              <div className="space-y-3">
                {(["compliant", "at-risk", "breached", "paused"] as SLAStatus[]).map(s => {
                  const count = CONTRACTS.filter(c => c.status === s).length;
                  const pct = (count / totalContracts) * 100;
                  return (
                    <div key={s}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="capitalize text-[var(--color-text-secondary)]">{s.replace("-", " ")}</span>
                        <span className={statusColor(s)}>{count} contracts ({pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", s === "compliant" ? "bg-emerald-500" : s === "at-risk" ? "bg-amber-500" : s === "breached" ? "bg-rose-500" : "bg-[var(--color-surface-3)]")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Portfolio Uptime Trend</h3>
              <UptimeTrendChart points={UPTIME_TREND} />
              <div className="flex gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />≥ 99.9%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500 inline-block" />Below target</span>
              </div>
            </div>
          </div>

          {/* Tier breakdown */}
          <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Contract Health by Tier</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(["platinum", "gold", "silver", "bronze"] as SLATier[]).map(tier => {
                const tierContracts = CONTRACTS.filter(c => c.tier === tier);
                if (tierContracts.length === 0) {return null;}
                const avgH = tierContracts.length > 0 ? Math.round(tierContracts.reduce((s, c) => s + c.healthScore, 0) / tierContracts.length) : 0;
                const allGood = tierContracts.every(c => c.status === "compliant");
                return (
                  <div key={tier} className="bg-[var(--color-surface-2)] rounded-lg p-4 text-center">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full capitalize", tierBadge(tier))}>{tier}</span>
                    <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-3">{tierContracts.length}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">contracts</div>
                    <div className={cn("text-lg font-semibold mt-2", allGood ? "text-emerald-400" : "text-amber-400")}>{avgH}%</div>
                    <div className="text-xs text-[var(--color-text-muted)]">avg health</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent violations */}
          <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Recent Violations</h3>
            <div className="space-y-3">
              {CONTRACTS.flatMap(c => c.violations.map(v => ({ ...v, customer: c.customer, tier: c.tier }))).toSorted((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map(v => (
                <div key={v.id} className="flex items-start justify-between p-3 bg-[var(--color-surface-2)] rounded-lg">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{v.customer}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full capitalize", tierBadge(v.tier as SLATier))}>{v.tier}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{v.date} · {v.duration} · {v.impact}</div>
                  </div>
                  <div className="text-rose-400 text-sm font-medium">-${v.penalty.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contracts */}
      {tab === "contracts" && !selectedContract && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as SLAStatus | "all")}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
            >
              <option value="all">All Status</option>
              <option value="compliant">Compliant</option>
              <option value="at-risk">At Risk</option>
              <option value="breached">Breached</option>
              <option value="paused">Paused</option>
            </select>
            <select
              value={filterTier}
              onChange={e => setFilterTier(e.target.value as SLATier | "all")}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]"
            >
              <option value="all">All Tiers</option>
              <option value="platinum">Platinum</option>
              <option value="gold">Gold</option>
              <option value="silver">Silver</option>
              <option value="bronze">Bronze</option>
            </select>
          </div>

          <div className="space-y-3">
            {filtered.map(c => (
              <div
                key={c.id}
                onClick={() => setSelectedContract(c)}
                className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)] hover:border-[var(--color-surface-3)] cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--color-text-primary)]">{c.customer}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", tierBadge(c.tier))}>{c.tier}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBg(c.status))}>{c.status.replace("-", " ")}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">{c.contactName} · Renewal {c.renewalDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[var(--color-text-primary)]">{c.healthScore}%</div>
                    <div className="text-xs text-[var(--color-text-muted)]">health score</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Uptime", val: c.uptimeActual, target: c.uptimeTarget, unit: "%", invert: false },
                    { label: "Response", val: c.responseActual, target: c.responseTarget, unit: "min", invert: true },
                    { label: "Resolution", val: c.resolutionActual, target: c.resolutionTarget, unit: "min", invert: true },
                  ].map(m => {
                    const ok = m.invert ? m.val <= m.target : m.val >= m.target;
                    return (
                      <div key={m.label} className="text-center">
                        <div className={cn("text-sm font-medium", ok ? "text-emerald-400" : "text-rose-400")}>{m.val}{m.unit}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">{m.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contract Detail */}
      {tab === "contracts" && selectedContract && (
        <div>
          <button onClick={() => setSelectedContract(null)} className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors">
            ← Back to contracts
          </button>
          <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)] mb-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{selectedContract.customer}</h2>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", tierBadge(selectedContract.tier))}>{selectedContract.tier}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBg(selectedContract.status))}>{selectedContract.status.replace("-", " ")}</span>
                </div>
                <div className="text-sm text-[var(--color-text-secondary)]">{selectedContract.contactName} · {selectedContract.contactEmail}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-1">Contract: {selectedContract.startDate} → {selectedContract.renewalDate}</div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-[var(--color-text-primary)]">{selectedContract.healthScore}%</div>
                <div className="text-xs text-[var(--color-text-muted)]">health score</div>
              </div>
            </div>
            <div className="space-y-3">
              {selectedContract.metrics.map(m => (
                <MetricBar
                  key={m.name}
                  label={m.name}
                  target={m.target}
                  actual={m.actual}
                  unit={m.unit}
                  invert={m.name === "Response Time" || m.name === "Resolution Time" || m.name === "Error Rate"}
                />
              ))}
            </div>
          </div>

          <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)] mb-5">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">SLA Credits</h3>
            <div className="flex items-center gap-4 mb-3">
              <div>
                <div className="text-2xl font-bold text-rose-400">${selectedContract.creditsUsed.toLocaleString()}</div>
                <div className="text-xs text-[var(--color-text-muted)]">credits issued</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)]">${selectedContract.creditsAvailable.toLocaleString()}</div>
                <div className="text-xs text-[var(--color-text-muted)]">credit limit</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-400">${(selectedContract.creditsAvailable - selectedContract.creditsUsed).toLocaleString()}</div>
                <div className="text-xs text-[var(--color-text-muted)]">remaining</div>
              </div>
            </div>
            <div className="h-3 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full"
                style={{ width: `${Math.min(100, (selectedContract.creditsUsed / selectedContract.creditsAvailable) * 100)}%` }}
              />
            </div>
          </div>

          {selectedContract.violations.length > 0 && (
            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Violations ({selectedContract.violations.length})</h3>
              <div className="space-y-3">
                {selectedContract.violations.map(v => (
                  <div key={v.id} className="p-4 bg-[var(--color-surface-2)] rounded-lg border border-[var(--color-border)]">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">{v.date} — {v.duration}</div>
                      <div className="text-rose-400 font-medium text-sm">-${v.penalty.toLocaleString()}</div>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mb-1"><span className="text-[var(--color-text-muted)]">Impact:</span> {v.impact}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]"><span className="text-[var(--color-text-muted)]">Root cause:</span> {v.rootCause}</div>
                    <div className={cn("text-xs mt-2", v.resolved ? "text-emerald-400" : "text-amber-400")}>{v.resolved ? "✓ Resolved" : "⏳ In progress"}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Incidents */}
      {tab === "incidents" && (
        <div className="space-y-3">
          {INCIDENTS.map(inc => (
            <div key={inc.id} className={cn("bg-[var(--color-surface-1)] rounded-xl p-4 border transition-colors", inc.breached ? "border-rose-500/40" : "border-[var(--color-border)]")}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium capitalize", severityBg(inc.severity))}>{inc.severity}</span>
                    {inc.breached && <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400">SLA Breached</span>}
                    {!inc.resolvedAt && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400">Open</span>}
                  </div>
                  <div className="font-medium text-[var(--color-text-primary)]">{inc.title}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">{inc.customer}</div>
                </div>
                <div className="text-right text-xs text-[var(--color-text-muted)]">
                  <div>Opened: {inc.openedAt}</div>
                  <div className={cn("mt-1", inc.breached ? "text-rose-400" : "text-[var(--color-text-muted)]")}>Deadline: {inc.slaDeadline}</div>
                  {inc.resolvedAt && <div className="text-emerald-400 mt-1">Resolved: {inc.resolvedAt}</div>}
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
                <span className="text-xs text-[var(--color-text-muted)]">Assignee: <span className="text-[var(--color-text-primary)]">{inc.assignee}</span></span>
                <span className={cn("text-xs", inc.resolvedAt ? "text-emerald-400" : "text-amber-400")}>
                  {inc.resolvedAt ? "✓ Resolved" : "⏳ In progress"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Credits & Penalties */}
      {tab === "credits" && (
        <div className="space-y-5">
          <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Credit Summary by Contract</h3>
            <div className="space-y-4">
              {CONTRACTS.filter(c => c.creditsUsed > 0 || c.creditsAvailable > 0).map(c => {
                const usedPct = Math.min(100, (c.creditsUsed / c.creditsAvailable) * 100);
                const isHigh = usedPct > 50;
                return (
                  <div key={c.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[var(--color-text-primary)]">{c.customer}</span>
                        <span className={cn("px-1.5 py-0.5 rounded-full capitalize", tierBadge(c.tier))}>{c.tier}</span>
                      </div>
                      <span className={isHigh ? "text-rose-400" : "text-[var(--color-text-secondary)]"}>
                        ${c.creditsUsed.toLocaleString()} / ${c.creditsAvailable.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-3 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", isHigh ? "bg-rose-500" : "bg-primary")}
                        style={{ width: `${usedPct}%` }}
                      />
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-1">{usedPct.toFixed(1)}% of credit limit used</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Penalty Log</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)]">
                    {["Customer", "Date", "Duration", "Penalty", "Status"].map(h => (
                      <th key={h} className="pb-2 text-left text-xs text-[var(--color-text-muted)] font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {CONTRACTS.flatMap(c => c.violations.map(v => ({ ...v, customer: c.customer }))).toSorted((a, b) => b.date.localeCompare(a.date)).map(v => (
                    <tr key={v.id}>
                      <td className="py-2 text-[var(--color-text-primary)]">{v.customer}</td>
                      <td className="py-2 text-[var(--color-text-secondary)]">{v.date}</td>
                      <td className="py-2 text-[var(--color-text-secondary)]">{v.duration}</td>
                      <td className="py-2 text-rose-400 font-medium">-${v.penalty.toLocaleString()}</td>
                      <td className="py-2">
                        <span className={cn("text-xs", v.resolved ? "text-emerald-400" : "text-amber-400")}>{v.resolved ? "Resolved" : "Open"}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--color-border)] flex justify-between">
              <span className="text-sm text-[var(--color-text-secondary)]">Total penalties YTD</span>
              <span className="text-sm font-bold text-rose-400">-${totalCreditsUsed.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
