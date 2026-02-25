import React, { useMemo, useState } from "react";
import { cn } from "../lib/utils";
import { AlertFilterPillGroup } from "../components/alerts/AlertFilters";
import { AlertRuleCard } from "../components/alerts/AlertRuleCard";
import { AlertRuleGroupSection } from "../components/alerts/AlertRuleGroupSection";
import { AlertSlideoutPanel } from "../components/alerts/AlertSlideoutPanel";
import {
  AlertGroupPresetButtons,
  AlertSeveritySummaryPill,
} from "../components/alerts/AlertRuleCardPrimitives";
import {
  AlertRuleConfigDialog,
  type AlertDiagnosticsView,
  type AlertRuleCategory,
  type AlertRuleConfig,
} from "../components/alerts/AlertRuleConfigDialog";
import {
  ALERT_SEVERITY_BADGE_CLASS,
  ALERT_SEVERITY_GROUP_STYLES,
  ALERT_SEVERITY_LABELS,
} from "../components/alerts/alertSeverityTheme";
import { normalizeDeliveryTargets } from "../components/alerts/alertDeliveryTargets";
import { toTitleLabel } from "../components/alerts/alertLabeling";

type AlertSeverity = "critical" | "high" | "medium" | "low";
type AlertState = "firing" | "resolved" | "suppressed" | "pending";
type ConditionType = "threshold" | "anomaly" | "absence" | "rate";
type NotifChannel = "slack" | "pagerduty" | "email" | "webhook";

interface AlertRule {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  state: AlertState;
  condition: ConditionType;
  metric: string;
  threshold: string;
  duration: string;
  firingFor: string;
  lastTriggered: string;
  triggerCount: number;
  channels: NotifChannel[];
  team: string;
  runbook: string;
  labels: Record<string, string>;
}

interface NotificationRoute {
  id: string;
  name: string;
  matcher: string;
  channels: NotifChannel[];
  escalateTo: string;
  escalateAfterMin: number;
  muteFrom: string;
  muteTo: string;
  active: boolean;
}

interface Silencer {
  id: string;
  name: string;
  matchers: string[];
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  reason: string;
  active: boolean;
}

interface AlertHistoryEvent {
  id: string;
  ruleName: string;
  severity: AlertSeverity;
  state: "fired" | "resolved";
  firedAt: string;
  resolvedAt: string;
  duration: string;
  affectedServices: string[];
  acknowledgedBy: string;
}

