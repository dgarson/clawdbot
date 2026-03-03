import React, { useState } from "react";
import { cn } from "../lib/utils";

type GateType = "boolean" | "percentage" | "user-list" | "segment" | "schedule";
type GateStatus = "enabled" | "disabled" | "partial";
type RolloutStrategy = "random" | "sticky" | "user-id-hash";
type Environment = "production" | "staging" | "development";

interface UserSegment {
  id: string;
  name: string;
  size: number;
  criteria: string;
}

interface ScheduleWindow {
  start: string;
  end: string;
  timezone: string;
}

interface FeatureGate {
  id: string;
  key: string;
  name: string;
  description: string;
  type: GateType;
  status: GateStatus;
  environment: Environment;
  rolloutPercent: number;
  strategy: RolloutStrategy;
  targetSegments: string[];
  targetUsers: string[];
  schedule: ScheduleWindow | null;
  owner: string;
  createdAt: string;
  updatedAt: string;
  evaluations: number;
  truePercent: number;
  dependsOn: string[];
  tags: string[];
}

interface EvaluationPoint {
  time: string;
  trueCount: number;
  falseCount: number;
}

interface GateEvent {
  id: string;
  gateKey: string;
  gateName: string;
  action: string;
  user: string;
  timestamp: string;
  detail: string;
}

const SEGMENTS: UserSegment[] = [
  { id: "s1", name: "Beta Testers", size: 1240, criteria: "User has opted into beta program" },
  { id: "s2", name: "Enterprise Accounts", size: 312, criteria: "Account type = enterprise" },
  { id: "s3", name: "US Users", size: 48200, criteria: "Country code = US" },
  { id: "s4", name: "Power Users", size: 8740, criteria: "Last 30d activity > 50 events" },
  { id: "s5", name: "New Signups (7d)", size: 2180, criteria: "Account created < 7 days ago" },
];

const GATES: FeatureGate[] = [
  {
    id: "g1", key: "new_dashboard_v2", name: "New Dashboard V2", environment: "production",
    description: "Enables the redesigned dashboard experience with tabbed navigation and new analytics widgets.",
    type: "percentage", status: "partial", rolloutPercent: 25, strategy: "sticky",
    targetSegments: ["s1", "s4"], targetUsers: [],
    schedule: null, owner: "product-team@co.com",
    createdAt: "2026-01-15", updatedAt: "2026-02-20",
    evaluations: 1284000, truePercent: 24.8,
    dependsOn: [], tags: ["dashboard", "v2", "UX"],
  },
  {
    id: "g2", key: "ai_code_assist", name: "AI Code Assistant", environment: "production",
    description: "Inline AI-powered code suggestions and auto-complete in the code editor.",
    type: "segment", status: "partial", rolloutPercent: 100, strategy: "sticky",
    targetSegments: ["s2", "s1"], targetUsers: [],
    schedule: null, owner: "ai-team@co.com",
    createdAt: "2025-11-01", updatedAt: "2026-02-15",
    evaluations: 890000, truePercent: 18.2,
    dependsOn: ["new_dashboard_v2"], tags: ["AI", "editor", "premium"],
  },
  {
    id: "g3", key: "billing_v3", name: "New Billing Portal", environment: "production",
    description: "Redesigned billing and subscription management flow with Stripe integration.",
    type: "boolean", status: "disabled", rolloutPercent: 0, strategy: "random",
    targetSegments: [], targetUsers: [],
    schedule: null, owner: "billing-team@co.com",
    createdAt: "2026-02-01", updatedAt: "2026-02-18",
    evaluations: 320000, truePercent: 0,
    dependsOn: [], tags: ["billing", "stripe", "v3"],
  },
  {
    id: "g4", key: "dark_mode_default", name: "Dark Mode Default", environment: "production",
    description: "Sets dark mode as the default theme for all new user accounts and returning users without explicit preference.",
    type: "boolean", status: "enabled", rolloutPercent: 100, strategy: "random",
    targetSegments: [], targetUsers: [],
    schedule: null, owner: "ux-team@co.com",
    createdAt: "2025-09-01", updatedAt: "2026-01-10",
    evaluations: 4820000, truePercent: 100,
    dependsOn: [], tags: ["theme", "UX"],
  },
  {
    id: "g5", key: "scheduled_maintenance_mode", name: "Maintenance Mode Banner", environment: "production",
    description: "Shows a scheduled maintenance banner to all users before planned downtime.",
    type: "schedule", status: "partial", rolloutPercent: 100, strategy: "random",
    targetSegments: [], targetUsers: [],
    schedule: { start: "2026-03-01 02:00", end: "2026-03-01 06:00", timezone: "UTC" },
    owner: "ops@co.com",
    createdAt: "2026-02-20", updatedAt: "2026-02-22",
    evaluations: 54000, truePercent: 0,
    dependsOn: [], tags: ["ops", "maintenance"],
  },
  {
    id: "g6", key: "beta_analytics_v2", name: "Analytics V2 (Beta)", environment: "staging",
    description: "Next-generation analytics pipeline with real-time event processing and drill-down capabilities.",
    type: "user-list", status: "partial", rolloutPercent: 100, strategy: "sticky",
    targetSegments: [], targetUsers: ["user_001@co.com", "user_002@co.com", "qa_team@co.com"],
    schedule: null, owner: "data-team@co.com",
    createdAt: "2026-02-10", updatedAt: "2026-02-22",
    evaluations: 12000, truePercent: 4.2,
    dependsOn: [], tags: ["analytics", "beta", "data"],
  },
  {
    id: "g7", key: "onboarding_wizard_v2", name: "Onboarding Wizard V2", environment: "production",
    description: "Stepped onboarding wizard replacing the single-page setup form. A/B test against control group.",
    type: "percentage", status: "partial", rolloutPercent: 50, strategy: "random",
    targetSegments: ["s5"], targetUsers: [],
    schedule: null, owner: "growth-team@co.com",
    createdAt: "2026-02-05", updatedAt: "2026-02-21",
    evaluations: 28000, truePercent: 49.6,
    dependsOn: [], tags: ["onboarding", "A/B", "growth"],
  },
];

