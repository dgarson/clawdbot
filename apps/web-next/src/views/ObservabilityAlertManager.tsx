import React, { useState } from "react";
import { cn } from "../lib/utils";

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
  { id: "s1", name: "Staging Maintenance", matchers: ["env=staging"], createdBy: "alice", createdAt: "Today 08:00", expiresAt: "Today 12:00", reason: "Planned maintenance window — infra upgrades", active: true },
  { id: "s2", name: "Agent Heartbeat Suppression", matchers: ["alertname=HeartbeatMissing", "env=prod"], createdBy: "bob", createdAt: "3d ago", expiresAt: "5d from now", reason: "Known issue with heartbeat false positives — tracking in Jira PLAT-4821", active: true },
  { id: "s3", name: "Last Week Deployment", matchers: ["env=prod", "team=platform"], createdBy: "carol", createdAt: "7d ago", expiresAt: "Expired", reason: "Deployment window — all prod alerts silenced during rollout", active: false },
];

const HISTORY: AlertHistoryEvent[] = [
  { id: "h1", ruleName: "DB Connections Exhausted", severity: "critical", state: "resolved", firedAt: "Today 09:12", resolvedAt: "Today 09:44", duration: "32m", affectedServices: ["api-gateway", "user-service"], acknowledgedBy: "dave" },
  { id: "h2", ruleName: "High CPU Rate of Change", severity: "medium", state: "resolved", firedAt: "Today 07:51", resolvedAt: "Today 08:03", duration: "12m", affectedServices: ["ml-service"], acknowledgedBy: "eve" },
  { id: "h3", ruleName: "High Error Rate", severity: "critical", state: "fired", firedAt: "Today 10:34", resolvedAt: "-", duration: "ongoing", affectedServices: ["api-gateway"], acknowledgedBy: "frank" },
  { id: "h4", ruleName: "P95 Latency Spike", severity: "high", state: "fired", firedAt: "Today 10:39", resolvedAt: "-", duration: "ongoing", affectedServices: ["user-service"], acknowledgedBy: "-" },
  { id: "h5", ruleName: "Disk Usage Critical", severity: "high", state: "fired", firedAt: "Today 10:44", resolvedAt: "-", duration: "ongoing", affectedServices: ["worker-04"], acknowledgedBy: "-" },
];

const severityColor: Record<AlertSeverity, string> = {
  critical: "bg-rose-500/15 border-rose-500/40 text-rose-400",
  high:     "bg-orange-500/15 border-orange-500/40 text-orange-400",
  medium:   "bg-amber-500/15 border-amber-500/40 text-amber-400",
  low:      "bg-sky-500/15 border-sky-500/30 text-sky-400",
};

const severityDot: Record<AlertSeverity, string> = {
  critical: "bg-rose-400",
  high:     "bg-orange-400",
  medium:   "bg-amber-400",
  low:      "bg-sky-400",
};

const stateBadge: Record<AlertState, string> = {
  firing:    "bg-rose-500/20 border-rose-500/40 text-rose-300",
  resolved:  "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  suppressed:"bg-zinc-700/50 border-zinc-600 text-zinc-400",
  pending:   "bg-amber-500/15 border-amber-500/30 text-amber-400",
};

const channelIcon: Record<NotifChannel, string> = {
  slack: "💬",
  pagerduty: "📟",
  email: "✉️",
  webhook: "🔗",
};

const conditionBadge: Record<ConditionType, string> = {
  threshold: "bg-indigo-500/15 text-indigo-400",
  anomaly:   "bg-purple-500/15 text-purple-400",
  absence:   "bg-zinc-700 text-zinc-400",
  rate:      "bg-sky-500/15 text-sky-400",
};

