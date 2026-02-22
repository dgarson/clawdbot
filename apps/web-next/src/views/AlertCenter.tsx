import React, { useState, useMemo, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type AlertSeverity = "critical" | "high" | "medium" | "low" | "info";
type AlertStatus = "firing" | "acknowledged" | "resolved" | "suppressed";
type AlertCategory =
  | "availability"
  | "performance"
  | "security"
  | "budget"
  | "agent"
  | "provider"
  | "data"
  | "system";

interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  category: AlertCategory;
  source: string;
  affectedResource: string;
  firedAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  acknowledgedBy?: string;
  silenceUntil?: string;
  runbookUrl?: string;
  labels: Record<string, string>;
  value?: string; // metric value that triggered
  threshold?: string; // threshold that was breached
}

interface AlertRule {
  id: string;
  name: string;
  enabled: boolean;
  severity: AlertSeverity;
  category: AlertCategory;
  condition: string; // human-readable condition description
  threshold: string;
  window: string; // "5m", "1h" etc.
  notifyChannels: string[];
  firedCount: number;
  lastFired?: string;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const ALERTS: Alert[] = [
  {
    id: "al-001",
    title: "Gemini 3 Flash token budget exhausted",
    description: "The hourly token budget for Gemini 3 Flash has been fully consumed. All requests to this model are being queued or redirected to fallback models.",
    severity: "critical",
    status: "firing",
    category: "provider",
    source: "rate-limit-monitor",
    affectedResource: "model/gemini-3-flash",
    firedAt: "2026-02-22T00:47:00Z",
    value: "3,000,000 tokens",
    threshold: "3,000,000 tokens/hour",
    runbookUrl: "#",
    labels: { model: "gemini-3-flash", provider: "google" },
  },
  {
    id: "al-002",
    title: "Global token budget at 86%",
    description: "Workspace-wide token consumption has reached 86% of the hourly limit. At current rate, the budget will be exhausted in ~18 minutes.",
    severity: "high",
    status: "acknowledged",
    category: "budget",
    source: "usage-monitor",
    affectedResource: "workspace/global",
    firedAt: "2026-02-22T00:42:00Z",
    acknowledgedAt: "2026-02-22T00:43:15Z",
    acknowledgedBy: "xavier",
    value: "86%",
    threshold: "80%",
    labels: { scope: "global" },
  },
  {
    id: "al-003",
    title: "Piper agent request quota at 85%",
    description: "Agent Piper has consumed 254 of 300 allowed requests this hour. Quota enforcement may interrupt ongoing work.",
    severity: "medium",
    status: "firing",
    category: "agent",
    source: "rate-limit-monitor",
    affectedResource: "agent/piper",
    firedAt: "2026-02-22T00:35:00Z",
    value: "254/300 requests",
    threshold: "75% (225 requests)",
    labels: { agent: "piper", squad: "product-ui" },
  },
  {
    id: "al-004",
    title: "Stripe webhook delivery failing",
    description: "Webhook endpoint for Stripe payment events is returning HTTP 503. 45 deliveries have failed in the past hour.",
    severity: "high",
    status: "firing",
    category: "availability",
    source: "webhook-monitor",
    affectedResource: "webhook/stripe-payments",
    firedAt: "2026-02-22T00:52:00Z",
    value: "45 failures",
    threshold: "5 failures in 10m",
    runbookUrl: "#",
    labels: { webhook: "stripe", direction: "inbound" },
  },
  {
    id: "al-005",
    title: "Claude Sonnet token budget at 89%",
    description: "Claude Sonnet 4.6 has consumed 1.78M of 2M hourly token budget. High usage from overnight sprint work.",
    severity: "medium",
    status: "acknowledged",
    category: "provider",
    source: "rate-limit-monitor",
    affectedResource: "model/claude-sonnet-4-6",
    firedAt: "2026-02-22T00:55:00Z",
    acknowledgedAt: "2026-02-22T00:56:00Z",
    acknowledgedBy: "luis",
    value: "1,780,000 tokens",
    threshold: "1,600,000 (80%)",
    labels: { model: "claude-sonnet-4-6", provider: "anthropic" },
  },
  {
    id: "al-006",
    title: "Suspicious login attempt detected",
    description: "3 failed authentication attempts from IP 203.0.113.42 in the last 5 minutes. IP has been temporarily blocked.",
    severity: "high",
    status: "resolved",
    category: "security",
    source: "auth-monitor",
    affectedResource: "auth/gateway",
    firedAt: "2026-02-21T22:15:00Z",
    resolvedAt: "2026-02-21T22:18:00Z",
    value: "3 failures from 203.0.113.42",
    threshold: "3 failures in 5m",
    runbookUrl: "#",
    labels: { ip: "203.0.113.42", action: "auto-blocked" },
  },
  {
    id: "al-007",
    title: "Agent response latency elevated",
    description: "Average response latency for Xavier agent has exceeded 4s over the past 10 minutes, compared to baseline of 1.8s.",
    severity: "medium",
    status: "resolved",
    category: "performance",
    source: "latency-monitor",
    affectedResource: "agent/xavier",
    firedAt: "2026-02-21T23:45:00Z",
    resolvedAt: "2026-02-21T23:58:00Z",
    value: "4.2s avg",
    threshold: "3.0s",
    labels: { agent: "xavier", metric: "response_latency" },
  },
  {
    id: "al-008",
    title: "Nightly build completed successfully",
    description: "Horizon UI nightly build finished in 1.44s with 0 TypeScript errors. 41 lazy-loaded views shipped.",
    severity: "info",
    status: "resolved",
    category: "system",
    source: "ci-monitor",
    affectedResource: "build/horizon-ui",
    firedAt: "2026-02-22T01:18:00Z",
    resolvedAt: "2026-02-22T01:18:02Z",
    value: "✓ built in 1.44s",
    labels: { build: "horizon-ui", views: "41" },
  },
];

const RULES: AlertRule[] = [
  {
    id: "rule-001", name: "Model token budget critical", enabled: true,
    severity: "critical", category: "provider",
    condition: "Model token usage ≥ 100% of hourly budget",
    threshold: "100%", window: "1m",
    notifyChannels: ["#cb-alerts", "pagerduty"],
    firedCount: 4, lastFired: "2026-02-22T00:47:00Z",
  },
  {
    id: "rule-002", name: "Global budget warning", enabled: true,
    severity: "high", category: "budget",
    condition: "Global token usage ≥ 80% of hourly budget",
    threshold: "80%", window: "5m",
    notifyChannels: ["#cb-alerts"],
    firedCount: 12, lastFired: "2026-02-22T00:42:00Z",
  },
  {
    id: "rule-003", name: "Agent quota warning", enabled: true,
    severity: "medium", category: "agent",
    condition: "Per-agent request quota ≥ 75%",
    threshold: "75%", window: "1m",
    notifyChannels: ["#cb-activity"],
    firedCount: 8, lastFired: "2026-02-22T00:35:00Z",
  },
  {
    id: "rule-004", name: "Webhook failure burst", enabled: true,
    severity: "high", category: "availability",
    condition: "≥5 webhook delivery failures in 10 minutes",
    threshold: "5 failures", window: "10m",
    notifyChannels: ["#cb-alerts"],
    firedCount: 3, lastFired: "2026-02-22T00:52:00Z",
  },
  {
    id: "rule-005", name: "Auth brute force detection", enabled: true,
    severity: "high", category: "security",
    condition: "≥3 failed auth attempts from same IP in 5 minutes",
    threshold: "3 failures", window: "5m",
    notifyChannels: ["#cb-alerts", "pagerduty"],
    firedCount: 2, lastFired: "2026-02-21T22:15:00Z",
  },
  {
    id: "rule-006", name: "Response latency elevated", enabled: true,
    severity: "medium", category: "performance",
    condition: "Agent p95 response latency > 3s sustained for 10m",
    threshold: "3000ms", window: "10m",
    notifyChannels: ["#cb-activity"],
    firedCount: 5, lastFired: "2026-02-21T23:45:00Z",
  },
  {
    id: "rule-007", name: "Dead agent heartbeat", enabled: false,
    severity: "critical", category: "agent",
    condition: "Agent fails to respond to heartbeat for 5+ minutes",
    threshold: "5m no response", window: "5m",
    notifyChannels: ["#cb-alerts", "pagerduty"],
    firedCount: 0,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/20",
  high:     "text-orange-400 bg-orange-400/10 border-orange-400/20",
  medium:   "text-amber-400 bg-amber-400/10 border-amber-400/20",
  low:      "text-blue-400 bg-blue-400/10 border-blue-400/20",
  info:     "text-zinc-400 bg-zinc-400/10 border-zinc-400/20",
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
  info:     "Info",
};

const STATUS_COLORS: Record<AlertStatus, string> = {
  firing:       "text-rose-400 bg-rose-400/10 border-rose-400/20",
  acknowledged: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  resolved:     "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  suppressed:   "text-zinc-500 bg-zinc-500/10 border-zinc-500/20",
};

const CATEGORY_EMOJIS: Record<AlertCategory, string> = {
  availability: "🌐",
  performance:  "⚡",
  security:     "🛡️",
  budget:       "💰",
  agent:        "🤖",
  provider:     "🔌",
  data:         "📊",
  system:       "⚙️",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface AlertCardProps {
  alert: Alert;
  selected: boolean;
  onSelect: () => void;
}

function AlertCard({ alert, selected, onSelect }: AlertCardProps) {
  const isFiring = alert.status === "firing";
  return (
    <button
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${alert.title} — ${alert.severity}`}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all",
        "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
        selected
          ? "border-indigo-500 bg-indigo-950/30"
          : isFiring
          ? "border-rose-500/30 bg-zinc-900 hover:border-rose-500/50"
          : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          {isFiring && (
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse shrink-0" aria-label="Firing" />
          )}
          <span className={cn("text-xs px-2 py-0.5 rounded-full border", SEVERITY_COLORS[alert.severity])}>
            {SEVERITY_LABELS[alert.severity]}
          </span>
          <span className={cn("text-xs px-2 py-0.5 rounded-full border", STATUS_COLORS[alert.status])}>
            {alert.status}
          </span>
        </div>
        <span className="text-xs text-zinc-500 shrink-0">{relTime(alert.firedAt)}</span>
      </div>

      <p className="text-sm font-semibold text-white mb-1">{alert.title}</p>
      <p className="text-xs text-zinc-500 line-clamp-2">{alert.description}</p>

      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm">{CATEGORY_EMOJIS[alert.category]}</span>
        <span className="text-xs text-zinc-600">{alert.affectedResource}</span>
      </div>
    </button>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type TabId = "alerts" | "rules";
type StatusFilter = AlertStatus | "all";
type SeverityFilter = AlertSeverity | "all";

export default function AlertCenter() {
  const [tab, setTab] = useState<TabId>("alerts");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(ALERTS[0]);

  const filteredAlerts = useMemo(() => {
    return ALERTS.filter(a => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      return true;
    }).sort((a, b) => {
      const sevOrder: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      const statOrder: Record<AlertStatus, number> = { firing: 0, acknowledged: 1, resolved: 2, suppressed: 3 };
      const s = statOrder[a.status] - statOrder[b.status];
      if (s !== 0) return s;
      return sevOrder[a.severity] - sevOrder[b.severity];
    });
  }, [statusFilter, severityFilter]);

  const counts = useMemo(() => ({
    firing: ALERTS.filter(a => a.status === "firing").length,
    acknowledged: ALERTS.filter(a => a.status === "acknowledged").length,
    resolved: ALERTS.filter(a => a.status === "resolved").length,
  }), []);

  const handleAcknowledge = useCallback((alertId: string) => {
    console.log("Acknowledge:", alertId);
  }, []);

  const handleResolve = useCallback((alertId: string) => {
    console.log("Resolve:", alertId);
  }, []);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "alerts", label: `Alerts (${ALERTS.length})` },
    { id: "rules",  label: `Rules (${RULES.length})` },
  ];

  const statuses: Array<{ value: StatusFilter; label: string }> = [
    { value: "all",          label: "All" },
    { value: "firing",       label: "Firing" },
    { value: "acknowledged", label: "Ack'd" },
    { value: "resolved",     label: "Resolved" },
  ];

  const severities: Array<{ value: SeverityFilter; label: string }> = [
    { value: "all",      label: "All" },
    { value: "critical", label: "Critical" },
    { value: "high",     label: "High" },
    { value: "medium",   label: "Medium" },
    { value: "info",     label: "Info" },
  ];

  return (
    <main className="flex flex-col h-full bg-zinc-950 text-white overflow-hidden" role="main" aria-label="Alert Center">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-white">Alert Center</h1>
            <p className="text-xs text-zinc-500 mt-0.5">Operational alerts, incidents, and notification rules</p>
          </div>
          <div className="flex items-center gap-5 text-xs">
            {[
              { label: "Firing", count: counts.firing, color: "text-rose-400" },
              { label: "Ack'd",  count: counts.acknowledged, color: "text-amber-400" },
              { label: "Resolved", count: counts.resolved, color: "text-emerald-400" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={cn("text-xl font-bold font-mono", s.color)}>{s.count}</p>
                <p className="text-zinc-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1" role="tablist">
          {tabs.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "px-4 py-1.5 rounded-lg text-sm transition-colors",
                "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                tab === t.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {tab === "alerts" ? (
        <div className="flex flex-1 overflow-hidden">
          {/* Alert list */}
          <div className="w-80 shrink-0 flex flex-col border-r border-zinc-800 overflow-hidden">
            {/* Filters */}
            <div className="p-3 border-b border-zinc-800 space-y-2">
              <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by status">
                {statuses.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setStatusFilter(s.value)}
                    aria-pressed={statusFilter === s.value}
                    className={cn(
                      "text-xs px-2 py-1 rounded border transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                      statusFilter === s.value
                        ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                        : "border-zinc-700 text-zinc-400 hover:text-white"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by severity">
                {severities.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setSeverityFilter(s.value)}
                    aria-pressed={severityFilter === s.value}
                    className={cn(
                      "text-xs px-2 py-1 rounded border transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                      severityFilter === s.value
                        ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                        : "border-zinc-700 text-zinc-400 hover:text-white"
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Alert cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2" role="list" aria-label="Alert list">
              {filteredAlerts.map(alert => (
                <div key={alert.id} role="listitem">
                  <AlertCard
                    alert={alert}
                    selected={selectedAlert?.id === alert.id}
                    onSelect={() => setSelectedAlert(alert)}
                  />
                </div>
              ))}
              {filteredAlerts.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-3xl mb-2">✅</p>
                  <p className="text-sm text-zinc-400">No alerts match filters</p>
                </div>
              )}
            </div>
          </div>

          {/* Alert detail */}
          <div className="flex-1 overflow-y-auto p-6">
            {selectedAlert ? (
              <div className="space-y-5 max-w-2xl">
                {/* Title + badges */}
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className={cn("text-sm px-2.5 py-1 rounded-full border font-medium", SEVERITY_COLORS[selectedAlert.severity])}>
                      {SEVERITY_LABELS[selectedAlert.severity]}
                    </span>
                    <span className={cn("text-sm px-2.5 py-1 rounded-full border", STATUS_COLORS[selectedAlert.status])}>
                      {selectedAlert.status}
                    </span>
                    <span className="text-sm px-2.5 py-1 rounded-full bg-zinc-800 text-zinc-400">
                      {CATEGORY_EMOJIS[selectedAlert.category]} {selectedAlert.category}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-white">{selectedAlert.title}</h2>
                  <p className="text-sm text-zinc-400 mt-2 leading-relaxed">{selectedAlert.description}</p>
                </div>

                {/* Timeline */}
                <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Timeline</h3>
                  <div className="space-y-2">
                    {[
                      { label: "Fired",        time: selectedAlert.firedAt,          icon: "🔔" },
                      { label: "Acknowledged", time: selectedAlert.acknowledgedAt,    icon: "👁️", by: selectedAlert.acknowledgedBy },
                      { label: "Resolved",     time: selectedAlert.resolvedAt,        icon: "✅" },
                    ].map(ev => ev.time && (
                      <div key={ev.label} className="flex items-center gap-3 text-sm">
                        <span>{ev.icon}</span>
                        <span className="text-zinc-400 w-24">{ev.label}</span>
                        <span className="text-white font-mono text-xs">
                          {new Date(ev.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                        {ev.by && <span className="text-zinc-500 text-xs">by {ev.by}</span>}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedAlert.value && (
                    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                      <p className="text-xs text-zinc-500 mb-1">Triggered Value</p>
                      <p className="text-base font-mono font-bold text-rose-400">{selectedAlert.value}</p>
                    </div>
                  )}
                  {selectedAlert.threshold && (
                    <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                      <p className="text-xs text-zinc-500 mb-1">Threshold</p>
                      <p className="text-base font-mono font-bold text-amber-400">{selectedAlert.threshold}</p>
                    </div>
                  )}
                </div>

                {/* Labels */}
                {Object.keys(selectedAlert.labels).length > 0 && (
                  <div className="rounded-xl bg-zinc-900 border border-zinc-800 p-4">
                    <h3 className="text-sm font-semibold text-white mb-3">Labels</h3>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(selectedAlert.labels).map(([k, v]) => (
                        <span key={k} className="text-xs font-mono px-2 py-1 rounded bg-zinc-800 text-zinc-300">
                          <span className="text-zinc-500">{k}=</span>{v}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                {selectedAlert.status === "firing" && (
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleAcknowledge(selectedAlert.id)}
                      className={cn(
                        "flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                      )}
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => handleResolve(selectedAlert.id)}
                      className={cn(
                        "flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
                      )}
                    >
                      Resolve
                    </button>
                  </div>
                )}
                {selectedAlert.status === "acknowledged" && (
                  <button
                    onClick={() => handleResolve(selectedAlert.id)}
                    className={cn(
                      "w-full py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-medium transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none"
                    )}
                  >
                    Mark Resolved
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <p className="text-5xl mb-4">🔔</p>
                <p className="text-lg font-semibold text-white">Select an alert</p>
                <p className="text-sm text-zinc-500 mt-1">Choose an alert from the list to view details</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Rules tab */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Alert Rules</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{RULES.filter(r => r.enabled).length} active · {RULES.filter(r => !r.enabled).length} disabled</p>
              </div>
              <button
                className={cn(
                  "text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                )}
              >
                + New Rule
              </button>
            </div>
            <div className="divide-y divide-zinc-800">
              {RULES.map(rule => (
                <div key={rule.id} className="px-4 py-4 flex items-start gap-4 hover:bg-zinc-800/30 transition-colors">
                  {/* Toggle */}
                  <button
                    role="switch"
                    aria-checked={rule.enabled}
                    aria-label={`${rule.name} ${rule.enabled ? "enabled" : "disabled"}`}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors mt-0.5",
                      "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                      rule.enabled ? "bg-indigo-600" : "bg-zinc-700"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform m-0.5",
                        rule.enabled ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-white">{rule.name}</p>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded border", SEVERITY_COLORS[rule.severity])}>
                        {rule.severity}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mb-2">{rule.condition}</p>
                    <div className="flex flex-wrap items-center gap-3 text-[10px] text-zinc-600">
                      <span>Window: {rule.window}</span>
                      <span>Threshold: {rule.threshold}</span>
                      <span>Fired: {rule.firedCount}×</span>
                      {rule.lastFired && <span>Last: {relTime(rule.lastFired)}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {rule.notifyChannels.map(ch => (
                        <span key={ch} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono">
                          {ch}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
