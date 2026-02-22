import React, { useState } from "react";
import { cn } from "../lib/utils";

type Period = "month" | "quarter" | "ytd";
type CostCenter = "engineering" | "marketing" | "sales" | "support" | "data" | "infra";
type ServiceLine = "compute" | "ai" | "storage" | "network" | "saas";

interface TeamCost {
  id: string;
  team: string;
  department: CostCenter;
  budget: number;
  spent: number;
  forecast: number;
  topServices: string[];
  owner: string;
  trend: number;
}

interface ServiceCost {
  id: string;
  service: string;
  line: ServiceLine;
  cost: number;
  unit: string;
  unitCount: number;
  trend: number;
  topConsumers: string[];
}

interface CostAnomaly {
  id: string;
  team: string;
  service: string;
  expectedCost: number;
  actualCost: number;
  deviation: number;
  detectedAt: string;
  status: "open" | "acknowledged" | "resolved";
  rootCause: string;
}

interface Allocation {
  month: string;
  engineering: number;
  marketing: number;
  sales: number;
  support: number;
  data: number;
  infra: number;
}

const TEAM_COSTS: TeamCost[] = [
  { id: "t1", team: "Platform Engineering", department: "engineering", budget: 45000, spent: 38420, forecast: 42100, topServices: ["GKE Cluster", "Cloud SQL", "GCS"], owner: "alice", trend: 3.2 },
  { id: "t2", team: "ML / AI", department: "engineering", budget: 35000, spent: 41890, forecast: 48200, topServices: ["GPU VMs", "Vertex AI", "BigQuery"], owner: "bob", trend: 18.4 },
  { id: "t3", team: "Marketing Tech", department: "marketing", budget: 12000, spent: 9340, forecast: 10200, topServices: ["CDN", "Analytics", "Email API"], owner: "carol", trend: -4.1 },
  { id: "t4", team: "Sales Enablement", department: "sales", budget: 8000, spent: 7120, forecast: 7800, topServices: ["CRM API", "Video Conferencing"], owner: "dave", trend: 1.8 },
  { id: "t5", team: "Data Infrastructure", department: "data", budget: 28000, spent: 24670, forecast: 26800, topServices: ["BigQuery", "Pub/Sub", "Dataflow"], owner: "eve", trend: -2.3 },
  { id: "t6", team: "Customer Support", department: "support", budget: 5000, spent: 4210, forecast: 4700, topServices: ["Zendesk API", "Storage"], owner: "frank", trend: 0.5 },
  { id: "t7", team: "Core Infrastructure", department: "infra", budget: 18000, spent: 16840, forecast: 17200, topServices: ["VPC", "Load Balancers", "DNS"], owner: "grace", trend: -1.2 },
];

const SERVICE_COSTS: ServiceCost[] = [
  { id: "s1", service: "GKE / Kubernetes", line: "compute", cost: 28400, unit: "node-hours", unitCount: 142000, trend: 4.2, topConsumers: ["Platform Engineering", "ML/AI", "Data Infra"] },
  { id: "s2", service: "GPU Compute (A100)", line: "ai", cost: 18900, unit: "GPU-hours", unitCount: 945, trend: 22.1, topConsumers: ["ML / AI"] },
  { id: "s3", service: "Cloud SQL (Postgres)", line: "compute", cost: 12300, unit: "instance-hours", unitCount: 61500, trend: 1.8, topConsumers: ["Platform Engineering", "Data Infra"] },
  { id: "s4", service: "BigQuery", line: "ai", cost: 9840, unit: "TB scanned", unitCount: 492, trend: -8.3, topConsumers: ["Data Infra", "ML / AI", "Marketing"] },
  { id: "s5", service: "Cloud Storage (GCS)", line: "storage", cost: 4200, unit: "TB stored", unitCount: 84, trend: 6.1, topConsumers: ["Platform Engineering", "Data Infra"] },
  { id: "s6", service: "CDN / Load Balancing", line: "network", cost: 3100, unit: "GB transferred", unitCount: 15500, trend: 3.4, topConsumers: ["Marketing Tech", "Platform Engineering"] },
  { id: "s7", service: "Vertex AI", line: "ai", cost: 2800, unit: "prediction calls", unitCount: 1400000, trend: 31.2, topConsumers: ["ML / AI"] },
  { id: "s8", service: "Pub/Sub + Dataflow", line: "network", cost: 2400, unit: "messages", unitCount: 480000000, trend: -2.1, topConsumers: ["Data Infra"] },
];

