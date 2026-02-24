import React, { useState } from "react";
import { cn } from "../lib/utils";

type IncidentSeverity = "sev1" | "sev2" | "sev3" | "sev4";
type IncidentStatus = "triggered" | "acknowledged" | "investigating" | "mitigated" | "resolved";
type ActionType = "comment" | "status_change" | "runbook" | "escalation" | "page" | "mitigation" | "resolution" | "alert";

interface IncidentResponder {
  id: string;
  name: string;
  role: string;
  joinedAt: string;
  active: boolean;
}

interface TimelineEvent {
  id: string;
  type: ActionType;
  author: string;
  timestamp: string;
  content: string;
  metadata?: string | null;
}

interface Incident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  service: string;
  owner: string;
  startedAt: string;
  resolvedAt: string | null;
  durationMin: number | null;
  affectedUsers: number;
  responders: IncidentResponder[];
  timeline: TimelineEvent[];
  runbook: string;
  slackChannel: string;
  impactDescription: string;
  rootCause: string | null;
}

interface RunbookStep {
  id: string;
  order: number;
  title: string;
  description: string;
  command: string | null;
  completed: boolean;
  critical: boolean;
}

interface PostmortemField {
  label: string;
  content: string;
}

const sevColor: Record<IncidentSeverity, string> = {
  sev1: "text-rose-400",
  sev2: "text-orange-400",
  sev3: "text-amber-400",
  sev4: "text-blue-400",
};

const sevBadge: Record<IncidentSeverity, string> = {
  sev1: "bg-rose-500/20 text-rose-300 border border-rose-500/40",
  sev2: "bg-orange-500/20 text-orange-300 border border-orange-500/40",
  sev3: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  sev4: "bg-blue-500/20 text-blue-300 border border-blue-500/40",
};

const sevLabel: Record<IncidentSeverity, string> = {
  sev1: "SEV1 — Critical",
  sev2: "SEV2 — Major",
  sev3: "SEV3 — Minor",
  sev4: "SEV4 — Informational",
};

const statusBadge: Record<IncidentStatus, string> = {
  triggered:     "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  acknowledged:  "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  investigating: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  mitigated:     "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
  resolved:      "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
};

const actionIcon: Record<ActionType, string> = {
  comment:       "💬",
  status_change: "🔄",
  runbook:       "📋",
  escalation:    "📣",
  page:          "📟",
  mitigation:    "🛠️",
  resolution:    "✅",
  alert:         "🔔",
};

