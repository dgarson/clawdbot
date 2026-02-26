import React, { useState } from "react";
import { cn } from "../lib/utils";

type DRStatus = "ready" | "degraded" | "untested" | "failed";
type RTO = "< 1hr" | "1-4hr" | "4-24hr" | "> 24hr";
type RPO = "< 15min" | "15min-1hr" | "1-4hr" | "> 4hr";
type TestResult = "pass" | "fail" | "partial" | "skipped";
type SiteRole = "primary" | "secondary" | "tertiary";

interface DRSite {
  id: string;
  name: string;
  region: string;
  role: SiteRole;
  status: DRStatus;
  lastSync: string;
  lagMs: number;
  capacity: number; // percent
}

interface DRPlan {
  id: string;
  name: string;
  service: string;
  rto: RTO;
  rpo: RPO;
  status: DRStatus;
  primarySite: string;
  failoverSite: string;
  lastTested: string;
  nextTest: string;
  owner: string;
  description: string;
  steps: string[];
  contacts: string[];
}

interface TestRun {
  id: string;
  planId: string;
  planName: string;
  date: string;
  result: TestResult;
  duration: number; // minutes
  rtoActual: number; // minutes
  rpoActual: number; // minutes
  notes: string;
  tester: string;
}

interface FailoverEvent {
  id: string;
  date: string;
  service: string;
  from: string;
  to: string;
  trigger: string;
  duration: number; // minutes
  outcome: "success" | "partial" | "failed";
}

const statusBadge: Record<DRStatus, string> = {
  ready:    "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  degraded: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  untested: "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30",
  failed:   "bg-rose-500/20 text-rose-400 border border-rose-500/30",
};

const statusDot: Record<DRStatus, string> = {
  ready:    "bg-emerald-400",
  degraded: "bg-amber-400",
  untested: "bg-zinc-400",
  failed:   "bg-rose-400",
};

const testBadge: Record<TestResult, string> = {
  pass:    "bg-emerald-500/20 text-emerald-400",
  fail:    "bg-rose-500/20 text-rose-400",
  partial: "bg-amber-500/20 text-amber-400",
  skipped: "bg-zinc-500/20 text-zinc-400",
};

const roleBadge: Record<SiteRole, string> = {
  primary:   "bg-indigo-500/20 text-indigo-400",
  secondary: "bg-sky-500/20 text-sky-400",
  tertiary:  "bg-zinc-500/20 text-zinc-400",
};

const drSites: DRSite[] = [
  { id: "s1", name: "US-East-1",    region: "us-east-1",    role: "primary",   status: "ready",    lastSync: "2s ago",   lagMs: 0,   capacity: 78 },
  { id: "s2", name: "US-West-2",    region: "us-west-2",    role: "secondary", status: "ready",    lastSync: "12s ago",  lagMs: 124, capacity: 45 },
  { id: "s3", name: "EU-Central-1", region: "eu-central-1", role: "secondary", status: "degraded", lastSync: "2m ago",   lagMs: 890, capacity: 62 },
  { id: "s4", name: "AP-Southeast", region: "ap-southeast", role: "tertiary",  status: "untested", lastSync: "8m ago",   lagMs: 450, capacity: 30 },
];

