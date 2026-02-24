import React, { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "../lib/utils";
import {
  AlertGroupPresetButtons,
  AlertSeveritySummaryPill,
} from "../components/alerts/AlertRuleCardPrimitives";
import { AlertSelectFilterBar } from "../components/alerts/AlertFilters";
import { AlertRuleCard } from "../components/alerts/AlertRuleCard";
import { AlertRuleGroupSection } from "../components/alerts/AlertRuleGroupSection";
import { AlertSlideoutPanel } from "../components/alerts/AlertSlideoutPanel";
import {
  AlertRuleConfigDialog,
  type AlertRuleCategory,
  type AlertRuleConfig,
  type AlertDiagnosticsView,
} from "../components/alerts/AlertRuleConfigDialog";
import {
  ALERT_SEVERITY_BADGE_CLASS,
  ALERT_SEVERITY_GROUP_STYLES,
  ALERT_SEVERITY_LABELS,
  ALERT_SEVERITY_ORDER,
} from "../components/alerts/alertSeverityTheme";
import { toTitleLabel } from "../components/alerts/alertLabeling";
import { AlertActionIcon } from "../components/alerts/alertActionIcons";
import { normalizeDeliveryTargets } from "../components/alerts/alertDeliveryTargets";
import { resolveAlertWorkspaceRoute } from "../components/alerts/alertRoutes";
import { warnOnSeverityContrastIssues } from "../components/alerts/alertVisualA11y";
import { getRuleStateBadgeClass } from "../components/alerts/alertStatusTheme";
import { getRovingTargetIndex } from "./alert-center-utils";

type RuleType = "threshold" | "anomaly" | "trend" | "composite" | "absence";
type RuleSeverity = "critical" | "high" | "medium" | "low" | "info";
type RuleState = "firing" | "ok" | "pending" | "disabled" | "error";
type ActionType = "alert" | "pagerduty" | "slack" | "webhook" | "auto-scale" | "runbook";

interface RuleCondition {
  metric: string;
  operator: "gt" | "lt" | "gte" | "lte" | "eq" | "ne";
  threshold: number;
  window: string;
  aggregation: "avg" | "sum" | "max" | "min" | "p99" | "p95";
}

interface RuleAction {
  type: ActionType;
  target: string;
  message: string;
  cooldown: string;
}

interface ObsRule {
  id: string;
  name: string;
  description: string;
  type: RuleType;
  severity: RuleSeverity;
  state: RuleState;
  conditions: RuleCondition[];
  actions: RuleAction[];
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdBy: string;
  createdAt: string;
  lastEvaluated: string;
  lastFired: string | null;
  firingCount: number;
  evaluationInterval: string;
  pendingDuration: string;
  enabled: boolean;
}

interface FiringAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: RuleSeverity;
  startedAt: string;
  duration: string;
  value: number;
  threshold: number;
  labels: Record<string, string>;
  status: "firing" | "resolved";
  resolvedAt: string | null;
}

interface EvalPoint {
  time: string;
  value: number;
  threshold: number;
  state: "ok" | "firing";
}

