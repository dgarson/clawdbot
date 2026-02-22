import React, { useState } from "react";
import { cn } from "../lib/utils";

interface DeployStep {
  name: string;
  status: "done" | "running" | "pending" | "failed" | "skipped";
  duration?: number;
  log?: string;
}

interface Deployment {
  id: string;
  version: string;
  environment: "production" | "staging" | "dev";
  service: string;
  status: "success" | "in_progress" | "failed" | "rolled_back" | "scheduled";
  deployer: string;
  commit: string;
  branch: string;
  startTime: string;
  duration?: number;
  steps: DeployStep[];
  notes?: string;
  previousVersion?: string;
}

const DEPLOYMENTS: Deployment[] = [
  {
    id: "d1", version: "v2.5.1", environment: "production", service: "api-gateway",
    status: "success", deployer: "alice@corp.io", commit: "a3f9e12",
    branch: "feat/session-improvements", startTime: "2026-02-22T07:12:00Z", duration: 284,
    previousVersion: "v2.5.0",
    steps: [
      { name: "Build Docker Image",   status: "done",    duration: 62  },
      { name: "Run Unit Tests",       status: "done",    duration: 41  },
      { name: "Push to Registry",     status: "done",    duration: 18  },
      { name: "Deploy to Staging",    status: "done",    duration: 35  },
      { name: "Smoke Tests",          status: "done",    duration: 22  },
      { name: "Deploy to Production", status: "done",    duration: 67  },
      { name: "Health Check",         status: "done",    duration: 12  },
      { name: "Update CDN",           status: "done",    duration: 27  },
    ],
  },
  {
    id: "d2", version: "v1.8.3", environment: "staging", service: "auth-service",
    status: "in_progress", deployer: "bob@corp.io", commit: "c7d2f44",
    branch: "fix/token-refresh", startTime: "2026-02-22T07:38:00Z",
    steps: [
      { name: "Build Docker Image",   status: "done",    duration: 58  },
      { name: "Run Unit Tests",       status: "done",    duration: 34  },
      { name: "Push to Registry",     status: "done",    duration: 15  },
      { name: "Deploy to Staging",    status: "running", log: "Waiting for pods to become ready... (2/3 ready)" },
      { name: "Smoke Tests",          status: "pending" },
      { name: "Health Check",         status: "pending" },
    ],
  },
  {
    id: "d3", version: "v3.1.0", environment: "production", service: "billing-service",
    status: "failed", deployer: "carol@corp.io", commit: "e9a1b33",
    branch: "feat/billing-v3", startTime: "2026-02-22T06:45:00Z", duration: 142,
    previousVersion: "v3.0.8",
    steps: [
      { name: "Build Docker Image",   status: "done",    duration: 71  },
      { name: "Run Unit Tests",       status: "done",    duration: 49  },
      { name: "Push to Registry",     status: "done",    duration: 14  },
      { name: "Deploy to Staging",    status: "done",    duration: 33  },
      { name: "Smoke Tests",          status: "failed",  duration: 8,  log: "ERROR: POST /api/v2/subscriptions returned 500. Expected 201.\nStack trace: TypeError: Cannot read property 'plan' of undefined\n  at BillingController.createSubscription:142" },
      { name: "Deploy to Production", status: "skipped" },
      { name: "Health Check",         status: "skipped" },
    ],
  },
  {
    id: "d4", version: "v2.2.1", environment: "production", service: "analytics-pipeline",
    status: "rolled_back", deployer: "david@corp.io", commit: "b5c8f22",
    branch: "refactor/pipeline-v2", startTime: "2026-02-21T21:15:00Z", duration: 621,
    previousVersion: "v2.1.9",
    notes: "Rolled back due to 3x increase in p99 latency after deploy.",
    steps: [
      { name: "Build Docker Image",   status: "done",    duration: 68  },
      { name: "Run Unit Tests",       status: "done",    duration: 52  },
      { name: "Push to Registry",     status: "done",    duration: 17  },
      { name: "Deploy to Production", status: "done",    duration: 72  },
      { name: "Health Check",         status: "done",    duration: 10  },
      { name: "Rollback Triggered",   status: "done",    duration: 45, log: "Latency threshold exceeded. Auto-rollback initiated." },
    ],
  },
  {
    id: "d5", version: "v0.9.4", environment: "dev", service: "notification-service",
    status: "scheduled", deployer: "eve@corp.io", commit: "f2d7a11",
    branch: "feat/push-v2", startTime: "2026-02-22T10:00:00Z",
    steps: [
      { name: "Build Docker Image",   status: "pending" },
      { name: "Run Unit Tests",       status: "pending" },
      { name: "Deploy to Dev",        status: "pending" },
    ],
  },
];

