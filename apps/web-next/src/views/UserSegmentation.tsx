import React, { useState } from "react";
import { cn } from "../lib/utils";

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface Segment {
  id: string;
  name: string;
  description: string;
  color: string;
  conditions: Condition[];
  userCount: number;
  percentage: number;
  trend: number;
  tags: string[];
  lastUpdated: string;
}

interface SegmentUser {
  id: string;
  name: string;
  email: string;
  plan: string;
  country: string;
  joinDate: string;
  segments: string[];
}

const SEGMENTS: Segment[] = [
  {
    id: "s1", name: "Power Users", description: "High-frequency users with >100 API calls/day",
    color: "bg-indigo-500", tags: ["engagement", "retention"],
    conditions: [
      { field: "api_calls_daily",  operator: "greater_than", value: "100" },
      { field: "account_age_days", operator: "greater_than", value: "30"  },
      { field: "plan",             operator: "in",           value: "pro,enterprise" },
    ],
    userCount: 2841, percentage: 5.9, trend: 12.4, lastUpdated: "2026-02-22",
  },
  {
    id: "s2", name: "At-Risk Churners", description: "Active users showing declining engagement",
    color: "bg-rose-500", tags: ["churn", "intervention"],
    conditions: [
      { field: "days_since_login",  operator: "greater_than", value: "14"  },
      { field: "api_calls_30d",     operator: "less_than",    value: "50"  },
      { field: "subscription_days", operator: "greater_than", value: "60"  },
    ],
    userCount: 1243, percentage: 2.6, trend: -8.1, lastUpdated: "2026-02-21",
  },
  {
    id: "s3", name: "Enterprise Prospects", description: "Pro users nearing plan limits",
    color: "bg-amber-500", tags: ["upsell", "sales"],
    conditions: [
      { field: "plan",             operator: "equals",       value: "pro"  },
      { field: "api_usage_pct",    operator: "greater_than", value: "80"   },
      { field: "team_size",        operator: "greater_than", value: "5"    },
    ],
    userCount: 891, percentage: 1.8, trend: 23.7, lastUpdated: "2026-02-22",
  },
  {
    id: "s4", name: "New Signups (7d)", description: "Users who signed up in the last 7 days",
    color: "bg-emerald-500", tags: ["onboarding", "activation"],
    conditions: [
      { field: "account_age_days", operator: "less_than",    value: "7"   },
    ],
    userCount: 3201, percentage: 6.6, trend: 4.2, lastUpdated: "2026-02-22",
  },
  {
    id: "s5", name: "Dormant (90d)", description: "Users inactive for 90+ days",
    color: "bg-zinc-500", tags: ["re-engagement", "cleanup"],
    conditions: [
      { field: "days_since_login",  operator: "greater_than", value: "90" },
    ],
    userCount: 8920, percentage: 18.4, trend: -2.1, lastUpdated: "2026-02-20",
  },
  {
    id: "s6", name: "GDPR Region (EU)", description: "Users in European Union countries",
    color: "bg-blue-500", tags: ["compliance", "gdpr"],
    conditions: [
      { field: "country",          operator: "in",           value: "DE,FR,IT,ES,NL,PL,SE,BE" },
    ],
    userCount: 11240, percentage: 23.2, trend: 1.8, lastUpdated: "2026-02-22",
  },
];

const SEGMENT_USERS: SegmentUser[] = [
  { id: "u1", name: "Alice Chen",    email: "alice@corp.io",   plan: "enterprise", country: "US", joinDate: "2024-01-15", segments: ["s1","s3"] },
  { id: "u2", name: "Bob Müller",    email: "bob@firma.de",    plan: "pro",        country: "DE", joinDate: "2024-03-02", segments: ["s1","s6"] },
  { id: "u3", name: "Carol Smith",   email: "carol@co.uk",     plan: "starter",    country: "GB", joinDate: "2025-11-10", segments: ["s2"] },
  { id: "u4", name: "David Park",    email: "david@corp.io",   plan: "pro",        country: "KR", joinDate: "2024-06-22", segments: ["s3"] },
  { id: "u5", name: "Eve Dubois",    email: "eve@société.fr",  plan: "enterprise", country: "FR", joinDate: "2023-09-14", segments: ["s1","s6"] },
  { id: "u6", name: "Frank Russo",   email: "frank@it.co",     plan: "starter",    country: "IT", joinDate: "2026-02-18", segments: ["s4","s6"] },
  { id: "u7", name: "Grace Wilson",  email: "grace@labs.io",   plan: "pro",        country: "AU", joinDate: "2025-06-01", segments: ["s2","s5"] },
  { id: "u8", name: "Henry Lopes",   email: "henry@br.com",    plan: "pro",        country: "BR", joinDate: "2024-08-30", segments: ["s3"] },
];

