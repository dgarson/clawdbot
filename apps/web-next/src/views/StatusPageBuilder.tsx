import React, { useState } from "react";
import { cn } from "../lib/utils";

type ComponentStatus = "operational" | "degraded" | "partial-outage" | "major-outage" | "maintenance";
type IncidentSeverity = "critical" | "major" | "minor" | "informational";
type IncidentPhase = "investigating" | "identified" | "monitoring" | "resolved";

interface StatusComponent {
  id: string;
  name: string;
  group: string;
  status: ComponentStatus;
  uptime30d: number;
  uptime90d: number;
  lastIncident: string | null;
  responseMs: number;
}

interface StatusIncident {
  id: string;
  title: string;
  severity: IncidentSeverity;
  phase: IncidentPhase;
  startedAt: string;
  resolvedAt: string | null;
  affectedComponents: string[];
  updates: { timestamp: string; message: string; phase: IncidentPhase }[];
}

interface UptimeBar {
  date: string;
  status: ComponentStatus;
}

const statusLabel = (s: ComponentStatus) => {
  if (s === "operational")   {return "Operational";}
  if (s === "degraded")      {return "Degraded Performance";}
  if (s === "partial-outage"){return "Partial Outage";}
  if (s === "major-outage")  {return "Major Outage";}
  return "Maintenance";
};

const statusColor = (s: ComponentStatus) => {
  if (s === "operational")    {return "bg-emerald-400";}
  if (s === "degraded")       {return "bg-amber-400";}
  if (s === "partial-outage") {return "bg-orange-400";}
  if (s === "major-outage")   {return "bg-rose-500";}
  return "bg-blue-400";
};

const statusText = (s: ComponentStatus) => {
  if (s === "operational")    {return "text-emerald-400";}
  if (s === "degraded")       {return "text-amber-400";}
  if (s === "partial-outage") {return "text-orange-400";}
  if (s === "major-outage")   {return "text-rose-400";}
  return "text-blue-400";
};

const phaseColor = (p: IncidentPhase) => {
  if (p === "investigating") {return "text-amber-400 bg-amber-400/10";}
  if (p === "identified")    {return "text-orange-400 bg-orange-400/10";}
  if (p === "monitoring")    {return "text-blue-400 bg-blue-400/10";}
  return "text-emerald-400 bg-emerald-400/10";
};

const severityColor = (s: IncidentSeverity) => {
  if (s === "critical")      {return "text-rose-400 bg-rose-400/10 border-rose-400/30";}
  if (s === "major")         {return "text-orange-400 bg-orange-400/10 border-orange-400/30";}
  if (s === "minor")         {return "text-amber-400 bg-amber-400/10 border-amber-400/30";}
  return "text-blue-400 bg-blue-400/10 border-blue-400/30";
};

function genUptimeBars(baseStatus: ComponentStatus): UptimeBar[] {
  const bars: UptimeBar[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    // Mostly operational, occasional blips
    const rand = Math.random();
    let status: ComponentStatus = "operational";
    if (baseStatus !== "operational" && i < 3) {
      status = baseStatus;
    } else if (rand < 0.02) {
      status = "degraded";
    } else if (rand < 0.005) {
      status = "partial-outage";
    }
    bars.push({ date: dateStr, status });
  }
  return bars;
}

