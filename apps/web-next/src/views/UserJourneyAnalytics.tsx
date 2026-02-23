import React, { useState } from "react";
import { cn } from "../lib/utils";

type JourneyStage = "awareness" | "activation" | "engagement" | "retention" | "revenue" | "referral";
type DropReason = "friction" | "confusion" | "value-gap" | "technical" | "competitor" | "unknown";
type TrendDir = "up" | "down" | "flat";
type Segment = "all" | "new" | "returning" | "power" | "churned";
type Platform = "web" | "mobile" | "api";

interface JourneyStep {
  id: string;
  stage: JourneyStage;
  name: string;
  users: number;
  conversionRate: number;
  dropRate: number;
  avgTimeSeconds: number;
  topDropReason: DropReason;
  trend: TrendDir;
  trendPct: number;
}

interface SessionPath {
  path: string;
  sessions: number;
  pct: number;
  avgDuration: number;
  completedGoal: boolean;
}

interface RetentionCohort {
  week: string;
  day0: number;
  day7: number;
  day14: number;
  day21: number;
  day28: number;
}

interface FunnelMetric {
  label: string;
  value: string;
  subValue: string;
  trend: TrendDir;
  trendPct: number;
  color: string;
}

const JOURNEY_STEPS: JourneyStep[] = [
  { id: "j1", stage: "awareness", name: "Landing Page Visit", users: 48200, conversionRate: 100, dropRate: 0, avgTimeSeconds: 42, topDropReason: "unknown", trend: "up", trendPct: 12 },
  { id: "j2", stage: "activation", name: "Sign Up Started", users: 9640, conversionRate: 20.0, dropRate: 80, avgTimeSeconds: 95, topDropReason: "friction", trend: "up", trendPct: 8 },
  { id: "j3", stage: "activation", name: "Email Verified", users: 7712, conversionRate: 80.0, dropRate: 20, avgTimeSeconds: 180, topDropReason: "technical", trend: "flat", trendPct: 0.2 },
  { id: "j4", stage: "activation", name: "Onboarding Completed", users: 5398, conversionRate: 70.0, dropRate: 30, avgTimeSeconds: 420, topDropReason: "confusion", trend: "down", trendPct: 4 },
  { id: "j5", stage: "engagement", name: "First API Call", users: 4858, conversionRate: 90.0, dropRate: 10, avgTimeSeconds: 210, topDropReason: "technical", trend: "up", trendPct: 15 },
  { id: "j6", stage: "engagement", name: "Integration Connected", users: 2914, conversionRate: 60.0, dropRate: 40, avgTimeSeconds: 890, topDropReason: "value-gap", trend: "down", trendPct: 6 },
  { id: "j7", stage: "retention", name: "Day 7 Active", users: 2040, conversionRate: 70.0, dropRate: 30, avgTimeSeconds: 0, topDropReason: "value-gap", trend: "flat", trendPct: 1 },
  { id: "j8", stage: "revenue", name: "Upgraded to Paid", users: 612, conversionRate: 30.0, dropRate: 70, avgTimeSeconds: 0, topDropReason: "value-gap", trend: "up", trendPct: 22 },
  { id: "j9", stage: "referral", name: "Invited Team Member", users: 245, conversionRate: 40.0, dropRate: 60, avgTimeSeconds: 0, topDropReason: "unknown", trend: "up", trendPct: 35 },
];

const SESSION_PATHS: SessionPath[] = [
  { path: "Home → Features → Pricing → Sign Up", sessions: 2840, pct: 22.4, avgDuration: 185, completedGoal: true },
  { path: "Home → Sign Up", sessions: 1920, pct: 15.1, avgDuration: 42, completedGoal: true },
  { path: "Blog → Features → Sign Up", sessions: 1540, pct: 12.1, avgDuration: 320, completedGoal: true },
  { path: "Home → Pricing → Bounce", sessions: 1380, pct: 10.9, avgDuration: 28, completedGoal: false },
  { path: "Home → Docs → Sign Up", sessions: 980, pct: 7.7, avgDuration: 540, completedGoal: true },
  { path: "Home → Demo → Sign Up", sessions: 760, pct: 6.0, avgDuration: 680, completedGoal: true },
  { path: "Direct → Sign Up → Bounce", sessions: 620, pct: 4.9, avgDuration: 15, completedGoal: false },
];

