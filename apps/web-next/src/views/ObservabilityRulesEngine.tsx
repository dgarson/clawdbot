import React, { useState } from "react";
import { cn } from "../lib/utils";

type RuleType = "threshold" | "anomaly" | "trend" | "composite" | "absence";
type RuleSeverity = "critical" | "high" | "medium" | "low" | "info";
type RuleState = "firing" | "ok" | "pending" | "disabled" | "error";
type ActionType = "alert" | "pagerduty" | "slack" | "webhook" | "auto-scale" | "runbook";
type MetricType = "gauge" | "counter" | "histogram" | "summary";

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

function stateColor(s: RuleState) {
  if (s === "firing") return "text-rose-400";
  if (s === "ok") return "text-emerald-400";
  if (s === "pending") return "text-amber-400";
  if (s === "error") return "text-rose-400";
  return "text-zinc-400";
}
function stateBg(s: RuleState) {
  if (s === "firing") return "bg-rose-400/10 text-rose-400";
  if (s === "ok") return "bg-emerald-400/10 text-emerald-400";
  if (s === "pending") return "bg-amber-400/10 text-amber-400";
  if (s === "error") return "bg-rose-400/10 text-rose-400";
  return "bg-zinc-600 text-zinc-400";
}
function severityColor(s: RuleSeverity) {
  if (s === "critical") return "bg-rose-500/10 text-rose-400";
  if (s === "high") return "bg-orange-500/10 text-orange-400";
  if (s === "medium") return "bg-amber-500/10 text-amber-400";
  if (s === "low") return "bg-blue-500/10 text-blue-400";
  return "bg-zinc-500/10 text-zinc-400";
}
function typeBadge(t: RuleType) {
  const colors: Record<RuleType, string> = {
    threshold: "bg-indigo-500/10 text-indigo-400",
    anomaly: "bg-purple-500/10 text-purple-400",
    trend: "bg-blue-500/10 text-blue-400",
    composite: "bg-orange-500/10 text-orange-400",
    absence: "bg-zinc-500/10 text-zinc-400",
  };
  return colors[t];
}
function actionTypeEmoji(t: ActionType) {
  const map: Record<ActionType, string> = { alert: "🔔", pagerduty: "📟", slack: "💬", webhook: "🪝", "auto-scale": "⚖️", runbook: "📖" };
  return map[t];
}
function opLabel(op: RuleCondition["operator"]) {
  const map: Record<RuleCondition["operator"], string> = { gt: ">", lt: "<", gte: "≥", lte: "≤", eq: "=", ne: "≠" };
  return map[op];
}

