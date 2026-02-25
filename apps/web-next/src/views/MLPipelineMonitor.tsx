import React, { useState } from "react";
import { cn } from "../lib/utils";

type PipelineStatus = "running" | "completed" | "failed" | "queued" | "cancelled";
type TabId = "pipelines" | "runs" | "models" | "compute";

interface Pipeline {
  id: string;
  name: string;
  description: string;
  framework: string;
  status: PipelineStatus;
  lastRun: string;
  avgDuration: string;
  successRate: number;
  totalRuns: number;
  owner: string;
  tags: string[];
  stages: PipelineStage[];
}

interface PipelineStage {
  name: string;
  status: "done" | "running" | "pending" | "failed" | "skipped";
  duration: string | null;
}

interface PipelineRun {
  id: string;
  pipelineId: string;
  pipelineName: string;
  runId: string;
  status: PipelineStatus;
  startedAt: string;
  duration: string;
  gpuCount: number;
  gpuType: string;
  trainLoss: number | null;
  valLoss: number | null;
  accuracy: number | null;
  metrics: Record<string, number>;
  triggeredBy: string;
  gitCommit: string;
}

interface ModelVersion {
  id: string;
  name: string;
  version: string;
  stage: "staging" | "production" | "archived" | "candidate";
  framework: string;
  accuracy: number;
  latencyMs: number;
  sizeGb: number;
  createdAt: string;
  runId: string;
  tags: string[];
  metrics: Record<string, number>;
}

interface ComputeNode {
  id: string;
  name: string;
  type: string;
  gpuCount: number;
  gpuUtil: number;
  memUtil: number;
  status: "available" | "busy" | "offline";
  currentRun: string | null;
  queueDepth: number;
}

const PIPELINES: Pipeline[] = [
  {
    id: "p1", name: "fraud-detection-v3", description: "Real-time fraud scoring model for payment transactions",
    framework: "PyTorch", status: "running", lastRun: "2m ago", avgDuration: "1h 24m", successRate: 94, totalRuns: 147, owner: "ml-platform", tags: ["fraud", "prod", "realtime"],
    stages: [
      { name: "Data Prep", status: "done", duration: "8m" },
      { name: "Feature Eng", status: "done", duration: "12m" },
      { name: "Training", status: "running", duration: null },
      { name: "Evaluation", status: "pending", duration: null },
      { name: "Registry Push", status: "pending", duration: null },
    ],
  },
  {
    id: "p2", name: "churn-predictor-nightly", description: "Daily churn probability scoring for all active users",
    framework: "XGBoost", status: "completed", lastRun: "4h ago", avgDuration: "22m", successRate: 98, totalRuns: 312, owner: "growth-ml", tags: ["churn", "batch"],
    stages: [
      { name: "Data Prep", status: "done", duration: "3m" },
      { name: "Feature Eng", status: "done", duration: "5m" },
      { name: "Training", status: "done", duration: "9m" },
      { name: "Evaluation", status: "done", duration: "2m" },
      { name: "Registry Push", status: "done", duration: "1m" },
    ],
  },
  {
    id: "p3", name: "embeddings-v2-finetune", description: "Fine-tuning sentence transformer for semantic search",
    framework: "HuggingFace", status: "failed", lastRun: "1h ago", avgDuration: "3h 10m", successRate: 71, totalRuns: 28, owner: "search-ml", tags: ["nlp", "embeddings"],
    stages: [
      { name: "Data Prep", status: "done", duration: "15m" },
      { name: "Tokenization", status: "done", duration: "8m" },
      { name: "Fine-tuning", status: "failed", duration: "42m" },
      { name: "Evaluation", status: "skipped", duration: null },
      { name: "Registry Push", status: "skipped", duration: null },
    ],
  },
  {
    id: "p4", name: "rec-engine-ab-test", description: "Collaborative filtering model for recommendation A/B",
    framework: "TensorFlow", status: "queued", lastRun: "1d ago", avgDuration: "2h 45m", successRate: 88, totalRuns: 64, owner: "rec-team", tags: ["recommendation", "ab-test"],
    stages: [
      { name: "Data Prep", status: "pending", duration: null },
      { name: "Matrix Factorization", status: "pending", duration: null },
      { name: "Training", status: "pending", duration: null },
      { name: "Offline Eval", status: "pending", duration: null },
      { name: "Registry Push", status: "pending", duration: null },
    ],
  },
  {
    id: "p5", name: "sentiment-classifier", description: "Multi-class sentiment analysis for support tickets",
    framework: "PyTorch", status: "completed", lastRun: "30m ago", avgDuration: "45m", successRate: 96, totalRuns: 89, owner: "support-ml", tags: ["nlp", "sentiment", "prod"],
    stages: [
      { name: "Data Prep", status: "done", duration: "5m" },
      { name: "Training", status: "done", duration: "28m" },
      { name: "Evaluation", status: "done", duration: "6m" },
      { name: "Registry Push", status: "done", duration: "2m" },
      { name: "Deploy", status: "done", duration: "4m" },
    ],
  },
];