export default function ObservabilityAlertManager() {
  const [tab, setTab] = useState<"alerts" | "routes" | "silencers" | "history">("alerts");
  const [selected, setSelected] = useState<AlertRule | null>(ALERT_RULES[0]);
  const [stateFilter, setStateFilter] = useState<"all" | AlertState>("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | AlertSeverity>("all");

  const firing = ALERT_RULES.filter(r => r.state === "firing");
  const pending = ALERT_RULES.filter(r => r.state === "pending");
  const resolved = ALERT_RULES.filter(r => r.state === "resolved");

  const filtered = ALERT_RULES.filter(r =>
    (stateFilter === "all" || r.state === stateFilter) &&
    (severityFilter === "all" || r.severity === severityFilter)
  );

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Alert Manager</h1>
            <p className="text-xs text-zinc-400 mt-0.5">Observability alerting — rules, routing, and silencing</p>
          </div>
          <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium transition-colors">+ New Rule</button>
        </div>
        {/* Status summary */}
        <div className="flex gap-4 mt-3">
          {[
            { label: "Firing", value: firing.length, color: "text-rose-400", pulse: firing.length > 0 },
            { label: "Pending", value: pending.length, color: "text-amber-400", pulse: false },
            { label: "Resolved", value: resolved.length, color: "text-emerald-400", pulse: false },
            { label: "Total Rules", value: ALERT_RULES.length, color: "text-zinc-300", pulse: false },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              {s.pulse && <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />}
              <div>
                <span className={cn("text-base font-bold", s.color)}>{s.value}</span>
                <span className="text-zinc-500 text-xs ml-1.5">{s.label}</span>
              </div>
            </div>
          ))}
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(["alerts", "routes", "silencers", "history"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                tab === t ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800")}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "alerts" && firing.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-[9px] font-bold text-white">{firing.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Alerts Tab */}
        {tab === "alerts" && (
          <div className="flex h-full">
            {/* Left */}
            <div className="w-[52%] flex-none border-r border-zinc-800 flex flex-col">
              {/* Filters */}
              <div className="flex-none px-4 py-2.5 border-b border-zinc-800 flex flex-wrap items-center gap-2">
                <span className="text-xs text-zinc-500">State:</span>
                {(["all", "firing", "pending", "resolved", "suppressed"] as const).map(s => (
                  <button key={s} onClick={() => setStateFilter(s)}
                    className={cn("px-2 py-0.5 rounded text-xs capitalize transition-colors",
                      stateFilter === s ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}>
                    {s}
                  </button>
                ))}
                <span className="text-zinc-700">|</span>
                <span className="text-xs text-zinc-500">Sev:</span>
                {(["all", "critical", "high", "medium", "low"] as const).map(s => (
                  <button key={s} onClick={() => setSeverityFilter(s)}
                    className={cn("px-2 py-0.5 rounded text-xs capitalize transition-colors",
                      severityFilter === s ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                {filtered.map(rule => (
                  <button key={rule.id} onClick={() => setSelected(rule)} className={cn(
                    "w-full text-left px-4 py-3 border-b border-zinc-800/60 hover:bg-zinc-900 transition-colors",
                    selected?.id === rule.id && "bg-zinc-900 border-l-2 border-l-indigo-500"
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("w-1.5 h-1.5 rounded-full flex-none mt-0.5", severityDot[rule.severity],
                          rule.state === "firing" && "animate-pulse")} />
                        <span className="text-sm font-medium text-white truncate">{rule.name}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-none">
                        <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium", severityColor[rule.severity])}>
                          {rule.severity.toUpperCase()}
                        </span>
                        <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium", stateBadge[rule.state])}>
                          {rule.state}
                        </span>
                      </div>
                    </div>
                    <div className="pl-3.5 mt-1.5 space-y-0.5">
                      <p className="text-[11px] text-zinc-500 truncate">{rule.description}</p>
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-zinc-600">{rule.metric.slice(0, 35)}{rule.metric.length > 35 ? "…" : ""}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {rule.state === "firing" && (
                          <span className="text-[10px] text-rose-400">⚡ Firing for {rule.firingFor}</span>
                        )}
                        <span className="text-[10px] text-zinc-600">Triggered {rule.triggerCount}x</span>
                        {rule.channels.map(ch => (
                          <span key={ch} className="text-[10px]">{channelIcon[ch]}</span>
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: Rule detail */}
            <div className="flex-1 overflow-y-auto p-5">
              {selected ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", severityDot[selected.severity], selected.state === "firing" && "animate-pulse")} />
                        <h2 className="text-base font-semibold text-white">{selected.name}</h2>
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">{selected.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-2.5 py-1 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">Edit</button>
                      <button className="px-2.5 py-1 rounded text-xs bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 transition-colors">Silence</button>
                    </div>
                  </div>
                  {/* Badges row */}
                  <div className="flex flex-wrap gap-2">
                    <span className={cn("px-2 py-1 rounded border text-xs font-medium", severityColor[selected.severity])}>{selected.severity.toUpperCase()}</span>
                    <span className={cn("px-2 py-1 rounded border text-xs font-medium", stateBadge[selected.state])}>{selected.state}</span>
                    <span className={cn("px-2 py-1 rounded text-xs font-medium", conditionBadge[selected.condition])}>{selected.condition}</span>
                    <span className="px-2 py-1 rounded border border-zinc-700 text-xs text-zinc-400">{selected.team}</span>
                  </div>

                  {/* Condition */}
                  <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="text-xs font-medium text-zinc-400 mb-3">Alert Condition</div>
                    <div className="font-mono text-xs bg-zinc-950 rounded-lg p-3 text-emerald-400 border border-zinc-800">
                      {selected.metric}
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <span className="text-zinc-500">Threshold: <span className="text-white font-mono">{selected.threshold}</span></span>
                      <span className="text-zinc-500">For: <span className="text-white">{selected.duration}</span></span>
                    </div>
                  </div>

                  {/* Firing status */}
                  {selected.state === "firing" && (
                    <div className="bg-rose-500/10 rounded-xl p-4 border border-rose-500/30">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                        <span className="text-xs font-semibold text-rose-300">FIRING</span>
                      </div>
                      <div className="mt-1 text-xs text-rose-400">Active for {selected.firingFor}</div>
                      <a href={selected.runbook} className="mt-2 block text-xs text-indigo-400 hover:text-indigo-300 underline">
                        📖 View Runbook
                      </a>
                    </div>
                  )}

                  {/* Notifications */}
                  <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="text-xs font-medium text-zinc-400 mb-3">Notification Channels</div>
                    <div className="space-y-2">
                      {selected.channels.map(ch => (
                        <div key={ch} className="flex items-center gap-2">
                          <span>{channelIcon[ch]}</span>
                          <span className="text-sm text-zinc-300 capitalize">{ch}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Labels */}
                  <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="text-xs font-medium text-zinc-400 mb-3">Labels</div>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(selected.labels).map(([k, v]) => (
                        <span key={k} className="px-2 py-0.5 rounded bg-zinc-800 text-xs font-mono">
                          <span className="text-indigo-400">{k}</span><span className="text-zinc-500">=</span><span className="text-zinc-300">{v}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="text-xs font-medium text-zinc-400 mb-3">Statistics</div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-zinc-500">Trigger Count: </span><span className="text-white font-semibold">{selected.triggerCount}</span></div>
                      <div><span className="text-zinc-500">Last Triggered: </span><span className="text-zinc-300">{selected.lastTriggered}</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">Select an alert rule</div>
              )}
            </div>
          </div>
        )}

        {/* Routes Tab */}
        {tab === "routes" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-4">
              {ROUTES.map(route => (
                <div key={route.id} className={cn("bg-zinc-900 rounded-xl p-5 border transition-colors", route.active ? "border-zinc-800" : "border-zinc-800/40 opacity-60")}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", route.active ? "bg-emerald-400" : "bg-zinc-600")} />
                      <h3 className="font-semibold text-white">{route.name}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {!route.active && <span className="text-xs text-zinc-500">Inactive</span>}
                      <button className="px-2.5 py-1 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">Edit</button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <div className="text-zinc-500 mb-1">Matcher</div>
                      <div className="font-mono bg-zinc-950 rounded px-2 py-1 text-emerald-400">{route.matcher}</div>
                    </div>
                    <div>
                      <div className="text-zinc-500 mb-1">Channels</div>
                      <div className="flex gap-2">
                        {route.channels.map(ch => (
                          <span key={ch} className="flex items-center gap-1 bg-zinc-800 rounded px-2 py-0.5 text-zinc-300">
                            <span>{channelIcon[ch]}</span><span className="capitalize">{ch}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                    {route.escalateTo && (
                      <div>
                        <div className="text-zinc-500 mb-1">Escalate to</div>
                        <div className="text-zinc-300">{route.escalateTo} after {route.escalateAfterMin}m</div>
                      </div>
                    )}
                    {route.muteFrom && (
                      <div>
                        <div className="text-zinc-500 mb-1">Mute window</div>
                        <div className="text-zinc-300">{route.muteFrom} – {route.muteTo}</div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Silencers Tab */}
        {tab === "silencers" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-medium text-zinc-300">{SILENCERS.filter(s => s.active).length} active silencers</h2>
              <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium transition-colors">+ Add Silence</button>
            </div>
            <div className="space-y-3">
              {SILENCERS.map(s => (
                <div key={s.id} className={cn("bg-zinc-900 rounded-xl p-4 border", s.active ? "border-amber-500/30 bg-amber-500/5" : "border-zinc-800 opacity-50")}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full", s.active ? "bg-amber-400" : "bg-zinc-600")} />
                        <h3 className="font-semibold text-white text-sm">{s.name}</h3>
                        {!s.active && <span className="text-[10px] text-zinc-500">EXPIRED</span>}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1 pl-4">{s.reason}</p>
                    </div>
                    {s.active && (
                      <button className="px-2.5 py-1 rounded text-xs bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-colors">
                        Expire Now
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {s.matchers.map(m => (
                      <span key={m} className="px-2 py-0.5 rounded bg-zinc-800 text-xs font-mono text-zinc-300">{m}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-zinc-600">
                    <span>Created by {s.createdBy} · {s.createdAt}</span>
                    <span>Expires: <span className={s.expiresAt === "Expired" ? "text-zinc-500" : "text-amber-400"}>{s.expiresAt}</span></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* History Tab */}
        {tab === "history" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-2">
              {HISTORY.map(ev => (
                <div key={ev.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-700 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("w-2 h-2 rounded-full flex-none", severityDot[ev.severity], ev.state === "fired" && "animate-pulse")} />
                      <span className="font-medium text-white text-sm truncate">{ev.ruleName}</span>
                      <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium flex-none",
                        ev.state === "resolved" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" : "bg-rose-500/20 border-rose-500/40 text-rose-300"
                      )}>{ev.state === "fired" ? "FIRING" : "RESOLVED"}</span>
                    </div>
                    <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium flex-none", severityColor[ev.severity])}>
                      {ev.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-3 text-xs">
                    <div><div className="text-zinc-500">Fired</div><div className="text-zinc-300 mt-0.5">{ev.firedAt}</div></div>
                    <div><div className="text-zinc-500">Resolved</div><div className="text-zinc-300 mt-0.5">{ev.resolvedAt}</div></div>
                    <div><div className="text-zinc-500">Duration</div><div className={cn("mt-0.5", ev.duration === "ongoing" ? "text-rose-400 font-semibold" : "text-zinc-300")}>{ev.duration}</div></div>
                    <div><div className="text-zinc-500">Ack'd by</div><div className="text-zinc-300 mt-0.5">{ev.acknowledgedBy}</div></div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ev.affectedServices.map(svc => (
                      <span key={svc} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-mono text-zinc-400">{svc}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