const EVAL_HISTORY: EvaluationPoint[] = [
  { time: "10:00", trueCount: 8200, falseCount: 24600 },
  { time: "11:00", trueCount: 9400, falseCount: 28200 },
  { time: "12:00", trueCount: 11800, falseCount: 35400 },
  { time: "13:00", trueCount: 10200, falseCount: 30600 },
  { time: "14:00", trueCount: 12100, falseCount: 36300 },
  { time: "15:00", trueCount: 13400, falseCount: 40200 },
  { time: "16:00", trueCount: 9800, falseCount: 29400 },
  { time: "17:00", trueCount: 7600, falseCount: 22800 },
];

const EVENTS: GateEvent[] = [
  { id: "ev1", gateKey: "new_dashboard_v2", gateName: "New Dashboard V2", action: "Rollout increased", user: "alice@co.com", timestamp: "2026-02-20 14:22", detail: "Rollout changed from 10% to 25%" },
  { id: "ev2", gateKey: "billing_v3", gateName: "New Billing Portal", action: "Disabled", user: "billing-eng@co.com", timestamp: "2026-02-18 09:15", detail: "Rolled back due to Stripe webhook issue (#INC-4421)" },
  { id: "ev3", gateKey: "scheduled_maintenance_mode", gateName: "Maintenance Mode Banner", action: "Created", user: "ops@co.com", timestamp: "2026-02-22 10:00", detail: "Scheduled for 2026-03-01 02:00 UTC maintenance window" },
  { id: "ev4", gateKey: "onboarding_wizard_v2", gateName: "Onboarding Wizard V2", action: "Rollout increased", user: "growth@co.com", timestamp: "2026-02-21 16:30", detail: "Rollout increased from 25% to 50% after positive metrics" },
  { id: "ev5", gateKey: "ai_code_assist", gateName: "AI Code Assistant", action: "Segment added", user: "ai-team@co.com", timestamp: "2026-02-15 11:00", detail: "Added 'Enterprise Accounts' segment to targeting" },
];

