import React, { useState } from "react";
import { cn } from "../lib/utils";

interface TimelineEntry {
  time: string;
  actor: string;
  action: string;
  type: "detection" | "escalation" | "mitigation" | "resolution" | "communication";
}

interface ActionItem {
  id: string;
  description: string;
  owner: string;
  priority: "critical" | "high" | "medium" | "low";
  dueDate: string;
  status: "open" | "in_progress" | "done";
}

interface Postmortem {
  id: string;
  title: string;
  severity: "sev1" | "sev2" | "sev3";
  status: "draft" | "review" | "published";
  date: string;
  duration: string;
  affectedUsers: number;
  affectedServices: string[];
  summary: string;
  detectedAt: string;
  resolvedAt: string;
  rootCause: string;
  contributingFactors: string[];
  timeline: TimelineEntry[];
  actionItems: ActionItem[];
  lessonsLearned: string[];
  author: string;
  reviewers: string[];
}

const POSTMORTEM: Postmortem = {
  id: "pm1",
  title: "API Gateway Latency Spike — Production",
  severity: "sev1",
  status: "published",
  date: "2026-02-20",
  duration: "2h 34m",
  affectedUsers: 8241,
  affectedServices: ["api-gateway", "auth-service", "billing-service"],
  author: "carol@corp.io",
  reviewers: ["alice@corp.io", "david@corp.io", "sre-team@corp.io"],
  summary: "A deployment of api-gateway v3.1.0 introduced a misconfigured connection pool that caused downstream timeout cascades. P99 latency increased from 120ms to 8.4s for ~42% of API requests. The incident was detected via automated alerting at 21:03 UTC and resolved by rolling back to v3.0.8 at 23:37 UTC.",
  detectedAt: "2026-02-20T21:03:00Z",
  resolvedAt: "2026-02-20T23:37:00Z",
  rootCause: "The api-gateway v3.1.0 deploy introduced a connection pool configuration regression: `max_connections` was inadvertently set to 5 (down from 200) for the upstream billing-service HTTP client. Under normal load, this caused rapid connection exhaustion, triggering timeout cascades that propagated to auth-service and surfaced as 504s to end users.",
  contributingFactors: [
    "Configuration diff review process did not catch the pool size regression in the deployment PR",
    "Staging environment uses synthetic low-traffic load — the pool exhaustion only manifested under production traffic levels",
    "Alert thresholds for upstream timeout rate were set too high (>5% before firing — actual issue threshold was ~2%)",
    "On-call rotation had changed 2 hours before the deploy — new on-call was not briefed on the pending deployment",
  ],
  timeline: [
    { time: "20:48", actor: "carol",        action: "Deployed api-gateway v3.1.0 to production", type: "escalation" },
    { time: "20:52", actor: "monitoring",   action: "billing-service p99 latency began rising to 1.2s", type: "detection" },
    { time: "21:03", actor: "PagerDuty",    action: "Alert fired: api-gateway error rate >2% (actually 3.8%)", type: "detection" },
    { time: "21:08", actor: "david (OC)",   action: "Acknowledged alert, began investigation", type: "escalation" },
    { time: "21:15", actor: "david",        action: "Identified spike in billing-service timeouts", type: "mitigation" },
    { time: "21:22", actor: "david",        action: "Escalated to alice (SRE lead)", type: "escalation" },
    { time: "21:35", actor: "alice",        action: "Identified connection pool regression in v3.1.0 config diff", type: "mitigation" },
    { time: "21:40", actor: "status page",  action: "Incident published: API degradation for some users", type: "communication" },
    { time: "21:45", actor: "carol",        action: "Attempted hotfix: bumped max_connections to 200 in env var override", type: "mitigation" },
    { time: "22:10", actor: "monitoring",   action: "Hotfix partially effective — error rate dropped to 1.4%, latency still elevated", type: "mitigation" },
    { time: "22:45", actor: "alice",        action: "Decision: full rollback to v3.0.8 safer than continued hotfix", type: "escalation" },
    { time: "23:12", actor: "carol",        action: "Initiated rollback to v3.0.8", type: "mitigation" },
    { time: "23:31", actor: "monitoring",   action: "Latency normalized — p99 back to 118ms", type: "resolution" },
    { time: "23:37", actor: "alice",        action: "Incident resolved — all metrics nominal", type: "resolution" },
    { time: "23:45", actor: "status page",  action: "Incident resolved — posted resolution update", type: "communication" },
  ],
  actionItems: [
    { id: "ai1", description: "Add connection pool configuration to PR review checklist and diff tooling", owner: "carol@corp.io",  priority: "critical", dueDate: "2026-02-27", status: "in_progress" },
    { id: "ai2", description: "Implement load-tested staging environment that mirrors production traffic patterns", owner: "alice@corp.io",  priority: "high",     dueDate: "2026-03-15", status: "open" },
    { id: "ai3", description: "Lower upstream timeout alert threshold from 5% to 1.5%", owner: "david@corp.io",  priority: "high",     dueDate: "2026-02-24", status: "done" },
    { id: "ai4", description: "Add deployment briefing step to on-call handoff runbook", owner: "sre@corp.io",    priority: "medium",   dueDate: "2026-03-01", status: "open" },
    { id: "ai5", description: "Create automated connection pool config validation in CI pipeline", owner: "carol@corp.io",  priority: "medium",   dueDate: "2026-03-10", status: "open" },
    { id: "ai6", description: "Document rollback procedure for api-gateway — current process took 25min", owner: "alice@corp.io",  priority: "medium",   dueDate: "2026-02-28", status: "in_progress" },
  ],
  lessonsLearned: [
    "Configuration regressions in connection pools are hard to detect in low-traffic staging environments — we need representative load",
    "Alert thresholds need to be calibrated more aggressively for upstream dependency error rates",
    "On-call handoffs should include a briefing on pending/recent deployments",
    "A partial hotfix can provide false confidence and delay the decision to rollback — cleaner to rollback sooner",
    "Our rollback procedure is too manual — a single-command rollback should be achievable in <5 minutes",
  ],
};