const drPlans: DRPlan[] = [
  {
    id: "p1",
    name: "Core API Failover",
    service: "api-gateway",
    rto: "< 1hr",
    rpo: "< 15min",
    status: "ready",
    primarySite: "US-East-1",
    failoverSite: "US-West-2",
    lastTested: "2025-01-15",
    nextTest: "2025-04-15",
    owner: "Platform Team",
    description: "Automated failover for the core API gateway using Route53 health checks with pre-warmed secondary.",
    steps: [
      "Detect primary failure via health check (auto, 30s)",
      "Trigger Route53 DNS failover to US-West-2 (auto, 60s)",
      "Validate traffic routing and 2xx response rates",
      "Page on-call engineers for manual verification",
      "Notify stakeholders via PagerDuty",
    ],
    contacts: ["jane@example.com", "ops-oncall@example.com"],
  },
  {
    id: "p2",
    name: "Database Primary Failover",
    service: "postgres-primary",
    rto: "1-4hr",
    rpo: "< 15min",
    status: "ready",
    primarySite: "US-East-1",
    failoverSite: "US-West-2",
    lastTested: "2024-12-01",
    nextTest: "2025-03-01",
    owner: "Data Team",
    description: "RDS Multi-AZ automatic failover with read replica promotion for regional outage.",
    steps: [
      "RDS Multi-AZ automatic failover within region (auto, 2-3min)",
      "Promote read replica in US-West-2 (manual, 15-30min)",
      "Update connection strings in app config",
      "Verify data integrity on promoted replica",
      "Run smoke tests against new primary",
    ],
    contacts: ["dba@example.com", "backend-oncall@example.com"],
  },
  {
    id: "p3",
    name: "Search Service Recovery",
    service: "elasticsearch",
    rto: "4-24hr",
    rpo: "1-4hr",
    status: "degraded",
    primarySite: "US-East-1",
    failoverSite: "EU-Central-1",
    lastTested: "2024-10-20",
    nextTest: "2025-01-20",
    owner: "Search Team",
    description: "Elasticsearch cross-cluster replication with manual promotion. Degraded due to lag in EU cluster.",
    steps: [
      "Assess EU cluster lag and data freshness",
      "Stop writes to primary (manual)",
      "Confirm EU cluster caught up or accept RPO gap",
      "Promote EU cluster as primary",
      "Update service discovery endpoints",
      "Rebuild index if lag > 4hr threshold",
    ],
    contacts: ["search-team@example.com"],
  },
  {
    id: "p4",
    name: "CDN Failback Plan",
    service: "cdn-edge",
    rto: "< 1hr",
    rpo: "< 15min",
    status: "ready",
    primarySite: "US-East-1",
    failoverSite: "US-West-2",
    lastTested: "2025-02-01",
    nextTest: "2025-05-01",
    owner: "Infra Team",
    description: "CDN origin failover via weighted routing rules.",
    steps: [
      "Detect origin health check failure",
      "Shift 100% traffic to secondary origin",
      "Purge stale CDN cache if needed",
      "Validate edge node cache hit rates",
    ],
    contacts: ["infra@example.com"],
  },
];

const testRuns: TestRun[] = [
  { id: "t1", planId: "p4", planName: "CDN Failback Plan",        date: "2025-02-01", result: "pass",    duration: 42,  rtoActual: 22,  rpoActual: 5,   notes: "Smooth. All automated steps completed under SLA.",     tester: "alice" },
  { id: "t2", planId: "p1", planName: "Core API Failover",         date: "2025-01-15", result: "pass",    duration: 55,  rtoActual: 48,  rpoActual: 8,   notes: "DNS TTL delay added 18min. Recommend lowering TTL.",   tester: "bob" },
  { id: "t3", planId: "p2", planName: "Database Primary Failover", date: "2024-12-01", result: "partial", duration: 180, rtoActual: 155, rpoActual: 12,  notes: "Replica promotion took longer than expected.",         tester: "carol" },
  { id: "t4", planId: "p3", planName: "Search Service Recovery",   date: "2024-10-20", result: "fail",    duration: 240, rtoActual: 310, rpoActual: 180, notes: "RTO exceeded target. EU replication lag was >2hr.",     tester: "dave" },
  { id: "t5", planId: "p1", planName: "Core API Failover",         date: "2024-09-10", result: "pass",    duration: 50,  rtoActual: 40,  rpoActual: 6,   notes: "Clean run.",                                           tester: "alice" },
];

const failoverEvents: FailoverEvent[] = [
  { id: "f1", date: "2025-01-28 14:22", service: "api-gateway",      from: "US-East-1", to: "US-West-2",    trigger: "AZ power outage",          duration: 38,  outcome: "success" },
  { id: "f2", date: "2024-12-15 03:11", service: "cdn-edge",         from: "US-East-1", to: "US-West-2",    trigger: "BGP route leak",           duration: 12,  outcome: "success" },
  { id: "f3", date: "2024-11-02 09:44", service: "elasticsearch",    from: "US-East-1", to: "EU-Central-1", trigger: "Datacenter fire suppression", duration: 420, outcome: "partial" },
  { id: "f4", date: "2024-09-18 17:05", service: "postgres-primary", from: "US-East-1", to: "US-West-2",    trigger: "Scheduled maintenance",    duration: 22,  outcome: "success" },
];

const readyCt   = drPlans.filter(p => p.status === "ready").length;
const degradedCt = drPlans.filter(p => p.status === "degraded").length;

