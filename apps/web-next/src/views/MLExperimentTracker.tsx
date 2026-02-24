import React, { useState } from "react";
import { cn } from "../lib/utils";

type ExpStatus = "running" | "completed" | "failed" | "queued" | "stopped";
type MetricTrend = "improving" | "degrading" | "stable";
type ModelFramework = "pytorch" | "tensorflow" | "sklearn" | "xgboost" | "jax";

interface HyperParam {
  name: string;
  value: string | number;
  type: "float" | "int" | "string" | "bool";
}

interface RunMetric {
  step: number;
  trainLoss: number;
  valLoss: number;
  accuracy: number;
  f1: number;
}

interface Experiment {
  id: string;
  name: string;
  description: string;
  status: ExpStatus;
  framework: ModelFramework;
  dataset: string;
  tags: string[];
  createdBy: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  durationMin: number | null;
  hyperParams: HyperParam[];
  metrics: RunMetric[];
  bestValLoss: number | null;
  bestAccuracy: number | null;
  gpuCount: number;
  gpuType: string;
}

interface ModelVersion {
  id: string;
  experimentId: string;
  name: string;
  version: string;
  accuracy: number;
  f1: number;
  size: string;
  registeredAt: string;
  stage: "development" | "staging" | "production" | "archived";
}

const statusBadge: Record<ExpStatus, string> = {
  running:   "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  completed: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  failed:    "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  queued:    "bg-[var(--color-surface-3)]/20 text-[var(--color-text-primary)] border border-[var(--color-surface-3)]/30",
  stopped:   "bg-amber-500/20 text-amber-300 border border-amber-500/30",
};

const statusDot: Record<ExpStatus, string> = {
  running:   "bg-blue-400 animate-pulse",
  completed: "bg-emerald-400",
  failed:    "bg-rose-400",
  queued:    "bg-[var(--color-surface-3)]",
  stopped:   "bg-amber-400",
};

const frameworkBadge: Record<ModelFramework, string> = {
  pytorch:     "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  tensorflow:  "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  sklearn:     "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  xgboost:    "bg-teal-500/20 text-teal-300 border border-teal-500/30",
  jax:         "bg-purple-500/20 text-purple-300 border border-purple-500/30",
};

const stageBadge: Record<ModelVersion["stage"], string> = {
  development: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
  staging:     "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  production:  "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  archived:    "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)] border border-[var(--color-surface-3)]/30",
};