const ALERT_RULES: AlertRule[] = [
  { id: "ar1", name: "High Error Rate", description: "HTTP 5xx rate exceeds 2% over 5m window", severity: "critical", state: "firing", condition: "threshold", metric: "http_requests_total{status=~'5..'}", threshold: "> 2%", duration: "5m", firingFor: "12m", lastTriggered: "12m ago", triggerCount: 3, channels: ["pagerduty", "slack"], team: "platform", runbook: "https://wiki/runbook/high-error-rate", labels: { env: "prod", service: "api-gateway" } },
  { id: "ar2", name: "P95 Latency Spike", description: "API latency p95 exceeds 2s for any service", severity: "high", state: "firing", condition: "threshold", metric: "http_request_duration_seconds{quantile='0.95'}", threshold: "> 2", duration: "3m", firingFor: "7m", lastTriggered: "7m ago", triggerCount: 1, channels: ["slack"], team: "backend", runbook: "https://wiki/runbook/latency", labels: { env: "prod", service: "user-service" } },
  { id: "ar3", name: "Disk Usage Critical", description: "Node disk usage exceeds 85%", severity: "high", state: "pending", condition: "threshold", metric: "node_filesystem_usage_ratio", threshold: "> 0.85", duration: "10m", firingFor: "2m", lastTriggered: "2m ago", triggerCount: 0, channels: ["slack", "email"], team: "infra", runbook: "https://wiki/runbook/disk", labels: { env: "prod", node: "worker-04" } },
  { id: "ar4", name: "Memory Anomaly Detected", description: "Unusual memory usage pattern (ML-based anomaly)", severity: "medium", state: "firing", condition: "anomaly", metric: "process_resident_memory_bytes", threshold: "z-score > 3.5", duration: "15m", firingFor: "23m", lastTriggered: "23m ago", triggerCount: 2, channels: ["slack"], team: "backend", runbook: "https://wiki/runbook/memory", labels: { env: "prod", service: "ml-service" } },
  { id: "ar5", name: "DB Connections Exhausted", description: "Postgres connection pool near saturation", severity: "critical", state: "resolved", condition: "threshold", metric: "pg_stat_activity_count", threshold: "> 90% of max", duration: "2m", firingFor: "-", lastTriggered: "1h ago", triggerCount: 8, channels: ["pagerduty", "slack", "email"], team: "data", runbook: "https://wiki/runbook/db-connections", labels: { env: "prod", db: "postgres-primary" } },
  { id: "ar6", name: "Heartbeat Missing", description: "Agent heartbeat not received for > 3m", severity: "high", state: "suppressed", condition: "absence", metric: "up{job='agent'}", threshold: "absent > 3m", duration: "3m", firingFor: "-", lastTriggered: "3d ago", triggerCount: 4, channels: ["pagerduty"], team: "platform", runbook: "https://wiki/runbook/heartbeat", labels: { env: "staging" } },
  { id: "ar7", name: "High CPU Rate of Change", description: "CPU usage increasing faster than 20%/min", severity: "medium", state: "resolved", condition: "rate", metric: "rate(node_cpu_seconds_total[1m])", threshold: "rate > 0.2", duration: "5m", firingFor: "-", lastTriggered: "2h ago", triggerCount: 1, channels: ["slack"], team: "infra", runbook: "https://wiki/runbook/cpu", labels: { env: "prod" } },
  { id: "ar8", name: "Certificate Expiry", description: "TLS certificate expires in < 14 days", severity: "medium", state: "firing", condition: "threshold", metric: "ssl_certificate_expiry_seconds", threshold: "< 1209600", duration: "1h", firingFor: "2d", lastTriggered: "2d ago", triggerCount: 1, channels: ["email", "slack"], team: "platform", runbook: "https://wiki/runbook/certs", labels: { domain: "api.company.com" } },
];

const ROUTES: NotificationRoute[] = [
  { id: "rt1", name: "Critical All-Hours", matcher: "severity=critical", channels: ["pagerduty", "slack"], escalateTo: "on-call-lead", escalateAfterMin: 15, muteFrom: "", muteTo: "", active: true },
  { id: "rt2", name: "High Business Hours", matcher: "severity=high,env=prod", channels: ["slack"], escalateTo: "team-lead", escalateAfterMin: 60, muteFrom: "", muteTo: "", active: true },
  { id: "rt3", name: "Medium No-Weekends", matcher: "severity=medium", channels: ["slack", "email"], escalateTo: "", escalateAfterMin: 240, muteFrom: "18:00", muteTo: "09:00", active: true },
  { id: "rt4", name: "Infra Team Direct", matcher: "team=infra", channels: ["pagerduty"], escalateTo: "infra-lead", escalateAfterMin: 30, muteFrom: "", muteTo: "", active: false },
];

const SILENCERS: Silencer[] = [
  { id: "s1", name: "Staging Maintenance", matchers: ["env=staging"], createdBy: "alice", createdAt: "Today 08:00", expiresAt: "Today 12:00", reason: "Planned maintenance window - infra upgrades", active: true },
  { id: "s2", name: "Agent Heartbeat Suppression", matchers: ["alertname=HeartbeatMissing", "env=prod"], createdBy: "bob", createdAt: "3d ago", expiresAt: "5d from now", reason: "Known issue with heartbeat false positives - tracking in Jira PLAT-4821", active: true },
  { id: "s3", name: "Last Week Deployment", matchers: ["env=prod", "team=platform"], createdBy: "carol", createdAt: "7d ago", expiresAt: "Expired", reason: "Deployment window - all prod alerts silenced during rollout", active: false },
];