const RULES: ObsRule[] = [
  {
    id: "rule1", name: "High API Error Rate", type: "threshold", severity: "critical", state: "firing",
    description: "Fires when the 5-minute error rate on any API endpoint exceeds 5% of total requests.",
    conditions: [{ metric: "http_requests_errors_rate5m", operator: "gt", threshold: 5, window: "5m", aggregation: "avg" }],
    actions: [
      { type: "pagerduty", target: "oncall-eng", message: "API error rate critical: {{value}}%", cooldown: "5m" },
      { type: "slack", target: "#incidents", message: "🚨 API error rate {{value}}% (threshold: 5%)", cooldown: "15m" },
    ],
    labels: { team: "platform", env: "production", service: "api-gateway" },
    annotations: { runbook: "https://runbooks.co/api-errors", summary: "High API error rate on production" },
    createdBy: "platform-team@co.com", createdAt: "2025-06-01", lastEvaluated: "2026-02-22 15:58",
    lastFired: "2026-02-22 14:20", firingCount: 18, evaluationInterval: "1m", pendingDuration: "2m", enabled: true,
  },
  {
    id: "rule2", name: "Database Connection Pool Exhaustion", type: "threshold", severity: "high", state: "pending",
    description: "Fires when database connection pool utilization exceeds 90% for more than 3 minutes.",
    conditions: [{ metric: "db_pool_utilization", operator: "gt", threshold: 90, window: "3m", aggregation: "avg" }],
    actions: [
      { type: "pagerduty", target: "dba-team", message: "DB connection pool {{value}}% utilized", cooldown: "10m" },
      { type: "runbook", target: "https://runbooks.co/db-pool", message: "Scale connection pool or investigate slow queries", cooldown: "0" },
    ],
    labels: { team: "database", env: "production", service: "postgres-primary" },
    annotations: { runbook: "https://runbooks.co/db-pool", summary: "Possible DB connection exhaustion" },
    createdBy: "dba@co.com", createdAt: "2025-09-01", lastEvaluated: "2026-02-22 15:58",
    lastFired: "2026-02-10 09:15", firingCount: 4, evaluationInterval: "1m", pendingDuration: "3m", enabled: true,
  },
  {
    id: "rule3", name: "P99 Latency Spike", type: "threshold", severity: "high", state: "ok",
    description: "Fires when p99 response latency exceeds 2 seconds averaged over the last 10 minutes.",
    conditions: [{ metric: "http_request_duration_p99", operator: "gt", threshold: 2000, window: "10m", aggregation: "p99" }],
    actions: [
      { type: "slack", target: "#backend-alerts", message: "P99 latency {{value}}ms exceeded 2s threshold", cooldown: "10m" },
    ],
    labels: { team: "backend", env: "production" },
    annotations: { runbook: "https://runbooks.co/latency", summary: "Response time degradation detected" },
    createdBy: "backend-team@co.com", createdAt: "2025-04-15", lastEvaluated: "2026-02-22 15:58",
    lastFired: "2026-02-18 16:45", firingCount: 7, evaluationInterval: "2m", pendingDuration: "5m", enabled: true,
  },
  {
    id: "rule4", name: "Memory Leak Detection", type: "anomaly", severity: "medium", state: "ok",
    description: "Detects sustained upward memory trend over 1 hour suggesting potential memory leak.",
    conditions: [{ metric: "process_memory_bytes", operator: "gt", threshold: 0, window: "1h", aggregation: "avg" }],
    actions: [
      { type: "slack", target: "#infra-alerts", message: "Memory growth trend detected on {{instance}}", cooldown: "1h" },
    ],
    labels: { team: "infra", env: "production" },
    annotations: { runbook: "https://runbooks.co/memory-leak", summary: "Possible memory leak" },
    createdBy: "infra@co.com", createdAt: "2025-11-01", lastEvaluated: "2026-02-22 15:55",
    lastFired: "2026-02-14 04:00", firingCount: 2, evaluationInterval: "5m", pendingDuration: "10m", enabled: true,
  },
  {
    id: "rule5", name: "Service Heartbeat Missing", type: "absence", severity: "critical", state: "ok",
    description: "Fires when any service stops sending heartbeat metrics for more than 2 minutes.",
    conditions: [{ metric: "service_heartbeat", operator: "eq", threshold: 0, window: "2m", aggregation: "sum" }],
    actions: [
      { type: "pagerduty", target: "oncall-eng", message: "Service {{service}} heartbeat missing for 2+ minutes", cooldown: "2m" },
    ],
    labels: { team: "platform", env: "production" },
    annotations: { runbook: "https://runbooks.co/service-down", summary: "Service may be down" },
    createdBy: "platform@co.com", createdAt: "2025-01-01", lastEvaluated: "2026-02-22 15:58",
    lastFired: "2026-02-05 09:14", firingCount: 3, evaluationInterval: "30s", pendingDuration: "2m", enabled: true,
  },
  {
    id: "rule6", name: "Disk Usage Warning", type: "threshold", severity: "medium", state: "firing",
    description: "Fires when disk usage on any monitored volume exceeds 80%.",
    conditions: [{ metric: "disk_usage_percent", operator: "gt", threshold: 80, window: "5m", aggregation: "max" }],
    actions: [
      { type: "slack", target: "#infra-alerts", message: "Disk usage on {{volume}} is {{value}}%", cooldown: "1h" },
    ],
    labels: { team: "infra", env: "production" },
    annotations: { runbook: "https://runbooks.co/disk", summary: "Disk space running low" },
    createdBy: "infra@co.com", createdAt: "2025-03-01", lastEvaluated: "2026-02-22 15:58",
    lastFired: "2026-02-22 10:00", firingCount: 12, evaluationInterval: "5m", pendingDuration: "5m", enabled: true,
  },
  {
    id: "rule7", name: "Queue Depth Alert", type: "threshold", severity: "high", state: "disabled",
    description: "Fires when message queue depth exceeds 10,000 unprocessed messages.",
    conditions: [{ metric: "rabbitmq_queue_messages", operator: "gt", threshold: 10000, window: "5m", aggregation: "max" }],
    actions: [
      { type: "slack", target: "#platform-alerts", message: "Queue depth {{value}} exceeds 10k", cooldown: "30m" },
    ],
    labels: { team: "platform" },
    annotations: { runbook: "https://runbooks.co/queue", summary: "Message queue backup detected" },
    createdBy: "platform@co.com", createdAt: "2026-01-15", lastEvaluated: "N/A",
    lastFired: null, firingCount: 0, evaluationInterval: "1m", pendingDuration: "5m", enabled: false,
  },
];

