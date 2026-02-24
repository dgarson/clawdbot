import React, { useState } from "react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";
import { FlaskConical } from "lucide-react";

type ExperimentStatus = 'draft' | 'running' | 'paused' | 'complete' | 'archived';
type MetricKind = 'conversion' | 'latency' | 'cost' | 'quality-score' | 'error-rate';

interface Variant {
  id: string;
  name: string;
  description: string;
  trafficPct: number; // 0-100
  model?: string;
  prompt?: string;
  temperature?: number;
}

interface MetricResult {
  variantId: string;
  metric: MetricKind;
  value: number;
  sampleSize: number;
  pValue?: number; // statistical significance
  winner: boolean;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  createdBy: string;
  startedAt?: string;
  endedAt?: string;
  variants: Variant[];
  metrics: MetricResult[];
  primaryMetric: MetricKind;
  targetSessions: number;
  completedSessions: number;
}

const SEED_EXPERIMENTS: Experiment[] = [
  {
    id: "exp-1",
    name: "Opus vs Sonnet for planning",
    description: "Comparing Claude 3 Opus against Sonnet for long-range planning tasks and logical consistency.",
    status: "running",
    createdBy: "Luis",
    startedAt: "2026-02-15T09:00:00Z",
    primaryMetric: "quality-score",
    targetSessions: 5000,
    completedSessions: 3240,
    variants: [
      { id: "v1-1", name: "Control (Opus)", description: "Baseline using Claude 3 Opus", trafficPct: 50, model: "claude-3-opus", temperature: 0.7 },
      { id: "v1-2", name: "Treatment (Sonnet)", description: "Challenger using Claude 3 Sonnet", trafficPct: 50, model: "claude-3-sonnet", temperature: 0.7 }
    ],
    metrics: [
      { variantId: "v1-1", metric: "quality-score", value: 92, sampleSize: 1620, winner: true },
      { variantId: "v1-2", metric: "quality-score", value: 88, sampleSize: 1620, winner: false },
      { variantId: "v1-1", metric: "latency", value: 2400, sampleSize: 1620, winner: false },
      { variantId: "v1-2", metric: "latency", value: 1100, sampleSize: 1620, winner: true },
      { variantId: "v1-1", metric: "cost", value: 15.00, sampleSize: 1620, winner: false },
      { variantId: "v1-2", metric: "cost", value: 3.00, sampleSize: 1620, winner: true }
    ]
  },
  {
    id: "exp-2",
    name: "Streaming vs batch responses",
    description: "Evaluating perceived quality and latency between full batch responses and token streaming.",
    status: "complete",
    createdBy: "Xavier",
    startedAt: "2026-02-01T10:00:00Z",
    endedAt: "2026-02-14T18:00:00Z",
    primaryMetric: "quality-score",
    targetSessions: 2000,
    completedSessions: 2000,
    variants: [
      { id: "v2-1", name: "Batch", description: "Wait for full response", trafficPct: 50 },
      { id: "v2-2", name: "Streaming", description: "Stream tokens as generated", trafficPct: 50 }
    ],
    metrics: [
      { variantId: "v2-1", metric: "quality-score", value: 84, sampleSize: 1000, winner: false, pValue: 0.02 },
      { variantId: "v2-2", metric: "quality-score", value: 89, sampleSize: 1000, winner: true, pValue: 0.02 },
      { variantId: "v2-1", metric: "latency", value: 3100, sampleSize: 1000, winner: false, pValue: 0.01 },
      { variantId: "v2-2", metric: "latency", value: 450, sampleSize: 1000, winner: true, pValue: 0.01 }
    ]
  },
  {
    id: "exp-3",
    name: "Temperature 0.7 vs 1.0 creativity",
    description: "Testing if higher temperature leads to better creative writing outputs without losing coherence.",
    status: "running",
    createdBy: "Piper",
    startedAt: "2026-02-20T14:30:00Z",
    primaryMetric: "quality-score",
    targetSessions: 1000,
    completedSessions: 450,
    variants: [
      { id: "v3-1", name: "Conservative", description: "Temp 0.7", trafficPct: 50, temperature: 0.7 },
      { id: "v3-2", name: "Creative", description: "Temp 1.0", trafficPct: 50, temperature: 1.0 }
    ],
    metrics: [
      { variantId: "v3-1", metric: "quality-score", value: 78, sampleSize: 225, winner: false, pValue: 0.45 },
      { variantId: "v3-2", metric: "quality-score", value: 79, sampleSize: 225, winner: false, pValue: 0.45 }
    ]
  },
  {
    id: "exp-4",
    name: "System prompt A vs B",
    description: "Formal vs Casual tone in system instructions.",
    status: "paused",
    createdBy: "Stephan",
    startedAt: "2026-02-10T11:00:00Z",
    primaryMetric: "conversion",
    targetSessions: 5000,
    completedSessions: 1200,
    variants: [
      { id: "v4-1", name: "Formal", description: "Professional tone", trafficPct: 50, prompt: "You are a professional assistant..." },
      { id: "v4-2", name: "Casual", description: "Friendly tone", trafficPct: 50, prompt: "Hey! I'm your friendly AI..." }
    ],
    metrics: [
      { variantId: "v4-1", metric: "conversion", value: 12.4, sampleSize: 600, winner: false },
      { variantId: "v4-2", metric: "conversion", value: 11.8, sampleSize: 600, winner: false }
    ]
  },
  {
    id: "exp-5",
    name: "3-retry vs 5-retry on failures",
    description: "Investigating if increasing retries improves success rates significantly vs increasing latency.",
    status: "draft",
    createdBy: "Tim",
    primaryMetric: "error-rate",
    targetSessions: 10000,
    completedSessions: 0,
    variants: [
      { id: "v5-1", name: "Retry-3", description: "3 attempts", trafficPct: 50 },
      { id: "v5-2", name: "Retry-5", description: "5 attempts", trafficPct: 50 }
    ],
    metrics: []
  }
];