const HISTORY: AlertHistoryEvent[] = [
  { id: "h1", ruleName: "DB Connections Exhausted", severity: "critical", state: "resolved", firedAt: "Today 09:12", resolvedAt: "Today 09:44", duration: "32m", affectedServices: ["api-gateway", "user-service"], acknowledgedBy: "dave" },
  { id: "h2", ruleName: "High CPU Rate of Change", severity: "medium", state: "resolved", firedAt: "Today 07:51", resolvedAt: "Today 08:03", duration: "12m", affectedServices: ["ml-service"], acknowledgedBy: "eve" },
  { id: "h3", ruleName: "High Error Rate", severity: "critical", state: "fired", firedAt: "Today 10:34", resolvedAt: "-", duration: "ongoing", affectedServices: ["api-gateway"], acknowledgedBy: "frank" },
  { id: "h4", ruleName: "P95 Latency Spike", severity: "high", state: "fired", firedAt: "Today 10:39", resolvedAt: "-", duration: "ongoing", affectedServices: ["user-service"], acknowledgedBy: "-" },
  { id: "h5", ruleName: "Disk Usage Critical", severity: "high", state: "fired", firedAt: "Today 10:44", resolvedAt: "-", duration: "ongoing", affectedServices: ["worker-04"], acknowledgedBy: "-" },
];

const stateBadge: Record<AlertState, string> = {
  firing: "bg-rose-500/20 border-rose-500/40 text-rose-300",
  resolved: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  suppressed: "bg-[var(--color-surface-3)]/50 border-[var(--color-surface-3)] text-[var(--color-text-secondary)]",
  pending: "bg-amber-500/15 border-amber-500/30 text-amber-400",
};

const channelIcon: Record<NotifChannel, string> = {
  slack: "SL",
  pagerduty: "PD",
  email: "EM",
  webhook: "WH",
};

const conditionBadge: Record<ConditionType, string> = {
  threshold: "bg-primary/15 text-primary",
  anomaly: "bg-purple-500/15 text-purple-400",
  absence: "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]",
  rate: "bg-sky-500/15 text-sky-400",
};

const MANAGER_SEVERITY_ORDER: AlertSeverity[] = ["critical", "high", "medium", "low"];

function mapTeamToCategory(team: string): AlertRuleCategory {
  if (team === "platform") {return "system";}
  if (team === "backend") {return "performance";}
  if (team === "infra") {return "availability";}
  if (team === "data") {return "data";}
  return "system";
}

function mapConditionToDiagnostics(condition: ConditionType): AlertDiagnosticsView {
  if (condition === "anomaly") {return "analytics";}
  if (condition === "rate") {return "metrics";}
  return "tracer";
}

function toDialogRule(rule: AlertRule): AlertRuleConfig {
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.state !== "suppressed",
    severity: rule.severity,
    category: mapTeamToCategory(rule.team),
    condition: rule.description,
    threshold: rule.threshold,
    window: rule.duration,
    notifyChannels: normalizeDeliveryTargets(rule.channels.map((c) => toTitleLabel(c))),
    firedCount: rule.triggerCount,
    lastFired: rule.lastTriggered,
    diagnosticsView: mapConditionToDiagnostics(rule.condition),
    notes: `Metric: ${rule.metric}`,
  };
}