const EXPERIMENTS: Experiment[] = [
  {
    id: "exp-001",
    name: "Intent Classifier v4 — Transformer",
    description: "Fine-tuned BERT for multi-class intent classification with 24 intents",
    status: "running",
    framework: "pytorch",
    dataset: "intent-corpus-v3 (124k samples)",
    tags: ["nlp", "classification", "production-candidate"],
    createdBy: "xavier",
    createdAt: "2026-02-22",
    startedAt: "2026-02-22T08:00:00Z",
    finishedAt: null,
    durationMin: null,
    gpuCount: 4,
    gpuType: "A100 80GB",
    hyperParams: [
      { name: "learning_rate", value: 2e-5, type: "float" },
      { name: "batch_size", value: 32, type: "int" },
      { name: "max_epochs", value: 20, type: "int" },
      { name: "warmup_steps", value: 500, type: "int" },
      { name: "dropout", value: 0.1, type: "float" },
      { name: "weight_decay", value: 0.01, type: "float" },
    ],
    metrics: [
      { step: 1, trainLoss: 1.82, valLoss: 1.91, accuracy: 0.52, f1: 0.48 },
      { step: 2, trainLoss: 1.41, valLoss: 1.58, accuracy: 0.65, f1: 0.62 },
      { step: 3, trainLoss: 1.12, valLoss: 1.28, accuracy: 0.72, f1: 0.70 },
      { step: 4, trainLoss: 0.89, valLoss: 1.05, accuracy: 0.78, f1: 0.76 },
      { step: 5, trainLoss: 0.72, valLoss: 0.88, accuracy: 0.82, f1: 0.81 },
      { step: 6, trainLoss: 0.61, valLoss: 0.78, accuracy: 0.85, f1: 0.84 },
      { step: 7, trainLoss: 0.53, valLoss: 0.71, accuracy: 0.87, f1: 0.86 },
      { step: 8, trainLoss: 0.47, valLoss: 0.66, accuracy: 0.88, f1: 0.87 },
    ],
    bestValLoss: 0.66,
    bestAccuracy: 0.88,
  },
  {
    id: "exp-002",
    name: "Anomaly Detector — Autoencoder",
    description: "Reconstruction-based anomaly detection for API traffic",
    status: "completed",
    framework: "pytorch",
    dataset: "api-traffic-logs-v2 (2.1M events)",
    tags: ["anomaly-detection", "time-series"],
    createdBy: "quinn",
    createdAt: "2026-02-21",
    startedAt: "2026-02-21T14:00:00Z",
    finishedAt: "2026-02-21T16:45:00Z",
    durationMin: 165,
    gpuCount: 2,
    gpuType: "A100 40GB",
    hyperParams: [
      { name: "latent_dim", value: 32, type: "int" },
      { name: "learning_rate", value: 1e-3, type: "float" },
      { name: "batch_size", value: 256, type: "int" },
      { name: "hidden_layers", value: "[128, 64, 32]", type: "string" },
    ],
    metrics: [
      { step: 1, trainLoss: 0.45, valLoss: 0.48, accuracy: 0.70, f1: 0.67 },
      { step: 5, trainLoss: 0.21, valLoss: 0.23, accuracy: 0.86, f1: 0.84 },
      { step: 10, trainLoss: 0.12, valLoss: 0.14, accuracy: 0.92, f1: 0.91 },
      { step: 15, trainLoss: 0.09, valLoss: 0.11, accuracy: 0.94, f1: 0.93 },
      { step: 20, trainLoss: 0.07, valLoss: 0.09, accuracy: 0.95, f1: 0.94 },
    ],
    bestValLoss: 0.09,
    bestAccuracy: 0.95,
  },
  {
    id: "exp-003",
    name: "Churn Predictor — XGBoost",
    description: "Gradient boosted trees for 30-day churn prediction",
    status: "completed",
    framework: "xgboost",
    dataset: "customer-events-12mo (87k customers)",
    tags: ["churn", "classification", "revenue"],
    createdBy: "piper",
    createdAt: "2026-02-20",
    startedAt: "2026-02-20T10:00:00Z",
    finishedAt: "2026-02-20T10:22:00Z",
    durationMin: 22,
    gpuCount: 0,
    gpuType: "CPU (32 cores)",
    hyperParams: [
      { name: "n_estimators", value: 500, type: "int" },
      { name: "max_depth", value: 6, type: "int" },
      { name: "learning_rate", value: 0.05, type: "float" },
      { name: "subsample", value: 0.8, type: "float" },
      { name: "colsample_bytree", value: 0.8, type: "float" },
    ],
    metrics: [
      { step: 100, trainLoss: 0.18, valLoss: 0.21, accuracy: 0.87, f1: 0.83 },
      { step: 200, trainLoss: 0.14, valLoss: 0.18, accuracy: 0.89, f1: 0.86 },
      { step: 300, trainLoss: 0.12, valLoss: 0.16, accuracy: 0.91, f1: 0.88 },
      { step: 400, trainLoss: 0.10, valLoss: 0.15, accuracy: 0.92, f1: 0.89 },
      { step: 500, trainLoss: 0.09, valLoss: 0.15, accuracy: 0.92, f1: 0.89 },
    ],
    bestValLoss: 0.15,
    bestAccuracy: 0.92,
  },
  {
    id: "exp-004",
    name: "Entity Extractor — BiLSTM-CRF",
    description: "Named entity recognition for extracting entities from user messages",
    status: "failed",
    framework: "pytorch",
    dataset: "ner-annotated-v2 (45k sentences)",
    tags: ["ner", "nlp"],
    createdBy: "sam",
    createdAt: "2026-02-19",
    startedAt: "2026-02-19T16:00:00Z",
    finishedAt: "2026-02-19T16:08:00Z",
    durationMin: 8,
    gpuCount: 1,
    gpuType: "V100 32GB",
    hyperParams: [
      { name: "hidden_dim", value: 256, type: "int" },
      { name: "num_layers", value: 2, type: "int" },
      { name: "learning_rate", value: 5e-4, type: "float" },
    ],
    metrics: [
      { step: 1, trainLoss: 2.14, valLoss: 2.22, accuracy: 0.31, f1: 0.28 },
      { step: 2, trainLoss: 1.98, valLoss: 2.45, accuracy: 0.29, f1: 0.27 },
    ],
    bestValLoss: 2.22,
    bestAccuracy: 0.31,
  },
  {
    id: "exp-005",
    name: "Sentiment Analyzer — DistilBERT",
    description: "Lightweight sentiment model for real-time message scoring",
    status: "queued",
    framework: "pytorch",
    dataset: "sentiment-corpus-v4 (210k samples)",
    tags: ["sentiment", "real-time"],
    createdBy: "xavier",
    createdAt: "2026-02-22",
    startedAt: null,
    finishedAt: null,
    durationMin: null,
    gpuCount: 2,
    gpuType: "A100 80GB",
    hyperParams: [
      { name: "learning_rate", value: 3e-5, type: "float" },
      { name: "batch_size", value: 64, type: "int" },
    ],
    metrics: [],
    bestValLoss: null,
    bestAccuracy: null,
  },
];

