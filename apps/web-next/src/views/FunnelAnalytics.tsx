import React, { useState } from "react";
import { cn } from "../lib/utils";

type FunnelStage = {
  id: string;
  name: string;
  count: number;
  conversionRate: number; // % from previous stage
  avgDuration: string;
  dropoffReasons: string[];
  color: string;
};

type FunnelType = "user-onboarding" | "agent-task" | "deploy-pipeline" | "model-request";

interface FunnelDefinition {
  id: FunnelType;
  name: string;
  description: string;
  stages: FunnelStage[];
  period: string;
  totalEntered: number;
  totalCompleted: number;
}

const FUNNELS: FunnelDefinition[] = [
  {
    id: "user-onboarding",
    name: "User Onboarding",
    description: "New user journey from signup through first productive session",
    period: "Last 30 days",
    totalEntered: 847,
    totalCompleted: 312,
    stages: [
      { id: "s1", name: "Signup",           count: 847,  conversionRate: 100,  avgDuration: "0s",  dropoffReasons: [],                                            color: "bg-indigo-500" },
      { id: "s2", name: "Email Verified",   count: 720,  conversionRate: 85.0, avgDuration: "4m",  dropoffReasons: ["Email not received (32%)", "Bounced (68%)"],  color: "bg-blue-500" },
      { id: "s3", name: "Profile Setup",    count: 612,  conversionRate: 85.0, avgDuration: "7m",  dropoffReasons: ["Abandoned form (45%)", "Timeout (55%)"],       color: "bg-sky-500" },
      { id: "s4", name: "First Agent",      count: 480,  conversionRate: 78.4, avgDuration: "12m", dropoffReasons: ["Confused by UI (60%)", "No use case (40%)"],  color: "bg-teal-500" },
      { id: "s5", name: "First Task Run",   count: 390,  conversionRate: 81.2, avgDuration: "3m",  dropoffReasons: ["Task failed (70%)", "Gave up (30%)"],          color: "bg-emerald-500" },
      { id: "s6", name: "Active (7d)",      count: 312,  conversionRate: 80.0, avgDuration: "7d",  dropoffReasons: ["No value realized (80%)", "Cost concern (20%)"], color: "bg-green-500" },
    ],
  },
  {
    id: "agent-task",
    name: "Agent Task Lifecycle",
    description: "Full lifecycle from task creation to verified completion",
    period: "Last 7 days",
    totalEntered: 15420,
    totalCompleted: 13891,
    stages: [
      { id: "t1", name: "Task Created",    count: 15420, conversionRate: 100,  avgDuration: "0s",   dropoffReasons: [],                                           color: "bg-indigo-500" },
      { id: "t2", name: "Queued",          count: 15380, conversionRate: 99.7, avgDuration: "0.2s", dropoffReasons: ["Validation failed (100%)"],                  color: "bg-blue-500" },
      { id: "t3", name: "Executing",       count: 14980, conversionRate: 97.4, avgDuration: "0.5s", dropoffReasons: ["Queue timeout (60%)", "Rate limit (40%)"],   color: "bg-violet-500" },
      { id: "t4", name: "Tool Calls",      count: 14600, conversionRate: 97.5, avgDuration: "4.2s", dropoffReasons: ["Agent errored (70%)", "Context full (30%)"], color: "bg-purple-500" },
      { id: "t5", name: "Completed",       count: 13891, conversionRate: 95.1, avgDuration: "8.7s", dropoffReasons: ["Timeout (50%)", "API error (50%)"],           color: "bg-emerald-500" },
    ],
  },
  {
    id: "deploy-pipeline",
    name: "Deploy Pipeline",
    description: "From PR merge to successful production deployment",
    period: "All time",
    totalEntered: 284,
    totalCompleted: 221,
    stages: [
      { id: "d1", name: "PR Merged",       count: 284, conversionRate: 100,  avgDuration: "0s",   dropoffReasons: [],                                         color: "bg-indigo-500" },
      { id: "d2", name: "CI Triggered",    count: 282, conversionRate: 99.3, avgDuration: "30s",  dropoffReasons: ["Config error (100%)"],                     color: "bg-blue-500" },
      { id: "d3", name: "Tests Passed",    count: 261, conversionRate: 92.6, avgDuration: "4m",   dropoffReasons: ["Flaky tests (40%)", "Real failures (60%)"], color: "bg-amber-500" },
      { id: "d4", name: "Build Success",   count: 248, conversionRate: 95.0, avgDuration: "2m",   dropoffReasons: ["TS errors (80%)", "Bundle too large (20%)"],color: "bg-orange-400" },
      { id: "d5", name: "Staged",          count: 236, conversionRate: 95.2, avgDuration: "5m",   dropoffReasons: ["Preview failed (100%)"],                   color: "bg-teal-500" },
      { id: "d6", name: "Production",      count: 221, conversionRate: 93.6, avgDuration: "2m",   dropoffReasons: ["Health check failed (100%)"],              color: "bg-emerald-500" },
    ],
  },
];