const RETENTION: RetentionCohort[] = [
  { week: "Jan W1", day0: 100, day7: 64, day14: 48, day21: 41, day28: 38 },
  { week: "Jan W2", day0: 100, day7: 67, day14: 51, day21: 43, day28: 40 },
  { week: "Jan W3", day0: 100, day7: 65, day14: 49, day21: 42, day28: 39 },
  { week: "Jan W4", day0: 100, day7: 69, day14: 54, day21: 46, day28: 43 },
  { week: "Feb W1", day0: 100, day7: 71, day14: 55, day21: 47, day28: null as unknown as number },
  { week: "Feb W2", day0: 100, day7: 72, day14: 56, day21: null as unknown as number, day28: null as unknown as number },
  { week: "Feb W3", day0: 100, day7: 74, day14: null as unknown as number, day21: null as unknown as number, day28: null as unknown as number },
];

const FUNNEL_METRICS: FunnelMetric[] = [
  { label: "Total Visitors", value: "48.2K", subValue: "This month", trend: "up", trendPct: 12, color: "text-zinc-100" },
  { label: "Sign-Up Rate", value: "20.0%", subValue: "9.6K users", trend: "up", trendPct: 8, color: "text-indigo-400" },
  { label: "Activation Rate", value: "56.0%", subValue: "5.4K users", trend: "down", trendPct: 4, color: "text-amber-400" },
  { label: "Paid Conversion", value: "11.3%", subValue: "612 paying", trend: "up", trendPct: 22, color: "text-emerald-400" },
];

function stageBg(s: JourneyStage) {
  const m: Record<JourneyStage, string> = {
    awareness: "bg-zinc-700 text-zinc-300",
    activation: "bg-indigo-500/10 text-indigo-400",
    engagement: "bg-cyan-500/10 text-cyan-400",
    retention: "bg-emerald-500/10 text-emerald-400",
    revenue: "bg-amber-500/10 text-amber-400",
    referral: "bg-purple-500/10 text-purple-400",
  };
  return m[s];
}
function dropReasonBg(r: DropReason) {
  if (r === "friction") {return "bg-orange-500/10 text-orange-400";}
  if (r === "confusion") {return "bg-amber-500/10 text-amber-400";}
  if (r === "technical") {return "bg-rose-500/10 text-rose-400";}
  if (r === "value-gap") {return "bg-indigo-500/10 text-indigo-400";}
  if (r === "competitor") {return "bg-red-500/10 text-red-400";}
  return "bg-zinc-700 text-zinc-300";
}
function trendColor(t: TrendDir) {
  if (t === "up") {return "text-emerald-400";}
  if (t === "down") {return "text-rose-400";}
  return "text-zinc-400";
}
function trendArrow(t: TrendDir) {
  if (t === "up") {return "↑";}
  if (t === "down") {return "↓";}
  return "→";
}
function retentionColor(v: number | null) {
  if (v === null) {return "bg-zinc-800 text-zinc-600";}
  if (v >= 60) {return "bg-emerald-700/60 text-emerald-300";}
  if (v >= 40) {return "bg-indigo-700/60 text-indigo-300";}
  if (v >= 25) {return "bg-amber-700/60 text-amber-300";}
  return "bg-zinc-700 text-zinc-400";
}