export default function ObservabilityRulesEngine() {
  const [tab, setTab] = useState<"rules" | "alerts" | "history" | "stats">("rules");
  const [selectedRule, setSelectedRule] = useState<ObsRule | null>(null);
  const [filterState, setFilterState] = useState<RuleState | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<RuleSeverity | "all">("all");
  const [filterType, setFilterType] = useState<RuleType | "all">("all");

  const filteredRules = RULES.filter(r => {
    if (filterState !== "all" && r.state !== filterState) return false;
    if (filterSeverity !== "all" && r.severity !== filterSeverity) return false;
    if (filterType !== "all" && r.type !== filterType) return false;
    return true;
  });

  const firingCount = RULES.filter(r => r.state === "firing").length;
  const pendingCount = RULES.filter(r => r.state === "pending").length;
  const okCount = RULES.filter(r => r.state === "ok").length;
  const activeAlerts = FIRING_ALERTS.filter(a => a.status === "firing").length;

  const maxValue = Math.max(...EVAL_HISTORY.map(p => p.value));

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "rules", label: `Rules (${RULES.length})` },
    { id: "alerts", label: `Alerts (${activeAlerts} firing)` },
    { id: "history", label: "Eval History" },
    { id: "stats", label: "Statistics" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Observability Rules Engine</h1>
          <p className="text-zinc-400 text-sm mt-1">Define, manage, and monitor alerting rules across your infrastructure</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors">Import Rules</button>
          <button className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">+ New Rule</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900 rounded-xl p-4 border border-rose-500/30">
          <div className="text-xs text-zinc-500 mb-1">Firing</div>
          <div className="text-2xl font-bold text-rose-400">{firingCount}</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-amber-500/20">
          <div className="text-xs text-zinc-500 mb-1">Pending</div>
          <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">OK</div>
          <div className="text-2xl font-bold text-emerald-400">{okCount}</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Active Alerts</div>
          <div className="text-2xl font-bold text-white">{activeAlerts}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedRule(null); }}
            className={cn("px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px", tab === t.id ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Rules list */}
      {tab === "rules" && !selectedRule && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={filterState} onChange={e => setFilterState(e.target.value as RuleState | "all")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200">
              <option value="all">All States</option>
              <option value="firing">Firing</option>
              <option value="pending">Pending</option>
              <option value="ok">OK</option>
              <option value="disabled">Disabled</option>
            </select>
            <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as RuleSeverity | "all")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200">
              <option value="all">All Severity</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value as RuleType | "all")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200">
              <option value="all">All Types</option>
              <option value="threshold">Threshold</option>
              <option value="anomaly">Anomaly</option>
              <option value="trend">Trend</option>
              <option value="absence">Absence</option>
              <option value="composite">Composite</option>
            </select>
          </div>

          <div className="space-y-2">
            {filteredRules.map(rule => (
              <div
                key={rule.id}
                onClick={() => setSelectedRule(rule)}
                className={cn("bg-zinc-900 rounded-xl p-4 border hover:border-zinc-600 cursor-pointer transition-colors", rule.state === "firing" ? "border-rose-500/30" : rule.state === "pending" ? "border-amber-500/20" : "border-zinc-800")}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <div className={cn("w-2 h-2 rounded-full", rule.state === "firing" ? "bg-rose-400 animate-pulse" : rule.state === "pending" ? "bg-amber-400" : rule.state === "ok" ? "bg-emerald-400" : "bg-zinc-500")} />
                      <span className="font-medium text-zinc-200">{rule.name}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", stateBg(rule.state))}>{rule.state}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", severityColor(rule.severity))}>{rule.severity}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", typeBadge(rule.type))}>{rule.type}</span>
                    </div>
                    <div className="text-xs text-zinc-400">{rule.description}</div>
                    <div className="flex gap-3 mt-2 text-xs text-zinc-500">
                      <span>Every {rule.evaluationInterval}</span>
                      <span>Pending: {rule.pendingDuration}</span>
                      <span>Fired: {rule.firingCount}x</span>
                      {rule.lastFired && <span>Last: {rule.lastFired}</span>}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-3">
                    {rule.actions.map((a, i) => (
                      <span key={i} title={a.type} className="text-base">{actionTypeEmoji(a.type)}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rule Detail */}
      {tab === "rules" && selectedRule && (
        <div>
          <button onClick={() => setSelectedRule(null)} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 mb-4 transition-colors">← Back</button>
          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-xl font-bold text-white">{selectedRule.name}</h2>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", stateBg(selectedRule.state))}>{selectedRule.state}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", severityColor(selectedRule.severity))}>{selectedRule.severity}</span>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", typeBadge(selectedRule.type))}>{selectedRule.type}</span>
                </div>
                <button className={cn("px-3 py-1.5 text-xs rounded-lg transition-colors", selectedRule.enabled ? "bg-rose-600 hover:bg-rose-500 text-white" : "bg-emerald-600 hover:bg-emerald-500 text-white")}>
                  {selectedRule.enabled ? "Disable" : "Enable"}
                </button>
              </div>
              <p className="text-sm text-zinc-300 mb-4">{selectedRule.description}</p>
              <div className="space-y-2 text-xs">
                {[
                  { label: "Interval", value: selectedRule.evaluationInterval },
                  { label: "Pending for", value: selectedRule.pendingDuration },
                  { label: "Fired count", value: selectedRule.firingCount.toString() },
                  { label: "Last fired", value: selectedRule.lastFired ?? "Never" },
                  { label: "Last evaluated", value: selectedRule.lastEvaluated },
                  { label: "Created by", value: selectedRule.createdBy },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-zinc-500">{row.label}</span>
                    <span className="text-zinc-300">{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <div className="text-xs text-zinc-500 mb-2">Labels</div>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(selectedRule.labels).map(([k, v]) => (
                    <span key={k} className="text-xs px-2 py-0.5 rounded bg-zinc-700 text-zinc-300">{k}={v}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">Conditions</h3>
                {selectedRule.conditions.map((cond, i) => (
                  <div key={i} className="p-3 bg-zinc-800 rounded-lg font-mono text-sm">
                    <span className="text-indigo-400">{cond.aggregation}</span>
                    <span className="text-zinc-300">({cond.metric})</span>
                    <span className="text-zinc-200">[{cond.window}] </span>
                    <span className="text-amber-400">{opLabel(cond.operator)} </span>
                    <span className="text-emerald-400">{cond.threshold}</span>
                  </div>
                ))}
              </div>
              <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">Actions</h3>
                <div className="space-y-2">
                  {selectedRule.actions.map((action, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 bg-zinc-800 rounded-lg">
                      <span className="text-base">{actionTypeEmoji(action.type)}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-zinc-300 capitalize">{action.type}</span>
                          <span className="text-xs text-zinc-500">→ {action.target}</span>
                          {action.cooldown !== "0" && <span className="text-xs text-zinc-600">cooldown: {action.cooldown}</span>}
                        </div>
                        <div className="text-xs text-zinc-400 mt-1 font-mono">{action.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {tab === "alerts" && (
        <div className="space-y-3">
          {FIRING_ALERTS.map(alert => (
            <div key={alert.id} className={cn("bg-zinc-900 rounded-xl p-4 border", alert.status === "firing" ? "border-rose-500/30" : "border-zinc-800")}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-zinc-200">{alert.ruleName}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", severityColor(alert.severity))}>{alert.severity}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", alert.status === "firing" ? "bg-rose-400/10 text-rose-400" : "bg-emerald-400/10 text-emerald-400")}>{alert.status}</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(alert.labels).map(([k, v]) => (
                      <span key={k} className="text-xs px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">{k}={v}</span>
                    ))}
                  </div>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <div>Started: {alert.startedAt}</div>
                  <div>Duration: {alert.duration}</div>
                  {alert.resolvedAt && <div className="text-emerald-400">Resolved: {alert.resolvedAt}</div>}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-zinc-800 flex gap-6 text-xs">
                <div><span className="text-zinc-500">Value: </span><span className={cn("font-bold", alert.status === "firing" ? "text-rose-400" : "text-zinc-300")}>{alert.value}</span></div>
                <div><span className="text-zinc-500">Threshold: </span><span className="text-zinc-400">{alert.threshold}</span></div>
                <div><span className="text-zinc-500">Excess: </span><span className="text-rose-400">+{(alert.value - alert.threshold).toFixed(1)}</span></div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Eval History chart */}
      {tab === "history" && (
        <div className="space-y-5">
          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-300 mb-1">Rule: "High API Error Rate" — Recent Evaluations</h3>
            <p className="text-xs text-zinc-500 mb-4">HTTP error rate (%) vs 5% threshold</p>
            <div className="flex items-end gap-2" style={{ height: 100 }}>
              {EVAL_HISTORY.map(pt => {
                const heightPct = (pt.value / (maxValue * 1.1)) * 100;
                return (
                  <div key={pt.time} className="flex flex-col items-center gap-1 flex-1">
                    <div className="w-full flex items-end" style={{ height: 80 }}>
                      <div
                        className={cn("w-full rounded-t", pt.state === "firing" ? "bg-rose-500" : "bg-emerald-500")}
                        style={{ height: `${heightPct}%`, minHeight: 4 }}
                        title={`${pt.value}% at ${pt.time}`}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500">{pt.time}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-rose-500 inline-block" />Firing</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />OK</span>
              <span className="ml-auto">Threshold: 5%</span>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      {tab === "stats" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "Total Rules", value: RULES.length, color: "text-white" },
              { label: "Enabled Rules", value: RULES.filter(r => r.enabled).length, color: "text-emerald-400" },
              { label: "Total Fire Events", value: RULES.reduce((s, r) => s + r.firingCount, 0), color: "text-rose-400" },
            ].map(stat => (
              <div key={stat.label} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 text-center">
                <div className={cn("text-3xl font-bold mb-1", stat.color)}>{stat.value}</div>
                <div className="text-xs text-zinc-500">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">Rules by Severity</h3>
            <div className="space-y-3">
              {(["critical", "high", "medium", "low", "info"] as RuleSeverity[]).map(sev => {
                const count = RULES.filter(r => r.severity === sev).length;
                const pct = (count / RULES.length) * 100;
                return (
                  <div key={sev}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="capitalize text-zinc-400">{sev}</span>
                      <span className={severityColor(sev).split(" ")[1]}>{count} rules</span>
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", sev === "critical" ? "bg-rose-500" : sev === "high" ? "bg-orange-500" : sev === "medium" ? "bg-amber-500" : sev === "low" ? "bg-blue-500" : "bg-zinc-500")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">Most Active Rules</h3>
            <div className="space-y-3">
              {[...RULES].sort((a, b) => b.firingCount - a.firingCount).slice(0, 5).map(rule => {
                const maxFire = Math.max(...RULES.map(r => r.firingCount), 1);
                const pct = (rule.firingCount / maxFire) * 100;
                return (
                  <div key={rule.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300">{rule.name}</span>
                      <span className={stateColor(rule.state)}>{rule.firingCount} fires</span>
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div className={cn("h-full rounded-full", rule.state === "firing" ? "bg-rose-500" : "bg-indigo-500")} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
