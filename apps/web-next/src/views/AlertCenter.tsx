import React, { useState, useMemo, useCallback, useEffect } from "react";
import {
  Bot,
  ChevronDown,
  ChevronRight,
  Coins,
  Database,
  ExternalLink,
  Gauge,
  Globe,
  Pencil,
  PlugZap,
  ServerCog,
  Shield,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";
import { Skeleton } from "../components/Skeleton";
import {
  AlertRuleConfigDialog,
  type AlertRuleCategory,
  type AlertRuleConfig,
  type AlertRuleSeverity,
  type AlertDiagnosticsView,
} from "../components/alerts/AlertRuleConfigDialog";
import {
  buildAlertCenterQuery,
  getAlertStatusLabel,
  getRovingTargetIndex,
  parseAlertCenterQuery,
  resolveBackToAlert,
  resolveRuleJump,
} from "./alert-center-utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type AlertSeverity = AlertRuleSeverity;
type AlertStatus = "firing" | "acknowledged" | "resolved" | "suppressed";
type AlertCategory = AlertRuleCategory;

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
  ruleId: string;
  value?: string; // metric value that triggered
  threshold?: string; // threshold that was breached
}

type AlertRule = AlertRuleConfig;

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
    ruleId: "rule-001",
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
    ruleId: "rule-002",
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
    ruleId: "rule-003",
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
    ruleId: "rule-004",
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
    ruleId: "rule-001",
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
    ruleId: "rule-005",
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
    ruleId: "rule-006",
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
    ruleId: "rule-007",
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
    diagnosticsView: "tracer",
  },
  {
    id: "rule-002", name: "Global budget warning", enabled: true,
    severity: "high", category: "budget",
    condition: "Global token usage ≥ 80% of hourly budget",
    threshold: "80%", window: "5m",
    notifyChannels: ["#cb-alerts"],
    firedCount: 12, lastFired: "2026-02-22T00:42:00Z",
    diagnosticsView: "analytics",
  },
  {
    id: "rule-003", name: "Agent quota warning", enabled: true,
    severity: "medium", category: "agent",
    condition: "Per-agent request quota ≥ 75%",
    threshold: "75%", window: "1m",
    notifyChannels: ["#cb-activity"],
    firedCount: 8, lastFired: "2026-02-22T00:35:00Z",
    diagnosticsView: "tracer",
  },
  {
    id: "rule-004", name: "Webhook failure burst", enabled: true,
    severity: "high", category: "availability",
    condition: "≥5 webhook delivery failures in 10 minutes",
    threshold: "5 failures", window: "10m",
    notifyChannels: ["#cb-alerts"],
    firedCount: 3, lastFired: "2026-02-22T00:52:00Z",
    diagnosticsView: "metrics",
  },
  {
    id: "rule-005", name: "Auth brute force detection", enabled: true,
    severity: "high", category: "security",
    condition: "≥3 failed auth attempts from same IP in 5 minutes",
    threshold: "3 failures", window: "5m",
    notifyChannels: ["#cb-alerts", "pagerduty"],
    firedCount: 2, lastFired: "2026-02-21T22:15:00Z",
    diagnosticsView: "analytics",
  },
  {
    id: "rule-006", name: "Response latency elevated", enabled: true,
    severity: "medium", category: "performance",
    condition: "Agent p95 response latency > 3s sustained for 10m",
    threshold: "3000ms", window: "10m",
    notifyChannels: ["#cb-activity"],
    firedCount: 5, lastFired: "2026-02-21T23:45:00Z",
    diagnosticsView: "tracer",
  },
  {
    id: "rule-007", name: "Dead agent heartbeat", enabled: false,
    severity: "critical", category: "agent",
    condition: "Agent fails to respond to heartbeat for 5+ minutes",
    threshold: "5m no response", window: "5m",
    notifyChannels: ["#cb-alerts", "pagerduty"],
    firedCount: 0,
    diagnosticsView: "tracer",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/20",
  high:     "text-orange-400 bg-orange-400/10 border-orange-400/20",
  medium:   "text-amber-400 bg-amber-400/10 border-amber-400/20",
  low:      "text-blue-400 bg-blue-400/10 border-blue-400/20",
  info:     "text-fg-secondary bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/20",
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: "Critical",
  high:     "High",
  medium:   "Medium",
  low:      "Low",
  info:     "Info",
};

const SEVERITY_ORDER: AlertSeverity[] = ["critical", "high", "medium", "low", "info"];

const SEVERITY_GROUP_STYLES: Record<
  AlertSeverity,
  { summaryPill: string; count: string; groupBorder: string; groupSurface: string; dot: string }