function fromDialogRule(original: AlertRule, next: AlertRuleConfig): AlertRule {
  const managerSeverity: AlertSeverity = next.severity === "info" ? "low" : next.severity;
  const toChannel = (value: string): NotifChannel | null => {
    const normalized = value.toLowerCase().trim();
    if (normalized.includes("pager")) {return "pagerduty";}
    if (normalized.includes("webhook")) {return "webhook";}
    if (normalized.includes("email")) {return "email";}
    if (normalized.includes("slack") || normalized.startsWith("#")) {return "slack";}
    return null;
  };

  const mappedChannels = next.notifyChannels
    .map((entry) => toChannel(entry))
    .filter((entry): entry is NotifChannel => entry !== null);

  return {
    ...original,
    name: next.name,
    description: next.condition,
    severity: managerSeverity,
    threshold: next.threshold,
    duration: next.window,
    triggerCount: next.firedCount,
    lastTriggered: next.lastFired ?? original.lastTriggered,
    state: next.enabled ? (original.state === "suppressed" ? "pending" : original.state) : "suppressed",
    channels: mappedChannels.length > 0 ? mappedChannels : original.channels,
  };
}

export default function ObservabilityAlertManager() {
  const [tab, setTab] = useState<"alerts" | "routes" | "silencers" | "history">("alerts");
  const [rules, setRules] = useState<AlertRule[]>(ALERT_RULES);
  const [selectedId, setSelectedId] = useState<string>(ALERT_RULES[0]?.id ?? "");
  const [stateFilter, setStateFilter] = useState<"all" | AlertState>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | AlertSeverity>("all");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [slideoutRuleId, setSlideoutRuleId] = useState<string | null>(null);
  const [rulePreset, setRulePreset] = useState<"p1Only" | "all" | "none" | "custom">("p1Only");
  const [expandedSeverityGroups, setExpandedSeverityGroups] = useState<Record<AlertSeverity, boolean>>({
    critical: true,
    high: true,
    medium: false,
    low: false,
  });

  const selected = rules.find((rule) => rule.id === selectedId) ?? null;
  const firing = rules.filter((rule) => rule.state === "firing");
  const pending = rules.filter((rule) => rule.state === "pending");
  const resolved = rules.filter((rule) => rule.state === "resolved");

  const filtered = useMemo(
    () => rules.filter((rule) =>
      (stateFilter === "all" || rule.state === stateFilter) &&
      (severityFilter === "all" || rule.severity === severityFilter)
    ),
    [rules, stateFilter, severityFilter]
  );

  const groupedRules = useMemo(() => {
    const groups: Record<AlertSeverity, AlertRule[]> = {
      critical: [],
      high: [],
      medium: [],
      low: [],
    };
    for (const rule of filtered) {
      groups[rule.severity].push(rule);
    }
    return groups;
  }, [filtered]);

  const applyRulePreset = (preset: "p1Only" | "all" | "none") => {
    setRulePreset(preset);
    if (preset === "p1Only") {
      setExpandedSeverityGroups({ critical: true, high: true, medium: false, low: false });
      return;
    }
    if (preset === "all") {
      setExpandedSeverityGroups({ critical: true, high: true, medium: true, low: true });
      return;
    }
    setExpandedSeverityGroups({ critical: false, high: false, medium: false, low: false });
  };

  const editingRule = useMemo(() => {
    const source = rules.find((rule) => rule.id === editingRuleId);
    return source ? toDialogRule(source) : null;
  }, [rules, editingRuleId]);

  const detailRule = useMemo(() => {
    if (!slideoutRuleId) {return null;}
    return rules.find((rule) => rule.id === slideoutRuleId) ?? null;
  }, [rules, slideoutRuleId]);

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      <div className="flex-none px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Alert Manager</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Observability alerting - rules, routing, and silencing</p>
          </div>
          <button className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary text-xs font-medium transition-colors">+ New Rule</button>
        </div>

        <div className="flex gap-4 mt-3">
          {[
            { label: "Firing", value: firing.length, color: "text-rose-400", pulse: firing.length > 0 },
            { label: "Pending", value: pending.length, color: "text-amber-400", pulse: false },
            { label: "Resolved", value: resolved.length, color: "text-emerald-400", pulse: false },
            { label: "Total Rules", value: rules.length, color: "text-[var(--color-text-primary)]", pulse: false },
          ].map((summary) => (
            <div key={summary.label} className="flex items-center gap-2">
              {summary.pulse ? <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" /> : null}
              <div>
                <span className={cn("text-base font-bold", summary.color)}>{summary.value}</span>
                <span className="text-[var(--color-text-muted)] text-xs ml-1.5">{summary.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-1 mt-3">
          {(["alerts", "routes", "silencers", "history"] as const).map((entry) => (
            <button
              key={entry}
              onClick={() => setTab(entry)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                tab === entry
                  ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              {entry.charAt(0).toUpperCase() + entry.slice(1)}
              {entry === "alerts" && firing.length > 0 ? (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-[9px] font-bold text-[var(--color-text-primary)]">{firing.length}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {tab === "alerts" ? (
          <div className="flex h-full">
            <div className="w-[58%] flex-none border-r border-[var(--color-border)] flex flex-col">
              <div className="flex-none px-4 py-3 border-b border-[var(--color-border)] space-y-2">
                <div className="grid gap-2 sm:grid-cols-2">
                  <AlertFilterPillGroup
                    label="State"
                    value={stateFilter}
                    onChange={(next) => setStateFilter(next as "all" | AlertState)}
                    options={[
                      { value: "all", label: "All" },
                      { value: "firing", label: "Firing" },
                      { value: "pending", label: "Pending" },
                      { value: "resolved", label: "Resolved" },
                      { value: "suppressed", label: "Suppressed" },
                    ]}
                  />
                  <AlertFilterPillGroup
                    label="Severity"
                    value={severityFilter}
                    onChange={(next) => setSeverityFilter(next as "all" | AlertSeverity)}
                    options={[
                      { value: "all", label: "All" },
                      { value: "critical", label: "Critical" },
                      { value: "high", label: "High" },
                      { value: "medium", label: "Medium" },
                      { value: "low", label: "Low" },
                    ]}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {MANAGER_SEVERITY_ORDER.map((severity) => {
                    const groupItems = groupedRules[severity];
                    const activeCount = groupItems.filter((rule) => rule.state === "firing" || rule.state === "pending").length;
                    const style = ALERT_SEVERITY_GROUP_STYLES[severity];
                    return (
                      <AlertSeveritySummaryPill
                        key={severity}
                        label={ALERT_SEVERITY_LABELS[severity]}
                        total={groupItems.length}
                        activeCount={activeCount}
                        expanded={expandedSeverityGroups[severity]}
                        onToggle={() => {
                          setRulePreset("custom");
                          setExpandedSeverityGroups((prev) => ({ ...prev, [severity]: !prev[severity] }));
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
                <p className="text-[11px] text-fg-muted">Preset: {rulePreset === "p1Only" ? "P0/P1 only" : rulePreset}</p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {MANAGER_SEVERITY_ORDER.map((severity) => {
                  const rulesInSeverity = groupedRules[severity];
                  if (rulesInSeverity.length === 0) {return null;}
                  const style = ALERT_SEVERITY_GROUP_STYLES[severity];
                  return (
                    <AlertRuleGroupSection
                      key={severity}
                      title={`${ALERT_SEVERITY_LABELS[severity]} rules`}
                      count={rulesInSeverity.length}
                      activeCount={rulesInSeverity.filter((rule) => rule.state === "firing" || rule.state === "pending").length}
                      expanded={expandedSeverityGroups[severity]}
                      onToggle={() => {
                        setRulePreset("custom");
                        setExpandedSeverityGroups((prev) => ({ ...prev, [severity]: !prev[severity] }));
                      }}
                      className={cn(style.groupBorder, style.groupSurface)}
                      dotClassName={style.dot}
                    >
                      {rulesInSeverity.map((rule) => (
                        <AlertRuleCard
                          key={rule.id}
                          id={`alert-rule-${rule.id}`}
                          title={rule.name}
                          titleBadges={(
                            <>
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase", ALERT_SEVERITY_BADGE_CLASS[rule.severity])}>
                                {rule.severity}
                              </span>
                              <span className={cn("text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase", stateBadge[rule.state])}>
                                {rule.state}
                              </span>
                            </>
                          )}
                          targets={normalizeDeliveryTargets(rule.channels.map((channel) => toTitleLabel(channel)))}
                          description={
                            <>
                              <p>{rule.description}</p>
                              <p className="mt-1 text-[10px] text-fg-muted font-mono">{rule.metric}</p>
                            </>
                          }
                          stats={[
                            { label: "Triggers", value: String(rule.triggerCount) },
                            { label: "Last", value: rule.lastTriggered },
                            { label: "Window", value: rule.duration },
                          ]}
                          className={cn(selectedId === rule.id ? "ring-1 ring-indigo-500/40 border-primary/40" : "")}
                          onClick={() => setSelectedId(rule.id)}
                          headerActions={(
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setEditingRuleId(rule.id);
                                }}
                                className="rounded-md border border-tok-border bg-surface-2 px-2 py-1 text-[11px] text-fg-secondary hover:text-fg-primary"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSlideoutRuleId(rule.id);
                                }}
                                className="rounded-md border border-tok-border bg-surface-2 px-2 py-1 text-[11px] text-fg-secondary hover:text-fg-primary"
                              >
                                Quick view
                              </button>
                            </div>
                          )}
                          footerActions={[
                            <span key="condition" className={cn("px-2 py-0.5 rounded text-[10px] font-medium", conditionBadge[rule.condition])}>
                              {rule.condition}
                            </span>,
                            <span key="threshold" className="px-2 py-0.5 rounded border border-tok-border text-[10px] text-fg-secondary font-mono">
                              {rule.threshold}
                            </span>,
                          ]}
                        />
                      ))}
                    </AlertRuleGroupSection>
                  );
                })}
                {filtered.length === 0 ? (
                  <div className="rounded-xl border border-tok-border bg-surface-1 p-6 text-sm text-fg-muted">
                    No rules match the active filters.
                  </div>
                ) : null}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {selected ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{selected.name}</h2>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1">{selected.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-2.5 py-1 rounded text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] transition-colors"
                        onClick={() => setEditingRuleId(selected.id)}
                      >
                        Edit
                      </button>
                      <button className="px-2.5 py-1 rounded text-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-colors">Silence</button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className={cn("px-2 py-1 rounded border text-xs font-medium", ALERT_SEVERITY_BADGE_CLASS[selected.severity])}>{selected.severity.toUpperCase()}</span>
                    <span className={cn("px-2 py-1 rounded border text-xs font-medium", stateBadge[selected.state])}>{selected.state}</span>
                    <span className={cn("px-2 py-1 rounded text-xs font-medium", conditionBadge[selected.condition])}>{selected.condition}</span>
                    <span className="px-2 py-1 rounded border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">{selected.team}</span>
                  </div>

                  <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                    <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">Alert Condition</div>
                    <div className="font-mono text-xs bg-[var(--color-surface-0)] rounded-lg p-3 text-emerald-400 border border-[var(--color-border)]">
                      {selected.metric}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-[var(--color-text-muted)]">Threshold: <span className="text-[var(--color-text-primary)] font-mono">{selected.threshold}</span></span>
                      <span className="text-[var(--color-text-muted)]">For: <span className="text-[var(--color-text-primary)]">{selected.duration}</span></span>
                    </div>
                  </div>

                  {selected.state === "firing" ? (
                    <div className="bg-rose-500/10 rounded-xl p-4 border border-rose-500/30">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                        <span className="text-xs font-semibold text-rose-300">FIRING</span>
                      </div>
                      <div className="mt-1 text-xs text-rose-400">Active for {selected.firingFor}</div>
                      <a href={selected.runbook} className="mt-2 block text-xs text-primary hover:text-indigo-300 underline">
                        View runbook
                      </a>
                    </div>
                  ) : null}

                  <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                    <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">Notification Channels</div>
                    <div className="space-y-2">
                      {selected.channels.map((channel) => (
                        <div key={channel} className="flex items-center gap-2">
                          <span className="rounded border border-tok-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-fg-secondary">{channelIcon[channel]}</span>
                          <span className="text-sm text-[var(--color-text-primary)] capitalize">{channel}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                    <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">Labels</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(selected.labels).map(([key, value]) => (
                        <span key={key} className="px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-xs font-mono">
                          <span className="text-primary">{key}</span><span className="text-[var(--color-text-muted)]">=</span><span className="text-[var(--color-text-primary)]">{value}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                    <div className="text-xs font-medium text-[var(--color-text-secondary)] mb-3">Statistics</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-[var(--color-text-muted)]">Trigger Count: </span><span className="text-[var(--color-text-primary)] font-semibold">{selected.triggerCount}</span></div>
                      <div><span className="text-[var(--color-text-muted)]">Last Triggered: </span><span className="text-[var(--color-text-primary)]">{selected.lastTriggered}</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">Select an alert rule</div>
              )}
            </div>
          </div>
        ) : null}

        {tab === "routes" ? (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-4">
              {ROUTES.map((route) => (
                <div key={route.id} className={cn("bg-[var(--color-surface-1)] rounded-xl p-5 border transition-colors", route.active ? "border-[var(--color-border)]" : "border-[var(--color-border)]/40 opacity-60")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", route.active ? "bg-emerald-400" : "bg-[var(--color-surface-3)]")} />
                      <h3 className="font-semibold text-[var(--color-text-primary)]">{route.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {!route.active ? <span className="text-xs text-[var(--color-text-muted)]">Inactive</span> : null}
                      <button className="px-2.5 py-1 rounded text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] transition-colors">Edit</button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-[var(--color-text-muted)] mb-1">Matcher</div>
                      <div className="font-mono bg-[var(--color-surface-0)] rounded px-2 py-1 text-emerald-400">{route.matcher}</div>
                    </div>
                    <div>
                      <div className="text-[var(--color-text-muted)] mb-1">Channels</div>
                      <div className="flex gap-2">
                        {route.channels.map((channel) => (
                          <span key={channel} className="flex items-center gap-1 bg-[var(--color-surface-2)] rounded px-2 py-0.5 text-[var(--color-text-primary)]">
                            <span className="rounded border border-tok-border bg-surface-1 px-1 text-[10px] font-semibold text-fg-secondary">{channelIcon[channel]}</span>
                            <span className="capitalize">{channel}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    {route.escalateTo ? (
                      <div>
                        <div className="text-[var(--color-text-muted)] mb-1">Escalate to</div>
                        <div className="text-[var(--color-text-primary)]">{route.escalateTo} after {route.escalateAfterMin}m</div>
                      </div>
                    ) : null}
                    {route.muteFrom ? (
                      <div>
                        <div className="text-[var(--color-text-muted)] mb-1">Mute window</div>
                        <div className="text-[var(--color-text-primary)]">{route.muteFrom} - {route.muteTo}</div>
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "silencers" ? (
          <div className="overflow-y-auto h-full p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-medium text-[var(--color-text-primary)]">{SILENCERS.filter((silencer) => silencer.active).length} active silencers</h2>
              <button className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary text-xs font-medium transition-colors">+ Add Silence</button>
            </div>
            <div className="space-y-3">
              {SILENCERS.map((silencer) => (
                <div key={silencer.id} className={cn("bg-[var(--color-surface-1)] rounded-xl p-4 border", silencer.active ? "border-amber-500/30 bg-amber-500/5" : "border-[var(--color-border)] opacity-50")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", silencer.active ? "bg-amber-400" : "bg-[var(--color-surface-3)]")} />
                        <h3 className="font-semibold text-[var(--color-text-primary)] text-sm">{silencer.name}</h3>
                        {!silencer.active ? <span className="text-[10px] text-[var(--color-text-muted)]">EXPIRED</span> : null}
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] mt-1 pl-4">{silencer.reason}</p>
                    </div>
                    {silencer.active ? (
                      <button className="px-2.5 py-1 rounded text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors">
                        Expire Now
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {silencer.matchers.map((matcher) => (
                      <span key={matcher} className="px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-xs font-mono text-[var(--color-text-primary)]">{matcher}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--color-text-muted)]">
                    <span>Created by {silencer.createdBy} · {silencer.createdAt}</span>
                    <span>Expires: <span className={silencer.expiresAt === "Expired" ? "text-[var(--color-text-muted)]" : "text-amber-400"}>{silencer.expiresAt}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-2">
              {HISTORY.map((event) => (
                <div key={event.id} className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)] hover:border-[var(--color-border)] transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("w-2 h-2 rounded-full flex-none", ALERT_SEVERITY_GROUP_STYLES[event.severity].dot, event.state === "fired" ? "animate-pulse" : "")} />
                      <span className="font-medium text-[var(--color-text-primary)] text-sm truncate">{event.ruleName}</span>
                      <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium flex-none",
                        event.state === "resolved" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-rose-500/20 border-rose-500/40 text-rose-300"
                      )}>{event.state === "fired" ? "FIRING" : "RESOLVED"}</span>
                    </div>
                    <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium flex-none", ALERT_SEVERITY_BADGE_CLASS[event.severity])}>
                      {event.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                    <div><div className="text-[var(--color-text-muted)]">Fired</div><div className="text-[var(--color-text-primary)] mt-0.5">{event.firedAt}</div></div>
                    <div><div className="text-[var(--color-text-muted)]">Resolved</div><div className="text-[var(--color-text-primary)] mt-0.5">{event.resolvedAt}</div></div>
                    <div><div className="text-[var(--color-text-muted)]">Duration</div><div className={cn("mt-0.5", event.duration === "ongoing" ? "text-rose-400 font-semibold" : "text-[var(--color-text-primary)]")}>{event.duration}</div></div>
                    <div><div className="text-[var(--color-text-muted)]">Ack'd by</div><div className="text-[var(--color-text-primary)] mt-0.5">{event.acknowledgedBy}</div></div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {event.affectedServices.map((service) => (
                      <span key={service} className="px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[10px] font-mono text-[var(--color-text-secondary)]">{service}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <AlertRuleConfigDialog
        open={editingRule !== null}
        rule={editingRule}
        onClose={() => setEditingRuleId(null)}
        onSave={(next) => {
          setRules((prev) => prev.map((rule) => (rule.id === next.id ? fromDialogRule(rule, next) : rule)));
          setEditingRuleId(null);
        }}
      />

      <AlertSlideoutPanel
        open={detailRule !== null}
        onClose={() => setSlideoutRuleId(null)}
        title={detailRule?.name ?? "Alert rule"}
        subtitle={detailRule ? `${detailRule.severity.toUpperCase()} · ${detailRule.state}` : undefined}
      >
        {detailRule ? (
          <div className="space-y-3 text-xs text-fg-secondary">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-fg-muted">Description</p>
              <p className="mt-1 text-fg-primary">{detailRule.description}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-fg-muted">Condition</p>
              <p className="mt-1 font-mono text-emerald-300">{detailRule.metric}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-tok-border bg-surface-1 p-2">
                <p className="text-[10px] uppercase tracking-wide text-fg-muted">Threshold</p>
                <p className="mt-1 text-fg-primary font-mono">{detailRule.threshold}</p>
              </div>
              <div className="rounded-lg border border-tok-border bg-surface-1 p-2">
                <p className="text-[10px] uppercase tracking-wide text-fg-muted">Window</p>
                <p className="mt-1 text-fg-primary">{detailRule.duration}</p>
              </div>
            </div>
          </div>
        ) : null}
      </AlertSlideoutPanel>
    </div>
  );
}