export default function UserJourneyAnalytics() {
  const [tab, setTab] = useState<"funnel" | "paths" | "retention" | "segments">("funnel");
  const [segment, setSegment] = useState<Segment>("all");
  const [platform, setPlatform] = useState<Platform | "all">("all");

  const maxUsers = JOURNEY_STEPS[0].users;

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">User Journey Analytics</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Funnel analysis, path exploration, and retention cohorts</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={platform}
            onChange={e => setPlatform(e.target.value as Platform | "all")}
            className="bg-zinc-800 text-sm rounded-lg px-2 py-1.5 text-zinc-300 outline-none"
          >
            <option value="all">All Platforms</option>
            <option value="web">Web</option>
            <option value="mobile">Mobile</option>
            <option value="api">API</option>
          </select>
          <select
            value={segment}
            onChange={e => setSegment(e.target.value as Segment)}
            className="bg-zinc-800 text-sm rounded-lg px-2 py-1.5 text-zinc-300 outline-none"
          >
            <option value="all">All Users</option>
            <option value="new">New Users</option>
            <option value="returning">Returning</option>
            <option value="power">Power Users</option>
            <option value="churned">Churned</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 px-6">
        <div className="flex gap-6">
          {(["funnel", "paths", "retention", "segments"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "py-3 text-sm font-medium border-b-2 capitalize transition-colors",
                tab === t ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {/* FUNNEL TAB */}
        {tab === "funnel" && (
          <div className="p-6">
            {/* Summary metrics */}
            <div className="grid grid-cols-4 gap-4 mb-6">
              {FUNNEL_METRICS.map((m, i) => (
                <div key={i} className="bg-zinc-900 rounded-xl p-5">
                  <div className={cn("text-2xl font-bold", m.color)}>{m.value}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{m.label}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{m.subValue}</div>
                  <div className={cn("text-xs mt-1", trendColor(m.trend))}>
                    {trendArrow(m.trend)} {m.trendPct}% vs last month
                  </div>
                </div>
              ))}
            </div>

            {/* Funnel visualization */}
            <div className="bg-zinc-900 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Conversion Funnel</h3>
              <div className="space-y-2">
                {JOURNEY_STEPS.map((step, i) => {
                  const width = (step.users / maxUsers) * 100;
                  return (
                    <div key={step.id} className="group">
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-40 text-xs text-zinc-400 truncate">{step.name}</div>
                        <div className="flex-1 relative">
                          <div className="h-7 bg-zinc-800 rounded overflow-hidden">
                            <div
                              className={cn("h-full rounded flex items-center px-2",
                                i === 0 ? "bg-indigo-600" : width > 60 ? "bg-indigo-600" : width > 30 ? "bg-indigo-700" : "bg-indigo-800"
                              )}
                              style={{ width: `${width}%` }}
                            >
                              <span className="text-xs text-white font-medium whitespace-nowrap">
                                {step.users.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="w-16 text-right">
                          <div className="text-xs text-zinc-300">{i === 0 ? "—" : `${step.conversionRate.toFixed(0)}%`}</div>
                        </div>
                        <div className="w-16 text-right">
                          <span className={cn("text-xs px-1.5 py-0.5 rounded", stageBg(step.stage))}>{step.stage}</span>
                        </div>
                        <div className={cn("text-xs w-16 text-right", trendColor(step.trend))}>
                          {trendArrow(step.trend)} {step.trendPct}%
                        </div>
                      </div>
                      {step.dropRate > 0 && i > 0 && (
                        <div className="flex items-center gap-3 mb-1">
                          <div className="w-40" />
                          <div className="flex-1 flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-rose-500/50" />
                            <span className="text-xs text-rose-400/70">{step.dropRate.toFixed(0)}% drop-off</span>
                            <span className={cn("text-xs px-1.5 py-0.5 rounded", dropReasonBg(step.topDropReason))}>
                              {step.topDropReason}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* PATHS TAB */}
        {tab === "paths" && (
          <div className="p-6">
            <div className="bg-zinc-900 rounded-xl overflow-hidden">
              <div className="px-5 py-4 border-b border-zinc-800">
                <h3 className="text-sm font-medium text-zinc-300">Top User Paths to Conversion</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Most common sequences leading to sign-up</p>
              </div>
              <div className="divide-y divide-zinc-800">
                {SESSION_PATHS.map((sp, i) => (
                  <div key={i} className="px-5 py-4 hover:bg-zinc-800/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-zinc-200 font-mono text-xs bg-zinc-800 px-2 py-0.5 rounded">{sp.path}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span>{sp.sessions.toLocaleString()} sessions</span>
                          <span>~{sp.avgDuration}s avg</span>
                          <span className={sp.completedGoal ? "text-emerald-400" : "text-rose-400"}>
                            {sp.completedGoal ? "✓ Converts" : "✗ Bounces"}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-medium text-zinc-100">{sp.pct}%</div>
                        <div className="text-xs text-zinc-500">of sessions</div>
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", sp.completedGoal ? "bg-emerald-500" : "bg-rose-500")}
                        style={{ width: `${sp.pct * 3}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* RETENTION TAB */}
        {tab === "retention" && (
          <div className="p-6">
            <div className="bg-zinc-900 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-300 mb-1">Retention Cohort Analysis</h3>
              <p className="text-xs text-zinc-500 mb-4">% of users still active at Day N since signup</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left text-xs text-zinc-400 font-medium pb-2 pr-4">Cohort</th>
                      <th className="text-center text-xs text-zinc-400 font-medium pb-2 px-2">Day 0</th>
                      <th className="text-center text-xs text-zinc-400 font-medium pb-2 px-2">Day 7</th>
                      <th className="text-center text-xs text-zinc-400 font-medium pb-2 px-2">Day 14</th>
                      <th className="text-center text-xs text-zinc-400 font-medium pb-2 px-2">Day 21</th>
                      <th className="text-center text-xs text-zinc-400 font-medium pb-2 px-2">Day 28</th>
                    </tr>
                  </thead>
                  <tbody>
                    {RETENTION.map((row, i) => (
                      <tr key={i}>
                        <td className="text-xs text-zinc-400 pr-4 py-1">{row.week}</td>
                        {[row.day0, row.day7, row.day14, row.day21, row.day28].map((v, j) => (
                          <td key={j} className="px-2 py-1">
                            <div className={cn(
                              "text-xs text-center px-2 py-1 rounded font-medium",
                              retentionColor(v)
                            )}>
                              {v !== null && !isNaN(v) ? `${v}%` : "—"}
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex gap-4 text-xs text-zinc-500">
                <span><span className="inline-block w-3 h-3 bg-emerald-700/60 rounded mr-1" />≥ 60%</span>
                <span><span className="inline-block w-3 h-3 bg-indigo-700/60 rounded mr-1" />40–60%</span>
                <span><span className="inline-block w-3 h-3 bg-amber-700/60 rounded mr-1" />25–40%</span>
                <span><span className="inline-block w-3 h-3 bg-zinc-700 rounded mr-1" />&lt; 25%</span>
              </div>
            </div>
          </div>
        )}

        {/* SEGMENTS TAB */}
        {tab === "segments" && (
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: "New Users", count: "2,841", icon: "✨", desc: "First visit in last 30 days", convRate: "18.2%", retDay7: "52%" },
                { name: "Returning Users", count: "8,240", icon: "🔄", desc: "Visited 2+ times, not converted", convRate: "24.8%", retDay7: "71%" },
                { name: "Power Users", count: "612", icon: "⚡", desc: "Paid plan, daily active", convRate: "100%", retDay7: "89%" },
                { name: "Churned Users", count: "1,180", icon: "💤", desc: "Active before, inactive 30+ days", convRate: "3.1%", retDay7: "18%" },
              ].map((seg, i) => (
                <div key={i} className="bg-zinc-900 rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl">{seg.icon}</span>
                    <div>
                      <div className="text-sm font-medium text-zinc-100">{seg.name}</div>
                      <div className="text-xs text-zinc-500">{seg.desc}</div>
                    </div>
                    <div className="ml-auto text-xl font-bold text-indigo-400">{seg.count}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <div className="text-zinc-100 font-medium">{seg.convRate}</div>
                      <div className="text-xs text-zinc-500">Conversion Rate</div>
                    </div>
                    <div className="bg-zinc-800 rounded-lg p-3">
                      <div className="text-zinc-100 font-medium">{seg.retDay7}</div>
                      <div className="text-xs text-zinc-500">Day 7 Retention</div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: seg.retDay7 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 bg-zinc-900 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-300 mb-4">Drop-off Reasons by Stage</h3>
              <div className="space-y-3">
                {(["friction", "confusion", "value-gap", "technical", "competitor"] as DropReason[]).map((reason, i) => {
                  const steps = JOURNEY_STEPS.filter(s => s.topDropReason === reason);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded w-24 text-center", dropReasonBg(reason))}>{reason}</span>
                      <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(steps.length / JOURNEY_STEPS.length) * 100}%` }} />
                      </div>
                      <span className="text-xs text-zinc-500 w-16 text-right">{steps.length} step{steps.length > 1 ? "s" : ""}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