> = {
  critical: {
    summaryPill: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    count: "text-rose-300",
    groupBorder: "border-rose-500/30",
    groupSurface: "bg-rose-500/5",
    dot: "bg-rose-400",
  },
  high: {
    summaryPill: "border-orange-500/40 bg-orange-500/10 text-orange-300",
    count: "text-orange-300",
    groupBorder: "border-orange-500/30",
    groupSurface: "bg-orange-500/5",
    dot: "bg-orange-400",
  },
  medium: {
    summaryPill: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    count: "text-amber-300",
    groupBorder: "border-amber-500/30",
    groupSurface: "bg-amber-500/5",
    dot: "bg-amber-400",
  },
  low: {
    summaryPill: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    count: "text-sky-300",
    groupBorder: "border-sky-500/30",
    groupSurface: "bg-sky-500/5",
    dot: "bg-sky-400",
  },
  info: {
    summaryPill: "border-tok-border bg-surface-2 text-fg-secondary",
    count: "text-fg-secondary",
    groupBorder: "border-tok-border",
    groupSurface: "bg-surface-1",
    dot: "bg-fg-muted",
  },
};

const STATUS_META: Record<
  AlertStatus,
  { label: string; pillClass: string; metricColor: string; metricSurface: string }
> = {
  firing: {
    label: getAlertStatusLabel("firing"),
    pillClass: "text-rose-400 bg-rose-400/10 border-rose-400/20",
    metricColor: "text-rose-300",
    metricSurface: "border-rose-500/20 bg-rose-500/5",
  },
  acknowledged: {
    label: getAlertStatusLabel("acknowledged"),
    pillClass: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    metricColor: "text-amber-300",
    metricSurface: "border-amber-500/20 bg-amber-500/5",
  },
  resolved: {
    label: getAlertStatusLabel("resolved"),
    pillClass: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    metricColor: "text-emerald-300",
    metricSurface: "border-emerald-500/20 bg-emerald-500/5",
  },
  suppressed: {
    label: getAlertStatusLabel("suppressed"),
    pillClass: "text-fg-muted bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/20",
    metricColor: "text-fg-muted",
    metricSurface: "border-tok-border bg-surface-2",
  },
};

const STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "firing", label: STATUS_META.firing.label },
  { value: "acknowledged", label: STATUS_META.acknowledged.label },
  { value: "resolved", label: STATUS_META.resolved.label },
];

const SEVERITY_FILTER_OPTIONS: Array<{ value: SeverityFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "critical", label: "Critical" },
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
  { value: "info", label: "Info" },
];

const CATEGORY_META: Record<AlertCategory, { label: string; emoji: string; icon: React.ComponentType<{ className?: string }> }> = {
  availability: { label: "Availability", emoji: "🌐", icon: Globe },
  performance:  { label: "Performance", emoji: "⚡", icon: Gauge },
  security:     { label: "Security", emoji: "🛡", icon: Shield },
  budget:       { label: "Budget", emoji: "💰", icon: Coins },
  agent:        { label: "Agent", emoji: "🤖", icon: Bot },
  provider:     { label: "Provider", emoji: "🔌", icon: PlugZap },
  data:         { label: "Data", emoji: "📊", icon: Database },
  system:       { label: "System", emoji: "⚙", icon: ServerCog },
};

const DIAGNOSTICS_LABELS: Record<AlertDiagnosticsView, string> = {
  tracer: "Agent Tracer",
  analytics: "Alert Analytics",
  metrics: "Metrics Explorer",
};

const DIAGNOSTICS_NAV: Record<AlertDiagnosticsView, string> = {
  tracer: "tracer",
  analytics: "agent-insights",
  metrics: "usage",
};

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) {return "just now";}
  if (mins < 60) {return `${mins}m ago`;}
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {return `${hrs}h ago`;}
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
  const CategoryIcon = CATEGORY_META[alert.category].icon;
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
          ? "border-rose-500/30 bg-surface-1 hover:border-rose-500/50"
          : "border-tok-border bg-surface-1 hover:border-tok-border"
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
          <span className={cn("text-xs px-2 py-0.5 rounded-full border", STATUS_META[alert.status].pillClass)}>
            {STATUS_META[alert.status].label}
          </span>
        </div>
        <span className="text-xs text-fg-muted shrink-0">{relTime(alert.firedAt)}</span>
      </div>

      <p className="text-sm font-semibold text-fg-primary mb-1">{alert.title}</p>
      <p className="text-xs text-fg-muted line-clamp-2">{alert.description}</p>

      <div className="mt-2 flex items-center gap-2">
        <CategoryIcon className="h-3.5 w-3.5 text-fg-muted" />
        <span className="text-xs text-fg-muted">{alert.affectedResource}</span>
      </div>
    </button>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type TabId = "alerts" | "rules";
type StatusFilter = "all" | "firing" | "acknowledged" | "resolved";
type SeverityFilter = AlertSeverity | "all";
type CategoryFilter = AlertCategory | "all";