const SEV_COLORS: Record<string, string> = {
  sev1: "bg-rose-400/15 text-rose-400 border-rose-500/30",
  sev2: "bg-amber-400/15 text-amber-400 border-amber-500/30",
  sev3: "bg-indigo-400/15 text-indigo-300 border-indigo-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  draft:     "bg-zinc-700 text-zinc-400 border-zinc-600",
  review:    "bg-amber-400/15 text-amber-400 border-amber-500/30",
  published: "bg-emerald-400/15 text-emerald-400 border-emerald-500/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-rose-400/15 text-rose-400 border-rose-500/30",
  high:     "bg-amber-400/15 text-amber-400 border-amber-500/30",
  medium:   "bg-indigo-400/15 text-indigo-300 border-indigo-500/30",
  low:      "bg-zinc-700 text-zinc-400 border-zinc-600",
};

const ACTION_STATUS_COLORS: Record<string, string> = {
  open:        "bg-zinc-700 text-zinc-400",
  in_progress: "bg-indigo-500/20 text-indigo-300",
  done:        "bg-emerald-400/15 text-emerald-400",
};

const TIMELINE_COLORS: Record<string, string> = {
  detection:     "bg-rose-500",
  escalation:    "bg-amber-500",
  mitigation:    "bg-indigo-500",
  resolution:    "bg-emerald-500",
  communication: "bg-zinc-500",
};

type Tab = "overview" | "timeline" | "analysis" | "actions" | "all_incidents";

const ALL_INCIDENTS = [
  { id: "pm1", title: "API Gateway Latency Spike", sev: "sev1", date: "2026-02-20", status: "published", duration: "2h 34m", users: 8241 },
  { id: "pm2", title: "Auth Service Outage (Token Refresh)",   sev: "sev2", date: "2026-02-14", status: "published", duration: "48m",    users: 2140 },
  { id: "pm3", title: "Database Connection Pool Exhaustion",   sev: "sev1", date: "2026-01-28", status: "published", duration: "1h 12m", users: 12033 },
  { id: "pm4", title: "CDN Cache Poisoning Incident",          sev: "sev2", date: "2026-01-15", status: "published", duration: "23m",    users: 890  },
  { id: "pm5", title: "Billing Service Data Sync Delay",       sev: "sev3", date: "2025-12-22", status: "published", duration: "6h 02m", users: 340  },
];