export default function DisasterRecoveryPlanner() {
  const [tab, setTab]               = useState<"overview" | "plans" | "tests" | "history">("overview");
  const [selectedPlan, setSelectedPlan] = useState<DRPlan | null>(null);
  const [statusFilter, setStatusFilter] = useState<DRStatus | "all">("all");

  const filteredPlans = statusFilter === "all" ? drPlans : drPlans.filter(p => p.status === statusFilter);

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "plans",    label: "DR Plans" },
    { id: "tests",    label: "Test History" },
    { id: "history",  label: "Failover Events" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Disaster Recovery Planner</h1>
            <p className="text-zinc-400 text-sm mt-1">Failover plans, test schedules, and recovery history</p>
          </div>
          <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors">
            + New Plan
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedPlan(null); }}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                tab === t.id
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "Total Plans",     value: drPlans.length, color: "text-white" },
                { label: "Ready",           value: readyCt,        color: "text-emerald-400" },
                { label: "Degraded/Untested", value: degradedCt + drPlans.filter(p=>p.status==="untested").length, color: "text-amber-400" },
                { label: "Sites Online",    value: `${drSites.filter(s=>s.status==="ready").length}/${drSites.length}`, color: "text-indigo-400" },
              ].map(kpi => (
                <div key={kpi.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">{kpi.label}</p>
                  <p className={cn("text-3xl font-bold mt-1", kpi.color)}>{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Site status */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Site Health</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {drSites.map(site => (
                  <div key={site.id} className="bg-zinc-800/50 rounded-lg p-4 flex items-center gap-4">
                    <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", statusDot[site.status])} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-white">{site.name}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", roleBadge[site.role])}>{site.role}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", statusBadge[site.status])}>{site.status}</span>
                      </div>
                      <p className="text-xs text-zinc-500">{site.region} · Sync: {site.lastSync}{site.lagMs > 0 ? ` · Lag: ${site.lagMs}ms` : " · In sync"}</p>
                      {/* Capacity bar */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 bg-zinc-700 rounded-full h-1.5">
                          <div
                            className={cn("h-1.5 rounded-full", site.capacity > 80 ? "bg-rose-500" : site.capacity > 60 ? "bg-amber-500" : "bg-emerald-500")}
                            style={{ width: `${site.capacity}%` }}
                          />
                        </div>
                        <span className="text-xs text-zinc-400 w-8 text-right">{site.capacity}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Plan coverage matrix */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">RTO / RPO Coverage</h2>
              <div className="space-y-3">
                {drPlans.map(plan => (
                  <div key={plan.id} className="flex items-center gap-4">
                    <div className="w-40 text-xs text-zinc-300 truncate">{plan.name}</div>
                    <div className="flex gap-2">
                      <span className="text-xs bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded">RTO: {plan.rto}</span>
                      <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded">RPO: {plan.rpo}</span>
                    </div>
                    <div className="flex-1">
                      <div className={cn("w-2.5 h-2.5 rounded-full inline-block", statusDot[plan.status])} />
                    </div>
                    <span className="text-xs text-zinc-500">Next test: {plan.nextTest}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DR Plans */}
        {tab === "plans" && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2">
              {(["all", "ready", "degraded", "untested", "failed"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setStatusFilter(f); setSelectedPlan(null); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    statusFilter === f ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {selectedPlan ? (
              /* Plan detail */
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedPlan(null)} className="text-zinc-400 hover:text-white text-sm">← Back</button>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusBadge[selectedPlan.status])}>{selectedPlan.status}</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedPlan.name}</h2>
                  <p className="text-zinc-400 text-sm mt-1">{selectedPlan.description}</p>
                </div>

                {/* Metadata grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Service",       value: selectedPlan.service },
                    { label: "Owner",         value: selectedPlan.owner },
                    { label: "RTO Target",    value: selectedPlan.rto },
                    { label: "RPO Target",    value: selectedPlan.rpo },
                    { label: "Primary Site",  value: selectedPlan.primarySite },
                    { label: "Failover Site", value: selectedPlan.failoverSite },
                    { label: "Last Tested",   value: selectedPlan.lastTested },
                    { label: "Next Test",     value: selectedPlan.nextTest },
                  ].map(m => (
                    <div key={m.label} className="bg-zinc-800/60 rounded-lg p-3">
                      <p className="text-xs text-zinc-500">{m.label}</p>
                      <p className="text-sm font-medium text-white mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Failover steps */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3">Failover Steps</h3>
                  <ol className="space-y-2">
                    {selectedPlan.steps.map((step, i) => (
                      <li key={i} className="flex gap-3 items-start">
                        <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 text-xs flex items-center justify-center flex-shrink-0 font-bold">{i + 1}</span>
                        <span className="text-sm text-zinc-300 leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Contacts */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-2">Emergency Contacts</h3>
                  <div className="flex gap-2 flex-wrap">
                    {selectedPlan.contacts.map(c => (
                      <span key={c} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded">{c}</span>
                    ))}
                  </div>
                </div>

                {/* Test history for this plan */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3">Test History</h3>
                  <div className="space-y-2">
                    {testRuns.filter(t => t.planId === selectedPlan.id).length === 0
                      ? <p className="text-zinc-500 text-sm">No tests recorded.</p>
                      : testRuns.filter(t => t.planId === selectedPlan.id).map(t => (
                          <div key={t.id} className="bg-zinc-800/60 rounded-lg p-3 flex items-center gap-4">
                            <span className={cn("text-xs px-2 py-0.5 rounded font-medium", testBadge[t.result])}>{t.result}</span>
                            <span className="text-xs text-zinc-400">{t.date}</span>
                            <span className="text-xs text-zinc-500">RTO: {t.rtoActual}min / RPO: {t.rpoActual}min</span>
                            <span className="text-xs text-zinc-500 flex-1">{t.notes}</span>
                          </div>
                        ))
                    }
                  </div>
                </div>
              </div>
            ) : (
              /* Plan list */
              <div className="space-y-3">
                {filteredPlans.map(plan => (
                  <button
                    key={plan.id}
                    onClick={() => setSelectedPlan(plan)}
                    className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5", statusDot[plan.status])} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{plan.name}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{plan.service} · Owner: {plan.owner}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <span className="text-xs bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded">RTO {plan.rto}</span>
                        <span className="text-xs bg-violet-500/20 text-violet-400 px-2 py-0.5 rounded">RPO {plan.rpo}</span>
                        <span className={cn("text-xs px-2 py-0.5 rounded font-medium", statusBadge[plan.status])}>{plan.status}</span>
                      </div>
                    </div>
                    <p className="text-xs text-zinc-500 mt-2 ml-5">
                      {plan.primarySite} → {plan.failoverSite} · Last tested: {plan.lastTested} · Next: {plan.nextTest}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Test History */}
        {tab === "tests" && (
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                { label: "Total Tests", value: testRuns.length, color: "text-white" },
                { label: "Passed",  value: testRuns.filter(t=>t.result==="pass").length,    color: "text-emerald-400" },
                { label: "Failed",  value: testRuns.filter(t=>t.result==="fail").length,    color: "text-rose-400" },
                { label: "Partial", value: testRuns.filter(t=>t.result==="partial").length, color: "text-amber-400" },
              ].map(kpi => (
                <div key={kpi.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider">{kpi.label}</p>
                  <p className={cn("text-2xl font-bold mt-1", kpi.color)}>{kpi.value}</p>
                </div>
              ))}
            </div>
            {testRuns.map(run => (
              <div key={run.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", testBadge[run.result])}>{run.result.toUpperCase()}</span>
                    <span className="text-sm font-medium text-white">{run.planName}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{run.date}</span>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-2">
                  <div className="bg-zinc-800/50 rounded p-2">
                    <p className="text-xs text-zinc-500">Duration</p>
                    <p className="text-sm font-medium text-white">{run.duration}min</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded p-2">
                    <p className="text-xs text-zinc-500">Actual RTO</p>
                    <p className="text-sm font-medium text-sky-400">{run.rtoActual}min</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded p-2">
                    <p className="text-xs text-zinc-500">Actual RPO</p>
                    <p className="text-sm font-medium text-violet-400">{run.rpoActual}min</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-400">{run.notes}</p>
                <p className="text-xs text-zinc-600 mt-1">Tester: {run.tester}</p>
              </div>
            ))}
          </div>
        )}

        {/* Failover Events */}
        {tab === "history" && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">Real failover events (planned and unplanned)</p>
            {failoverEvents.map(ev => (
              <div key={ev.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded font-medium",
                      ev.outcome === "success" ? "bg-emerald-500/20 text-emerald-400" :
                      ev.outcome === "partial"  ? "bg-amber-500/20 text-amber-400" :
                      "bg-rose-500/20 text-rose-400"
                    )}>{ev.outcome}</span>
                    <span className="text-sm font-semibold text-white">{ev.service}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{ev.date}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-300 mb-1">
                  <span className="text-zinc-500">{ev.from}</span>
                  <span className="text-zinc-600">→</span>
                  <span className="text-zinc-300">{ev.to}</span>
                </div>
                <div className="flex gap-4 text-xs text-zinc-500">
                  <span>Trigger: {ev.trigger}</span>
                  <span>Duration: {ev.duration}min</span>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