function AlertCenterSkeleton() {
  return (
    <main className="flex flex-col h-full bg-surface-0 text-fg-primary overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-tok-border shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="space-y-1.5">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-64" />
          </div>
          {/* Stat counts */}
          <div className="flex items-center gap-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="text-center space-y-1">
                <Skeleton className="h-7 w-6 mx-auto" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))}
          </div>
        </div>
        {/* Tabs */}
        <div className="flex gap-1">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </div>
      </div>

      {/* Alert list + detail */}
      <div className="flex flex-1 overflow-hidden">
        {/* List */}
        <div className="w-80 shrink-0 flex flex-col border-r border-tok-border overflow-hidden">
          {/* Filters */}
          <div className="p-3 border-b border-tok-border space-y-2">
            <div className="flex flex-wrap gap-1">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-6 w-14 rounded" />)}
            </div>
            <div className="flex flex-wrap gap-1">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-6 w-16 rounded" />)}
            </div>
          </div>
          {/* Alert cards */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-xl border border-tok-border bg-surface-1 p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-3 w-12" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-3 w-2/3" />
                <div className="flex items-center gap-2 mt-1">
                  <Skeleton className="w-4 h-4 rounded" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-5 max-w-2xl">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-20 rounded-full" />
                <Skeleton className="h-7 w-28 rounded-full" />
              </div>
              <Skeleton className="h-7 w-80" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
            <div className="rounded-xl bg-surface-1 border border-tok-border p-4 space-y-3">
              <Skeleton className="h-4 w-20" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-5 h-5" />
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-32" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="rounded-xl bg-surface-1 border border-tok-border p-4 space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-6 w-32" />
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-surface-1 border border-tok-border p-4 space-y-3">
              <Skeleton className="h-4 w-16" />
              <div className="flex flex-wrap gap-2">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-6 w-24 rounded" />)}
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="flex-1 h-10 rounded-xl" />
              <Skeleton className="flex-1 h-10 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
export default function AlertCenter({
  isLoading = false,
  onNavigate,
}: {
  isLoading?: boolean;
  onNavigate?: (viewId: string) => void;
}) {
  const initialQuery = useMemo(
    () => parseAlertCenterQuery(typeof window !== "undefined" ? window.location.search : ""),
    []
  );
  const [tab, setTab] = useState<TabId>(() => (initialQuery.tab === "rules" ? "rules" : "alerts"));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const value = initialQuery.status;
    return STATUS_FILTER_OPTIONS.some((option) => option.value === value) ? (value as StatusFilter) : "all";
  });
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>(() => {
    const value = initialQuery.severity;
    return SEVERITY_FILTER_OPTIONS.some((option) => option.value === value) ? (value as SeverityFilter) : "all";
  });
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(() => {
    const value = initialQuery.category;
    return value && value in CATEGORY_META ? (value as CategoryFilter) : "all";
  });
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(() => {
    const fromQuery = ALERTS.find((alert) => alert.id === initialQuery.alertId);
    return fromQuery ?? ALERTS[0];
  });
  const [rules, setRules] = useState<AlertRule[]>(RULES);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(initialQuery.ruleId ?? null);
  const [focusedRuleId, setFocusedRuleId] = useState<string | null>(initialQuery.ruleId ?? null);
  const [originAlertId, setOriginAlertId] = useState<string | null>(initialQuery.fromAlertId ?? null);
  const [expandedSeverityGroups, setExpandedSeverityGroups] = useState<Record<AlertSeverity, boolean>>({
    critical: true,
    high: true,
    medium: false,
    low: false,
    info: false,
  });

  const editingRule = useMemo(
    () => rules.find((rule) => rule.id === editingRuleId) ?? null,
    [editingRuleId, rules]
  );

  const filteredAlerts = useMemo(() => {
    return ALERTS.filter((alert) => {
      if (statusFilter !== "all" && alert.status !== statusFilter) {return false;}
      if (severityFilter !== "all" && alert.severity !== severityFilter) {return false;}
      if (categoryFilter !== "all" && alert.category !== categoryFilter) {return false;}
      return true;
    }).toSorted((left, right) => {
      const sevOrder: Record<AlertSeverity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
      const statOrder: Record<AlertStatus, number> = { firing: 0, acknowledged: 1, resolved: 2, suppressed: 3 };
      const statusDelta = statOrder[left.status] - statOrder[right.status];
      if (statusDelta !== 0) {return statusDelta;}
      return sevOrder[left.severity] - sevOrder[right.severity];
    });
  }, [categoryFilter, severityFilter, statusFilter]);

  const counts = useMemo(
    () => ({
      firing: ALERTS.filter((alert) => alert.status === "firing").length,
      acknowledged: ALERTS.filter((alert) => alert.status === "acknowledged").length,
      resolved: ALERTS.filter((alert) => alert.status === "resolved").length,
    }),
    []
  );

  const activeRuleCount = useMemo(() => rules.filter((rule) => rule.enabled).length, [rules]);
  const disabledRuleCount = rules.length - activeRuleCount;
  const categoryFilters = useMemo(() => {
    const seen = new Set<AlertCategory>();
    const values = ALERTS.map((alert) => alert.category).filter((category) => {
      if (seen.has(category)) {return false;}
      seen.add(category);
      return true;
    });
    return values.toSorted((left, right) => CATEGORY_META[left].label.localeCompare(CATEGORY_META[right].label));
  }, []);
  const selectedRule = useMemo(
    () => (selectedAlert ? rules.find((rule) => rule.id === selectedAlert.ruleId) ?? null : null),
    [rules, selectedAlert]
  );
  const SelectedCategoryIcon = selectedAlert ? CATEGORY_META[selectedAlert.category].icon : null;

  const groupedRules = useMemo(
    () =>
      SEVERITY_ORDER.map((severity) => ({
        severity,
        rules: rules
          .filter((rule) => rule.severity === severity)
          .toSorted((left, right) => {
            const enabledDelta = Number(right.enabled) - Number(left.enabled);
            if (enabledDelta !== 0) {return enabledDelta;}
            if (right.firedCount !== left.firedCount) {return right.firedCount - left.firedCount;}
            return left.name.localeCompare(right.name);
          }),
      })),
    [rules]
  );

  const handleAcknowledge = useCallback((alertId: string) => {
    console.log("Acknowledge:", alertId);
  }, []);

  const handleResolve = useCallback((alertId: string) => {
    console.log("Resolve:", alertId);
  }, []);

  const handleStatusMetricClick = useCallback((status: Exclude<StatusFilter, "all">) => {
    setTab("alerts");
    setStatusFilter(status);
  }, []);

  const handleOpenTriggerRule = useCallback((ruleId: string) => {
    const next = resolveRuleJump(selectedAlert?.id ?? null, ruleId);
    setTab(next.tab);
    setFocusedRuleId(next.focusedRuleId);
    setOriginAlertId(next.originAlertId);
    const targetRule = rules.find((rule) => rule.id === ruleId);
    if (targetRule) {
      setExpandedSeverityGroups((previous) => ({ ...previous, [targetRule.severity]: true }));
    }
  }, [rules, selectedAlert]);

  const handleBackToAlert = useCallback(() => {
    const next = resolveBackToAlert(originAlertId, ALERTS.map((alert) => alert.id));
    setTab(next.tab);
    setOriginAlertId(next.originAlertId);
    setFocusedRuleId(next.focusedRuleId);
    if (next.selectedAlertId) {
      const alert = ALERTS.find((candidate) => candidate.id === next.selectedAlertId) ?? null;
      setSelectedAlert(alert);
    }
  }, [originAlertId]);

  const openDiagnosticsView = useCallback(
    (diagnosticsView: AlertDiagnosticsView) => {
      onNavigate?.(DIAGNOSTICS_NAV[diagnosticsView]);
    },
    [onNavigate]
  );

  const toggleRuleEnabled = useCallback((ruleId: string) => {
    setRules((previous) =>
      previous.map((rule) => (rule.id === ruleId ? { ...rule, enabled: !rule.enabled } : rule))
    );
  }, []);

  const handleRuleSave = useCallback((nextRule: AlertRule) => {
    setRules((previous) => previous.map((rule) => (rule.id === nextRule.id ? nextRule : rule)));
    setEditingRuleId(null);
  }, []);

  const handleNewRule = useCallback(() => {
    const id = `rule-${Date.now()}`;
    const newRule: AlertRule = {
      id,
      name: "Untitled alert rule",
      enabled: true,
      severity: "high",
      category: "system",
      condition: "Condition pending configuration",
      threshold: "N/A",
      window: "5m",
      notifyChannels: ["#cb-alerts"],
      firedCount: 0,
      diagnosticsView: "tracer",
    };

    setRules((previous) => [newRule, ...previous]);
    setExpandedSeverityGroups((previous) => ({ ...previous, [newRule.severity]: true }));
    setEditingRuleId(id);
  }, []);

  const handleFilterGroupKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const pills = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-filter-pill='true']")
    );
    if (pills.length === 0) {return;}
    const activeIndex = pills.findIndex((pill) => pill === document.activeElement);
    const index = getRovingTargetIndex(activeIndex >= 0 ? activeIndex : 0, event.key, pills.length);
    if (index === null) {return;}
    event.preventDefault();
    pills[index]?.focus();
  }, []);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "alerts", label: `Alerts (${ALERTS.length})` },
    { id: "rules", label: `Rules (${rules.length})` },
  ];

  const statusMetrics: Array<{ value: Exclude<StatusFilter, "all">; label: string; count: number; color: string; surface: string }> = [
    { value: "firing", label: STATUS_META.firing.label, count: counts.firing, color: STATUS_META.firing.metricColor, surface: STATUS_META.firing.metricSurface },
    { value: "acknowledged", label: STATUS_META.acknowledged.label, count: counts.acknowledged, color: STATUS_META.acknowledged.metricColor, surface: STATUS_META.acknowledged.metricSurface },
    { value: "resolved", label: STATUS_META.resolved.label, count: counts.resolved, color: STATUS_META.resolved.metricColor, surface: STATUS_META.resolved.metricSurface },
  ];

  useEffect(() => {
    if (filteredAlerts.length === 0) {
      setSelectedAlert(null);
      return;
    }
    if (!selectedAlert || !filteredAlerts.some((alert) => alert.id === selectedAlert.id)) {
      setSelectedAlert(filteredAlerts[0]);
    }
  }, [filteredAlerts, selectedAlert]);

  useEffect(() => {
    if (tab !== "rules" || !focusedRuleId) {return;}
    const target = document.getElementById(`rule-${focusedRuleId}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedRuleId, tab]);

  useEffect(() => {
    if (typeof window === "undefined") {return;}
    const nextQuery = buildAlertCenterQuery(window.location.search, {
      tab,
      status: statusFilter,
      severity: severityFilter,
      category: categoryFilter,
      alertId: selectedAlert?.id,
      ruleId: focusedRuleId ?? undefined,
      fromAlertId: originAlertId ?? undefined,
    });
    if (window.location.search !== nextQuery) {
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${nextQuery}${window.location.hash}`);
    }
  }, [categoryFilter, focusedRuleId, originAlertId, selectedAlert, severityFilter, statusFilter, tab]);

  useEffect(() => {
    if (typeof window === "undefined") {return;}
    const onPopState = () => {
      const query = parseAlertCenterQuery(window.location.search);
      setTab(query.tab === "rules" ? "rules" : "alerts");
      setStatusFilter(
        STATUS_FILTER_OPTIONS.some((option) => option.value === query.status) ? (query.status as StatusFilter) : "all"
      );
      setSeverityFilter(
        SEVERITY_FILTER_OPTIONS.some((option) => option.value === query.severity) ? (query.severity as SeverityFilter) : "all"
      );
      setCategoryFilter(query.category && query.category in CATEGORY_META ? (query.category as CategoryFilter) : "all");
      setFocusedRuleId(query.ruleId ?? null);
      setOriginAlertId(query.fromAlertId ?? null);
      setSelectedAlert(ALERTS.find((alert) => alert.id === query.alertId) ?? ALERTS[0]);
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  if (isLoading) {
    return <AlertCenterSkeleton />;
  }

  return (
    <>
      <main className="flex flex-col h-full bg-surface-0 text-fg-primary overflow-hidden" role="main" aria-label="Alert Center">
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-b border-tok-border shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-3">
            <div>
              <h1 className="text-lg font-bold text-fg-primary">Alert Center</h1>
              <p className="text-xs text-fg-muted mt-0.5">Operational alerts, incidents, and notification rules</p>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {statusMetrics.map((metric) => (
                <button
                  key={metric.label}
                  type="button"
                  onClick={() => handleStatusMetricClick(metric.value)}
                  aria-pressed={statusFilter === metric.value}
                  className={cn(
                    "rounded-xl border px-3 py-1.5 text-center transition-colors min-w-20",
                    "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                    metric.surface,
                    statusFilter === metric.value ? "ring-1 ring-indigo-500/70 bg-indigo-500/10" : "hover:bg-surface-2/50"
                  )}
                >
                  <p className={cn("text-lg font-bold font-mono leading-tight", metric.color)}>{metric.count}</p>
                  <p className="text-fg-muted">{metric.label}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-1" role="tablist">
            {tabs.map((tabOption) => (
              <button
                key={tabOption.id}
                role="tab"
                aria-selected={tab === tabOption.id}
                onClick={() => setTab(tabOption.id)}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-sm transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  tab === tabOption.id ? "bg-surface-2 text-fg-primary" : "text-fg-secondary hover:text-fg-primary"
                )}
              >
                {tabOption.label}
              </button>
            ))}
          </div>
        </div>

        {tab === "alerts" ? (
          <div className="flex flex-1 overflow-hidden">
            <div className="w-64 sm:w-72 md:w-80 shrink-0 flex flex-col border-r border-tok-border overflow-hidden">
              <div className="p-3 border-b border-tok-border space-y-2">
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-fg-muted">State</p>
                  <div
                    className="flex flex-wrap gap-1"
                    role="group"
                    aria-label="Filter by alert state"
                    onKeyDown={handleFilterGroupKeyDown}
                  >
                    {STATUS_FILTER_OPTIONS.map((statusOption) => (
                      <button
                        key={statusOption.value}
                        data-filter-pill="true"
                        onClick={() => setStatusFilter(statusOption.value)}
                        aria-pressed={statusFilter === statusOption.value}
                        className={cn(
                          "text-xs px-2 py-1 rounded border transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                          statusFilter === statusOption.value
                            ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                            : "border-tok-border text-fg-secondary hover:text-fg-primary"
                        )}
                      >
                        {statusOption.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-fg-muted">Criticality</p>
                  <div
                    className="flex flex-wrap gap-1"
                    role="group"
                    aria-label="Filter by criticality"
                    onKeyDown={handleFilterGroupKeyDown}
                  >
                    {SEVERITY_FILTER_OPTIONS.map((severityOption) => (
                      <button
                        key={severityOption.value}
                        data-filter-pill="true"
                        onClick={() => setSeverityFilter(severityOption.value)}
                        aria-pressed={severityFilter === severityOption.value}
                        className={cn(
                          "text-xs px-2 py-1 rounded border transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                          severityFilter === severityOption.value
                            ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                            : "border-tok-border text-fg-secondary hover:text-fg-primary"
                        )}
                      >
                        {severityOption.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] uppercase tracking-wide text-fg-muted">Category</p>
                  <div
                    className="flex flex-wrap gap-1"
                    role="group"
                    aria-label="Filter by category"
                    onKeyDown={handleFilterGroupKeyDown}
                  >
                    <button
                      key="all"
                      data-filter-pill="true"
                      onClick={() => setCategoryFilter("all")}
                      aria-pressed={categoryFilter === "all"}
                      className={cn(
                        "text-xs px-2 py-1 rounded border transition-colors",
                        "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                        categoryFilter === "all"
                          ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                          : "border-tok-border text-fg-secondary hover:text-fg-primary"
                      )}
                    >
                      All
                    </button>
                    {categoryFilters.map((category) => {
                      const CategoryIcon = CATEGORY_META[category].icon;
                      return (
                        <button
                          key={category}
                          data-filter-pill="true"
                          onClick={() => setCategoryFilter(category)}
                          aria-pressed={categoryFilter === category}
                          className={cn(
                            "text-xs px-2 py-1 rounded border transition-colors inline-flex items-center gap-1",
                            "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                            categoryFilter === category
                              ? "border-indigo-500 bg-indigo-950/40 text-indigo-300"
                              : "border-tok-border text-fg-secondary hover:text-fg-primary"
                          )}
                        >
                          <CategoryIcon className="h-3.5 w-3.5 opacity-70" />
                          <span>{CATEGORY_META[category].label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2" role="list" aria-label="Alert list">
                {filteredAlerts.map((alert) => (
                  <div key={alert.id} role="listitem">
                    <AlertCard
                      alert={alert}
                      selected={selectedAlert?.id === alert.id}
                      onSelect={() => setSelectedAlert(alert)}
                    />
                  </div>
                ))}
                {filteredAlerts.length === 0 && (
                  <ContextualEmptyState
                    icon={ShieldCheck}
                    title="All clear — no active alerts"
                    description="No alerts match your current filters. Adjust filters or check back later."
                    size="sm"
                  />
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
              {selectedAlert ? (
                <div className="space-y-5 max-w-2xl">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <span className={cn("text-sm px-2.5 py-1 rounded-full border font-medium", SEVERITY_COLORS[selectedAlert.severity])}>
                        {SEVERITY_LABELS[selectedAlert.severity]}
                      </span>
                      <span className={cn("text-sm px-2.5 py-1 rounded-full border", STATUS_META[selectedAlert.status].pillClass)}>
                        {STATUS_META[selectedAlert.status].label}
                      </span>
                      <span className="text-sm px-2.5 py-1 rounded-full bg-surface-2 text-fg-secondary inline-flex items-center gap-1.5">
                        {SelectedCategoryIcon && <SelectedCategoryIcon className="h-4 w-4 opacity-70" />}
                        <span>{CATEGORY_META[selectedAlert.category].label}</span>
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-fg-primary">{selectedAlert.title}</h2>
                    <p className="text-sm text-fg-secondary mt-2 leading-relaxed">{selectedAlert.description}</p>
                  </div>

                  {selectedRule && (
                    <div className="rounded-xl bg-surface-1 border border-tok-border p-4">
                      <h3 className="text-sm font-semibold text-fg-primary mb-2">Triggered Rule</h3>
                      <p className="text-sm text-fg-primary">{selectedRule.name}</p>
                      <p className="text-xs text-fg-muted mt-1">{selectedRule.condition}</p>
                      <button
                        onClick={() => handleOpenTriggerRule(selectedRule.id)}
                        className={cn(
                          "mt-3 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-tok-border bg-surface-2",
                          "text-fg-secondary hover:text-fg-primary hover:bg-surface-3 transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                        )}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Rule
                      </button>
                    </div>
                  )}

                  <div className="rounded-xl bg-surface-1 border border-tok-border p-4">
                    <h3 className="text-sm font-semibold text-fg-primary mb-3">Timeline</h3>
                    <div className="space-y-2">
                      {[
                        { label: "Fired", time: selectedAlert.firedAt, icon: "🔔" },
                        { label: "Acknowledged", time: selectedAlert.acknowledgedAt, icon: "👁️", by: selectedAlert.acknowledgedBy },
                        { label: "Resolved", time: selectedAlert.resolvedAt, icon: "✅" },
                      ].map(
                        (event) =>
                          event.time && (
                            <div key={event.label} className="flex items-center gap-3 text-sm">
                              <span>{event.icon}</span>
                              <span className="text-fg-secondary w-24">{event.label}</span>
                              <span className="text-fg-primary font-mono text-xs">
                                {new Date(event.time).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                              {event.by && <span className="text-fg-muted text-xs">by {event.by}</span>}
                            </div>
                          )
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {selectedAlert.value && (
                      <div className="rounded-xl bg-surface-1 border border-tok-border p-4">
                        <p className="text-xs text-fg-muted mb-1">Triggered Value</p>
                        <p className="text-base font-mono font-bold text-rose-400">{selectedAlert.value}</p>
                      </div>
                    )}
                    {selectedAlert.threshold && (
                      <div className="rounded-xl bg-surface-1 border border-tok-border p-4">
                        <p className="text-xs text-fg-muted mb-1">Threshold</p>
                        <p className="text-base font-mono font-bold text-amber-400">{selectedAlert.threshold}</p>
                      </div>
                    )}
                  </div>

                  {Object.keys(selectedAlert.labels).length > 0 && (
                    <div className="rounded-xl bg-surface-1 border border-tok-border p-4">
                      <h3 className="text-sm font-semibold text-fg-primary mb-3">Labels</h3>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(selectedAlert.labels).map(([key, value]) => (
                          <span key={key} className="text-xs font-mono px-2 py-1 rounded bg-surface-2 text-fg-primary">
                            <span className="text-fg-muted">{key}=</span>
                            {value}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedAlert.status === "firing" && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAcknowledge(selectedAlert.id)}
                        className={cn(
                          "flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-fg-primary text-sm font-medium transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:outline-none"
                        )}
                      >
                        Acknowledge
                      </button>
                      <button
                        onClick={() => handleResolve(selectedAlert.id)}
                        className={cn(
                          "flex-1 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-fg-primary text-sm font-medium transition-colors",
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
                        "w-full py-2 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-fg-primary text-sm font-medium transition-colors",
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
                  <p className="text-lg font-semibold text-fg-primary">Select an alert</p>
                  <p className="text-sm text-fg-muted mt-1">Choose an alert from the list to view details</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
            <div className="space-y-3">
              {originAlertId && (
                <section className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-indigo-200">Viewing rule context from alert details</p>
                    <button
                      type="button"
                      onClick={handleBackToAlert}
                      className="inline-flex items-center gap-1 rounded-md border border-indigo-400/40 bg-indigo-500/20 px-2.5 py-1 text-xs text-indigo-100 hover:bg-indigo-500/30 transition-colors"
                    >
                      <ExternalLink className="size-3.5 rotate-180" />
                      Back to Alert
                    </button>
                  </div>
                </section>
              )}
              <section className="rounded-xl border border-tok-border bg-surface-1 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold text-fg-primary">Alert Rules</h2>
                    <p className="text-xs text-fg-muted mt-0.5">
                      {activeRuleCount} active · {disabledRuleCount} disabled
                    </p>
                  </div>
                  <button
                    onClick={handleNewRule}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-fg-primary transition-colors",
                      "focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                    )}
                  >
                    + New Rule
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Severity buckets">
                  {groupedRules.map((group) => {
                    const groupStyle = SEVERITY_GROUP_STYLES[group.severity];
                    const expanded = expandedSeverityGroups[group.severity];
                    return (
                      <button
                        key={group.severity}
                        type="button"
                        onClick={() =>
                          setExpandedSeverityGroups((previous) => ({
                            ...previous,
                            [group.severity]: !previous[group.severity],
                          }))
                        }
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs transition-colors",
                          "focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none",
                          groupStyle.summaryPill
                        )}
                      >
                        <span className="font-semibold">{SEVERITY_LABELS[group.severity]}</span>
                        <span className={cn("rounded-full bg-surface-0/70 px-1.5 py-0.5 font-mono text-[11px]", groupStyle.count)}>
                          {group.rules.length}
                        </span>
                        {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                      </button>
                    );
                  })}
                </div>
              </section>

              {groupedRules
                .filter((group) => group.rules.length > 0)
                .map((group) => {
                  const groupStyle = SEVERITY_GROUP_STYLES[group.severity];
                  const expanded = expandedSeverityGroups[group.severity];
                  return (
                    <section
                      key={group.severity}
                      className={cn("rounded-xl border bg-surface-1 overflow-hidden", groupStyle.groupBorder, groupStyle.groupSurface)}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSeverityGroups((previous) => ({
                            ...previous,
                            [group.severity]: !previous[group.severity],
                          }))
                        }
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 text-left",
                          "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("h-2.5 w-2.5 rounded-full", groupStyle.dot)} />
                          <p className="text-sm font-semibold text-fg-primary">
                            {SEVERITY_LABELS[group.severity]} ({group.rules.length})
                          </p>
                          <span className="text-xs text-fg-muted">
                            {group.rules.filter((rule) => rule.enabled).length} active
                          </span>
                        </div>
                        {expanded ? <ChevronDown className="size-4 text-fg-muted" /> : <ChevronRight className="size-4 text-fg-muted" />}
                      </button>

                      {expanded && (
                        <div className="p-3 sm:p-4 space-y-3">
                          {group.rules.map((rule) => {
                            const RuleCategoryIcon = CATEGORY_META[rule.category].icon;
                            return (
                            <article
                              id={`rule-${rule.id}`}
                              key={rule.id}
                              className={cn(
                                "rounded-xl border border-tok-border bg-surface-0/60 p-4",
                                focusedRuleId === rule.id && "ring-1 ring-indigo-500/60 bg-indigo-500/10"
                              )}
                            >
                              <div className="flex items-start gap-4">
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={rule.enabled}
                                  aria-label={`${rule.name} ${rule.enabled ? "enabled" : "disabled"}`}
                                  onClick={() => toggleRuleEnabled(rule.id)}
                                  className={cn(
                                    "relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors mt-0.5",
                                    "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                                    rule.enabled ? "bg-indigo-600" : "bg-surface-3"
                                  )}
                                >
                                  <span
                                    className={cn(
                                      "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform m-0.5",
                                      rule.enabled ? "translate-x-4" : "translate-x-0"
                                    )}
                                  />
                                </button>

                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="text-sm font-semibold text-fg-primary">{rule.name}</h3>
                                    <span className={cn("text-[11px] px-2 py-0.5 rounded-full border", SEVERITY_COLORS[rule.severity])}>
                                      {SEVERITY_LABELS[rule.severity]}
                                    </span>
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-surface-2 text-fg-secondary inline-flex items-center gap-1">
                                      <RuleCategoryIcon className="size-3 opacity-70" />
                                      <span>{CATEGORY_META[rule.category].label}</span>
                                    </span>
                                  </div>

                                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {rule.notifyChannels.map((channel) => (
                                      <span
                                        key={channel}
                                        className="text-[10px] px-2 py-0.5 rounded-full border border-tok-border bg-surface-2 text-fg-secondary font-mono"
                                      >
                                        {channel}
                                      </span>
                                    ))}
                                  </div>

                                  <p className="text-xs text-fg-muted mt-2">{rule.condition}</p>

                                  <div className="mt-3 flex flex-wrap items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setEditingRuleId(rule.id)}
                                      className="inline-flex items-center gap-1.5 rounded-md border border-tok-border bg-surface-2 px-2.5 py-1 text-xs text-fg-secondary hover:text-fg-primary transition-colors"
                                    >
                                      <Pencil className="size-3.5" />
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openDiagnosticsView(rule.diagnosticsView)}
                                      className="inline-flex items-center gap-1.5 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-300 hover:bg-indigo-500/20 transition-colors"
                                    >
                                      <ExternalLink className="size-3.5" />
                                      {DIAGNOSTICS_LABELS[rule.diagnosticsView]}
                                    </button>
                                  </div>
                                </div>

                                <div className="w-40 shrink-0 self-center rounded-lg border border-tok-border bg-surface-2/60 px-3 py-2">
                                  <div className="space-y-1.5">
                                    <div className="flex items-center justify-between gap-2 text-[11px]">
                                      <span className="text-fg-muted">Window</span>
                                      <span className="text-fg-primary font-mono">{rule.window}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 text-[11px]">
                                      <span className="text-fg-muted">Threshold</span>
                                      <span className="text-fg-primary font-mono">{rule.threshold}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 text-[11px]">
                                      <span className="text-fg-muted">Fired</span>
                                      <span className="text-fg-primary font-mono">{rule.firedCount}×</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2 text-[11px]">
                                      <span className="text-fg-muted">Last</span>
                                      <span className="text-fg-primary font-mono">
                                        {rule.lastFired ? relTime(rule.lastFired) : "never"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </article>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
            </div>
          </div>
        )}
      </main>

      <AlertRuleConfigDialog
        open={editingRule !== null}
        rule={editingRule}
        onClose={() => setEditingRuleId(null)}
        onSave={handleRuleSave}
        onOpenDiagnostics={openDiagnosticsView}
      />
    </>
  );
}