const ANOMALIES: CostAnomaly[] = [
  { id: "a1", team: "ML / AI", service: "GPU Compute (A100)", expectedCost: 15200, actualCost: 18900, deviation: 24.3, detectedAt: "Today 06:00", status: "open", rootCause: "Training job runaway — no timeout set on experimental model run" },
  { id: "a2", team: "Platform Engineering", service: "Cloud SQL", expectedCost: 11800, actualCost: 12300, deviation: 4.2, detectedAt: "Yesterday 12:00", status: "acknowledged", rootCause: "Read replica scaling after traffic spike — expected" },
  { id: "a3", team: "Data Infrastructure", service: "BigQuery", expectedCost: 10700, actualCost: 9840, deviation: -8.0, detectedAt: "3d ago", status: "resolved", rootCause: "Partitioned table backfill completed — queries more efficient now" },
  { id: "a4", team: "ML / AI", service: "Vertex AI", expectedCost: 2100, actualCost: 2800, deviation: 33.3, detectedAt: "Today 08:30", status: "open", rootCause: "New real-time inference endpoint deployed without autoscaling limits" },
];

const MONTHLY_ALLOCATION: Allocation[] = [
  { month: "Aug", engineering: 62000, marketing: 8400, sales: 6800, support: 3900, data: 21000, infra: 15000 },
  { month: "Sep", engineering: 65000, marketing: 8900, sales: 7100, support: 4100, data: 22000, infra: 15500 },
  { month: "Oct", engineering: 68000, marketing: 9200, sales: 7300, support: 4000, data: 23000, infra: 16200 },
  { month: "Nov", engineering: 71000, marketing: 9800, sales: 7600, support: 4200, data: 24000, infra: 16500 },
  { month: "Dec", engineering: 73000, marketing: 10100, sales: 7900, support: 4300, data: 24500, infra: 17000 },
  { month: "Jan", engineering: 76000, marketing: 10800, sales: 7800, support: 4200, data: 24800, infra: 16800 },
  { month: "Feb", engineering: 80310, marketing: 9340, sales: 7120, support: 4210, data: 24670, infra: 16840 },
];

const deptColor: Record<CostCenter, string> = {
  engineering: "bg-indigo-500",
  marketing:   "bg-purple-500",
  sales:       "bg-amber-500",
  support:     "bg-sky-500",
  data:        "bg-emerald-500",
  infra:       "bg-zinc-500",
};

const lineIcon: Record<ServiceLine, string> = {
  compute: "🖥️", ai: "🤖", storage: "💾", network: "🌐", saas: "☁️",
};

const anomalyStatusBadge: Record<string, string> = {
  open:         "bg-rose-500/15 border-rose-500/30 text-rose-400",
  acknowledged: "bg-amber-500/15 border-amber-500/30 text-amber-400",
  resolved:     "bg-emerald-500/10 border-emerald-500/25 text-emerald-400",
};