const RUNS: PipelineRun[] = [
  { id: "r1", pipelineId: "p1", pipelineName: "fraud-detection-v3", runId: "run_a7k3x9", status: "running", startedAt: "2m ago", duration: "ongoing", gpuCount: 8, gpuType: "A100", trainLoss: 0.0234, valLoss: 0.0312, accuracy: null, metrics: { "batch": 4200, "epoch": 3 }, triggeredBy: "schedule", gitCommit: "f3a1c7b" },
  { id: "r2", pipelineId: "p2", pipelineName: "churn-predictor-nightly", runId: "run_b2m8p4", status: "completed", startedAt: "4h ago", duration: "21m", gpuCount: 0, gpuType: "CPU", trainLoss: 0.1823, valLoss: 0.1941, accuracy: 0.8734, metrics: { "auc": 0.923, "f1": 0.847 }, triggeredBy: "schedule", gitCommit: "d8f2a4e" },
  { id: "r3", pipelineId: "p3", pipelineName: "embeddings-v2-finetune", runId: "run_c5q1r7", status: "failed", startedAt: "1h ago", duration: "42m", gpuCount: 4, gpuType: "A100", trainLoss: 0.3201, valLoss: null, accuracy: null, metrics: { "step": 1420 }, triggeredBy: "manual", gitCommit: "a2e9c3f" },
  { id: "r4", pipelineId: "p5", pipelineName: "sentiment-classifier", runId: "run_d9h3k2", status: "completed", startedAt: "30m ago", duration: "44m", gpuCount: 2, gpuType: "V100", trainLoss: 0.0891, valLoss: 0.0934, accuracy: 0.9312, metrics: { "macro_f1": 0.918, "micro_f1": 0.931 }, triggeredBy: "push", gitCommit: "c7b4d1a" },
  { id: "r5", pipelineId: "p2", pipelineName: "churn-predictor-nightly", runId: "run_e4j6n1", status: "completed", startedAt: "1d ago", duration: "23m", gpuCount: 0, gpuType: "CPU", trainLoss: 0.1956, valLoss: 0.2013, accuracy: 0.8612, metrics: { "auc": 0.901, "f1": 0.831 }, triggeredBy: "schedule", gitCommit: "b9a7e5c" },
  { id: "r6", pipelineId: "p4", pipelineName: "rec-engine-ab-test", runId: "run_f7m2q5", status: "cancelled", startedAt: "2d ago", duration: "12m", gpuCount: 16, gpuType: "A100", trainLoss: null, valLoss: null, accuracy: null, metrics: {}, triggeredBy: "manual", gitCommit: "e1d8b3f" },
];

const MODEL_VERSIONS: ModelVersion[] = [
  { id: "m1", name: "fraud-detector", version: "3.2.1", stage: "production", framework: "PyTorch", accuracy: 0.9734, latencyMs: 12, sizeGb: 0.8, createdAt: "3d ago", runId: "run_a7k3x8", tags: ["fraud", "v3", "optimized"], metrics: { "precision": 0.961, "recall": 0.948, "auc": 0.982 } },
  { id: "m2", name: "fraud-detector", version: "3.2.0", stage: "archived", framework: "PyTorch", accuracy: 0.9682, latencyMs: 14, sizeGb: 0.9, createdAt: "10d ago", runId: "run_z9p2k1", tags: ["fraud", "v3"], metrics: { "precision": 0.953, "recall": 0.939, "auc": 0.976 } },
  { id: "m3", name: "churn-predictor", version: "5.1.0", stage: "production", framework: "XGBoost", accuracy: 0.8734, latencyMs: 2, sizeGb: 0.05, createdAt: "4h ago", runId: "run_b2m8p4", tags: ["churn", "nightly"], metrics: { "auc": 0.923, "f1": 0.847 } },
  { id: "m4", name: "sentiment-classifier", version: "2.4.0", stage: "candidate", framework: "PyTorch", accuracy: 0.9312, latencyMs: 28, sizeGb: 1.4, createdAt: "30m ago", runId: "run_d9h3k2", tags: ["nlp", "sentiment"], metrics: { "macro_f1": 0.918, "micro_f1": 0.931 } },
  { id: "m5", name: "sentence-embeddings", version: "1.9.2", stage: "staging", framework: "HuggingFace", accuracy: 0.8923, latencyMs: 45, sizeGb: 2.1, createdAt: "2d ago", runId: "run_h3l5m9", tags: ["nlp", "embeddings", "search"], metrics: { "ndcg@10": 0.783, "mrr": 0.812 } },
];