const StatusBadge = ({ status }: { status: ExperimentStatus }) => {
  const styles: Record<ExperimentStatus, string> = {
    draft: "bg-surface-2 text-fg-secondary border-tok-border",
    running: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 animate-pulse",
    paused: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    complete: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    archived: "bg-surface-1 text-fg-muted border-tok-border"
  };

  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border", styles[status])}>
      {status}
    </span>
  );
};

const ProgressBar = ({ current, total, color = "bg-indigo-500" }: { current: number; total: number; color?: string }) => {
  const percentage = Math.min(Math.round((current / total) * 100), 100);
  return (
    <div className="w-full">
      <div className="flex justify-between text-[10px] text-fg-muted mb-1">
        <span>{percentage}% complete</span>
        <span>{current.toLocaleString()} / {total.toLocaleString()}</span>
      </div>
      <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
        <div 
          className={cn("h-full rounded-full transition-all duration-500", color)} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export default function ABTestManager() {
  const [selectedId, setSelectedId] = useState<string>(SEED_EXPERIMENTS[0].id);
  const [activeTab, setActiveTab] = useState<'overview' | 'variants' | 'results'>('overview');

  const selectedExp = SEED_EXPERIMENTS.find(e => e.id === selectedId) || SEED_EXPERIMENTS[0];

  const getMetricLabel = (kind: MetricKind) => {
    return kind.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getVariantMetric = (variantId: string, metric: MetricKind) => {
    return selectedExp.metrics.find(m => m.variantId === variantId && m.metric === metric);
  };

  const uniqueMetrics = Array.from(new Set(selectedExp.metrics.map(m => m.metric)));

  return (
    <div className="flex flex-col md:flex-row h-screen bg-surface-0 text-fg-primary font-sans selection:bg-indigo-500/30">
      {/* Sidebar List */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-tok-border flex flex-col overflow-hidden bg-surface-0 max-h-[40vh] md:max-h-none">
        <div className="p-4 border-b border-tok-border flex items-center justify-between">
          <h2 className="font-semibold text-fg-primary">Experiments</h2>
          <button className="p-1.5 rounded-md hover:bg-surface-1 text-fg-secondary transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {SEED_EXPERIMENTS.length === 0 && (
            <ContextualEmptyState
              icon={FlaskConical}
              title="No experiments yet"
              description="Create your first A/B test to start optimizing agent performance."
              size="sm"
            />
          )}
          {SEED_EXPERIMENTS.map((exp) => (
            <button
              key={exp.id}
              onClick={() => setSelectedId(exp.id)}
              className={cn(
                "w-full text-left p-3 rounded-lg border transition-all duration-200 group",
                selectedId === exp.id 
                  ? "bg-surface-1 border-tok-border shadow-lg shadow-black/20" 
                  : "bg-transparent border-transparent hover:bg-surface-1/50 hover:border-tok-border"
              )}
            >
              <div className="flex justify-between items-start mb-2">
                <StatusBadge status={exp.status} />
                <span className="text-[10px] text-fg-muted font-medium">{getMetricLabel(exp.primaryMetric)}</span>
              </div>
              <h3 className={cn(
                "text-sm font-medium mb-1 truncate",
                selectedId === exp.id ? "text-fg-primary" : "text-fg-secondary group-hover:text-fg-primary"
              )}>
                {exp.name}
              </h3>
              <div className="flex items-center text-[10px] text-fg-muted mb-3">
                <span className="truncate">by {exp.createdBy}</span>
              </div>
              <ProgressBar 
                current={exp.completedSessions} 
                total={exp.targetSessions} 
                color={selectedId === exp.id ? "bg-indigo-500" : "bg-surface-3"}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Detail Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-surface-0">
        {/* Header */}
        <div className="p-3 sm:p-4 md:p-6 border-b border-tok-border bg-surface-1/30">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-bold tracking-tight">{selectedExp.name}</h1>
                <StatusBadge status={selectedExp.status} />
              </div>
              <p className="text-fg-secondary max-w-2xl text-sm leading-relaxed">{selectedExp.description}</p>
            </div>
            <div className="flex gap-2">
              <button className="px-3 py-1.5 rounded bg-surface-2 hover:bg-surface-3 border border-tok-border text-xs font-medium transition-colors">
                Duplicate
              </button>
              <button className="px-3 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 text-xs font-medium transition-colors">
                Save Changes
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-6">
            {(['overview', 'variants', 'results'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "pb-3 text-sm font-medium transition-all relative capitalize",
                  activeTab === tab ? "text-indigo-400" : "text-fg-muted hover:text-fg-primary"
                )}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto">
            {activeTab === 'overview' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                  <div className="bg-surface-1 p-5 rounded-xl border border-tok-border">
                    <h4 className="text-[10px] uppercase tracking-widest text-fg-muted font-bold mb-4">Sessions Progress</h4>
                    <ProgressBar current={selectedExp.completedSessions} total={selectedExp.targetSessions} color="bg-emerald-500" />
                  </div>
                  <div className="bg-surface-1 p-5 rounded-xl border border-tok-border">
                    <h4 className="text-[10px] uppercase tracking-widest text-fg-muted font-bold mb-1">Primary Metric</h4>
                    <div className="text-xl font-semibold text-fg-primary">{getMetricLabel(selectedExp.primaryMetric)}</div>
                    <div className="text-xs text-fg-muted mt-2">Targeted for optimization</div>
                  </div>
                  <div className="bg-surface-1 p-5 rounded-xl border border-tok-border">
                    <h4 className="text-[10px] uppercase tracking-widest text-fg-muted font-bold mb-1">Created By</h4>
                    <div className="text-xl font-semibold text-fg-primary">{selectedExp.createdBy}</div>
                    <div className="text-xs text-fg-muted mt-2">Started on {selectedExp.startedAt ? new Date(selectedExp.startedAt).toLocaleDateString() : 'N/A'}</div>
                  </div>
                </div>

                <div className="bg-surface-1 rounded-xl border border-tok-border overflow-hidden">
                  <div className="p-4 border-b border-tok-border bg-surface-1/50">
                    <h4 className="text-sm font-semibold">Status Management</h4>
                  </div>
                  <div className="p-6 flex flex-wrap gap-3">
                    {selectedExp.status === 'draft' && (
                      <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-fg-primary text-xs font-bold rounded transition-colors uppercase tracking-wide">
                        Start Experiment
                      </button>
                    )}
                    {(selectedExp.status === 'running') && (
                      <button className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-fg-primary text-xs font-bold rounded transition-colors uppercase tracking-wide">
                        Pause Experiment
                      </button>
                    )}
                    {selectedExp.status === 'paused' && (
                      <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-fg-primary text-xs font-bold rounded transition-colors uppercase tracking-wide">
                        Resume Experiment
                      </button>
                    )}
                    {(selectedExp.status === 'running' || selectedExp.status === 'paused') && (
                      <button className="px-4 py-2 bg-surface-3 hover:bg-surface-3 text-fg-primary text-xs font-bold rounded transition-colors uppercase tracking-wide">
                        Stop & Complete
                      </button>
                    )}
                    {selectedExp.status === 'complete' && (
                      <button className="px-4 py-2 bg-surface-3 hover:bg-surface-3 text-fg-primary text-xs font-bold rounded transition-colors uppercase tracking-wide">
                        Archive Experiment
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'variants' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-surface-1 rounded-xl border border-tok-border overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-tok-border bg-surface-1/50">
                        <th className="px-6 py-4 font-semibold text-fg-secondary uppercase text-[10px] tracking-widest">Variant</th>
                        <th className="px-6 py-4 font-semibold text-fg-secondary uppercase text-[10px] tracking-widest">Traffic Split</th>
                        <th className="px-6 py-4 font-semibold text-fg-secondary uppercase text-[10px] tracking-widest">Model / Config</th>
                        <th className="px-6 py-4 font-semibold text-fg-secondary uppercase text-[10px] tracking-widest">Prompt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tok-border">
                      {selectedExp.variants.map((v) => (
                        <tr key={v.id} className="hover:bg-surface-2/30 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-medium text-fg-primary">{v.name}</div>
                            <div className="text-[10px] text-fg-muted">{v.description}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-xs w-8 text-indigo-400">{v.trafficPct}%</span>
                              <div className="w-24 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500" style={{ width: `${v.trafficPct}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              {v.model && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-fg-muted">Model:</span>
                                  <code className="text-[10px] px-1.5 py-0.5 bg-surface-2 rounded text-indigo-300 border border-tok-border">{v.model}</code>
                                </div>
                              )}
                              {v.temperature !== undefined && (
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-fg-muted">Temp:</span>
                                  <span className="text-[10px] font-mono text-fg-primary">{v.temperature}</span>
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {v.prompt ? (
                              <div className="text-[10px] text-fg-secondary line-clamp-2 italic font-serif">"{v.prompt}"</div>
                            ) : (
                              <span className="text-[10px] text-fg-muted italic">No override</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'results' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {selectedExp.status === 'complete' && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center gap-4">
                    <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-emerald-400 uppercase tracking-wide">Experiment Concluded</h4>
                      <p className="text-xs text-emerald-500/80">
                        {selectedExp.variants.find(v => selectedExp.metrics.some(m => m.variantId === v.id && m.winner && m.metric === selectedExp.primaryMetric))?.name} is the clear winner on {getMetricLabel(selectedExp.primaryMetric)}.
                      </p>
                    </div>
                  </div>
                )}

                {uniqueMetrics.length > 0 ? (
                  <div className="grid grid-cols-1 gap-6">
                    {uniqueMetrics.map(metricKind => (
                      <div key={metricKind} className="bg-surface-1 rounded-xl border border-tok-border overflow-hidden">
                        <div className="px-6 py-4 border-b border-tok-border bg-surface-1/50 flex justify-between items-center">
                          <h4 className="text-sm font-semibold capitalize">{getMetricLabel(metricKind)}</h4>
                          {selectedExp.metrics.some(m => m.metric === metricKind && m.pValue !== undefined && m.pValue < 0.05) && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                              STATISTICALLY SIGNIFICANT
                            </span>
                          )}
                        </div>
                        <div className="p-0">
                          <table className="w-full text-left text-sm">
                            <thead>
                              <tr className="bg-surface-0/30">
                                <th className="px-6 py-3 text-[10px] text-fg-muted uppercase tracking-widest font-bold">Variant</th>
                                <th className="px-6 py-3 text-[10px] text-fg-muted uppercase tracking-widest font-bold text-right">Value</th>
                                <th className="px-6 py-3 text-[10px] text-fg-muted uppercase tracking-widest font-bold text-right">Sample Size</th>
                                <th className="px-6 py-3 text-[10px] text-fg-muted uppercase tracking-widest font-bold text-right">p-Value</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-tok-border">
                              {selectedExp.variants.map(v => {
                                const result = getVariantMetric(v.id, metricKind);
                                if (!result) {return null;}
                                return (
                                  <tr key={v.id} className={cn("transition-colors", result.winner ? "bg-emerald-500/5" : "")}>
                                    <td className="px-6 py-4 flex items-center gap-3">
                                      <span className="font-medium text-fg-primary">{v.name}</span>
                                      {result.winner && (
                                        <span className="px-1.5 py-0.5 bg-emerald-500 text-black text-[9px] font-bold rounded">WINNER</span>
                                      )}
                                    </td>
                                    <td className={cn("px-6 py-4 text-right font-mono font-semibold", result.winner ? "text-emerald-400" : "text-fg-primary")}>
                                      {metricKind === 'latency' ? `${result.value}ms` : metricKind === 'cost' ? `$${result.value.toFixed(2)}` : `${result.value}%`}
                                    </td>
                                    <td className="px-6 py-4 text-right text-fg-muted text-xs">
                                      {result.sampleSize.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                      {result.pValue !== undefined ? (
                                        <span className={cn("text-xs font-mono", result.pValue < 0.05 ? "text-emerald-400" : "text-fg-muted")}>
                                          {result.pValue.toFixed(3)}
                                        </span>
                                      ) : (
                                        <span className="text-fg-muted">—</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-fg-muted bg-surface-1 rounded-2xl border border-tok-border border-dashed">
                    <svg className="w-12 h-12 mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                    <p className="text-sm font-medium">No metrics recorded yet</p>
                    <p className="text-[10px] mt-1">Start the experiment to begin gathering data</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