const FIRING_ALERTS: FiringAlert[] = [
  { id: "a1", ruleId: "rule1", ruleName: "High API Error Rate", severity: "critical", startedAt: "2026-02-22 14:20", duration: "1h 38m", value: 7.4, threshold: 5, labels: { endpoint: "/api/v2/orders", region: "us-east-1" }, status: "firing", resolvedAt: null },
  { id: "a2", ruleId: "rule6", ruleName: "Disk Usage Warning", severity: "medium", startedAt: "2026-02-22 10:00", duration: "5h 58m", value: 83.2, threshold: 80, labels: { volume: "/dev/nvme0n1p1", host: "worker-12" }, status: "firing", resolvedAt: null },
  { id: "a3", ruleId: "rule3", ruleName: "P99 Latency Spike", severity: "high", startedAt: "2026-02-18 16:45", duration: "22m", value: 2840, threshold: 2000, labels: { service: "order-svc" }, status: "resolved", resolvedAt: "2026-02-18 17:07" },
  { id: "a4", ruleId: "rule1", ruleName: "High API Error Rate", severity: "critical", startedAt: "2026-02-15 09:30", duration: "45m", value: 12.1, threshold: 5, labels: { endpoint: "/api/v1/payments" }, status: "resolved", resolvedAt: "2026-02-15 10:15" },
];

const EVAL_HISTORY: EvalPoint[] = [
  { time: "14:00", value: 2.1, threshold: 5, state: "ok" },
  { time: "14:10", value: 3.8, threshold: 5, state: "ok" },
  { time: "14:20", value: 6.2, threshold: 5, state: "firing" },
  { time: "14:30", value: 7.9, threshold: 5, state: "firing" },
  { time: "14:40", value: 8.4, threshold: 5, state: "firing" },
  { time: "14:50", value: 7.1, threshold: 5, state: "firing" },
  { time: "15:00", value: 6.8, threshold: 5, state: "firing" },
  { time: "15:10", value: 7.4, threshold: 5, state: "firing" },
];