const MODEL_VERSIONS: ModelVersion[] = [
  { id: "mv-01", experimentId: "exp-002", name: "anomaly-detector", version: "v2.3.0", accuracy: 0.95, f1: 0.94, size: "12.4 MB", registeredAt: "2026-02-21", stage: "production" },
  { id: "mv-02", experimentId: "exp-003", name: "churn-predictor", version: "v1.8.0", accuracy: 0.92, f1: 0.89, size: "28.1 MB", registeredAt: "2026-02-20", stage: "staging" },
  { id: "mv-03", experimentId: "exp-001", name: "intent-classifier", version: "v4.0.0-rc1", accuracy: 0.88, f1: 0.87, size: "418 MB", registeredAt: "2026-02-22", stage: "development" },
  { id: "mv-04", experimentId: "exp-003", name: "churn-predictor", version: "v1.7.2", accuracy: 0.91, f1: 0.88, size: "26.4 MB", registeredAt: "2026-02-15", stage: "archived" },
];

const maxMetricLoss = 2.5;

export default function MLExperimentTracker() {
  const [tab, setTab] = useState<"experiments" | "compare" | "models" | "artifacts">("experiments");
  const [selectedExp, setSelectedExp] = useState<Experiment>(EXPERIMENTS[0]);
  const [compareA, setCompareA] = useState<string>("exp-002");
  const [compareB, setCompareB] = useState<string>("exp-003");

  const expA = EXPERIMENTS.find(e => e.id === compareA);
  const expB = EXPERIMENTS.find(e => e.id === compareB);

  const completedExps = EXPERIMENTS.filter(e => e.status === "completed");

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">ML Experiment Tracker</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Runs · Compare · Model Registry</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-[var(--color-text-secondary)]">{EXPERIMENTS.filter(e => e.status === "running").length} running</span>
          </span>
          <span className="text-[var(--color-text-secondary)]">{completedExps.length} completed</span>
          <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium transition-colors">
            + New Experiment
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] px-6">
        {(["experiments", "compare", "models", "artifacts"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize",
              tab === t ? "border-indigo-500 text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t === "models" ? "Model Registry" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Experiments Tab */}
      {tab === "experiments" && (
        <div className="flex flex-1 overflow-hidden">
          {/* List */}
          <div className="w-80 border-r border-[var(--color-border)] overflow-y-auto">
            {EXPERIMENTS.map(exp => (
              <button
                key={exp.id}
                onClick={() => setSelectedExp(exp)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)]/40 transition-colors",
                  selectedExp.id === exp.id && "bg-[var(--color-surface-2)]/60"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusDot[exp.status])} />
                  <span className="text-xs font-mono text-[var(--color-text-muted)]">{exp.id}</span>
                  <span className={cn("ml-auto text-xs px-1.5 py-0.5 rounded-full", statusBadge[exp.status])}>{exp.status}</span>
                </div>
                <div className="text-xs font-medium text-[var(--color-text-primary)] mb-1 leading-snug">{exp.name}</div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-1.5 py-0.5 rounded", frameworkBadge[exp.framework])}>{exp.framework}</span>
                  {exp.bestAccuracy !== null && (
                    <span className="text-xs text-emerald-400">acc:{(exp.bestAccuracy * 100).toFixed(1)}%</span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Detail */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="font-mono text-xs text-[var(--color-text-muted)] mb-1">{selectedExp.id}</div>
                <h2 className="text-base font-semibold mb-1">{selectedExp.name}</h2>
                <p className="text-xs text-[var(--color-text-secondary)] mb-2">{selectedExp.description}</p>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded", frameworkBadge[selectedExp.framework])}>{selectedExp.framework}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBadge[selectedExp.status])}>{selectedExp.status}</span>
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="text-xs text-[var(--color-text-muted)]">GPU</div>
                <div className="text-[var(--color-text-primary)]">{selectedExp.gpuCount > 0 ? `${selectedExp.gpuCount}× ${selectedExp.gpuType}` : selectedExp.gpuType}</div>
              </div>
            </div>

            {/* Metric summary */}
            {selectedExp.bestAccuracy !== null && (
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-[var(--color-surface-1)] rounded-lg p-3 text-center">
                  <div className="text-xl font-bold font-mono text-emerald-400">{(selectedExp.bestAccuracy * 100).toFixed(1)}%</div>
                  <div className="text-xs text-[var(--color-text-muted)]">best accuracy</div>
                </div>
                <div className="bg-[var(--color-surface-1)] rounded-lg p-3 text-center">
                  <div className="text-xl font-bold font-mono text-[var(--color-text-primary)]">{selectedExp.bestValLoss}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">best val loss</div>
                </div>
                <div className="bg-[var(--color-surface-1)] rounded-lg p-3 text-center">
                  <div className="text-xl font-bold font-mono text-[var(--color-text-primary)]">{selectedExp.durationMin !== null ? `${selectedExp.durationMin}m` : "—"}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">duration</div>
                </div>
              </div>
            )}

            {/* Loss chart */}
            {selectedExp.metrics.length > 0 && (
              <div className="bg-[var(--color-surface-1)] rounded-lg p-4 mb-4">
                <div className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Loss Curve</div>
                <div className="flex items-end gap-2 h-28">
                  {selectedExp.metrics.map(m => (
                    <div key={m.step} className="flex-1 flex gap-0.5 items-end h-full">
                      <div
                        className="flex-1 bg-indigo-500 rounded-t"
                        style={{ height: `${Math.min((m.trainLoss / maxMetricLoss) * 100, 100)}%` }}
                        title={`Train: ${m.trainLoss}`}
                      />
                      <div
                        className="flex-1 bg-rose-500/70 rounded-t"
                        style={{ height: `${Math.min((m.valLoss / maxMetricLoss) * 100, 100)}%` }}
                        title={`Val: ${m.valLoss}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /><span className="text-[var(--color-text-secondary)]">Train</span></span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500/70" /><span className="text-[var(--color-text-secondary)]">Val</span></span>
                </div>
              </div>
            )}

            {/* Hyperparams */}
            <div className="bg-[var(--color-surface-1)] rounded-lg p-4 mb-4">
              <div className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Hyperparameters</div>
              <div className="grid grid-cols-2 gap-2">
                {selectedExp.hyperParams.map(hp => (
                  <div key={hp.name} className="flex items-center justify-between bg-[var(--color-surface-2)] rounded px-3 py-2">
                    <span className="font-mono text-xs text-[var(--color-text-secondary)]">{hp.name}</span>
                    <span className="font-mono text-xs text-[var(--color-text-primary)]">{String(hp.value)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tags + dataset */}
            <div className="text-xs text-[var(--color-text-muted)]">
              Dataset: <span className="text-[var(--color-text-primary)]">{selectedExp.dataset}</span>
              <span className="mx-2">·</span>
              By <span className="text-[var(--color-text-primary)]">{selectedExp.createdBy}</span>
              <span className="mx-2">·</span>
              {selectedExp.createdAt}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedExp.tags.map(t => (
                <span key={t} className="text-xs px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]">{t}</span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Compare Tab */}
      {tab === "compare" && (
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-base font-semibold mb-4">Compare Experiments</h2>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">Experiment A</label>
              <select value={compareA} onChange={e => setCompareA(e.target.value)} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)]">
                {EXPERIMENTS.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1.5">Experiment B</label>
              <select value={compareB} onChange={e => setCompareB(e.target.value)} className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)]">
                {EXPERIMENTS.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>
          {expA && expB && (
            <div className="space-y-3">
              {[
                { label: "Status", a: expA.status, b: expB.status },
                { label: "Framework", a: expA.framework, b: expB.framework },
                { label: "Best Accuracy", a: expA.bestAccuracy !== null ? `${(expA.bestAccuracy * 100).toFixed(1)}%` : "—", b: expB.bestAccuracy !== null ? `${(expB.bestAccuracy * 100).toFixed(1)}%` : "—" },
                { label: "Best Val Loss", a: expA.bestValLoss !== null ? String(expA.bestValLoss) : "—", b: expB.bestValLoss !== null ? String(expB.bestValLoss) : "—" },
                { label: "Duration", a: expA.durationMin !== null ? `${expA.durationMin}m` : "—", b: expB.durationMin !== null ? `${expB.durationMin}m` : "—" },
                { label: "Dataset", a: expA.dataset, b: expB.dataset },
                { label: "GPU", a: `${expA.gpuCount > 0 ? `${expA.gpuCount}× ` : ""}${expA.gpuType}`, b: `${expB.gpuCount > 0 ? `${expB.gpuCount}× ` : ""}${expB.gpuType}` },
              ].map(row => (
                <div key={row.label} className="grid grid-cols-3 gap-3">
                  <div className="bg-[var(--color-surface-1)] rounded p-3 text-center col-span-1">
                    <div className="text-xs text-[var(--color-text-muted)]">{row.label}</div>
                  </div>
                  <div className="bg-[var(--color-surface-1)] rounded p-3 text-center">
                    <div className="text-xs font-mono text-indigo-300">{row.a}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Exp A</div>
                  </div>
                  <div className="bg-[var(--color-surface-1)] rounded p-3 text-center">
                    <div className="text-xs font-mono text-emerald-300">{row.b}</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Exp B</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Model Registry Tab */}
      {tab === "models" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Model Registry</h2>
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
              <span className="text-emerald-400">●</span> Production
              <span className="text-amber-400 ml-2">●</span> Staging
              <span className="text-indigo-400 ml-2">●</span> Dev
            </div>
          </div>
          <div className="space-y-3">
            {MODEL_VERSIONS.map(mv => (
              <div key={mv.id} className="bg-[var(--color-surface-1)] rounded-xl p-4 flex items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">{mv.name}</span>
                    <span className="font-mono text-xs text-[var(--color-text-muted)]">{mv.version}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", stageBadge[mv.stage])}>{mv.stage}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">from {mv.experimentId} · registered {mv.registeredAt} · {mv.size}</div>
                </div>
                <div className="flex items-center gap-6 text-center">
                  <div>
                    <div className="text-lg font-bold font-mono text-emerald-400">{(mv.accuracy * 100).toFixed(1)}%</div>
                    <div className="text-xs text-[var(--color-text-muted)]">accuracy</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold font-mono text-[var(--color-text-primary)]">{(mv.f1 * 100).toFixed(1)}%</div>
                    <div className="text-xs text-[var(--color-text-muted)]">F1</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="text-xs px-2.5 py-1.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded border border-[var(--color-border)] transition-colors">Download</button>
                  <button className="text-xs px-2.5 py-1.5 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded transition-colors">Promote</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Artifacts Tab */}
      {tab === "artifacts" && (
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-base font-semibold mb-4">Experiment Artifacts</h2>
          <div className="space-y-2">
            {[
              { exp: "exp-002", name: "model.pt", size: "12.4 MB", type: "model", created: "2026-02-21 16:45" },
              { exp: "exp-002", name: "tokenizer.json", size: "482 KB", type: "config", created: "2026-02-21 16:45" },
              { exp: "exp-002", name: "confusion_matrix.png", size: "84 KB", type: "plot", created: "2026-02-21 16:44" },
              { exp: "exp-002", name: "eval_metrics.json", size: "12 KB", type: "metrics", created: "2026-02-21 16:44" },
              { exp: "exp-003", name: "model.joblib", size: "26.4 MB", type: "model", created: "2026-02-20 10:22" },
              { exp: "exp-003", name: "feature_importance.csv", size: "24 KB", type: "data", created: "2026-02-20 10:22" },
              { exp: "exp-003", name: "roc_curve.png", size: "96 KB", type: "plot", created: "2026-02-20 10:21" },
              { exp: "exp-001", name: "checkpoint_epoch8.pt", size: "412 MB", type: "checkpoint", created: "2026-02-22 10:12" },
            ].map((a, i) => (
              <div key={i} className="bg-[var(--color-surface-1)] rounded-lg p-3 flex items-center gap-4">
                <span className="text-sm">{a.type === "model" ? "🤖" : a.type === "plot" ? "📊" : a.type === "metrics" ? "📋" : a.type === "checkpoint" ? "💾" : a.type === "config" ? "⚙️" : "📄"}</span>
                <div className="flex-1">
                  <div className="font-mono text-sm text-[var(--color-text-primary)]">{a.name}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{a.exp} · {a.size}</div>
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">{a.created}</div>
                <button className="text-xs px-2.5 py-1 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded border border-[var(--color-border)] transition-colors">⬇</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