function statusBadge(s: GateStatus) {
  if (s === "enabled") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "disabled") {return "bg-zinc-600 text-zinc-400";}
  return "bg-amber-400/10 text-amber-400";
}
function typeBadge(t: GateType) {
  const colors: Record<GateType, string> = {
    boolean: "bg-zinc-700 text-zinc-300",
    percentage: "bg-indigo-500/20 text-indigo-300",
    "user-list": "bg-blue-500/20 text-blue-300",
    segment: "bg-purple-500/20 text-purple-300",
    schedule: "bg-orange-500/20 text-orange-300",
  };
  return colors[t];
}
function envBadge(e: Environment) {
  if (e === "production") {return "bg-rose-500/10 text-rose-400";}
  if (e === "staging") {return "bg-amber-500/10 text-amber-400";}
  return "bg-blue-500/10 text-blue-400";
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-full flex items-end">
      <div className={cn("w-full rounded-t", color)} style={{ height: `${pct}%`, minHeight: 2 }} />
    </div>
  );
}

export default function FeatureGatingDashboard() {
  const [tab, setTab] = useState<"gates" | "segments" | "analytics" | "events">("gates");
  const [selectedGate, setSelectedGate] = useState<FeatureGate | null>(null);
  const [filterStatus, setFilterStatus] = useState<GateStatus | "all">("all");
  const [filterEnv, setFilterEnv] = useState<Environment | "all">("all");
  const [filterType, setFilterType] = useState<GateType | "all">("all");

  const filtered = GATES.filter(g => {
    if (filterStatus !== "all" && g.status !== filterStatus) {return false;}
    if (filterEnv !== "all" && g.environment !== filterEnv) {return false;}
    if (filterType !== "all" && g.type !== filterType) {return false;}
    return true;
  });

  const enabledCount = GATES.filter(g => g.status === "enabled").length;
  const partialCount = GATES.filter(g => g.status === "partial").length;
  const disabledCount = GATES.filter(g => g.status === "disabled").length;
  const totalEvaluations = GATES.reduce((s, g) => s + g.evaluations, 0);
  const maxEval = Math.max(...EVAL_HISTORY.map(e => e.trueCount + e.falseCount));

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "gates", label: `Gates (${GATES.length})` },
    { id: "segments", label: "Segments" },
    { id: "analytics", label: "Analytics" },
    { id: "events", label: "Change Log" },
  ];

  const segmentMap = Object.fromEntries(SEGMENTS.map(s => [s.id, s]));

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Feature Gating Dashboard</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage feature flags, rollouts, and user targeting across environments</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors">SDK Docs</button>
          <button className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">+ New Gate</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Enabled Gates</div>
          <div className="text-2xl font-bold text-emerald-400">{enabledCount}</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Partial Rollout</div>
          <div className="text-2xl font-bold text-amber-400">{partialCount}</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Disabled</div>
          <div className="text-2xl font-bold text-zinc-400">{disabledCount}</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Total Evaluations</div>
          <div className="text-2xl font-bold text-white">{(totalEvaluations / 1000000).toFixed(1)}M</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedGate(null); }}
            className={cn("px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px", tab === t.id ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Gates list */}
      {tab === "gates" && !selectedGate && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as GateStatus | "all")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200">
              <option value="all">All Status</option>
              <option value="enabled">Enabled</option>
              <option value="partial">Partial</option>
              <option value="disabled">Disabled</option>
            </select>
            <select value={filterEnv} onChange={e => setFilterEnv(e.target.value as Environment | "all")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200">
              <option value="all">All Environments</option>
              <option value="production">Production</option>
              <option value="staging">Staging</option>
              <option value="development">Development</option>
            </select>
            <select value={filterType} onChange={e => setFilterType(e.target.value as GateType | "all")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200">
              <option value="all">All Types</option>
              <option value="boolean">Boolean</option>
              <option value="percentage">Percentage</option>
              <option value="segment">Segment</option>
              <option value="user-list">User List</option>
              <option value="schedule">Schedule</option>
            </select>
          </div>

          <div className="space-y-3">
            {filtered.map(gate => (
              <div
                key={gate.id}
                onClick={() => setSelectedGate(gate)}
                className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-600 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-zinc-100">{gate.name}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", statusBadge(gate.status))}>{gate.status}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", typeBadge(gate.type))}>{gate.type.replace("-", " ")}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", envBadge(gate.environment))}>{gate.environment}</span>
                    </div>
                    <div className="text-xs text-zinc-500 font-mono">{gate.key}</div>
                    <div className="text-xs text-zinc-400 mt-1">{gate.description}</div>
                  </div>
                  <div className="text-right">
                    {gate.type === "percentage" && (
                      <div className="text-2xl font-bold text-white">{gate.rolloutPercent}%</div>
                    )}
                    {gate.type === "boolean" && (
                      <div className={cn("text-2xl font-bold", gate.status === "enabled" ? "text-emerald-400" : "text-zinc-500")}>
                        {gate.status === "enabled" ? "ON" : "OFF"}
                      </div>
                    )}
                    {gate.type === "segment" && (
                      <div className="text-sm text-purple-300">{gate.targetSegments.length} segments</div>
                    )}
                    {gate.type === "user-list" && (
                      <div className="text-sm text-blue-300">{gate.targetUsers.length} users</div>
                    )}
                    {gate.type === "schedule" && gate.schedule && (
                      <div className="text-xs text-orange-300 text-right">
                        <div>{gate.schedule.start}</div>
                        <div>→ {gate.schedule.end}</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs text-zinc-500 mt-2">
                  <div className="flex gap-3">
                    <span>{gate.evaluations.toLocaleString()} evals</span>
                    <span className="text-emerald-400">{gate.truePercent}% true</span>
                  </div>
                  <div className="flex gap-1">
                    {gate.tags.map(t => <span key={t} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{t}</span>)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gate Detail */}
      {tab === "gates" && selectedGate && (
        <div>
          <button onClick={() => setSelectedGate(null)} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 mb-4 transition-colors">
            ← Back to gates
          </button>

          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-xl font-bold text-white">{selectedGate.name}</h2>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", statusBadge(selectedGate.status))}>{selectedGate.status}</span>
                  </div>
                  <div className="text-xs text-zinc-400 font-mono mb-2">{selectedGate.key}</div>
                  <div className="flex gap-2 flex-wrap">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", typeBadge(selectedGate.type))}>{selectedGate.type.replace("-", " ")}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", envBadge(selectedGate.environment))}>{selectedGate.environment}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-colors">Enable</button>
                  <button className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 rounded-lg text-zinc-300 transition-colors">Disable</button>
                </div>
              </div>
              <p className="text-sm text-zinc-300 mb-4">{selectedGate.description}</p>
              <div className="space-y-2 text-xs">
                {[
                  { label: "Owner", value: selectedGate.owner },
                  { label: "Created", value: selectedGate.createdAt },
                  { label: "Updated", value: selectedGate.updatedAt },
                  { label: "Strategy", value: selectedGate.strategy },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-zinc-500">{row.label}</span>
                    <span className="text-zinc-300">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Evaluation Stats</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-white">{selectedGate.evaluations.toLocaleString()}</div>
                  <div className="text-xs text-zinc-500">total evaluations</div>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-emerald-400">{selectedGate.truePercent}%</div>
                  <div className="text-xs text-zinc-500">returning true</div>
                </div>
              </div>
              {selectedGate.type === "percentage" && (
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">Rollout</span>
                    <span className="text-white">{selectedGate.rolloutPercent}%</span>
                  </div>
                  <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${selectedGate.rolloutPercent}%` }} />
                  </div>
                </div>
              )}
              {selectedGate.schedule && (
                <div className="mt-3 p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
                  <div className="text-xs text-orange-300 font-medium mb-1">Scheduled Window</div>
                  <div className="text-xs text-zinc-300">{selectedGate.schedule.start} → {selectedGate.schedule.end}</div>
                  <div className="text-xs text-zinc-500">{selectedGate.schedule.timezone}</div>
                </div>
              )}
            </div>
          </div>

          {/* Targeting */}
          {(selectedGate.targetSegments.length > 0 || selectedGate.targetUsers.length > 0) && (
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 mb-5">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Targeting</h3>
              {selectedGate.targetSegments.length > 0 && (
                <div className="mb-4">
                  <div className="text-xs text-zinc-500 mb-2">Segments</div>
                  <div className="space-y-2">
                    {selectedGate.targetSegments.map(sid => {
                      const seg = segmentMap[sid];
                      return seg ? (
                        <div key={sid} className="flex justify-between items-center p-3 bg-zinc-800 rounded-lg">
                          <div>
                            <div className="text-sm text-zinc-200">{seg.name}</div>
                            <div className="text-xs text-zinc-500">{seg.criteria}</div>
                          </div>
                          <div className="text-sm text-indigo-400">{seg.size.toLocaleString()} users</div>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
              {selectedGate.targetUsers.length > 0 && (
                <div>
                  <div className="text-xs text-zinc-500 mb-2">Specific Users</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedGate.targetUsers.map(u => (
                      <span key={u} className="text-xs px-2 py-1 bg-zinc-800 rounded-lg text-zinc-300">{u}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedGate.dependsOn.length > 0 && (
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-300 mb-3">Dependencies</h3>
              <div className="flex flex-wrap gap-2">
                {selectedGate.dependsOn.map(dep => (
                  <span key={dep} className="text-xs px-2 py-1 bg-amber-500/10 text-amber-300 rounded-lg font-mono">{dep}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Segments */}
      {tab === "segments" && (
        <div className="space-y-3">
          {SEGMENTS.map(seg => {
            const activeGates = GATES.filter(g => g.targetSegments.includes(seg.id));
            return (
              <div key={seg.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium text-zinc-100">{seg.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">{seg.criteria}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-bold text-indigo-400">{seg.size.toLocaleString()}</div>
                    <div className="text-xs text-zinc-500">users</div>
                  </div>
                </div>
                {activeGates.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <div className="text-xs text-zinc-500 mb-2">Used by {activeGates.length} gate{activeGates.length !== 1 ? "s" : ""}:</div>
                    <div className="flex flex-wrap gap-1">
                      {activeGates.map(g => (
                        <span key={g.id} className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-mono">{g.key}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Analytics */}
      {tab === "analytics" && (
        <div className="space-y-6">
          {/* Evaluation chart */}
          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">Hourly Evaluations (Today)</h3>
            <div className="flex items-end gap-2" style={{ height: 100 }}>
              {EVAL_HISTORY.map(pt => {
                const total = pt.trueCount + pt.falseCount;
                const totalPct = (total / maxEval) * 100;
                const truePct = (pt.trueCount / total) * 100;
                return (
                  <div key={pt.time} className="flex flex-col items-center gap-1 flex-1">
                    <div className="w-full flex items-end" style={{ height: 80 }}>
                      <div className="w-full relative rounded-t overflow-hidden bg-zinc-700" style={{ height: `${totalPct}%`, minHeight: 4 }}>
                        <div className="absolute bottom-0 left-0 w-full bg-emerald-500 rounded-t" style={{ height: `${truePct}%` }} />
                      </div>
                    </div>
                    <span className="text-[10px] text-zinc-500">{pt.time}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-zinc-500">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" />True</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-zinc-700 inline-block" />False</span>
            </div>
          </div>

          {/* Per-gate usage */}
          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">Gate Evaluation Volume</h3>
            <div className="space-y-3">
              {[...GATES].toSorted((a, b) => b.evaluations - a.evaluations).map(g => {
                const maxEv = GATES[0].evaluations;
                const pct = Math.min(100, (g.evaluations / maxEv) * 100);
                return (
                  <div key={g.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-zinc-300 font-mono">{g.key}</span>
                      <span className="text-zinc-400">{g.evaluations.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Change Log */}
      {tab === "events" && (
        <div className="space-y-3">
          {EVENTS.map(ev => (
            <div key={ev.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-zinc-200">{ev.gateName}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400">{ev.action}</span>
                </div>
                <span className="text-xs text-zinc-500">{ev.timestamp}</span>
              </div>
              <div className="text-xs text-zinc-500 mb-1">by {ev.user}</div>
              <div className="text-sm text-zinc-300">{ev.detail}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