const ENV_COLORS: Record<string, string> = {
  production: "bg-rose-400/15 text-rose-400 border-rose-500/30",
  staging:    "bg-amber-400/15 text-amber-400 border-amber-500/30",
  dev:        "bg-zinc-700 text-zinc-400 border-zinc-600",
};

const STATUS_STYLES: Record<string, string> = {
  success:     "bg-emerald-400/15 text-emerald-400 border-emerald-500/30",
  in_progress: "bg-indigo-400/15 text-indigo-300 border-indigo-500/30",
  failed:      "bg-rose-400/15 text-rose-400 border-rose-500/30",
  rolled_back: "bg-amber-400/15 text-amber-400 border-amber-500/30",
  scheduled:   "bg-zinc-700 text-zinc-400 border-zinc-600",
};

const STEP_STATUS_ICON: Record<string, string> = {
  done:    "✓",
  running: "⏳",
  pending: "○",
  failed:  "✗",
  skipped: "—",
};

const STEP_STATUS_COLOR: Record<string, string> = {
  done:    "text-emerald-400",
  running: "text-indigo-300",
  pending: "text-zinc-600",
  failed:  "text-rose-400",
  skipped: "text-zinc-600",
};

type Tab = "timeline" | "services" | "environments" | "settings";

export default function DeploymentTracker() {
  const [activeTab, setActiveTab]             = useState<Tab>("timeline");
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null);
  const [filterEnv, setFilterEnv]             = useState("all");
  const [filterStatus, setFilterStatus]       = useState("all");

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "timeline",     label: "Timeline",      emoji: "📅" },
    { id: "services",     label: "Services",      emoji: "⚙️" },
    { id: "environments", label: "Environments",  emoji: "🌍" },
    { id: "settings",     label: "Settings",      emoji: "🔧" },
  ];

  const filteredDeployments = DEPLOYMENTS.filter(d => {
    if (filterEnv    !== "all" && d.environment !== filterEnv)    return false;
    if (filterStatus !== "all" && d.status      !== filterStatus) return false;
    return true;
  });

  const fmtDuration = (s: number) => s >= 60 ? `${Math.floor(s/60)}m ${s%60}s` : `${s}s`;

  const services = Array.from(new Set(DEPLOYMENTS.map(d => d.service)));
  const envSummary = ["production","staging","dev"].map(env => ({
    env,
    recent: DEPLOYMENTS.filter(d => d.environment === env).sort((a,b) => b.startTime.localeCompare(a.startTime))[0],
    count:  DEPLOYMENTS.filter(d => d.environment === env).length,
  }));

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Deployment Tracker</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Track releases across environments and services</p>
        </div>
        <button className="text-sm px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors">
          🚀 New Deployment
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Deployments Today",  value: DEPLOYMENTS.filter(d=>d.startTime.startsWith("2026-02-22")).length, color: "text-indigo-400" },
          { label: "Success Rate",       value: `${Math.round((DEPLOYMENTS.filter(d=>d.status==="success").length/DEPLOYMENTS.length)*100)}%`, color: "text-emerald-400" },
          { label: "Avg Deploy Time",    value: fmtDuration(Math.round(DEPLOYMENTS.filter(d=>d.duration).reduce((s,d)=>s+(d.duration??0),0)/DEPLOYMENTS.filter(d=>d.duration).length)), color: "text-white" },
          { label: "Failed",             value: DEPLOYMENTS.filter(d=>d.status==="failed"||d.status==="rolled_back").length, color: "text-rose-400" },
        ].map(card => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-400 mb-1">{card.label}</div>
            <div className={cn("text-2xl font-bold", card.color)}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-lg border border-zinc-800 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm rounded-md transition-colors",
              activeTab === t.id
                ? "bg-indigo-500 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Timeline */}
      {activeTab === "timeline" && (
        <div className="grid grid-cols-5 gap-4">
          {/* Filters + list */}
          <div className="col-span-2 space-y-3">
            <div className="flex gap-2">
              <select
                value={filterEnv}
                onChange={e => setFilterEnv(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none"
              >
                <option value="all">All Envs</option>
                <option value="production">Production</option>
                <option value="staging">Staging</option>
                <option value="dev">Dev</option>
              </select>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="in_progress">In Progress</option>
                <option value="failed">Failed</option>
                <option value="rolled_back">Rolled Back</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>

            {filteredDeployments.map(dep => (
              <button
                key={dep.id}
                onClick={() => setSelectedDeployment(dep)}
                className={cn(
                  "w-full bg-zinc-900 border rounded-lg p-4 text-left hover:border-zinc-600 transition-colors",
                  selectedDeployment?.id === dep.id ? "border-indigo-500/50" : "border-zinc-800"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-medium text-white">{dep.service}</div>
                    <div className="text-xs text-zinc-400 font-mono">{dep.version} · {dep.commit}</div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", STATUS_STYLES[dep.status])}>
                    {dep.status.replace("_"," ")}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <span className={cn("px-1.5 py-0.5 rounded border text-xs", ENV_COLORS[dep.environment])}>{dep.environment}</span>
                  <span>{dep.deployer}</span>
                  {dep.duration && <span className="ml-auto">{fmtDuration(dep.duration)}</span>}
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className="col-span-3">
            {selectedDeployment ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-white">{selectedDeployment.service} {selectedDeployment.version}</h3>
                    <div className="text-xs text-zinc-400 mt-0.5 font-mono">{selectedDeployment.branch} · {selectedDeployment.commit}</div>
                  </div>
                  <span className={cn("text-sm px-3 py-1 rounded border", STATUS_STYLES[selectedDeployment.status])}>
                    {selectedDeployment.status.replace("_"," ")}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    ["Environment", selectedDeployment.environment],
                    ["Deployed by", selectedDeployment.deployer],
                    ["Started",     new Date(selectedDeployment.startTime).toLocaleTimeString()],
                    ["Duration",    selectedDeployment.duration ? fmtDuration(selectedDeployment.duration) : "—"],
                    ["Previous",    selectedDeployment.previousVersion ?? "—"],
                    ["Branch",      selectedDeployment.branch],
                  ].map(([k,v]) => (
                    <div key={k} className="bg-zinc-800 rounded p-2">
                      <div className="text-zinc-500">{k}</div>
                      <div className="text-zinc-300 mt-0.5 truncate">{v}</div>
                    </div>
                  ))}
                </div>

                {selectedDeployment.notes && (
                  <div className="bg-amber-400/10 border border-amber-500/30 rounded p-3 text-xs text-amber-300">
                    ⚠ {selectedDeployment.notes}
                  </div>
                )}

                {/* Steps */}
                <div>
                  <div className="text-xs font-medium text-zinc-400 mb-3">Deploy Steps</div>
                  <div className="space-y-2">
                    {selectedDeployment.steps.map((step, i) => (
                      <div key={i} className={cn(
                        "bg-zinc-800 rounded-lg p-3",
                        step.status === "failed" && "border border-rose-500/30"
                      )}>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-sm font-mono", STEP_STATUS_COLOR[step.status])}>
                            {STEP_STATUS_ICON[step.status]}
                          </span>
                          <span className="text-sm text-white flex-1">{step.name}</span>
                          {step.duration && (
                            <span className="text-xs text-zinc-500">{step.duration}s</span>
                          )}
                          {step.status === "running" && (
                            <span className="text-xs text-indigo-300 animate-pulse">running...</span>
                          )}
                        </div>
                        {step.log && (
                          <pre className={cn(
                            "mt-2 text-xs font-mono rounded p-2 overflow-x-auto whitespace-pre-wrap text-xs leading-relaxed",
                            step.status === "failed" ? "bg-rose-900/30 text-rose-200" : "bg-zinc-700 text-zinc-300"
                          )}>{step.log}</pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {(selectedDeployment.status === "failed" || selectedDeployment.status === "in_progress") && (
                  <div className="flex gap-2 pt-2 border-t border-zinc-800">
                    {selectedDeployment.status === "failed" && selectedDeployment.previousVersion && (
                      <button className="text-xs px-3 py-2 bg-amber-500/20 border border-amber-500/30 text-amber-300 rounded hover:bg-amber-500/30 transition-colors">
                        🔄 Rollback to {selectedDeployment.previousVersion}
                      </button>
                    )}
                    <button className="text-xs px-3 py-2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded hover:bg-indigo-500/30 transition-colors">
                      🔁 Retry
                    </button>
                    {selectedDeployment.status === "in_progress" && (
                      <button className="text-xs px-3 py-2 bg-rose-400/10 border border-rose-500/30 text-rose-300 rounded hover:bg-rose-400/20 transition-colors">
                        ⏹ Abort
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center text-zinc-500 text-sm">
                Select a deployment to view details and step logs
              </div>
            )}
          </div>
        </div>
      )}

      {/* Services */}
      {activeTab === "services" && (
        <div className="grid grid-cols-3 gap-4">
          {services.map(svc => {
            const svcDeps = DEPLOYMENTS.filter(d => d.service === svc);
            const latest = svcDeps.sort((a,b) => b.startTime.localeCompare(a.startTime))[0];
            const successRate = Math.round((svcDeps.filter(d=>d.status==="success").length / svcDeps.length) * 100);
            return (
              <div key={svc} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">{svc}</h3>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", STATUS_STYLES[latest.status])}>
                    {latest.status.replace("_"," ")}
                  </span>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between"><span className="text-zinc-400">Latest</span><span className="text-zinc-300">{latest.version}</span></div>
                  <div className="flex justify-between"><span className="text-zinc-400">Environment</span>
                    <span className={cn("px-1.5 py-0.5 rounded border text-xs", ENV_COLORS[latest.environment])}>{latest.environment}</span>
                  </div>
                  <div className="flex justify-between"><span className="text-zinc-400">Success Rate</span>
                    <span className={cn(successRate >= 80 ? "text-emerald-400" : "text-rose-400")}>{successRate}%</span>
                  </div>
                  <div className="flex justify-between"><span className="text-zinc-400">Total Deploys</span><span className="text-zinc-300">{svcDeps.length}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Environments */}
      {activeTab === "environments" && (
        <div className="space-y-4">
          {envSummary.map(({ env, recent, count }) => recent && (
            <div key={env} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={cn("text-sm px-3 py-1 rounded border capitalize font-semibold", ENV_COLORS[env])}>{env}</span>
                  <span className="text-sm text-zinc-400">{count} deployment{count !== 1 ? "s" : ""}</span>
                </div>
                <span className={cn("text-xs px-2 py-0.5 rounded border", STATUS_STYLES[recent.status])}>
                  Latest: {recent.status.replace("_"," ")}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-3 text-xs">
                {[
                  ["Service",  recent.service],
                  ["Version",  recent.version],
                  ["Deployer", recent.deployer],
                  ["Time",     new Date(recent.startTime).toLocaleTimeString()],
                ].map(([k,v]) => (
                  <div key={k} className="bg-zinc-800 rounded p-2">
                    <div className="text-zinc-500">{k}</div>
                    <div className="text-zinc-300 mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settings */}
      {activeTab === "settings" && (
        <div className="max-w-lg space-y-4">
          {[
            { label: "Default Environment",         value: "staging",   type: "select", opts: ["production","staging","dev"] },
            { label: "Auto-rollback on failure",     value: "enabled",   type: "select", opts: ["enabled","disabled"] },
            { label: "Deployment notifications",     value: "slack",     type: "select", opts: ["slack","email","both","none"] },
            { label: "Max concurrent deployments",   value: "3",         type: "number" },
            { label: "Deployment window (UTC)",      value: "06:00–22:00",type: "text"  },
            { label: "Health check timeout (s)",     value: "60",        type: "number" },
          ].map(f => (
            <div key={f.label}>
              <label className="block text-xs text-zinc-400 mb-1.5">{f.label}</label>
              {f.type === "select" ? (
                <select className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 focus:outline-none">
                  {f.opts?.map(o => <option key={o} selected={o === f.value}>{o}</option>)}
                </select>
              ) : (
                <input type={f.type} defaultValue={f.value} className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-indigo-500" />
              )}
            </div>
          ))}
          <button className="px-4 py-2 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600 transition-colors">Save Settings</button>
        </div>
      )}
    </div>
  );
}