const FIELDS = ["plan","country","api_calls_daily","api_calls_30d","days_since_login","account_age_days","team_size","api_usage_pct","subscription_days"];
const OPERATORS = ["equals","not_equals","greater_than","less_than","in","not_in","contains"];

const CONDITION_TEMPLATES = [
  { field: "plan",              operator: "in",           value: "pro,enterprise" },
  { field: "days_since_login",  operator: "greater_than", value: "30"  },
  { field: "api_usage_pct",     operator: "greater_than", value: "80"  },
];

type Tab = "segments" | "builder" | "users" | "overlap";

export default function UserSegmentation() {
  const [activeTab, setActiveTab] = useState<Tab>("segments");
  const [selectedSegment, setSelectedSegment] = useState<Segment | null>(null);
  const [builderConditions, setBuilderConditions] = useState<Condition[]>([...CONDITION_TEMPLATES]);
  const [builderName, setBuilderName] = useState("New Segment");
  const [sortBy, setSortBy] = useState<"count" | "pct" | "trend">("count");

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "segments", label: "Segments",      emoji: "🎯" },
    { id: "builder",  label: "Builder",        emoji: "🔧" },
    { id: "users",    label: "User Lookup",    emoji: "👤" },
    { id: "overlap",  label: "Overlap Matrix", emoji: "⚡" },
  ];

  const sortedSegments = [...SEGMENTS].sort((a, b) => {
    if (sortBy === "count") return b.userCount - a.userCount;
    if (sortBy === "pct")   return b.percentage - a.percentage;
    return Math.abs(b.trend) - Math.abs(a.trend);
  });

  const totalUsers = 48410;

  const addCondition = () => {
    setBuilderConditions(prev => [...prev, { field: "plan", operator: "equals", value: "" }]);
  };

  const removeCondition = (i: number) => {
    setBuilderConditions(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateCondition = (i: number, key: keyof Condition, value: string) => {
    setBuilderConditions(prev => prev.map((c, idx) => idx === i ? { ...c, [key]: value } : c));
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">User Segmentation</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{SEGMENTS.length} segments · {totalUsers.toLocaleString()} total users</p>
        </div>
        <button
          onClick={() => setActiveTab("builder")}
          className="text-sm px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors"
        >
          + New Segment
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Segments",    value: SEGMENTS.length,                                          color: "text-indigo-400" },
          { label: "Largest Segment",   value: `${SEGMENTS.reduce((a,s)=>s.userCount>a.userCount?s:a).name}`, color: "text-white"     },
          { label: "Users Segmented",   value: `${Math.round((SEGMENTS.reduce((a,s)=>a+s.userCount,0)/totalUsers)*100)}%`, color: "text-emerald-400" },
          { label: "Avg Segment Size",  value: Math.round(SEGMENTS.reduce((a,s)=>a+s.userCount,0)/SEGMENTS.length).toLocaleString(), color: "text-amber-400" },
        ].map(card => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-400 mb-1">{card.label}</div>
            <div className={cn("text-lg font-bold truncate", card.color)}>{card.value}</div>
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

      {/* Segments Tab */}
      {activeTab === "segments" && (
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-zinc-400">Sort by:</span>
              {(["count","pct","trend"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded border capitalize transition-colors",
                    sortBy === s ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            {sortedSegments.map(seg => (
              <button
                key={seg.id}
                onClick={() => setSelectedSegment(seg)}
                className={cn(
                  "w-full bg-zinc-900 border rounded-lg p-4 text-left hover:border-zinc-600 transition-colors",
                  selectedSegment?.id === seg.id ? "border-indigo-500/50" : "border-zinc-800"
                )}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("w-2.5 h-2.5 rounded-full", seg.color)} />
                  <span className="text-sm font-medium text-white">{seg.name}</span>
                </div>
                <div className="text-xs text-zinc-400 mb-3">{seg.description}</div>

                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-zinc-400">{seg.userCount.toLocaleString()} users</span>
                    <span className="text-zinc-400">{seg.percentage}%</span>
                  </div>
                  <div className="w-full bg-zinc-800 rounded-full h-1.5">
                    <div className={cn("h-full rounded-full", seg.color)} style={{ width: `${seg.percentage * 3}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex flex-wrap gap-1">
                    {seg.tags.map(t => (
                      <span key={t} className="text-xs bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                  <span className={cn("text-xs font-medium", seg.trend > 0 ? "text-emerald-400" : "text-rose-400")}>
                    {seg.trend > 0 ? "↑" : "↓"}{Math.abs(seg.trend)}%
                  </span>
                </div>
              </button>
            ))}
          </div>

          <div className="col-span-3">
            {selectedSegment ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">
                <div className="flex items-center gap-3">
                  <span className={cn("w-4 h-4 rounded-full", selectedSegment.color)} />
                  <h3 className="text-base font-semibold text-white">{selectedSegment.name}</h3>
                  <span className={cn("text-xs ml-auto", selectedSegment.trend > 0 ? "text-emerald-400" : "text-rose-400")}>
                    {selectedSegment.trend > 0 ? "↑" : "↓"}{Math.abs(selectedSegment.trend)}% vs last week
                  </span>
                </div>

                <p className="text-sm text-zinc-400">{selectedSegment.description}</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <div className="text-xs text-zinc-400">Users</div>
                    <div className="text-2xl font-bold text-white mt-1">{selectedSegment.userCount.toLocaleString()}</div>
                  </div>
                  <div className="bg-zinc-800 rounded-lg p-3">
                    <div className="text-xs text-zinc-400">% of Total</div>
                    <div className="text-2xl font-bold text-indigo-400 mt-1">{selectedSegment.percentage}%</div>
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <div className="text-xs font-medium text-zinc-400 mb-2">Conditions ({selectedSegment.conditions.length})</div>
                  <div className="space-y-2">
                    {selectedSegment.conditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 bg-zinc-800 rounded p-2.5 text-xs">
                        <span className="text-zinc-300 font-mono">{c.field}</span>
                        <span className="text-zinc-500">{c.operator.replace(/_/g," ")}</span>
                        <span className="text-indigo-300 font-mono">{c.value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Bar chart — trend last 7 days */}
                <div>
                  <div className="text-xs font-medium text-zinc-400 mb-2">User count — last 7 days</div>
                  <div className="flex items-end gap-1 h-16 bg-zinc-800 rounded p-2">
                    {Array.from({ length: 7 }, (_, i) => {
                      const base = selectedSegment.userCount;
                      const v = base * (0.92 + (i / 7) * 0.16);
                      const pct = (v / (base * 1.1)) * 100;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                          <div className={cn("w-full rounded-t", selectedSegment.color)} style={{ height: `${pct}%` }} />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-2 border-t border-zinc-800">
                  <button className="flex-1 text-xs py-2 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded hover:bg-indigo-500/30 transition-colors">Export CSV</button>
                  <button className="flex-1 text-xs py-2 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-700 transition-colors">Create Campaign</button>
                  <button className="text-xs py-2 px-3 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-700 transition-colors">Edit</button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center text-zinc-500 text-sm">
                Select a segment to view details
              </div>
            )}
          </div>
        </div>
      )}

      {/* Builder */}
      {activeTab === "builder" && (
        <div className="max-w-xl space-y-5">
          <div>
            <label className="block text-xs text-zinc-400 mb-1.5">Segment Name</label>
            <input
              type="text"
              value={builderName}
              onChange={e => setBuilderName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-medium text-white">Conditions</div>
              <div className="text-xs text-zinc-400">Match <span className="text-indigo-300 font-semibold">ALL</span> conditions</div>
            </div>

            <div className="space-y-3">
              {builderConditions.map((cond, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex items-center gap-2">
                  <select
                    value={cond.field}
                    onChange={e => updateCondition(i, "field", e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none"
                  >
                    {FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={e => updateCondition(i, "operator", e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none"
                  >
                    {OPERATORS.map(o => <option key={o} value={o}>{o.replace(/_/g," ")}</option>)}
                  </select>
                  <input
                    type="text"
                    value={cond.value}
                    onChange={e => updateCondition(i, "value", e.target.value)}
                    placeholder="value"
                    className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-xs rounded px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                  />
                  <button onClick={() => removeCondition(i)} className="text-zinc-500 hover:text-rose-400 transition-colors text-lg leading-none">×</button>
                </div>
              ))}
            </div>

            <button
              onClick={addCondition}
              className="mt-3 w-full text-xs py-2 border border-dashed border-zinc-700 text-zinc-400 rounded hover:border-indigo-500/50 hover:text-indigo-300 transition-colors"
            >
              + Add Condition
            </button>
          </div>

          {/* Preview */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-xs font-medium text-zinc-400 mb-2">Estimated Audience</div>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-indigo-400">~3,200</div>
              <div className="text-xs text-zinc-400">users (6.6% of total)</div>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="px-4 py-2 bg-indigo-500 text-white text-sm rounded hover:bg-indigo-600 transition-colors">Save Segment</button>
            <button className="px-4 py-2 border border-zinc-700 text-zinc-400 text-sm rounded hover:bg-zinc-800 transition-colors">Preview Users</button>
          </div>
        </div>
      )}

      {/* Users */}
      {activeTab === "users" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-xs text-zinc-400">
                <th className="px-4 py-3 text-left font-medium">User</th>
                <th className="px-4 py-3 text-left font-medium">Plan</th>
                <th className="px-4 py-3 text-left font-medium">Country</th>
                <th className="px-4 py-3 text-left font-medium">Joined</th>
                <th className="px-4 py-3 text-left font-medium">Segments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {SEGMENT_USERS.map(u => (
                <tr key={u.id} className="hover:bg-zinc-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm text-white">{u.name}</div>
                    <div className="text-xs text-zinc-500">{u.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      "text-xs px-2 py-0.5 rounded border",
                      u.plan === "enterprise" ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" :
                      u.plan === "pro"        ? "bg-amber-500/10 border-amber-500/30 text-amber-300" :
                                               "bg-zinc-700 border-zinc-600 text-zinc-400"
                    )}>{u.plan}</span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">{u.country}</td>
                  <td className="px-4 py-3 text-zinc-400 text-xs">{u.joinDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.segments.map(sid => {
                        const seg = SEGMENTS.find(s => s.id === sid);
                        if (!seg) return null;
                        return (
                          <span key={sid} className={cn("text-xs text-white px-2 py-0.5 rounded", seg.color)}>
                            {seg.name}
                          </span>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Overlap Matrix */}
      {activeTab === "overlap" && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Segment Overlap Matrix</h3>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="w-32 pb-2" />
                    {SEGMENTS.map(s => (
                      <th key={s.id} className="px-2 pb-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className={cn("w-2 h-2 rounded-full", s.color)} />
                          <span className="text-zinc-400 truncate max-w-[60px]">{s.name}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {SEGMENTS.map((rowSeg, ri) => (
                    <tr key={rowSeg.id}>
                      <td className="py-2 pr-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className={cn("w-2 h-2 rounded-full", rowSeg.color)} />
                          <span className="text-zinc-400 truncate max-w-[80px]">{rowSeg.name}</span>
                        </div>
                      </td>
                      {SEGMENTS.map((colSeg, ci) => {
                        if (ri === ci) return (
                          <td key={colSeg.id} className="px-2 py-2 text-center">
                            <div className="bg-zinc-700 rounded text-zinc-300 py-1 px-2">—</div>
                          </td>
                        );
                        // simulate overlap
                        const overlap = ri < ci
                          ? Math.round((rowSeg.userCount * colSeg.userCount) / (totalUsers * 3))
                          : Math.round((rowSeg.userCount * colSeg.userCount) / (totalUsers * 3));
                        const pct = Math.round((overlap / Math.min(rowSeg.userCount, colSeg.userCount)) * 100);
                        return (
                          <td key={colSeg.id} className="px-2 py-2 text-center">
                            <div className={cn(
                              "rounded py-1 px-2 text-xs",
                              pct > 30 ? "bg-rose-500/20 text-rose-300" :
                              pct > 10 ? "bg-amber-500/20 text-amber-300" :
                                         "bg-zinc-800 text-zinc-400"
                            )}>
                              {pct}%
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-zinc-400">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-rose-500/20 rounded" /> &gt;30% overlap</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-500/20 rounded" /> 10–30% overlap</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-zinc-800 rounded" /> &lt;10% overlap</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