const INCIDENTS: Incident[] = [
  {
    id: "INC-4821",
    title: "API Gateway 5xx spike — auth service degraded",
    severity: "sev1",
    status: "investigating",
    service: "auth-service",
    owner: "tim@clawdbot.io",
    startedAt: "2026-02-22T09:47:00Z",
    resolvedAt: null,
    durationMin: null,
    affectedUsers: 18240,
    slackChannel: "#inc-4821",
    runbook: "https://runbooks.internal/auth-service-degraded",
    impactDescription: "Authentication failures for ~18k active users. Login and token refresh failing with 502 errors. API Gateway returning 5xx for ~23% of auth requests.",
    rootCause: null,
    responders: [
      { id: "r1", name: "Tim", role: "Incident Commander", joinedAt: "09:48", active: true },
      { id: "r2", name: "Xavier", role: "Technical Lead", joinedAt: "09:49", active: true },
      { id: "r3", name: "Sam", role: "Auth Specialist", joinedAt: "09:51", active: true },
      { id: "r4", name: "Quinn", role: "Observability", joinedAt: "09:52", active: true },
    ],
    timeline: [
      { id: "t1", type: "alert", author: "PagerDuty", timestamp: "09:47:12", content: "Alert triggered: auth_error_rate > 20% for 3m", metadata: "alert:auth-high-error-rate" },
      { id: "t2", type: "page", author: "System", timestamp: "09:47:15", content: "On-call paged: Tim, Sam", metadata: null },
      { id: "t3", type: "status_change", author: "Tim", timestamp: "09:48:03", content: "Status changed to Acknowledged", metadata: null },
      { id: "t4", type: "comment", author: "Tim", timestamp: "09:49:22", content: "Taking IC. Pulling up auth-service metrics. Looks like memory spiked ~5 min ago.", metadata: null },
      { id: "t5", type: "escalation", author: "Tim", timestamp: "09:50:00", content: "Escalating to Xavier as TL. Auth service may need restart.", metadata: null },
      { id: "t6", type: "status_change", author: "Tim", timestamp: "09:51:30", content: "Status changed to Investigating", metadata: null },
      { id: "t7", type: "runbook", author: "Sam", timestamp: "09:52:00", content: "Following runbook: auth-service-degraded. Checking pod health in k8s.", metadata: "Step 3: Check pod readiness probes" },
      { id: "t8", type: "comment", author: "Quinn", timestamp: "09:54:12", content: "Memory at 97% on auth-service-pod-2 and auth-service-pod-3. OOMkill likely.", metadata: null },
      { id: "t9", type: "comment", author: "Sam", timestamp: "09:56:30", content: "Rolling restart initiated on affected pods. Traffic draining.", metadata: null },
    ],
  },
  {
    id: "INC-4819",
    title: "Report generation service timeout — async queue backed up",
    severity: "sev2",
    status: "mitigated",
    service: "report-service",
    owner: "xavier@clawdbot.io",
    startedAt: "2026-02-22T07:15:00Z",
    resolvedAt: null,
    durationMin: 157,
    affectedUsers: 842,
    slackChannel: "#inc-4819",
    runbook: "https://runbooks.internal/report-service-timeout",
    impactDescription: "Report generation requests timing out after 30s. ~842 users unable to export reports. Queue depth at 4,200+ jobs.",
    rootCause: "Deadlock in report DB connection pool caused by a query that held a long-running transaction during a schema migration.",
    responders: [
      { id: "r1", name: "Xavier", role: "Incident Commander", joinedAt: "07:16", active: true },
      { id: "r2", name: "Tim", role: "Database Lead", joinedAt: "07:18", active: false },
    ],
    timeline: [
      { id: "t1", type: "alert", author: "PagerDuty", timestamp: "07:15:00", content: "Alert: report_generation_p95 > 25s for 5m" },
      { id: "t2", type: "status_change", author: "Xavier", timestamp: "07:16:12", content: "Acknowledged" },
      { id: "t3", type: "status_change", author: "Xavier", timestamp: "07:22:00", content: "Investigating" },
      { id: "t4", type: "comment", author: "Tim", timestamp: "07:35:00", content: "Found deadlock in pg_stat_activity. Killing stuck query." },
      { id: "t5", type: "mitigation", author: "Xavier", timestamp: "07:52:00", content: "Mitigated: DB connection pool recycled, queue processing resumed. Monitoring." },
      { id: "t6", type: "status_change", author: "Xavier", timestamp: "07:52:00", content: "Status changed to Mitigated" },
    ],
  },
  {
    id: "INC-4815",
    title: "Webhook delivery failures — TLS cert expiry",
    severity: "sev2",
    status: "resolved",
    service: "webhook-service",
    owner: "sam@clawdbot.io",
    startedAt: "2026-02-21T14:00:00Z",
    resolvedAt: "2026-02-21T16:45:00Z",
    durationMin: 165,
    affectedUsers: 2140,
    slackChannel: "#inc-4815",
    runbook: "https://runbooks.internal/webhook-tls-renewal",
    impactDescription: "Webhook deliveries failing for ~2,140 endpoints due to TLS handshake errors. Certificate expired at 14:00 UTC.",
    rootCause: "Auto-renewal cron job failed silently 30 days prior due to misconfigured credentials. Certificate expired without replacement.",
    responders: [
      { id: "r1", name: "Sam", role: "Incident Commander", joinedAt: "14:02", active: false },
      { id: "r2", name: "Tim", role: "Infrastructure", joinedAt: "14:10", active: false },
    ],
    timeline: [
      { id: "t1", type: "alert", author: "PagerDuty", timestamp: "14:00:02", content: "Alert: webhook_delivery_error_rate > 90%" },
      { id: "t2", type: "status_change", author: "Sam", timestamp: "14:03:00", content: "Acknowledged" },
      { id: "t3", type: "comment", author: "Tim", timestamp: "14:22:00", content: "TLS cert expired. Issuing emergency renewal via certbot." },
      { id: "t4", type: "mitigation", author: "Tim", timestamp: "15:10:00", content: "New cert deployed. Deliveries resuming." },
      { id: "t5", type: "resolution", author: "Sam", timestamp: "16:45:00", content: "Queue drained, error rate at 0%. Resolved." },
      { id: "t6", type: "status_change", author: "Sam", timestamp: "16:45:00", content: "Status changed to Resolved" },
    ],
  },
];