function severityColor(s: RuleSeverity) {
  if (s === "critical") {return "bg-rose-500/10 text-rose-400";}
  if (s === "high") {return "bg-orange-500/10 text-orange-400";}
  if (s === "medium") {return "bg-amber-500/10 text-amber-400";}
  if (s === "low") {return "bg-blue-500/10 text-blue-400";}
  return "bg-[var(--color-surface-3)]/10 text-[var(--color-text-secondary)]";
}
function typeBadge(t: RuleType) {
  const colors: Record<RuleType, string> = {
    threshold: "bg-indigo-500/10 text-indigo-400",
    anomaly: "bg-purple-500/10 text-purple-400",
    trend: "bg-blue-500/10 text-blue-400",
    composite: "bg-orange-500/10 text-orange-400",
    absence: "bg-[var(--color-surface-3)]/10 text-[var(--color-text-secondary)]",
  };
  return colors[t];
}
function opLabel(op: RuleCondition["operator"]) {
  const map: Record<RuleCondition["operator"], string> = { gt: ">", lt: "<", gte: "≥", lte: "≤", eq: "=", ne: "≠" };
  return map[op];
}

export default function ObservabilityRulesEngine() {
  const OBS_RULES_UI_KEY = "oc_obs_rules_ui";
  const [rules, setRules] = useState<ObsRule[]>(RULES);
  const [tab, setTab] = useState<"rules" | "alerts" | "history" | "stats">("rules");
  const [selectedRule, setSelectedRule] = useState<ObsRule | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [showSlideout, setShowSlideout] = useState(false);
  const [rulePreset, setRulePreset] = useState<"p1Only" | "all" | "none" | "custom">("p1Only");
  const [filterState, setFilterState] = useState<RuleState | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<RuleSeverity | "all">("all");
  const [filterType, setFilterType] = useState<RuleType | "all">("all");
  const [expandedSeverityGroups, setExpandedSeverityGroups] = useState<Record<RuleSeverity, boolean>>({
    critical: true,
    high: true,
    medium: false,
    low: false,
    info: false,
  });

  const applyRulePreset = useCallback((preset: "p1Only" | "all" | "none") => {
    setRulePreset(preset);
    if (preset === "p1Only") {
      setExpandedSeverityGroups({ critical: true, high: true, medium: false, low: false, info: false });
      return;
    }
    if (preset === "all") {
      setExpandedSeverityGroups({ critical: true, high: true, medium: true, low: true, info: true });
      return;
    }
    setExpandedSeverityGroups({ critical: false, high: false, medium: false, low: false, info: false });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {return;}
    warnOnSeverityContrastIssues();
    const query = new URLSearchParams(window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search);
    const presetFromQuery = query.get("rgPreset");
    if (presetFromQuery === "p1Only" || presetFromQuery === "all" || presetFromQuery === "none") {
      applyRulePreset(presetFromQuery);
    }
    try {
      const raw = window.localStorage.getItem(OBS_RULES_UI_KEY);
      if (!raw) {return;}
      const parsed = JSON.parse(raw) as { preset?: "p1Only" | "all" | "none"; expanded?: Partial<Record<RuleSeverity, boolean>> };
      if (parsed.preset) {applyRulePreset(parsed.preset);}
      if (parsed.expanded) {
        setExpandedSeverityGroups((prev) => ({
          ...prev,
          critical: parsed.expanded?.critical ?? prev.critical,
          high: parsed.expanded?.high ?? prev.high,
          medium: parsed.expanded?.medium ?? prev.medium,
          low: parsed.expanded?.low ?? prev.low,
          info: parsed.expanded?.info ?? prev.info,
        }));
      }
    } catch {}
  }, [applyRulePreset]);

  useEffect(() => {
    if (typeof window === "undefined") {return;}
    try {
      window.localStorage.setItem(OBS_RULES_UI_KEY, JSON.stringify({ preset: rulePreset, expanded: expandedSeverityGroups }));
      const params = new URLSearchParams(window.location.search.startsWith("?") ? window.location.search.slice(1) : window.location.search);
      params.set("obsTab", tab);
      if (rulePreset !== "custom") {
        params.set("rgPreset", rulePreset);
      } else {
        params.delete("rgPreset");
      }
      window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}${window.location.hash}`);
    } catch {}
  }, [expandedSeverityGroups, rulePreset, tab]);

  const filteredRules = rules.filter((rule) => {
    if (filterState !== "all" && rule.state !== filterState) {return false;}
    if (filterSeverity !== "all" && rule.severity !== filterSeverity) {return false;}
    if (filterType !== "all" && rule.type !== filterType) {return false;}
    return true;
  });

  const groupedRules = useMemo(
    () =>
      ALERT_SEVERITY_ORDER.map((severity) => ({
        severity,
        rules: filteredRules.filter((rule) => rule.severity === severity),
      })),
    [filteredRules]
  );

  const editingRule = useMemo(
    () => rules.find((rule) => rule.id === editingRuleId) ?? null,
    [editingRuleId, rules]
  );

  const toConfig = (rule: ObsRule): AlertRuleConfig => {
    const first = rule.conditions[0];
    const targets = normalizeDeliveryTargets(rule.actions.map((action) => action.target));
    return {
      id: rule.id,
      name: rule.name,
      enabled: rule.enabled,
      severity: rule.severity,
      category: (rule.labels.team === "security" ? "security" : "system") as AlertRuleCategory,
      condition: first ? `${first.aggregation}(${first.metric}) ${opLabel(first.operator)} ${first.threshold}` : rule.description,
      threshold: String(first?.threshold ?? "0"),
      window: first?.window ?? "5m",
      notifyChannels: targets.length ? targets : ["#cb-alerts"],
      firedCount: rule.firingCount,
      lastFired: rule.lastFired ?? undefined,
      diagnosticsView: "metrics",
      notes: rule.description,
    };
  };

  const handleRuleSave = (next: AlertRuleConfig) => {
    setRules((previous) =>
      previous.map((rule) =>
        rule.id === next.id
          ? {
              ...rule,
              name: next.name,
              enabled: next.enabled,
              severity: next.severity,
              firingCount: next.firedCount,
              lastFired: next.lastFired ?? null,
              pendingDuration: next.window,
              actions: normalizeDeliveryTargets(next.notifyChannels).map((target) => ({
                type: target.includes("pagerduty") ? "pagerduty" : "slack",
                target,
                message: `${next.name} triggered`,
                cooldown: "5m",
              })),
              description: next.notes?.trim() || rule.description,
            }
          : rule
      )
    );
    setEditingRuleId(null);
  };

  const firingCount = rules.filter((rule) => rule.state === "firing").length;
  const pendingCount = rules.filter((rule) => rule.state === "pending").length;
  const okCount = rules.filter((rule) => rule.state === "ok").length;
  const activeAlerts = FIRING_ALERTS.filter((alert) => alert.status === "firing").length;
  const maxValue = Math.max(...EVAL_HISTORY.map((point) => point.value), 1);

  return (
    <>
      <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Observability Rules Engine</h1>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">Define, manage, and monitor alerting rules across your infrastructure</p>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1.5 text-sm bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-lg transition-colors">Import Rules</button>
            <button className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors">+ New Rule</button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[{ label: "Firing", value: firingCount, tone: "text-rose-400 border-rose-500/30" }, { label: "Pending", value: pendingCount, tone: "text-amber-400 border-amber-500/20" }, { label: "OK", value: okCount, tone: "text-emerald-400 border-[var(--color-border)]" }, { label: "Active Alerts", value: activeAlerts, tone: "text-[var(--color-text-primary)] border-[var(--color-border)]" }].map((stat) => (
            <div key={stat.label} className={cn("bg-[var(--color-surface-1)] rounded-xl p-4 border", stat.tone)}>
              <div className="text-xs text-[var(--color-text-muted)] mb-1">{stat.label}</div>
              <div className={cn("text-2xl font-bold", stat.tone.split(" ")[0])}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-1 border-b border-[var(--color-border)] mb-6">
          {[
            { id: "rules", label: `Rules (${rules.length})` },
            { id: "alerts", label: `Alerts (${activeAlerts} firing)` },
            { id: "history", label: "Eval History" },
            { id: "stats", label: "Statistics" },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => { setTab(item.id as typeof tab); setSelectedRule(null); }}
              className={cn("px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px", tab === item.id ? "border-indigo-500 text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "rules" && !selectedRule ? (
          <div>
            <AlertSelectFilterBar
              filters={[
                { value: filterState, onChange: (next) => setFilterState(next as RuleState | "all"), ariaLabel: "Filter by state", options: [{ value: "all", label: "All States" }, { value: "firing", label: "Firing" }, { value: "pending", label: "Pending" }, { value: "ok", label: "OK" }, { value: "disabled", label: "Disabled" }] },
                { value: filterSeverity, onChange: (next) => setFilterSeverity(next as RuleSeverity | "all"), ariaLabel: "Filter by severity", options: [{ value: "all", label: "All Severity" }, ...ALERT_SEVERITY_ORDER.map((severity) => ({ value: severity, label: toTitleLabel(severity) }))] },
                { value: filterType, onChange: (next) => setFilterType(next as RuleType | "all"), ariaLabel: "Filter by type", options: [{ value: "all", label: "All Types" }, { value: "threshold", label: "Threshold" }, { value: "anomaly", label: "Anomaly" }, { value: "trend", label: "Trend" }, { value: "absence", label: "Absence" }, { value: "composite", label: "Composite" }] },
              ]}
            />

            <div
              className="mb-3 flex flex-wrap gap-2"
              onKeyDown={(event) => {
                const pills = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button[data-severity-pill='true']"));
                if (pills.length === 0) {return;}
                const activeIndex = pills.findIndex((pill) => pill === document.activeElement);
                const index = getRovingTargetIndex(activeIndex >= 0 ? activeIndex : 0, event.key, pills.length);
                if (index === null) {return;}
                event.preventDefault();
                pills[index]?.focus();
              }}
            >
              {groupedRules.map((group) => {
                const style = ALERT_SEVERITY_GROUP_STYLES[group.severity];
                return (
                  <AlertSeveritySummaryPill
                    key={group.severity}
                    label={ALERT_SEVERITY_LABELS[group.severity]}
                    total={group.rules.length}
                    activeCount={group.rules.filter((rule) => rule.state !== "disabled").length}
                    expanded={expandedSeverityGroups[group.severity]}
                    onToggle={() => {
                      setRulePreset("custom");
                      setExpandedSeverityGroups((prev) => ({ ...prev, [group.severity]: !prev[group.severity] }));
                    }}
                    className={style.summaryPill}
                    countClassName={style.count}
                    countSurfaceClassName={style.badgeSurface}
                  />
                );
              })}
            </div>

            <AlertGroupPresetButtons
              onP1Only={() => applyRulePreset("p1Only")}
              onExpandAll={() => applyRulePreset("all")}
              onCollapseAll={() => applyRulePreset("none")}
            />

            <div className="space-y-3 mt-2">
              {groupedRules.filter((group) => group.rules.length > 0).map((group) => {
                const style = ALERT_SEVERITY_GROUP_STYLES[group.severity];
                const expanded = expandedSeverityGroups[group.severity];
                return (
                  <AlertRuleGroupSection
                    key={group.severity}
                    title={ALERT_SEVERITY_LABELS[group.severity]}
                    count={group.rules.length}
                    activeCount={group.rules.filter((rule) => rule.state !== "disabled").length}
                    expanded={expanded}
                    onToggle={() => {
                      setRulePreset("custom");
                      setExpandedSeverityGroups((prev) => ({ ...prev, [group.severity]: !prev[group.severity] }));
                    }}
                    className={cn(style.groupBorder, style.groupSurface)}
                  >
                    {group.rules.map((rule) => {
                      const actionTargets = normalizeDeliveryTargets(rule.actions.map((action) => action.target));
                      return (
                        <AlertRuleCard
                          key={rule.id}
                          onClick={() => { setSelectedRule(rule); setShowSlideout(true); }}
                          title={rule.name}
                          titleBadges={(
                            <>
                              <span className={cn("text-xs px-2 py-0.5 rounded-full border", getRuleStateBadgeClass(rule.state))}>{toTitleLabel(rule.state)}</span>
                              <span className={cn("text-xs px-2 py-0.5 rounded-full border", ALERT_SEVERITY_BADGE_CLASS[rule.severity])}>{ALERT_SEVERITY_LABELS[rule.severity]}</span>
                              <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", typeBadge(rule.type))}>{toTitleLabel(rule.type)}</span>
                            </>
                          )}
                          targets={actionTargets}
                          description={rule.description}
                          headerActions={(
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); setEditingRuleId(rule.id); }}
                              className="inline-flex items-center gap-1.5 rounded-md border border-tok-border bg-surface-2 px-2.5 py-1 text-xs text-fg-secondary hover:text-fg-primary transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          footerActions={(
                            <div className="flex items-center gap-1">
                              {rule.actions.map((action, index) => (
                                <span key={`${rule.id}-${index}`} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1" title={toTitleLabel(action.type)}>
                                  <AlertActionIcon type={action.type} className="size-3.5 text-[var(--color-text-secondary)]" />
                                </span>
                              ))}
                            </div>
                          )}
                          stats={[
                            { label: "Interval", value: rule.evaluationInterval },
                            { label: "Pending", value: rule.pendingDuration },
                            { label: "Fired", value: `${rule.firingCount}x` },
                            { label: "Last", value: rule.lastFired ?? "Never" },
                          ]}
                        />
                      );
                    })}
                  </AlertRuleGroupSection>
                );
              })}
            </div>
          </div>
        ) : null}

        {tab === "rules" && selectedRule ? (
          <div>
            <button onClick={() => setSelectedRule(null)} className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors">← Back</button>
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{selectedRule.name}</h2>
                <button onClick={() => setEditingRuleId(selectedRule.id)} className="rounded-md border border-tok-border bg-surface-2 px-2.5 py-1 text-xs">Edit</button>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] mt-2">{selectedRule.description}</p>
            </div>
          </div>
        ) : null}

        {tab === "alerts" ? (
          <div className="space-y-3">
            {FIRING_ALERTS.map((alert) => (
              <div key={alert.id} className={cn("bg-[var(--color-surface-1)] rounded-xl p-4 border", alert.status === "firing" ? "border-rose-500/30" : "border-[var(--color-border)]")}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{alert.ruleName}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full border", ALERT_SEVERITY_BADGE_CLASS[alert.severity])}>{ALERT_SEVERITY_LABELS[alert.severity]}</span>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
            <h3 className="text-sm font-medium mb-3">Evaluation History</h3>
            <div className="flex items-end gap-2" style={{ height: 100 }}>
              {EVAL_HISTORY.map((point) => (
                <div key={point.time} className="flex-1">
                  <div className={cn("rounded-t", point.state === "firing" ? "bg-rose-500" : "bg-emerald-500")} style={{ height: `${(point.value / (maxValue * 1.1)) * 90}px`, minHeight: 4 }} />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "stats" ? (
          <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
            <h3 className="text-sm font-medium mb-3">Rules by Severity</h3>
            {ALERT_SEVERITY_ORDER.map((severity) => {
              const count = rules.filter((rule) => rule.severity === severity).length;
              return (
                <div key={severity} className="flex items-center justify-between text-xs py-1">
                  <span>{ALERT_SEVERITY_LABELS[severity]}</span>
                  <span>{count}</span>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>

      <AlertSlideoutPanel
        open={showSlideout && Boolean(selectedRule)}
        title="Alert-Specific Workspace"
        subtitle="Focused diagnostics for this rule"
        onClose={() => setShowSlideout(false)}
      >
        {selectedRule ? (
          <button
            type="button"
            onClick={() => { window.location.hash = `#${resolveAlertWorkspaceRoute({ ruleId: selectedRule.id })}`; }}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300 hover:bg-emerald-500/20 transition-colors"
          >
            Open Alert Workspace
          </button>
        ) : null}
      </AlertSlideoutPanel>

      <AlertRuleConfigDialog
        open={editingRule !== null}
        rule={editingRule ? toConfig(editingRule) : null}
        onClose={() => setEditingRuleId(null)}
        onSave={handleRuleSave}
      />
    </>
  );
}