const NUM_FUNNEL_WIDTH_STEPS = 100;

export default function FunnelAnalytics() {
  const [activeFunnelId, setActiveFunnelId] = useState<FunnelType>("user-onboarding");
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"funnel" | "table" | "sankey">("funnel");

  const funnel = FUNNELS.find(f => f.id === activeFunnelId)!;
  const maxCount = funnel.stages[0].count;
  const overallConversion = ((funnel.totalCompleted / funnel.totalEntered) * 100).toFixed(1);
  const selectedStage = funnel.stages.find(s => s.id === selectedStageId);

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
        {/* Funnel selector */}
        <div className="flex gap-2">
          {FUNNELS.map(f => (
            <button
              key={f.id}
              onClick={() => { setActiveFunnelId(f.id); setSelectedStageId(null); }}
              className={cn("text-xs px-3 py-1.5 rounded border transition-colors", activeFunnelId === f.id ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" : "border-zinc-700 text-zinc-500 hover:text-zinc-300 bg-zinc-800")}
            >
              {f.name}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="ml-auto flex items-center gap-6">
          {[
            { label: "Entered",    value: funnel.totalEntered.toLocaleString() },
            { label: "Completed",  value: funnel.totalCompleted.toLocaleString() },
            { label: "Conversion", value: `${overallConversion}%` },
            { label: "Period",     value: funnel.period },
          ].map(({ label, value }) => (
            <div key={label} className="text-center">
              <div className="text-sm font-bold text-white">{value}</div>
              <div className="text-[10px] text-zinc-500">{label}</div>
            </div>
          ))}
        </div>

        {/* View mode */}
        <div className="flex rounded border border-zinc-700 overflow-hidden">
          {(["funnel", "table"] as const).map(m => (
            <button
              key={m}
              onClick={() => setViewMode(m)}
              className={cn("text-xs px-3 py-1.5 capitalize transition-colors", viewMode === m ? "bg-indigo-500 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white")}
            >
              {m === "funnel" ? "📊 Funnel" : "📋 Table"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === "funnel" ? (
            <div className="max-w-2xl mx-auto">
              <p className="text-xs text-zinc-500 mb-6">{funnel.description}</p>

              {/* Funnel visualization */}
              <div className="space-y-1">
                {funnel.stages.map((stage, i) => {
                  const widthPct = (stage.count / maxCount) * 100;
                  const isSelected = selectedStageId === stage.id;
                  const prevStage = i > 0 ? funnel.stages[i - 1] : null;
                  const dropoff = prevStage ? prevStage.count - stage.count : 0;

                  return (
                    <div key={stage.id}>
                      {/* Dropoff indicator */}
                      {i > 0 && dropoff > 0 && (
                        <div className="flex items-center gap-2 py-0.5 px-2">
                          <div className="flex-1 h-px bg-zinc-800" />
                          <span className="text-[9px] text-rose-400 whitespace-nowrap">
                            ↓ {dropoff.toLocaleString()} dropped ({(100 - stage.conversionRate).toFixed(1)}%)
                          </span>
                          <div className="flex-1 h-px bg-zinc-800" />
                        </div>
                      )}

                      {/* Stage bar */}
                      <button
                        onClick={() => setSelectedStageId(isSelected ? null : stage.id)}
                        className="w-full group"
                      >
                        <div className="flex items-center gap-3 mb-0.5">
                          <span className="text-[10px] text-zinc-500 w-4 text-right">{i + 1}</span>
                          <span className="text-xs text-zinc-300">{stage.name}</span>
                          <span className="text-xs text-white font-semibold ml-auto">{stage.count.toLocaleString()}</span>
                          {i > 0 && (
                            <span className={cn("text-[10px] font-medium w-12 text-right", stage.conversionRate >= 90 ? "text-emerald-400" : stage.conversionRate >= 75 ? "text-amber-400" : "text-rose-400")}>
                              {stage.conversionRate.toFixed(1)}%
                            </span>
                          )}
                        </div>

                        {/* Trapezoid bar using centered div */}
                        <div className="flex justify-center">
                          <div
                            className={cn("transition-all duration-300 rounded h-10 flex items-center justify-center", stage.color, isSelected ? "opacity-100 ring-2 ring-white/30" : "opacity-70 group-hover:opacity-90")}
                            style={{ width: `${widthPct}%` }}
                          >
                            <span className="text-white text-xs font-bold drop-shadow">{stage.name}</span>
                          </div>
                        </div>

                        {/* Duration */}
                        <div className="text-center text-[9px] text-zinc-600 mt-0.5">avg {stage.avgDuration}</div>
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Overall funnel bar */}
              <div className="mt-8 p-4 bg-zinc-900 rounded border border-zinc-800">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-400">Overall Conversion</span>
                  <span className="text-sm font-bold text-white">{overallConversion}%</span>
                </div>
                <div className="h-3 bg-zinc-800 rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 rounded"
                    style={{ width: `${overallConversion}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-zinc-600 mt-1">
                  <span>{funnel.totalEntered.toLocaleString()} entered</span>
                  <span>{funnel.totalCompleted.toLocaleString()} completed</span>
                </div>
              </div>
            </div>
          ) : (
            /* Table view */
            <table className="w-full max-w-3xl mx-auto">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2">#</th>
                  <th className="text-left px-4 py-2">Stage</th>
                  <th className="text-right px-4 py-2">Count</th>
                  <th className="text-right px-4 py-2">Conv. Rate</th>
                  <th className="text-right px-4 py-2">Dropped</th>
                  <th className="text-left px-4 py-2">Avg Duration</th>
                  <th className="text-left px-4 py-2">Bar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {funnel.stages.map((stage, i) => {
                  const prev = funnel.stages[i - 1];
                  const dropped = prev ? prev.count - stage.count : 0;
                  return (
                    <tr key={stage.id} className="hover:bg-zinc-900 transition-colors">
                      <td className="px-4 py-3 text-zinc-600 text-xs">{i + 1}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2.5 h-2.5 rounded-sm flex-shrink-0", stage.color)} />
                          <span className="text-sm text-white">{stage.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-mono text-white">{stage.count.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        {i === 0 ? (
                          <span className="text-[10px] text-zinc-600">—</span>
                        ) : (
                          <span className={cn("text-sm font-semibold", stage.conversionRate >= 90 ? "text-emerald-400" : stage.conversionRate >= 75 ? "text-amber-400" : "text-rose-400")}>
                            {stage.conversionRate.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-rose-400">
                        {dropped > 0 ? `-${dropped.toLocaleString()}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-500">{stage.avgDuration}</td>
                      <td className="px-4 py-3 w-32">
                        <div className="h-2 bg-zinc-800 rounded overflow-hidden">
                          <div className={cn("h-full rounded", stage.color)} style={{ width: `${(stage.count / maxCount) * 100}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Stage detail panel */}
        {selectedStage && (
          <div className="w-72 flex-shrink-0 border-l border-zinc-800 bg-zinc-900 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className={cn("w-3 h-3 rounded", selectedStage.color)} />
                <span className="font-semibold text-sm text-white">{selectedStage.name}</span>
              </div>
              <button onClick={() => setSelectedStageId(null)} className="text-zinc-500 hover:text-white text-xs">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: "Users",     value: selectedStage.count.toLocaleString() },
                { label: "Conv. Rate",value: `${selectedStage.conversionRate.toFixed(1)}%` },
                { label: "Avg Time",  value: selectedStage.avgDuration },
                { label: "Of Total",  value: `${((selectedStage.count / maxCount) * 100).toFixed(0)}%` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-zinc-950 rounded p-2 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500">{label}</div>
                  <div className="text-sm font-semibold text-white mt-0.5">{value}</div>
                </div>
              ))}
            </div>

            {/* Proportion bar */}
            <div className="mb-4">
              <div className="text-[10px] text-zinc-500 mb-1">Proportion of entrants</div>
              <div className="h-2 bg-zinc-800 rounded overflow-hidden">
                <div className={cn("h-full rounded", selectedStage.color)} style={{ width: `${(selectedStage.count / maxCount) * 100}%` }} />
              </div>
            </div>

            {/* Drop-off reasons */}
            {selectedStage.dropoffReasons.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Drop-off Reasons</div>
                <div className="space-y-1.5">
                  {selectedStage.dropoffReasons.map((reason, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-rose-400 flex-shrink-0" />
                      <span className="text-zinc-400">{reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