const RUNBOOK_STEPS: RunbookStep[] = [
  { id: "rs-1", order: 1, title: "Verify alert", description: "Confirm the alert is not a fluke. Check Grafana for error rate sustained above threshold.", command: null, completed: true, critical: false },
  { id: "rs-2", order: 2, title: "Acknowledge & page team", description: "Acknowledge in PagerDuty. Page secondary on-call if needed.", command: null, completed: true, critical: false },
  { id: "rs-3", order: 3, title: "Check pod health", description: "Check kubernetes pod status and recent events for auth-service.", command: "kubectl get pods -n production -l app=auth-service\nkubectl describe pod <pod-name> -n production", completed: true, critical: true },
  { id: "rs-4", order: 4, title: "Check memory/CPU", description: "Inspect resource utilization. OOMkill is common cause of auth degradation.", command: "kubectl top pods -n production -l app=auth-service", completed: true, critical: true },
  { id: "rs-5", order: 5, title: "Rolling restart", description: "If OOMkill detected, initiate rolling restart. Traffic will drain gracefully.", command: "kubectl rollout restart deployment/auth-service -n production", completed: false, critical: true },
  { id: "rs-6", order: 6, title: "Verify recovery", description: "Watch error rate return to baseline (<1%) for at least 5 minutes.", command: null, completed: false, critical: false },
  { id: "rs-7", order: 7, title: "Increase memory limit", description: "If this is a recurring issue, file a ticket to increase auth-service memory limit.", command: null, completed: false, critical: false },
];

const POSTMORTEM: PostmortemField[] = [
  { label: "Summary", content: "Auth service experienced memory exhaustion on two pods, causing 5xx errors for 23% of authentication requests affecting ~18,000 users for approximately 45 minutes." },
  { label: "Root Cause", content: "Memory leak introduced in v2.14.1 (shipped 2026-02-20). The token validation cache had an unbounded growth pattern under high request volume." },
  { label: "Impact", content: "18,240 users unable to log in or refresh tokens. ~45 minutes of degraded authentication. No data loss." },
  { label: "Detection", content: "Automated alert fired after error rate exceeded 20% for 3 minutes. Detection was timely." },
  { label: "Resolution", content: "Rolling restart of affected pods. Memory leak fix deployed as v2.14.2 hotfix." },
  { label: "Action Items", content: "1. Add memory limit alert at 85% (not 95%). 2. Review token cache TTL configuration. 3. Add memory leak detection to CI pipeline. 4. Update runbook with OOM diagnosis steps." },
];