export default function CostAttributionDashboard() {
  const [tab, setTab] = useState<"teams" | "services" | "anomalies" | "trend">("teams");
  const [period, setPeriod] = useState<Period>("month");
  const [selected, setSelected] = useState<TeamCost | null>(TEAM_COSTS[0]);

  const totalSpent = TEAM_COSTS.reduce((s, t) => s + t.spent, 0);
  const totalBudget = TEAM_COSTS.reduce((s, t) => s + t.budget, 0);
  const overBudget = TEAM_COSTS.filter(t => t.spent > t.budget);
  const openAnomalies = ANOMALIES.filter(a => a.status === "open");
  const maxServiceCost = Math.max(...SERVICE_COSTS.map(s => s.cost));
  const maxMonthTotal = Math.max(...MONTHLY_ALLOCATION.map(m => m.engineering + m.marketing + m.sales + m.support + m.data + m.infra));

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Cost Attribution</h1>
            <p className="text-xs text-zinc-400 mt-0.5">Infrastructure spend by team, service, and anomaly detection</p>
          </div>
          <div className="flex items-center gap-2">
            {(["month", "quarter", "ytd"] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={cn("px-3 py-1.5 rounded text-xs font-medium uppercase transition-colors",
                  period === p ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}>
                {p}
              </button>
            ))}
          </div>
        </div>
        {/* Stats */}
        <div className="flex gap-5 mt-3">
          {[
            { label: "Total Spent", value: `$${(totalSpent / 1000).toFixed(0)}K`, color: "text-white" },
            { label: "Budget", value: `$${(totalBudget / 1000).toFixed(0)}K`, color: "text-zinc-300" },
            { label: "Budget Used", value: `${Math.round((totalSpent / totalBudget) * 100)}%`, color: totalSpent > totalBudget ? "text-rose-400" : "text-emerald-400" },
            { label: "Over Budget", value: overBudget.length, color: overBudget.length > 0 ? "text-rose-400" : "text-emerald-400" },
            { label: "Open Anomalies", value: openAnomalies.length, color: openAnomalies.length > 0 ? "text-amber-400" : "text-emerald-400" },
          ].map(s => (
            <div key={s.label}>
              <span className={cn("text-base font-bold", s.color)}>{s.value}</span>
              <span className="text-zinc-500 text-xs ml-1.5">{s.label}</span>
            </div>
          ))}
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(["teams", "services", "anomalies", "trend"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                tab === t ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800")}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "anomalies" && openAnomalies.length > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500 text-[9px] font-bold text-white">{openAnomalies.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Teams Tab */}
        {tab === "teams" && (
          <div className="flex h-full">
            {/* Left */}
            <div className="w-[48%] flex-none border-r border-zinc-800 overflow-y-auto">
              {TEAM_COSTS.toSorted((a, b) => b.spent - a.spent).map(team => {
                const pct = Math.round((team.spent / team.budget) * 100);
                const over = team.spent > team.budget;
                return (
                  <button key={team.id} onClick={() => setSelected(team)} className={cn(
                    "w-full text-left px-4 py-3.5 border-b border-zinc-800/60 hover:bg-zinc-900 transition-colors",
                    selected?.id === team.id && "bg-zinc-900 border-l-2 border-l-indigo-500"
                  )}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn("w-2 h-2 rounded-full flex-none", deptColor[team.department])} />
                        <span className="text-sm font-medium text-white truncate">{team.team}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-none text-xs">
                        <span className={cn("font-bold", over ? "text-rose-400" : "text-white")}>${(team.spent / 1000).toFixed(1)}K</span>
                        <span className="text-zinc-600">of ${(team.budget / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                    <div className="mt-2 px-4">
                      <div className="w-full bg-zinc-800 rounded-full h-1.5">
                        <div
                          className={cn("h-1.5 rounded-full", over ? "bg-rose-500" : pct > 80 ? "bg-amber-500" : "bg-indigo-500")}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] mt-1">
                        <span className={over ? "text-rose-400 font-semibold" : "text-zinc-600"}>{pct}% used</span>
                        <span className={cn("font-medium", team.trend > 0 ? "text-rose-400" : "text-emerald-400")}>
                          {team.trend > 0 ? "↑" : "↓"}{Math.abs(team.trend)}% MoM
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            {/* Right: team detail */}
            <div className="flex-1 overflow-y-auto p-5">
              {selected && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-3 h-3 rounded-full", deptColor[selected.department])} />
                      <h2 className="text-base font-semibold text-white">{selected.team}</h2>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">Owner: {selected.owner} · Dept: {selected.department}</p>
                  </div>
                  {/* Budget overview */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Spent", value: `$${(selected.spent / 1000).toFixed(1)}K`, color: selected.spent > selected.budget ? "text-rose-400" : "text-white" },
                      { label: "Budget", value: `$${(selected.budget / 1000).toFixed(0)}K`, color: "text-zinc-300" },
                      { label: "Forecast", value: `$${(selected.forecast / 1000).toFixed(1)}K`, color: selected.forecast > selected.budget ? "text-amber-400" : "text-emerald-400" },
                    ].map(m => (
                      <div key={m.label} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800 text-center">
                        <div className={cn("text-xl font-bold", m.color)}>{m.value}</div>
                        <div className="text-xs text-zinc-500">{m.label}</div>
                      </div>
                    ))}
                  </div>
                  {/* Progress */}
                  <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-zinc-400">Budget utilization</span>
                      <span className={cn("font-semibold", selected.spent > selected.budget ? "text-rose-400" : "text-white")}>{Math.round((selected.spent / selected.budget) * 100)}%</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-3">
                      <div
                        className={cn("h-3 rounded-full relative", selected.spent > selected.budget ? "bg-rose-500" : selected.spent / selected.budget > 0.8 ? "bg-amber-500" : "bg-indigo-500")}
                        style={{ width: `${Math.min(100, (selected.spent / selected.budget) * 100)}%` }}
                      />
                    </div>
                    {/* Forecast marker */}
                    <div className="mt-2 text-[10px] text-zinc-500">
                      Forecast: ${(selected.forecast / 1000).toFixed(1)}K — {selected.forecast > selected.budget ? <span className="text-amber-400">will exceed budget by ${((selected.forecast - selected.budget) / 1000).toFixed(1)}K</span> : <span className="text-emerald-400">on track</span>}
                    </div>
                  </div>
                  {/* Top services */}
                  <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="text-xs font-medium text-zinc-400 mb-3">Top Cost Drivers</div>
                    <div className="space-y-1.5">
                      {selected.topServices.map((svc, i) => (
                        <div key={svc} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-600">{i + 1}.</span>
                          <span className="text-xs text-zinc-300">{svc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={cn("font-semibold", selected.trend > 5 ? "text-rose-400" : selected.trend > 0 ? "text-amber-400" : "text-emerald-400")}>
                      {selected.trend > 0 ? "↑" : "↓"}{Math.abs(selected.trend)}% MoM trend
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Services Tab */}
        {tab === "services" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-3">
              {SERVICE_COSTS.toSorted((a, b) => b.cost - a.cost).map(svc => (
                <div key={svc.id} className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span>{lineIcon[svc.line]}</span>
                        <span className="font-medium text-white text-sm">{svc.service}</span>
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-1 ml-6">
                        {svc.unitCount.toLocaleString()} {svc.unit}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2 ml-6">
                        {svc.topConsumers.map(c => (
                          <span key={c} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">{c}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right flex-none">
                      <div className="text-lg font-bold text-white">${(svc.cost / 1000).toFixed(1)}K</div>
                      <div className={cn("text-xs font-medium", svc.trend > 10 ? "text-rose-400" : svc.trend > 0 ? "text-amber-400" : "text-emerald-400")}>
                        {svc.trend > 0 ? "↑" : "↓"}{Math.abs(svc.trend)}% MoM
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 w-full bg-zinc-800 rounded-full h-1.5">
                    <div className="bg-indigo-500 h-1.5 rounded-full" style={{ width: `${(svc.cost / maxServiceCost) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Anomalies Tab */}
        {tab === "anomalies" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-3">
              {ANOMALIES.map(anomaly => (
                <div key={anomaly.id} className={cn("bg-zinc-900 rounded-xl p-4 border",
                  anomaly.status === "open" ? "border-rose-500/40" :
                  anomaly.status === "acknowledged" ? "border-amber-500/30" : "border-zinc-800"
                )}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium", anomalyStatusBadge[anomaly.status])}>{anomaly.status.toUpperCase()}</span>
                        <span className="text-sm font-medium text-white">{anomaly.service}</span>
                      </div>
                      <div className="text-xs text-zinc-500 mt-1">{anomaly.team} · Detected {anomaly.detectedAt}</div>
                      <p className="text-xs text-zinc-400 mt-2">{anomaly.rootCause}</p>
                    </div>
                    <div className="text-right flex-none">
                      <div className={cn("text-lg font-bold", anomaly.deviation > 0 ? "text-rose-400" : "text-emerald-400")}>
                        {anomaly.deviation > 0 ? "+" : ""}{anomaly.deviation.toFixed(1)}%
                      </div>
                      <div className="text-xs text-zinc-500">${(anomaly.actualCost / 1000).toFixed(1)}K actual</div>
                      <div className="text-xs text-zinc-600">vs ${(anomaly.expectedCost / 1000).toFixed(1)}K expected</div>
                    </div>
                  </div>
                  {anomaly.status === "open" && (
                    <div className="flex gap-2 mt-3">
                      <button className="px-2.5 py-1 rounded text-xs bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 transition-colors">Acknowledge</button>
                      <button className="px-2.5 py-1 rounded text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors">Investigate</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trend Tab */}
        {tab === "trend" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <div className="text-sm font-medium text-zinc-300 mb-4">Monthly Cost by Department (7 months)</div>
              <div className="flex items-end gap-2 h-48">
                {MONTHLY_ALLOCATION.map((m) => {
                  const total = m.engineering + m.marketing + m.sales + m.support + m.data + m.infra;
                  const heightPct = (total / maxMonthTotal) * 100;
                  const segments = [
                    { key: "engineering", val: m.engineering, color: "bg-indigo-500" },
                    { key: "data", val: m.data, color: "bg-emerald-500" },
                    { key: "infra", val: m.infra, color: "bg-zinc-500" },
                    { key: "marketing", val: m.marketing, color: "bg-purple-500" },
                    { key: "sales", val: m.sales, color: "bg-amber-500" },
                    { key: "support", val: m.support, color: "bg-sky-500" },
                  ];
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="text-[10px] text-zinc-500">${(total / 1000).toFixed(0)}K</div>
                      <div className="w-full flex flex-col-reverse gap-px rounded overflow-hidden" style={{ height: `${heightPct}%` }}>
                        {segments.map(seg => (
                          <div key={seg.key} className={seg.color} style={{ flex: seg.val }} />
                        ))}
                      </div>
                      <div className="text-[10px] text-zinc-500">{m.month}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-3 mt-4 text-[10px]">
                {[
                  { label: "Engineering", color: "bg-indigo-500" },
                  { label: "Data", color: "bg-emerald-500" },
                  { label: "Infra", color: "bg-zinc-500" },
                  { label: "Marketing", color: "bg-purple-500" },
                  { label: "Sales", color: "bg-amber-500" },
                  { label: "Support", color: "bg-sky-500" },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className={cn("w-2 h-2 rounded-sm", l.color)} />
                    <span className="text-zinc-500">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