const COMPONENTS: StatusComponent[] = [
  { id: "gateway",    name: "API Gateway",           group: "Core",       status: "operational",    uptime30d: 99.98, uptime90d: 99.95, lastIncident: null,          responseMs: 12  },
  { id: "agent-rt",   name: "Agent Runtime",         group: "Core",       status: "operational",    uptime30d: 99.92, uptime90d: 99.87, lastIncident: "5 days ago",  responseMs: 45  },
  { id: "scheduler",  name: "Cron Scheduler",        group: "Core",       status: "operational",    uptime30d: 99.99, uptime90d: 99.98, lastIncident: null,          responseMs: 8   },
  { id: "llm-proxy",  name: "LLM Proxy",             group: "AI",         status: "degraded",       uptime30d: 99.71, uptime90d: 99.65, lastIncident: "2 hours ago", responseMs: 280 },
  { id: "vector-db",  name: "Vector Store",          group: "AI",         status: "operational",    uptime30d: 99.89, uptime90d: 99.82, lastIncident: "12 days ago", responseMs: 35  },
  { id: "slack-int",  name: "Slack Integration",     group: "Integrations", status: "operational",  uptime30d: 99.95, uptime90d: 99.91, lastIncident: null,          responseMs: 92  },
  { id: "github-int", name: "GitHub Integration",    group: "Integrations", status: "operational",  uptime30d: 99.88, uptime90d: 99.80, lastIncident: "8 days ago",  responseMs: 128 },
  { id: "postgres",   name: "Database (Primary)",    group: "Data",       status: "operational",    uptime30d: 99.99, uptime90d: 99.99, lastIncident: null,          responseMs: 4   },
  { id: "redis",      name: "Cache Layer",           group: "Data",       status: "operational",    uptime30d: 99.97, uptime90d: 99.96, lastIncident: null,          responseMs: 1   },
  { id: "cdn",        name: "CDN / Edge",            group: "Network",    status: "operational",    uptime30d: 99.99, uptime90d: 99.99, lastIncident: null,          responseMs: 6   },
  { id: "web-app",    name: "Web Application",       group: "Network",    status: "operational",    uptime30d: 99.94, uptime90d: 99.90, lastIncident: "18 days ago", responseMs: 220 },
];

const INCIDENTS: StatusIncident[] = [
  {
    id: "inc-001",
    title: "LLM Proxy Elevated Latency",
    severity: "minor",
    phase: "monitoring",
    startedAt: "2026-02-22 05:10 MST",
    resolvedAt: null,
    affectedComponents: ["llm-proxy"],
    updates: [
      { timestamp: "07:00 MST", message: "Latency has decreased to 280ms (down from 450ms). Continuing to monitor.", phase: "monitoring" },
      { timestamp: "05:45 MST", message: "Root cause identified: upstream model provider experiencing high load. No action required on our end.", phase: "identified" },
      { timestamp: "05:10 MST", message: "We are investigating elevated response times on the LLM Proxy. P95 latency is 450ms (normal: <200ms).", phase: "investigating" },
    ],
  },
  {
    id: "inc-002",
    title: "Agent Runtime Partial Degradation",
    severity: "major",
    phase: "resolved",
    startedAt: "2026-02-17 14:30 MST",
    resolvedAt: "2026-02-17 16:45 MST",
    affectedComponents: ["agent-rt"],
    updates: [
      { timestamp: "16:45 MST", message: "All systems have recovered. Root cause was a memory leak in the session manager, patched in v2.14.1.", phase: "resolved" },
      { timestamp: "15:20 MST", message: "Fix deployed. Monitoring recovery.", phase: "monitoring" },
      { timestamp: "14:50 MST", message: "Issue identified: memory leak in session manager causing OOM restarts. Fix in progress.", phase: "identified" },
      { timestamp: "14:30 MST", message: "Investigating reports of agent sessions timing out unexpectedly.", phase: "investigating" },
    ],
  },
];

const GROUPS = ["Core", "AI", "Integrations", "Data", "Network"];