export default function IncidentCommandCenter() {
  const [tab, setTab] = useState<"active" | "runbook" | "timeline" | "postmortem">("active");
  const [selectedIncident, setSelectedIncident] = useState<Incident>(INCIDENTS[0]);
  const [steps, setSteps] = useState<RunbookStep[]>(RUNBOOK_STEPS);

  const activeIncidents = INCIDENTS.filter(i => i.status !== "resolved");
  const openDuration = selectedIncident.startedAt
    ? Math.floor((Date.now() - new Date(selectedIncident.startedAt).getTime()) / 60000)
    : null;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Incident Command Center</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Response · Runbooks · Postmortems</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span className="text-rose-300 font-medium">{activeIncidents.filter(i => i.severity === "sev1").length} SEV1</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-400" />
            <span className="text-orange-300 font-medium">{activeIncidents.filter(i => i.severity === "sev2").length} SEV2</span>
          </span>
          <button className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 rounded text-sm font-medium transition-colors">
            + Declare Incident
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-6">
        {(["active", "runbook", "timeline", "postmortem"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize",
              tab === t ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
            )}
          >
            {t === "postmortem" ? "Postmortem" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Active Incidents Tab */}
      {tab === "active" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Incident List */}
          <div className="w-80 border-r border-zinc-800 overflow-y-auto">
            {INCIDENTS.map(inc => (
              <button
                key={inc.id}
                onClick={() => setSelectedIncident(inc)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors",
                  selectedIncident.id === inc.id && "bg-zinc-800/60"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("text-xs font-bold font-mono", sevColor[inc.severity])}>{inc.id}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full ml-auto", sevBadge[inc.severity])}>
                    {inc.severity.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs font-medium text-white mb-1 leading-snug">{inc.title}</div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full", statusBadge[inc.status])}>{inc.status}</span>
                  <span className="text-xs text-zinc-500">{inc.service}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Incident Detail */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className={cn("font-bold font-mono", sevColor[selectedIncident.severity])}>{selectedIncident.id}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sevBadge[selectedIncident.severity])}>
                    {sevLabel[selectedIncident.severity]}
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBadge[selectedIncident.status])}>
                    {selectedIncident.status}
                  </span>
                </div>
                <h2 className="text-base font-semibold">{selectedIncident.title}</h2>
              </div>
              {selectedIncident.status !== "resolved" && (
                <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium transition-colors">
                  Update Status
                </button>
              )}
            </div>

            {/* Impact summary */}
            <div className="bg-zinc-900 rounded-lg p-4 mb-4 border-l-2 border-rose-500">
              <div className="text-xs font-medium text-zinc-400 mb-1.5">Impact</div>
              <p className="text-sm text-zinc-300">{selectedIncident.impactDescription}</p>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-4 gap-3 mb-4">
              <div className="bg-zinc-900 rounded-lg p-3 text-center">
                <div className="text-xl font-bold font-mono text-rose-400">{selectedIncident.affectedUsers.toLocaleString()}</div>
                <div className="text-xs text-zinc-500">affected users</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-3 text-center">
                <div className="text-xl font-bold font-mono text-white">
                  {selectedIncident.durationMin !== null ? `${selectedIncident.durationMin}m` : openDuration !== null ? `${openDuration}m` : "—"}
                </div>
                <div className="text-xs text-zinc-500">{selectedIncident.resolvedAt ? "duration" : "open for"}</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-3 text-center">
                <div className="text-xl font-bold font-mono text-white">{selectedIncident.responders.length}</div>
                <div className="text-xs text-zinc-500">responders</div>
              </div>
              <div className="bg-zinc-900 rounded-lg p-3 text-center">
                <div className="text-xl font-bold font-mono text-white">{selectedIncident.timeline.length}</div>
                <div className="text-xs text-zinc-500">timeline events</div>
              </div>
            </div>

            {/* Responders */}
            <div className="bg-zinc-900 rounded-lg p-4 mb-4">
              <div className="text-sm font-medium text-zinc-300 mb-3">Responders</div>
              <div className="flex flex-wrap gap-2">
                {selectedIncident.responders.map(r => (
                  <div key={r.id} className="flex items-center gap-2 bg-zinc-800 rounded-full px-3 py-1.5">
                    <span className={cn("w-2 h-2 rounded-full", r.active ? "bg-emerald-400" : "bg-zinc-600")} />
                    <span className="text-xs font-medium text-white">{r.name}</span>
                    <span className="text-xs text-zinc-500">{r.role}</span>
                    <span className="text-xs text-zinc-600">since {r.joinedAt}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent timeline events */}
            <div>
              <div className="text-sm font-medium text-zinc-300 mb-3">Recent Activity</div>
              <div className="space-y-2">
                {selectedIncident.timeline.slice(-4).toReversed().map(evt => (
                  <div key={evt.id} className="flex items-start gap-3 py-2 border-b border-zinc-800/40 last:border-0">
                    <span className="text-base mt-0.5">{actionIcon[evt.type]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-white">{evt.author}</span>
                        <span className="text-xs text-zinc-500">{evt.timestamp}</span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-snug">{evt.content}</p>
                      {evt.metadata && <div className="text-xs font-mono text-zinc-600 mt-0.5">{evt.metadata}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Runbook Tab */}
      {tab === "runbook" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Auth Service Degraded — Runbook</h2>
              <p className="text-sm text-zinc-400 mt-0.5">{steps.filter(s => s.completed).length} of {steps.length} steps complete</p>
            </div>
            <div className="w-48 bg-zinc-800 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all"
                style={{ width: `${(steps.filter(s => s.completed).length / steps.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="space-y-3">
            {steps.map(step => (
              <div
                key={step.id}
                className={cn(
                  "bg-zinc-900 rounded-lg p-4 border-l-2 transition-all",
                  step.completed ? "border-emerald-500 opacity-70" : step.critical ? "border-rose-500" : "border-zinc-700"
                )}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setSteps(steps.map(s => s.id === step.id ? { ...s, completed: !s.completed } : s))}
                    className={cn(
                      "w-5 h-5 rounded border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors",
                      step.completed ? "bg-emerald-500 border-emerald-500" : "border-zinc-600 hover:border-zinc-400"
                    )}
                  >
                    {step.completed && <span className="text-white text-xs font-bold">✓</span>}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-zinc-500 font-mono">Step {step.order}</span>
                      <span className="text-sm font-medium text-white">{step.title}</span>
                      {step.critical && <span className="text-xs text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">critical</span>}
                    </div>
                    <p className="text-xs text-zinc-400 mb-2">{step.description}</p>
                    {step.command && (
                      <pre className="bg-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 overflow-x-auto">
                        {step.command}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Tab */}
      {tab === "timeline" && (
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-base font-semibold mb-4">Full Timeline — {selectedIncident.id}</h2>
          <div className="relative">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-zinc-800" />
            <div className="space-y-4">
              {selectedIncident.timeline.map(evt => (
                <div key={evt.id} className="relative flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-700 flex items-center justify-center flex-shrink-0 z-10 text-base">
                    {actionIcon[evt.type]}
                  </div>
                  <div className="flex-1 bg-zinc-900 rounded-lg p-3">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs font-medium text-white">{evt.author}</span>
                      <span className="text-xs font-mono text-zinc-500">{evt.timestamp}</span>
                      <span className="text-xs text-zinc-600 capitalize">{evt.type.replace("_", " ")}</span>
                    </div>
                    <p className="text-sm text-zinc-300">{evt.content}</p>
                    {evt.metadata && <div className="text-xs font-mono text-zinc-600 mt-1">{evt.metadata}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Postmortem Tab */}
      {tab === "postmortem" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Postmortem Draft — {selectedIncident.id}</h2>
              <p className="text-sm text-zinc-400 mt-0.5">Blameless postmortem in progress</p>
            </div>
            <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium transition-colors">
              Publish
            </button>
          </div>
          <div className="space-y-4">
            {POSTMORTEM.map(field => (
              <div key={field.label} className="bg-zinc-900 rounded-lg p-4">
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">{field.label}</div>
                <p className="text-sm text-zinc-300 leading-relaxed">{field.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