const COMPUTE: ComputeNode[] = [
  { id: "c1", name: "gpu-node-01", type: "NVIDIA A100 80GB", gpuCount: 8, gpuUtil: 87, memUtil: 74, status: "busy", currentRun: "run_a7k3x9", queueDepth: 2 },
  { id: "c2", name: "gpu-node-02", type: "NVIDIA A100 80GB", gpuCount: 8, gpuUtil: 0, memUtil: 12, status: "available", currentRun: null, queueDepth: 0 },
  { id: "c3", name: "gpu-node-03", type: "NVIDIA V100 32GB", gpuCount: 4, gpuUtil: 62, memUtil: 58, status: "busy", currentRun: "run_d9h3k2", queueDepth: 1 },
  { id: "c4", name: "gpu-node-04", type: "NVIDIA V100 32GB", gpuCount: 4, gpuUtil: 0, memUtil: 8, status: "offline", currentRun: null, queueDepth: 0 },
  { id: "c5", name: "cpu-node-01", type: "96-core CPU", gpuCount: 0, gpuUtil: 0, memUtil: 43, status: "busy", currentRun: "run_b2m8p4", queueDepth: 3 },
];

const pipelineStatusColor: Record<PipelineStatus, string> = {
  running: "text-sky-400",
  completed: "text-emerald-400",
  failed: "text-rose-400",
  queued: "text-amber-400",
  cancelled: "text-[var(--color-text-muted)]",
};

const pipelineStatusBg: Record<PipelineStatus, string> = {
  running: "bg-sky-400/10 border-sky-400/30",
  completed: "bg-emerald-400/10 border-emerald-400/30",
  failed: "bg-rose-400/10 border-rose-400/30",
  queued: "bg-amber-400/10 border-amber-400/30",
  cancelled: "bg-[var(--color-surface-3)]/30 border-[var(--color-surface-3)]/30",
};

const stageStatusColor: Record<string, string> = {
  done: "bg-emerald-400",
  running: "bg-sky-400 animate-pulse",
  pending: "bg-[var(--color-surface-3)]",
  failed: "bg-rose-400",
  skipped: "bg-[var(--color-surface-2)]",
};

const modelStageBadge: Record<string, string> = {
  production: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  staging: "bg-sky-500/10 border-sky-500/30 text-sky-400",
  candidate: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  archived: "bg-[var(--color-surface-3)]/30 border-[var(--color-surface-3)] text-[var(--color-text-muted)]",
};