export default function StatusPageBuilder() {
  const [components, setComponents] = useState<StatusComponent[]>(COMPONENTS);
  const [incidents, _setIncidents] = useState<StatusIncident[]>(INCIDENTS);
  const [activeTab, setActiveTab] = useState<"status" | "incidents" | "builder">("status");
  const [expandedIncidentId, setExpandedIncidentId] = useState<string | null>("inc-001");
  const [expandedComponentId, setExpandedComponentId] = useState<string | null>(null);
  const [editingComponentId, setEditingComponentId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState<ComponentStatus>("operational");

  const overallStatus: ComponentStatus = (() => {
    if (components.some(c => c.status === "major-outage")) {return "major-outage";}
    if (components.some(c => c.status === "partial-outage")) {return "partial-outage";}
    if (components.some(c => c.status === "degraded")) {return "degraded";}
    if (components.some(c => c.status === "maintenance")) {return "maintenance";}
    return "operational";
  })();

  const overallUptime = (components.reduce((sum, c) => sum + c.uptime30d, 0) / components.length).toFixed(3);

  function startEdit(comp: StatusComponent) {
    setEditingComponentId(comp.id);
    setEditStatus(comp.status);
  }

  function applyEdit(compId: string) {
    setComponents(prev => prev.map(c => c.id === compId ? { ...c, status: editStatus } : c));
    setEditingComponentId(null);
  }

  return (
    <div className="flex h-full bg-[var(--color-surface-0)] overflow-hidden flex-col">
      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-1)] flex-shrink-0">
        {(["status", "incidents", "builder"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-6 py-3 text-sm font-medium transition-colors border-b-2 capitalize",
              activeTab === tab ? "border-indigo-500 text-indigo-300" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {tab === "status" ? "🟢 Live Status" : tab === "incidents" ? `🔥 Incidents (${incidents.filter(i => !i.resolvedAt).length} open)` : "⚙️ Builder"}
          </button>
        ))}

        {/* Overall status badge */}
        <div className="ml-auto flex items-center gap-3 pr-6">
          <div className={cn("flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold border", severityColor(overallStatus === "operational" ? "informational" : "minor"))}>
            <span className={cn("w-2 h-2 rounded-full", statusColor(overallStatus), overallStatus !== "operational" && "animate-pulse")} />
            {statusLabel(overallStatus)}
          </div>
          <span className="text-xs text-[var(--color-text-muted)]">{overallUptime}% uptime (30d)</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === "status" && (
          <div className="max-w-3xl mx-auto space-y-6">
            {GROUPS.map(group => {
              const groupComponents = components.filter(c => c.group === group);
              if (groupComponents.length === 0) {return null;}
              const groupStatus: ComponentStatus = groupComponents.some(c => c.status !== "operational")
                ? groupComponents.find(c => c.status !== "operational")!.status
                : "operational";
              return (
                <div key={group} className="bg-[var(--color-surface-1)] rounded border border-[var(--color-border)] overflow-hidden">
                  {/* Group header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
                    <span className="font-semibold text-[var(--color-text-primary)] text-sm">{group}</span>
                    <span className={cn("text-xs font-medium", statusText(groupStatus))}>{statusLabel(groupStatus)}</span>
                  </div>

                  {/* Components */}
                  <div className="divide-y divide-[var(--color-border)]">
                    {groupComponents.map(comp => {
                      const bars = genUptimeBars(comp.status);
                      const isExpanded = expandedComponentId === comp.id;
                      return (
                        <div key={comp.id}>
                          <button
                            onClick={() => setExpandedComponentId(isExpanded ? null : comp.id)}
                            className="w-full text-left px-4 py-3 hover:bg-[var(--color-surface-2)]/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", statusColor(comp.status), comp.status !== "operational" && "animate-pulse")} />
                              <span className="text-sm text-[var(--color-text-primary)] flex-1">{comp.name}</span>
                              <span className={cn("text-xs font-medium", statusText(comp.status))}>{statusLabel(comp.status)}</span>
                              <span className="text-xs text-[var(--color-text-muted)]">{comp.responseMs}ms</span>
                              <span className={cn("text-xs transition-transform", isExpanded && "rotate-180")}>▾</span>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="px-4 pb-4 bg-[var(--color-surface-0)]/40">
                              {/* Uptime bars */}
                              <div className="mb-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-[10px] text-[var(--color-text-muted)]">90-day uptime</span>
                                  <span className="text-[10px] text-[var(--color-text-secondary)]">{comp.uptime90d}%</span>
                                </div>
                                <div className="flex gap-px h-6">
                                  {bars.map((bar, i) => (
                                    <div
                                      key={i}
                                      title={`${bar.date}: ${statusLabel(bar.status)}`}
                                      className={cn("flex-1 rounded-sm", statusColor(bar.status), bar.status === "operational" ? "opacity-70" : "opacity-100")}
                                    />
                                  ))}
                                </div>
                                <div className="flex justify-between text-[9px] text-[var(--color-text-muted)] mt-0.5">
                                  <span>90 days ago</span>
                                  <span>Today</span>
                                </div>
                              </div>

                              {/* Stats */}
                              <div className="grid grid-cols-3 gap-3 mb-3">
                                {[
                                  { label: "30d Uptime", value: `${comp.uptime30d}%` },
                                  { label: "Avg Response", value: `${comp.responseMs}ms` },
                                  { label: "Last Incident", value: comp.lastIncident ?? "Never" },
                                ].map(({ label, value }) => (
                                  <div key={label} className="bg-[var(--color-surface-1)] rounded p-2 border border-[var(--color-border)]">
                                    <div className="text-[10px] text-[var(--color-text-muted)]">{label}</div>
                                    <div className="text-xs text-[var(--color-text-primary)] font-medium mt-0.5">{value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {activeTab === "incidents" && (
          <div className="max-w-3xl mx-auto space-y-4">
            {incidents.length === 0 ? (
              <div className="text-center py-12 text-[var(--color-text-muted)]">No incidents recorded</div>
            ) : (
              incidents.map(inc => (
                <div key={inc.id} className={cn("bg-[var(--color-surface-1)] rounded border overflow-hidden", inc.resolvedAt ? "border-[var(--color-border)]" : "border-amber-400/30")}>
                  <button
                    onClick={() => setExpandedIncidentId(expandedIncidentId === inc.id ? null : inc.id)}
                    className="w-full text-left px-5 py-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className={cn("text-xs font-semibold px-2 py-1 rounded border mt-0.5", severityColor(inc.severity))}>
                        {inc.severity.toUpperCase()}
                      </span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{inc.title}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded capitalize", phaseColor(inc.phase))}>
                            {inc.phase}
                          </span>
                          <span className="text-xs text-[var(--color-text-muted)]">Started: {inc.startedAt}</span>
                          {inc.resolvedAt && <span className="text-xs text-[var(--color-text-muted)]">Resolved: {inc.resolvedAt}</span>}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {inc.affectedComponents.map(cId => {
                            const comp = components.find(c => c.id === cId);
                            return comp ? (
                              <span key={cId} className="text-[10px] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] px-2 py-0.5 rounded">{comp.name}</span>
                            ) : null;
                          })}
                        </div>
                      </div>
                      <span className={cn("text-xs transition-transform flex-shrink-0", expandedIncidentId === inc.id && "rotate-180")}>▾</span>
                    </div>
                  </button>

                  {expandedIncidentId === inc.id && (
                    <div className="border-t border-[var(--color-border)] px-5 py-4">
                      <div className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">Incident Timeline</div>
                      <div className="space-y-3">
                        {inc.updates.map((upd, i) => (
                          <div key={i} className="flex gap-3">
                            <div className="flex flex-col items-center">
                              <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5", phaseColor(upd.phase).split(" ")[0].replace("text-", "bg-"))} />
                              {i < inc.updates.length - 1 && <div className="w-px flex-1 bg-[var(--color-surface-2)] mt-1" />}
                            </div>
                            <div className="flex-1 pb-3">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn("text-[10px] font-semibold capitalize px-1.5 py-0.5 rounded", phaseColor(upd.phase))}>{upd.phase}</span>
                                <span className="text-[10px] text-[var(--color-text-muted)]">{upd.timestamp}</span>
                              </div>
                              <p className="text-sm text-[var(--color-text-primary)]">{upd.message}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "builder" && (
          <div className="max-w-3xl mx-auto">
            <div className="mb-4">
              <p className="text-sm text-[var(--color-text-secondary)]">Manage component statuses for the public status page.</p>
            </div>
            <div className="bg-[var(--color-surface-1)] rounded border border-[var(--color-border)] divide-y divide-[var(--color-border)]">
              {components.map(comp => (
                <div key={comp.id} className="flex items-center gap-4 px-4 py-3">
                  <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", statusColor(comp.status))} />
                  <div className="flex-1">
                    <div className="text-sm text-[var(--color-text-primary)] font-medium">{comp.name}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)]">{comp.group}</div>
                  </div>

                  {editingComponentId === comp.id ? (
                    <div className="flex items-center gap-2">
                      <select
                        value={editStatus}
                        onChange={e => setEditStatus(e.target.value as ComponentStatus)}
                        className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs px-2 py-1 rounded focus:outline-none focus:border-indigo-500"
                      >
                        <option value="operational">Operational</option>
                        <option value="degraded">Degraded Performance</option>
                        <option value="partial-outage">Partial Outage</option>
                        <option value="major-outage">Major Outage</option>
                        <option value="maintenance">Maintenance</option>
                      </select>
                      <button onClick={() => applyEdit(comp.id)} className="text-xs bg-indigo-500 hover:bg-indigo-600 text-[var(--color-text-primary)] px-3 py-1 rounded">Save</button>
                      <button onClick={() => setEditingComponentId(null)} className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className={cn("text-xs font-medium", statusText(comp.status))}>{statusLabel(comp.status)}</span>
                      <button onClick={() => startEdit(comp)} className="text-xs text-[var(--color-text-muted)] hover:text-indigo-400 px-2 py-1 rounded hover:bg-[var(--color-surface-2)] transition-colors">Edit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