export default function IncidentPostmortem() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const pm = POSTMORTEM;

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "overview",       label: "Overview",         emoji: "📋" },
    { id: "timeline",       label: "Timeline",         emoji: "⏱️" },
    { id: "analysis",       label: "Root Cause",       emoji: "🔍" },
    { id: "actions",        label: "Action Items",     emoji: "✅" },
    { id: "all_incidents",  label: "All Incidents",    emoji: "📁" },
  ];

  const openCount   = pm.actionItems.filter(a => a.status === "open").length;
  const doneCount   = pm.actionItems.filter(a => a.status === "done").length;
  const progressPct = Math.round((doneCount / pm.actionItems.length) * 100);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className={cn("text-sm px-2.5 py-1 rounded border font-semibold uppercase", SEV_COLORS[pm.severity])}>
              {pm.severity.toUpperCase()}
            </span>
            <span className={cn("text-xs px-2 py-0.5 rounded border capitalize", STATUS_COLORS[pm.status])}>
              {pm.status}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white">{pm.title}</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{pm.date} · Duration: {pm.duration} · {pm.affectedUsers.toLocaleString()} users affected</p>
        </div>
        <div className="flex gap-2">
          <button className="text-sm px-4 py-2 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-800 transition-colors">⬇ Export PDF</button>
          <button className="text-sm px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors">✏️ Edit</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-lg border border-zinc-800 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm rounded-md transition-colors",
              activeTab === t.id ? "bg-indigo-500 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === "overview" && (
        <div className="space-y-5 max-w-3xl">
          {/* Key metrics */}
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "Duration",         value: pm.duration,              color: "text-rose-400" },
              { label: "Users Affected",   value: pm.affectedUsers.toLocaleString(), color: "text-amber-400" },
              { label: "Services Impacted",value: pm.affectedServices.length, color: "text-indigo-300" },
              { label: "Action Items",     value: pm.actionItems.length,   color: "text-white" },
            ].map(m => (
              <div key={m.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-xs text-zinc-400">{m.label}</div>
                <div className={cn("text-xl font-bold mt-1", m.color)}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Executive Summary</h3>
            <p className="text-sm text-zinc-300 leading-relaxed">{pm.summary}</p>
          </div>

          {/* Affected services + timeline window */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="text-xs font-medium text-zinc-400 mb-3">Affected Services</div>
              <div className="space-y-1.5">
                {pm.affectedServices.map(s => (
                  <div key={s} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    <span className="text-sm text-zinc-300 font-mono">{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="text-xs font-medium text-zinc-400 mb-3">Incident Window</div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-zinc-400">Detected</span><span className="text-zinc-300">21:03 UTC</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Mitigated</span><span className="text-zinc-300">22:10 UTC</span></div>
                <div className="flex justify-between"><span className="text-zinc-400">Resolved</span><span className="text-zinc-300">23:37 UTC</span></div>
                <div className="flex justify-between border-t border-zinc-800 pt-2"><span className="text-zinc-400">MTTR</span><span className="text-rose-400 font-semibold">2h 34m</span></div>
              </div>
            </div>
          </div>

          {/* Action items progress */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-zinc-400">Action Item Progress</div>
              <div className="text-xs text-zinc-400">{doneCount}/{pm.actionItems.length} done</div>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-2">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
            {openCount > 0 && (
              <div className="mt-2 text-xs text-amber-400">{openCount} open items remaining</div>
            )}
          </div>

          {/* Reviewers */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-xs font-medium text-zinc-400 mb-2">Author & Reviewers</div>
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-zinc-300">Author: <span className="text-indigo-300">{pm.author}</span></span>
              <span className="text-zinc-600">|</span>
              <span className="text-zinc-400">Reviewed by:</span>
              {pm.reviewers.map(r => (
                <span key={r} className="bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded">{r}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Timeline */}
      {activeTab === "timeline" && (
        <div className="max-w-2xl">
          <div className="flex items-center gap-4 mb-4 text-xs flex-wrap">
            {Object.entries(TIMELINE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className={cn("w-2.5 h-2.5 rounded-full", color)} />
                <span className="text-zinc-400 capitalize">{type}</span>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {pm.timeline.map((entry, i) => (
              <div key={i} className="flex gap-3 group">
                <div className="flex flex-col items-center">
                  <div className={cn("w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0", TIMELINE_COLORS[entry.type])} />
                  {i < pm.timeline.length - 1 && <div className="w-px flex-1 bg-zinc-800 mt-1" />}
                </div>
                <div className="pb-4">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-mono text-zinc-500">{entry.time}</span>
                    <span className="text-xs text-indigo-300">{entry.actor}</span>
                  </div>
                  <div className="text-sm text-zinc-300 mt-0.5">{entry.action}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Root Cause Analysis */}
      {activeTab === "analysis" && (
        <div className="max-w-3xl space-y-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Root Cause</h3>
            <p className="text-sm text-zinc-300 leading-relaxed">{pm.rootCause}</p>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Contributing Factors</h3>
            <div className="space-y-3">
              {pm.contributingFactors.map((f, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-amber-400 font-bold text-sm flex-shrink-0">{i + 1}.</span>
                  <p className="text-sm text-zinc-300 leading-relaxed">{f}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Lessons Learned</h3>
            <div className="space-y-2">
              {pm.lessonsLearned.map((l, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="text-emerald-400 text-sm flex-shrink-0">→</span>
                  <p className="text-sm text-zinc-300 leading-relaxed">{l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Action Items */}
      {activeTab === "actions" && (
        <div className="space-y-3 max-w-3xl">
          <div className="flex items-center justify-between">
            <div className="text-sm text-zinc-400">{pm.actionItems.length} action items — {doneCount} done, {openCount} open</div>
            <button className="text-xs px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded hover:bg-indigo-500/30">+ Add Item</button>
          </div>

          {pm.actionItems.map(item => (
            <div key={item.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className={cn(
                  "mt-0.5 w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center",
                  item.status === "done" ? "bg-emerald-500 border-emerald-400" : "border-zinc-600"
                )}>
                  {item.status === "done" && <span className="text-white text-xs">✓</span>}
                </div>
                <div className="flex-1">
                  <p className={cn("text-sm", item.status === "done" ? "text-zinc-500 line-through" : "text-zinc-200")}>{item.description}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className="text-xs text-zinc-400">👤 {item.owner}</span>
                    <span className="text-xs text-zinc-400">📅 {item.dueDate}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded border capitalize", PRIORITY_COLORS[item.priority])}>{item.priority}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded capitalize", ACTION_STATUS_COLORS[item.status])}>{item.status.replace("_"," ")}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All Incidents */}
      {activeTab === "all_incidents" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden max-w-3xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400">
                <th className="px-4 py-3 text-left font-medium">Incident</th>
                <th className="px-4 py-3 text-left font-medium">Severity</th>
                <th className="px-4 py-3 text-left font-medium">Date</th>
                <th className="px-4 py-3 text-left font-medium">Duration</th>
                <th className="px-4 py-3 text-right font-medium">Users</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {ALL_INCIDENTS.map(inc => (
                <tr
                  key={inc.id}
                  className={cn("hover:bg-zinc-800/30 cursor-pointer transition-colors", inc.id === "pm1" && "bg-indigo-500/5")}
                >
                  <td className="px-4 py-3">
                    <div className="text-sm text-white">{inc.title}</div>
                    {inc.id === "pm1" && <div className="text-xs text-indigo-400">← currently viewing</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded border uppercase font-semibold", SEV_COLORS[inc.sev])}>{inc.sev}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{inc.date}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{inc.duration}</td>
                  <td className="px-4 py-3 text-right text-xs text-zinc-400">{inc.users.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