export default function MLPipelineMonitor() {
  const [tab, setTab] = useState<TabId>("pipelines");
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelVersion | null>(null);

  const tabs: { id: TabId; label: string; emoji: string }[] = [
    { id: "pipelines", label: "Pipelines", emoji: "🔀" },
    { id: "runs", label: "Run History", emoji: "📜" },
    { id: "models", label: "Model Registry", emoji: "📦" },
    { id: "compute", label: "Compute", emoji: "🖥️" },
  ];

  const runningCount = PIPELINES.filter(p => p.status === "running").length;
  const failedCount = PIPELINES.filter(p => p.status === "failed").length;
  const prodModels = MODEL_VERSIONS.filter(m => m.stage === "production").length;
  const busyNodes = COMPUTE.filter(c => c.status === "busy").length;

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">ML Pipeline Monitor</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">MLflow + Ray cluster · us-east-1</p>
        </div>
        <div className="flex items-center gap-3">
          {runningCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-500/10 border border-sky-500/30">
              <div className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
              <span className="text-xs text-sky-400 font-medium">{runningCount} running</span>
            </div>
          )}
          {failedCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30">
              <span className="text-xs text-rose-400 font-medium">{failedCount} failed</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-0 border-b border-[var(--color-border)]">
        {[
          { label: "Active Pipelines", value: String(PIPELINES.length), sub: `${runningCount} running` },
          { label: "Total Runs (7d)", value: "284", sub: "92% success rate" },
          { label: "Prod Models", value: String(prodModels), sub: `${MODEL_VERSIONS.length} versions tracked` },
          { label: "GPU Utilization", value: "68%", sub: `${busyNodes}/${COMPUTE.length} nodes busy` },
          { label: "Avg Train Time", value: "47m", sub: "-8% vs last week" },
        ].map((stat, i) => (
          <div key={i} className="px-6 py-3 border-r border-[var(--color-border)] last:border-r-0">
            <div className="text-xl font-bold text-[var(--color-text-primary)]">{stat.value}</div>
            <div className="text-xs font-medium text-[var(--color-text-secondary)] mt-0.5">{stat.label}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] px-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id ? "border-primary text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* PIPELINES TAB */}
        {tab === "pipelines" && (
          <div className="flex h-full">
            <div className="w-96 border-r border-[var(--color-border)] overflow-y-auto">
              {PIPELINES.map(pipeline => (
                <button
                  key={pipeline.id}
                  onClick={() => setSelectedPipeline(pipeline)}
                  className={cn(
                    "w-full text-left px-4 py-4 border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-1)] transition-colors",
                    selectedPipeline?.id === pipeline.id && "bg-[var(--color-surface-2)]"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[var(--color-text-primary)] font-mono">{pipeline.name}</span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded border", pipelineStatusBg[pipeline.status])}>
                      <span className={pipelineStatusColor[pipeline.status]}>{pipeline.status}</span>
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-2 line-clamp-1">{pipeline.description}</p>
                  {/* Stage pills */}
                  <div className="flex items-center gap-1">
                    {pipeline.stages.map((stage, i) => (
                      <React.Fragment key={stage.name}>
                        <div className={cn("h-1.5 rounded-full flex-1", stageStatusColor[stage.status])} title={stage.name} />
                        {i < pipeline.stages.length - 1 && <div className="w-0.5 h-0.5 rounded-full bg-[var(--color-surface-3)]" />}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2 text-xs text-[var(--color-text-muted)]">
                    <span>{pipeline.framework}</span>
                    <span>{pipeline.successRate}% success · {pipeline.totalRuns} runs</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedPipeline ? (
                <div className="p-6 space-y-6">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">{selectedPipeline.name}</h2>
                      <span className={cn("text-xs px-2 py-0.5 rounded border", pipelineStatusBg[selectedPipeline.status])}>
                        <span className={pipelineStatusColor[selectedPipeline.status]}>{selectedPipeline.status}</span>
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)]">{selectedPipeline.description}</p>
                  </div>

                  {/* Stage progress */}
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Pipeline Stages</div>
                    <div className="space-y-2">
                      {selectedPipeline.stages.map((stage, i) => (
                        <div key={stage.name} className="flex items-center gap-3">
                          <div className={cn(
                            "w-5 h-5 rounded-full flex items-center justify-center text-xs shrink-0",
                            stage.status === "done" ? "bg-emerald-500/20 text-emerald-400" :
                            stage.status === "running" ? "bg-sky-500/20 text-sky-400" :
                            stage.status === "failed" ? "bg-rose-500/20 text-rose-400" :
                            "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                          )}>
                            {stage.status === "done" ? "✓" :
                             stage.status === "running" ? "▶" :
                             stage.status === "failed" ? "✗" :
                             String(i + 1)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-sm",
                                stage.status === "done" ? "text-[var(--color-text-primary)]" :
                                stage.status === "running" ? "text-sky-400 font-medium" :
                                stage.status === "failed" ? "text-rose-400" :
                                "text-[var(--color-text-muted)]"
                              )}>{stage.name}</span>
                              {stage.duration && <span className="text-xs text-[var(--color-text-muted)]">{stage.duration}</span>}
                            </div>
                            {stage.status === "running" && (
                              <div className="mt-1 h-0.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                                <div className="h-full bg-sky-500 rounded-full animate-pulse" style={{ width: "60%" }} />
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Framework", value: selectedPipeline.framework },
                      { label: "Avg Duration", value: selectedPipeline.avgDuration },
                      { label: "Success Rate", value: `${selectedPipeline.successRate}%` },
                      { label: "Total Runs", value: String(selectedPipeline.totalRuns) },
                      { label: "Last Run", value: selectedPipeline.lastRun },
                      { label: "Owner", value: selectedPipeline.owner },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-[var(--color-surface-1)] rounded p-3">
                        <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
                        <div className="text-sm font-medium text-[var(--color-text-primary)] mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Tags */}
                  <div className="flex gap-2 flex-wrap">
                    {selectedPipeline.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-xs text-[var(--color-text-secondary)] font-mono">{tag}</span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    {selectedPipeline.status === "running" ? (
                      <button className="px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded text-amber-400 transition-colors">Stop Run</button>
                    ) : (
                      <button className="px-3 py-1.5 text-xs bg-primary hover:bg-primary rounded text-[var(--color-text-primary)] transition-colors">Trigger Run</button>
                    )}
                    {["View Logs", "Edit Config", "Clone Pipeline"].map(action => (
                      <button key={action} className="px-3 py-1.5 text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] transition-colors">{action}</button>
                    ))}
                  </div>

                  {selectedPipeline.status === "failed" && (
                    <div className="bg-rose-500/10 border border-rose-500/30 rounded-lg p-4">
                      <div className="text-rose-400 font-medium text-sm mb-1">Run Failed — Fine-tuning Stage</div>
                      <p className="text-xs text-rose-300/70 font-mono">CUDA out of memory. Tried to allocate 2.50 GiB. GPU 0 has total capacity of 40.00 GiB with 1.82 GiB free.</p>
                      <div className="mt-2 flex gap-2">
                        <button className="px-3 py-1 text-xs bg-rose-500/20 border border-rose-500/40 rounded text-rose-400 hover:bg-rose-500/30 transition-colors">View Full Trace</button>
                        <button className="px-3 py-1 text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] transition-colors">Retry with lower batch size</button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">
                  Select a pipeline to view details
                </div>
              )}
            </div>
          </div>
        )}

        {/* RUNS TAB */}
        {tab === "runs" && (
          <div className="p-6">
            <div className="space-y-2">
              {RUNS.map(run => (
                <div key={run.id} className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-[var(--color-text-muted)]">{run.runId}</span>
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{run.pipelineName}</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        Started {run.startedAt} · {run.duration} · by {run.triggeredBy} · <span className="font-mono">{run.gitCommit}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {run.gpuCount > 0 && (
                        <span className="text-xs text-[var(--color-text-muted)]">{run.gpuCount}× {run.gpuType}</span>
                      )}
                      <span className={cn("text-xs px-2 py-0.5 rounded border", pipelineStatusBg[run.status])}>
                        <span className={pipelineStatusColor[run.status]}>{run.status}</span>
                      </span>
                    </div>
                  </div>

                  {Object.keys(run.metrics).length > 0 && (
                    <div className="flex gap-4 flex-wrap">
                      {run.trainLoss !== null && (
                        <div className="text-xs">
                          <span className="text-[var(--color-text-muted)]">train_loss </span>
                          <span className="text-[var(--color-text-primary)] font-mono">{run.trainLoss.toFixed(4)}</span>
                        </div>
                      )}
                      {run.valLoss !== null && (
                        <div className="text-xs">
                          <span className="text-[var(--color-text-muted)]">val_loss </span>
                          <span className="text-[var(--color-text-primary)] font-mono">{run.valLoss.toFixed(4)}</span>
                        </div>
                      )}
                      {run.accuracy !== null && (
                        <div className="text-xs">
                          <span className="text-[var(--color-text-muted)]">accuracy </span>
                          <span className="text-emerald-400 font-mono">{(run.accuracy * 100).toFixed(1)}%</span>
                        </div>
                      )}
                      {Object.entries(run.metrics).map(([k, v]) => (
                        <div key={k} className="text-xs">
                          <span className="text-[var(--color-text-muted)]">{k} </span>
                          <span className="text-[var(--color-text-primary)] font-mono">{typeof v === "number" && v < 10 ? v.toFixed(3) : v}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MODEL REGISTRY TAB */}
        {tab === "models" && (
          <div className="flex h-full">
            <div className="w-80 border-r border-[var(--color-border)] overflow-y-auto">
              <div className="p-3 border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                {MODEL_VERSIONS.length} model versions
              </div>
              {MODEL_VERSIONS.map(model => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-1)] transition-colors",
                    selectedModel?.id === model.id && "bg-[var(--color-surface-2)]"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[var(--color-text-primary)] font-mono">{model.name}</span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded border", modelStageBadge[model.stage])}>{model.stage}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
                    <span>v{model.version} · {model.framework}</span>
                    <span>{(model.accuracy * 100).toFixed(1)}% acc</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedModel ? (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">{selectedModel.name} <span className="text-[var(--color-text-muted)]">v{selectedModel.version}</span></h2>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{selectedModel.framework} · created {selectedModel.createdAt} · run <span className="font-mono">{selectedModel.runId}</span></p>
                    </div>
                    <span className={cn("text-xs px-2 py-1 rounded border", modelStageBadge[selectedModel.stage])}>{selectedModel.stage}</span>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Accuracy", value: `${(selectedModel.accuracy * 100).toFixed(2)}%`, highlight: true },
                      { label: "Latency", value: `${selectedModel.latencyMs}ms p99` },
                      { label: "Model Size", value: `${selectedModel.sizeGb} GB` },
                    ].map(({ label, value, highlight }) => (
                      <div key={label} className="bg-[var(--color-surface-1)] rounded p-4 text-center">
                        <div className={cn("text-2xl font-bold", highlight ? "text-emerald-400" : "text-[var(--color-text-primary)]")}>{value}</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">{label}</div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">Evaluation Metrics</div>
                    <div className="space-y-2">
                      {Object.entries(selectedModel.metrics).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-xs text-[var(--color-text-secondary)] w-28 font-mono shrink-0">{key}</span>
                          <div className="flex-1 bg-[var(--color-surface-2)] rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${Math.min(value, 1) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-[var(--color-text-primary)] font-mono w-12 text-right">{value < 10 ? value.toFixed(3) : value.toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {selectedModel.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-xs text-[var(--color-text-secondary)] font-mono">{tag}</span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    {selectedModel.stage === "candidate" && (
                      <button className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 rounded text-[var(--color-text-primary)] transition-colors">Promote to Production</button>
                    )}
                    {selectedModel.stage === "production" && (
                      <button className="px-3 py-1.5 text-xs bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded text-amber-400 transition-colors">Archive</button>
                    )}
                    {["Compare Versions", "Download", "Deploy to Endpoint"].map(action => (
                      <button key={action} className="px-3 py-1.5 text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] transition-colors">{action}</button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">Select a model version</div>
              )}
            </div>
          </div>
        )}

        {/* COMPUTE TAB */}
        {tab === "compute" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Compute Nodes</h2>
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> Available</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> Busy</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--color-surface-3)] inline-block" /> Offline</span>
              </div>
            </div>

            <div className="space-y-3">
              {COMPUTE.map(node => (
                <div key={node.id} className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2.5 h-2.5 rounded-full",
                        node.status === "available" ? "bg-emerald-400" :
                        node.status === "busy" ? "bg-sky-400 animate-pulse" : "bg-[var(--color-surface-3)]"
                      )} />
                      <div>
                        <span className="font-mono text-sm text-[var(--color-text-primary)]">{node.name}</span>
                        <span className="text-xs text-[var(--color-text-muted)] ml-2">{node.type}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {node.currentRun && (
                        <span className="text-xs font-mono text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/20">{node.currentRun}</span>
                      )}
                      {node.queueDepth > 0 && (
                        <span className="text-xs text-amber-400">{node.queueDepth} queued</span>
                      )}
                    </div>
                  </div>

                  {node.gpuCount > 0 ? (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[var(--color-text-muted)]">GPU Utilization</span>
                          <span className={cn("text-xs font-medium", node.gpuUtil > 80 ? "text-amber-400" : "text-[var(--color-text-primary)]")}>{node.gpuUtil}%</span>
                        </div>
                        <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                          <div
                            className={cn("h-full rounded-full transition-all", node.gpuUtil > 80 ? "bg-amber-500" : "bg-sky-500")}
                            style={{ width: `${node.gpuUtil}%` }}
                          />
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">{node.gpuCount} GPUs</div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[var(--color-text-muted)]">Memory</span>
                          <span className="text-xs font-medium text-[var(--color-text-primary)]">{node.memUtil}%</span>
                        </div>
                        <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${node.memUtil}%` }}
                          />
                        </div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-1">GPU VRAM</div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--color-text-muted)]">CPU Memory</span>
                        <span className="text-xs font-medium text-[var(--color-text-primary)]">{node.memUtil}%</span>
                      </div>
                      <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${node.memUtil}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {node.status === "offline" && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/50 rounded p-2">
                      <span>⚠️</span> Node offline — last heartbeat 47m ago
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
