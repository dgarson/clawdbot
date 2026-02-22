import React, { useState } from "react"
import { cn } from "../lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────────

type TabId = "models" | "experiments" | "deployments" | "lineage"

type Framework = "PyTorch" | "TensorFlow" | "JAX" | "ONNX"
type TaskType = "LLM" | "classifier" | "embedder" | "reward"
type ExperimentStatus = "running" | "completed" | "failed"
type HealthStatus = "healthy" | "degraded" | "down"

interface ModelMetrics {
  accuracy: number
  f1: number
  precision: number
  recall: number
  loss: number
}

interface Model {
  id: string
  name: string
  version: string
  framework: Framework
  taskType: TaskType
  sizeGB: number
  trainingDataset: string
  metrics: ModelMetrics
  tags: string[]
  description: string
  createdAt: string
  author: string
}

interface ExperimentConfig {
  learningRate: number
  batchSize: number
  epochs: number
  optimizer: string
  warmupSteps: number
}

interface ExperimentMetrics {
  loss: number
  accuracy: number
  f1: number
}

interface Experiment {
  id: string
  name: string
  modelId: string
  modelName: string
  config: ExperimentConfig
  metrics: ExperimentMetrics
  duration: string
  gpuHours: number
  status: ExperimentStatus
  startedAt: string
  completedAt: string | null
  gpuType: string
}

interface Deployment {
  id: string
  modelId: string
  modelName: string
  modelVersion: string
  endpointUrl: string
  trafficPercent: number
  latencyP50: number
  latencyP95: number
  latencyP99: number
  requestsPerDay: number
  health: HealthStatus
  deployedAt: string
  region: string
}

interface LineageEntry {
  id: string
  modelName: string
  version: string
  parentVersion: string | null
  trainingDataVersion: string
  trainedBy: string
  trainedAt: string
  deployedToProd: string | null
  changeNotes: string
}

// ── Data ───────────────────────────────────────────────────────────────────────

const MODELS: Model[] = [
  {
    id: "m1",
    name: "Nova-LLM",
    version: "3.2.1",
    framework: "PyTorch",
    taskType: "LLM",
    sizeGB: 42.5,
    trainingDataset: "CommonCrawl-2025-Q4",
    metrics: { accuracy: 0.921, f1: 0.918, precision: 0.925, recall: 0.911, loss: 0.087 },
    tags: ["production", "multilingual", "chat"],
    description: "Large language model optimized for multi-turn conversational tasks with multilingual support across 48 languages.",
    createdAt: "2026-01-15",
    author: "ML Platform Team",
  },
  {
    id: "m2",
    name: "SentinelClassifier",
    version: "2.0.4",
    framework: "TensorFlow",
    taskType: "classifier",
    sizeGB: 1.8,
    trainingDataset: "InternalModeration-v7",
    metrics: { accuracy: 0.967, f1: 0.954, precision: 0.971, recall: 0.938, loss: 0.034 },
    tags: ["safety", "moderation", "realtime"],
    description: "Content moderation classifier for detecting harmful, toxic, and policy-violating content in real time.",
    createdAt: "2026-01-22",
    author: "Trust & Safety",
  },
  {
    id: "m3",
    name: "EmbedX",
    version: "1.5.0",
    framework: "JAX",
    taskType: "embedder",
    sizeGB: 4.2,
    trainingDataset: "SemanticPairs-12M",
    metrics: { accuracy: 0.889, f1: 0.876, precision: 0.892, recall: 0.861, loss: 0.121 },
    tags: ["search", "rag", "semantic"],
    description: "High-performance text embedding model for semantic search and retrieval-augmented generation pipelines.",
    createdAt: "2025-12-08",
    author: "Search Team",
  },
  {
    id: "m4",
    name: "RewardForge",
    version: "1.1.2",
    framework: "PyTorch",
    taskType: "reward",
    sizeGB: 8.7,
    trainingDataset: "HumanPrefs-500K",
    metrics: { accuracy: 0.845, f1: 0.832, precision: 0.858, recall: 0.807, loss: 0.163 },
    tags: ["rlhf", "alignment", "preference"],
    description: "Reward model for RLHF pipeline, trained on 500K human preference comparisons across diverse task categories.",
    createdAt: "2026-02-01",
    author: "Alignment Team",
  },
  {
    id: "m5",
    name: "VisionNet",
    version: "4.0.0",
    framework: "ONNX",
    taskType: "classifier",
    sizeGB: 12.3,
    trainingDataset: "ImageNet-2025-Extended",
    metrics: { accuracy: 0.948, f1: 0.941, precision: 0.952, recall: 0.931, loss: 0.055 },
    tags: ["vision", "multimodal", "production"],
    description: "State-of-the-art image classification model with multimodal capabilities for document and scene understanding.",
    createdAt: "2026-02-10",
    author: "Vision Team",
  },
  {
    id: "m6",
    name: "CodeBERT-XL",
    version: "2.3.0",
    framework: "PyTorch",
    taskType: "embedder",
    sizeGB: 6.1,
    trainingDataset: "GithubCode-50M",
    metrics: { accuracy: 0.912, f1: 0.905, precision: 0.918, recall: 0.893, loss: 0.095 },
    tags: ["code", "embeddings", "search"],
    description: "Code-specialized embedding model trained on 50M code snippets across 32 programming languages.",
    createdAt: "2026-01-30",
    author: "Developer Tools",
  },
  {
    id: "m7",
    name: "TinyChat",
    version: "1.0.0",
    framework: "ONNX",
    taskType: "LLM",
    sizeGB: 0.8,
    trainingDataset: "ChatDistill-2M",
    metrics: { accuracy: 0.834, f1: 0.821, precision: 0.842, recall: 0.801, loss: 0.178 },
    tags: ["edge", "mobile", "distilled"],
    description: "Distilled conversational model optimized for edge deployment on mobile devices with sub-100ms latency.",
    createdAt: "2026-02-18",
    author: "Edge ML Team",
  },
]

const EXPERIMENTS: Experiment[] = [
  {
    id: "exp-001",
    name: "Nova-LLM lr-sweep-3e-4",
    modelId: "m1",
    modelName: "Nova-LLM",
    config: { learningRate: 0.0003, batchSize: 256, epochs: 12, optimizer: "AdamW", warmupSteps: 2000 },
    metrics: { loss: 0.087, accuracy: 0.921, f1: 0.918 },
    duration: "18h 42m",
    gpuHours: 149.6,
    status: "completed",
    startedAt: "2026-01-12 08:00",
    completedAt: "2026-01-13 02:42",
    gpuType: "A100 80GB x8",
  },
  {
    id: "exp-002",
    name: "Nova-LLM lr-sweep-5e-4",
    modelId: "m1",
    modelName: "Nova-LLM",
    config: { learningRate: 0.0005, batchSize: 256, epochs: 12, optimizer: "AdamW", warmupSteps: 2000 },
    metrics: { loss: 0.094, accuracy: 0.913, f1: 0.909 },
    duration: "17h 58m",
    gpuHours: 143.7,
    status: "completed",
    startedAt: "2026-01-13 10:00",
    completedAt: "2026-01-14 03:58",
    gpuType: "A100 80GB x8",
  },
  {
    id: "exp-003",
    name: "SentinelClassifier v2 finetune",
    modelId: "m2",
    modelName: "SentinelClassifier",
    config: { learningRate: 0.0001, batchSize: 128, epochs: 25, optimizer: "AdamW", warmupSteps: 500 },
    metrics: { loss: 0.034, accuracy: 0.967, f1: 0.954 },
    duration: "4h 12m",
    gpuHours: 16.8,
    status: "completed",
    startedAt: "2026-01-20 14:00",
    completedAt: "2026-01-20 18:12",
    gpuType: "A100 40GB x4",
  },
  {
    id: "exp-004",
    name: "EmbedX contrastive-v3",
    modelId: "m3",
    modelName: "EmbedX",
    config: { learningRate: 0.0002, batchSize: 512, epochs: 8, optimizer: "LAMB", warmupSteps: 1000 },
    metrics: { loss: 0.121, accuracy: 0.889, f1: 0.876 },
    duration: "6h 30m",
    gpuHours: 26.0,
    status: "completed",
    startedAt: "2025-12-05 09:00",
    completedAt: "2025-12-05 15:30",
    gpuType: "A100 40GB x4",
  },
  {
    id: "exp-005",
    name: "RewardForge pref-tuning",
    modelId: "m4",
    modelName: "RewardForge",
    config: { learningRate: 0.00005, batchSize: 64, epochs: 5, optimizer: "AdamW", warmupSteps: 300 },
    metrics: { loss: 0.163, accuracy: 0.845, f1: 0.832 },
    duration: "9h 15m",
    gpuHours: 74.0,
    status: "completed",
    startedAt: "2026-01-29 06:00",
    completedAt: "2026-01-29 15:15",
    gpuType: "H100 80GB x8",
  },
  {
    id: "exp-006",
    name: "VisionNet ablation-study",
    modelId: "m5",
    modelName: "VisionNet",
    config: { learningRate: 0.0001, batchSize: 384, epochs: 30, optimizer: "SGD", warmupSteps: 3000 },
    metrics: { loss: 0.055, accuracy: 0.948, f1: 0.941 },
    duration: "22h 08m",
    gpuHours: 176.5,
    status: "completed",
    startedAt: "2026-02-08 02:00",
    completedAt: "2026-02-09 00:08",
    gpuType: "H100 80GB x8",
  },
  {
    id: "exp-007",
    name: "CodeBERT-XL multilang",
    modelId: "m6",
    modelName: "CodeBERT-XL",
    config: { learningRate: 0.00015, batchSize: 256, epochs: 10, optimizer: "AdamW", warmupSteps: 1500 },
    metrics: { loss: 0.132, accuracy: 0.878, f1: 0.864 },
    duration: "11h 44m",
    gpuHours: 46.9,
    status: "running",
    startedAt: "2026-02-22 01:00",
    completedAt: null,
    gpuType: "A100 80GB x4",
  },
  {
    id: "exp-008",
    name: "TinyChat distillation-r2",
    modelId: "m7",
    modelName: "TinyChat",
    config: { learningRate: 0.0004, batchSize: 128, epochs: 20, optimizer: "AdamW", warmupSteps: 800 },
    metrics: { loss: 0.312, accuracy: 0.712, f1: 0.698 },
    duration: "3h 22m",
    gpuHours: 6.7,
    status: "failed",
    startedAt: "2026-02-17 20:00",
    completedAt: "2026-02-17 23:22",
    gpuType: "A100 40GB x2",
  },
  {
    id: "exp-009",
    name: "Nova-LLM cosine-schedule",
    modelId: "m1",
    modelName: "Nova-LLM",
    config: { learningRate: 0.0003, batchSize: 512, epochs: 15, optimizer: "AdamW", warmupSteps: 3000 },
    metrics: { loss: 0.078, accuracy: 0.932, f1: 0.929 },
    duration: "24h 10m",
    gpuHours: 193.3,
    status: "running",
    startedAt: "2026-02-21 08:00",
    completedAt: null,
    gpuType: "H100 80GB x8",
  },
]

const DEPLOYMENTS: Deployment[] = [
  {
    id: "dep-1",
    modelId: "m1",
    modelName: "Nova-LLM",
    modelVersion: "3.2.1",
    endpointUrl: "https://api.internal/v1/nova-llm",
    trafficPercent: 90,
    latencyP50: 145,
    latencyP95: 320,
    latencyP99: 580,
    requestsPerDay: 2_450_000,
    health: "healthy",
    deployedAt: "2026-01-16",
    region: "us-east-1",
  },
  {
    id: "dep-2",
    modelId: "m1",
    modelName: "Nova-LLM",
    modelVersion: "3.1.0",
    endpointUrl: "https://api.internal/v1/nova-llm-canary",
    trafficPercent: 10,
    latencyP50: 152,
    latencyP95: 335,
    latencyP99: 610,
    requestsPerDay: 272_000,
    health: "healthy",
    deployedAt: "2025-12-20",
    region: "us-east-1",
  },
  {
    id: "dep-3",
    modelId: "m2",
    modelName: "SentinelClassifier",
    modelVersion: "2.0.4",
    endpointUrl: "https://api.internal/v1/sentinel",
    trafficPercent: 100,
    latencyP50: 12,
    latencyP95: 28,
    latencyP99: 45,
    requestsPerDay: 18_700_000,
    health: "healthy",
    deployedAt: "2026-01-23",
    region: "us-west-2",
  },
  {
    id: "dep-4",
    modelId: "m3",
    modelName: "EmbedX",
    modelVersion: "1.5.0",
    endpointUrl: "https://api.internal/v1/embedx",
    trafficPercent: 100,
    latencyP50: 8,
    latencyP95: 18,
    latencyP99: 32,
    requestsPerDay: 34_100_000,
    health: "degraded",
    deployedAt: "2025-12-09",
    region: "us-east-1",
  },
  {
    id: "dep-5",
    modelId: "m5",
    modelName: "VisionNet",
    modelVersion: "4.0.0",
    endpointUrl: "https://api.internal/v1/visionnet",
    trafficPercent: 100,
    latencyP50: 85,
    latencyP95: 190,
    latencyP99: 340,
    requestsPerDay: 5_620_000,
    health: "healthy",
    deployedAt: "2026-02-11",
    region: "eu-west-1",
  },
  {
    id: "dep-6",
    modelId: "m7",
    modelName: "TinyChat",
    modelVersion: "0.9.8",
    endpointUrl: "https://edge.internal/v1/tinychat",
    trafficPercent: 100,
    latencyP50: 42,
    latencyP95: 78,
    latencyP99: 120,
    requestsPerDay: 890_000,
    health: "down",
    deployedAt: "2026-02-15",
    region: "us-central-1",
  },
]

const LINEAGE: LineageEntry[] = [
  {
    id: "lin-1",
    modelName: "Nova-LLM",
    version: "3.2.1",
    parentVersion: "3.1.0",
    trainingDataVersion: "CommonCrawl-2025-Q4",
    trainedBy: "Alex Chen",
    trainedAt: "2026-01-15",
    deployedToProd: "2026-01-16",
    changeNotes: "Improved multilingual performance with expanded Q4 dataset. 0.8% accuracy uplift.",
  },
  {
    id: "lin-2",
    modelName: "Nova-LLM",
    version: "3.1.0",
    parentVersion: "3.0.2",
    trainingDataVersion: "CommonCrawl-2025-Q3",
    trainedBy: "Alex Chen",
    trainedAt: "2025-12-18",
    deployedToProd: "2025-12-20",
    changeNotes: "Architecture update: switched to grouped-query attention. 15% inference speedup.",
  },
  {
    id: "lin-3",
    modelName: "Nova-LLM",
    version: "3.0.2",
    parentVersion: "3.0.0",
    trainingDataVersion: "CommonCrawl-2025-Q2",
    trainedBy: "Priya Sharma",
    trainedAt: "2025-10-05",
    deployedToProd: "2025-10-08",
    changeNotes: "Hotfix for tokenization edge case in CJK scripts.",
  },
  {
    id: "lin-4",
    modelName: "SentinelClassifier",
    version: "2.0.4",
    parentVersion: "2.0.3",
    trainingDataVersion: "InternalModeration-v7",
    trainedBy: "Jordan Lee",
    trainedAt: "2026-01-22",
    deployedToProd: "2026-01-23",
    changeNotes: "Added 50K new labeled examples for emerging harmful content patterns.",
  },
  {
    id: "lin-5",
    modelName: "SentinelClassifier",
    version: "2.0.3",
    parentVersion: "2.0.0",
    trainingDataVersion: "InternalModeration-v6",
    trainedBy: "Jordan Lee",
    trainedAt: "2025-11-14",
    deployedToProd: "2025-11-15",
    changeNotes: "Reduced false positive rate by 23% through improved negative sampling.",
  },
  {
    id: "lin-6",
    modelName: "EmbedX",
    version: "1.5.0",
    parentVersion: "1.4.1",
    trainingDataVersion: "SemanticPairs-12M",
    trainedBy: "Mei Wong",
    trainedAt: "2025-12-08",
    deployedToProd: "2025-12-09",
    changeNotes: "Scaled training pairs from 8M to 12M. Switched to JAX for 2x training throughput.",
  },
  {
    id: "lin-7",
    modelName: "RewardForge",
    version: "1.1.2",
    parentVersion: "1.1.0",
    trainingDataVersion: "HumanPrefs-500K",
    trainedBy: "Sam Torres",
    trainedAt: "2026-02-01",
    deployedToProd: null,
    changeNotes: "Expanded preference dataset to 500K. Improved reward accuracy on safety-critical prompts.",
  },
  {
    id: "lin-8",
    modelName: "VisionNet",
    version: "4.0.0",
    parentVersion: "3.8.2",
    trainingDataVersion: "ImageNet-2025-Extended",
    trainedBy: "Kai Nakamura",
    trainedAt: "2026-02-10",
    deployedToProd: "2026-02-11",
    changeNotes: "Major version bump: added document understanding head. ONNX export for cross-platform serving.",
  },
  {
    id: "lin-9",
    modelName: "CodeBERT-XL",
    version: "2.3.0",
    parentVersion: "2.2.1",
    trainingDataVersion: "GithubCode-50M",
    trainedBy: "Ravi Gupta",
    trainedAt: "2026-01-30",
    deployedToProd: null,
    changeNotes: "Extended language coverage from 24 to 32 languages. Added Rust, Zig, Elixir, and more.",
  },
  {
    id: "lin-10",
    modelName: "TinyChat",
    version: "1.0.0",
    parentVersion: null,
    trainingDataVersion: "ChatDistill-2M",
    trainedBy: "Edge ML Team",
    trainedAt: "2026-02-18",
    deployedToProd: null,
    changeNotes: "Initial release: distilled from Nova-LLM 3.2.1. Target: sub-100ms on mobile.",
  },
]

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function frameworkEmoji(fw: Framework): string {
  switch (fw) {
    case "PyTorch": return "🔥"
    case "TensorFlow": return "🧠"
    case "JAX": return "⚡"
    case "ONNX": return "📦"
  }
}

function taskEmoji(task: TaskType): string {
  switch (task) {
    case "LLM": return "💬"
    case "classifier": return "🏷️"
    case "embedder": return "🔗"
    case "reward": return "🎯"
  }
}

function statusStyle(status: ExperimentStatus): string {
  switch (status) {
    case "completed": return "text-emerald-400"
    case "running": return "text-amber-400"
    case "failed": return "text-rose-400"
  }
}

function statusEmoji(status: ExperimentStatus): string {
  switch (status) {
    case "completed": return "✅"
    case "running": return "🔄"
    case "failed": return "❌"
  }
}

function healthStyle(health: HealthStatus): string {
  switch (health) {
    case "healthy": return "text-emerald-400"
    case "degraded": return "text-amber-400"
    case "down": return "text-rose-400"
  }
}

function healthEmoji(health: HealthStatus): string {
  switch (health) {
    case "healthy": return "🟢"
    case "degraded": return "🟡"
    case "down": return "🔴"
  }
}

// ── Sub-Components ─────────────────────────────────────────────────────────────

function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: { id: TabId; label: string; emoji: string }[]
  active: TabId
  onSelect: (id: TabId) => void
}) {
  return (
    <div className="flex gap-1 border-b border-zinc-800 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={cn(
            "px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg",
            active === tab.id
              ? "bg-zinc-900 text-white border-b-2 border-indigo-500"
              : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50"
          )}
        >
          <span className="mr-1.5">{tab.emoji}</span>
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function MetricBadge({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg px-3 py-2 text-center">
      <div className="text-xs text-zinc-500 mb-0.5">{label}</div>
      <div className="text-sm font-semibold text-white">
        {value}
        {unit && <span className="text-zinc-400 text-xs ml-0.5">{unit}</span>}
      </div>
    </div>
  )
}

function Tag({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className={cn(
        "inline-block text-xs px-2 py-0.5 rounded-full font-medium",
        color ?? "bg-indigo-500/20 text-indigo-300"
      )}
    >
      {children}
    </span>
  )
}

// ── Models Tab ─────────────────────────────────────────────────────────────────

function ModelsTab() {
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const selectedModel = MODELS.find((m) => m.id === selectedModelId)

  return (
    <div>
      {selectedModel ? (
        <ModelDetail model={selectedModel} onBack={() => setSelectedModelId(null)} />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              🤖 Model Registry
              <span className="text-zinc-500 text-sm font-normal ml-2">{MODELS.length} models</span>
            </h2>
          </div>
          <div className="grid gap-3">
            {MODELS.map((model) => (
              <button
                key={model.id}
                onClick={() => setSelectedModelId(model.id)}
                className="w-full text-left bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-indigo-500/50 transition-colors group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{frameworkEmoji(model.framework)}</span>
                    <div>
                      <span className="font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        {model.name}
                      </span>
                      <span className="text-zinc-500 text-sm ml-2">v{model.version}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag>{taskEmoji(model.taskType)} {model.taskType}</Tag>
                    <span className="text-zinc-500 text-xs">{model.sizeGB} GB</span>
                  </div>
                </div>
                <p className="text-zinc-400 text-sm mb-3 line-clamp-1">{model.description}</p>
                <div className="flex items-center justify-between">
                  <div className="flex gap-4 text-xs text-zinc-500">
                    <span>📊 Acc: {(model.metrics.accuracy * 100).toFixed(1)}%</span>
                    <span>🎯 F1: {(model.metrics.f1 * 100).toFixed(1)}%</span>
                    <span>📉 Loss: {model.metrics.loss.toFixed(3)}</span>
                  </div>
                  <div className="flex gap-1">
                    {model.tags.map((tag) => (
                      <Tag key={tag}>{tag}</Tag>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ModelDetail({ model, onBack }: { model: Model; onBack: () => void }) {
  return (
    <div>
      <button
        onClick={onBack}
        className="text-indigo-400 hover:text-indigo-300 text-sm mb-4 inline-block transition-colors"
      >
        ← Back to Models
      </button>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-2xl">{frameworkEmoji(model.framework)}</span>
              <h2 className="text-xl font-bold text-white">{model.name}</h2>
              <span className="text-zinc-400 text-sm">v{model.version}</span>
            </div>
            <p className="text-zinc-400 text-sm">{model.description}</p>
          </div>
          <Tag>{taskEmoji(model.taskType)} {model.taskType}</Tag>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <MetricBadge label="Framework" value={model.framework} />
          <MetricBadge label="Size" value={model.sizeGB} unit="GB" />
          <MetricBadge label="Dataset" value={model.trainingDataset} />
          <MetricBadge label="Created" value={model.createdAt} />
        </div>

        <div className="mb-4">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3">📊 Performance Metrics</h3>
          <div className="overflow-hidden rounded-lg border border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-800/50">
                  <th className="text-left px-4 py-2 text-zinc-400 font-medium">Metric</th>
                  <th className="text-right px-4 py-2 text-zinc-400 font-medium">Value</th>
                  <th className="text-left px-4 py-2 text-zinc-400 font-medium">Visual</th>
                </tr>
              </thead>
              <tbody>
                {([
                  { key: "Accuracy", val: model.metrics.accuracy },
                  { key: "F1 Score", val: model.metrics.f1 },
                  { key: "Precision", val: model.metrics.precision },
                  { key: "Recall", val: model.metrics.recall },
                ] as const).map((row) => (
                  <tr key={row.key} className="border-t border-zinc-800/50">
                    <td className="px-4 py-2 text-zinc-300">{row.key}</td>
                    <td className="px-4 py-2 text-right font-mono text-white">
                      {(row.val * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-2">
                      <div className="w-full bg-zinc-800 rounded-full h-2">
                        <div
                          className="bg-indigo-500 h-2 rounded-full transition-all"
                          style={{ width: `${row.val * 100}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-zinc-800/50">
                  <td className="px-4 py-2 text-zinc-300">Loss</td>
                  <td className="px-4 py-2 text-right font-mono text-white">
                    {model.metrics.loss.toFixed(4)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div
                        className="bg-rose-400 h-2 rounded-full transition-all"
                        style={{ width: `${Math.min(model.metrics.loss * 500, 100)}%` }}
                      />
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {model.tags.map((tag) => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </div>
          <span className="text-xs text-zinc-500">by {model.author}</span>
        </div>
      </div>
    </div>
  )
}

// ── Experiments Tab ────────────────────────────────────────────────────────────

function ExperimentsTab() {
  const [compareIds, setCompareIds] = useState<[string, string] | null>(null)

  function toggleCompare(id: string) {
    setCompareIds((prev) => {
      if (prev === null) return [id, ""]
      if (prev[0] === id) return null
      if (prev[1] === id) return [prev[0], ""]
      if (prev[0] === "") return [id, prev[1]]
      if (prev[1] === "") return [prev[0], id]
      return [id, ""]
    })
  }

  const isSelected = (id: string) =>
    compareIds !== null && (compareIds[0] === id || compareIds[1] === id)

  const canCompare =
    compareIds !== null && compareIds[0] !== "" && compareIds[1] !== ""

  const expA = canCompare ? EXPERIMENTS.find((e) => e.id === compareIds![0]) : undefined
  const expB = canCompare ? EXPERIMENTS.find((e) => e.id === compareIds![1]) : undefined

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">
          🧪 Experiment Tracking
          <span className="text-zinc-500 text-sm font-normal ml-2">{EXPERIMENTS.length} experiments</span>
        </h2>
        {compareIds !== null && (
          <button
            onClick={() => setCompareIds(null)}
            className="text-xs text-zinc-400 hover:text-white transition-colors"
          >
            Clear selection
          </button>
        )}
      </div>

      {canCompare && expA && expB && (
        <ComparePanel a={expA} b={expB} onClose={() => setCompareIds(null)} />
      )}

      <div className="space-y-3">
        {EXPERIMENTS.map((exp) => (
          <div
            key={exp.id}
            className={cn(
              "bg-zinc-900 border rounded-xl p-4 transition-colors",
              isSelected(exp.id)
                ? "border-indigo-500"
                : "border-zinc-800 hover:border-zinc-700"
            )}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className={statusStyle(exp.status)}>{statusEmoji(exp.status)}</span>
                  <span className="font-semibold text-white">{exp.name}</span>
                  <span className={cn("text-xs font-medium", statusStyle(exp.status))}>
                    {exp.status}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  {exp.modelName} · {exp.gpuType} · Started {exp.startedAt}
                </div>
              </div>
              <button
                onClick={() => toggleCompare(exp.id)}
                className={cn(
                  "text-xs px-3 py-1 rounded-lg border transition-colors",
                  isSelected(exp.id)
                    ? "bg-indigo-500/20 border-indigo-500 text-indigo-300"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-white"
                )}
              >
                {isSelected(exp.id) ? "Selected" : "Compare"}
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 mb-3">
              <MetricBadge label="Loss" value={exp.metrics.loss.toFixed(4)} />
              <MetricBadge label="Accuracy" value={`${(exp.metrics.accuracy * 100).toFixed(1)}%`} />
              <MetricBadge label="F1" value={`${(exp.metrics.f1 * 100).toFixed(1)}%`} />
              <MetricBadge label="Duration" value={exp.duration} />
              <MetricBadge label="GPU Hours" value={exp.gpuHours.toFixed(1)} unit="h" />
              <MetricBadge label="Batch Size" value={exp.config.batchSize} />
              <MetricBadge label="LR" value={exp.config.learningRate.toExponential(0)} />
            </div>

            <div className="flex gap-2 text-xs text-zinc-500">
              <span>Optimizer: {exp.config.optimizer}</span>
              <span>·</span>
              <span>Epochs: {exp.config.epochs}</span>
              <span>·</span>
              <span>Warmup: {exp.config.warmupSteps}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ComparePanel({
  a,
  b,
  onClose,
}: {
  a: Experiment
  b: Experiment
  onClose: () => void
}) {
  type CompareRow = { label: string; valA: string; valB: string; better: "lower" | "higher" }

  const rows: CompareRow[] = [
    {
      label: "Loss",
      valA: a.metrics.loss.toFixed(4),
      valB: b.metrics.loss.toFixed(4),
      better: "lower",
    },
    {
      label: "Accuracy",
      valA: `${(a.metrics.accuracy * 100).toFixed(1)}%`,
      valB: `${(b.metrics.accuracy * 100).toFixed(1)}%`,
      better: "higher",
    },
    {
      label: "F1",
      valA: `${(a.metrics.f1 * 100).toFixed(1)}%`,
      valB: `${(b.metrics.f1 * 100).toFixed(1)}%`,
      better: "higher",
    },
    {
      label: "GPU Hours",
      valA: a.gpuHours.toFixed(1),
      valB: b.gpuHours.toFixed(1),
      better: "lower",
    },
    {
      label: "Learning Rate",
      valA: a.config.learningRate.toExponential(1),
      valB: b.config.learningRate.toExponential(1),
      better: "lower",
    },
    {
      label: "Batch Size",
      valA: a.config.batchSize.toString(),
      valB: b.config.batchSize.toString(),
      better: "higher",
    },
    {
      label: "Epochs",
      valA: a.config.epochs.toString(),
      valB: b.config.epochs.toString(),
      better: "higher",
    },
  ]

  function betterClass(row: CompareRow, side: "a" | "b"): string {
    const numA = parseFloat(row.valA)
    const numB = parseFloat(row.valB)
    if (isNaN(numA) || isNaN(numB) || numA === numB) return "text-white"
    const aWins = row.better === "lower" ? numA < numB : numA > numB
    if (side === "a") return aWins ? "text-emerald-400" : "text-zinc-400"
    return aWins ? "text-zinc-400" : "text-emerald-400"
  }

  return (
    <div className="bg-zinc-900 border border-indigo-500/30 rounded-xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-indigo-300">⚖️ Side-by-Side Comparison</h3>
        <button onClick={onClose} className="text-zinc-500 hover:text-white text-xs transition-colors">
          Close
        </button>
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-zinc-800/50">
              <th className="text-left px-4 py-2 text-zinc-400 font-medium">Metric</th>
              <th className="text-right px-4 py-2 text-indigo-300 font-medium">{a.name}</th>
              <th className="text-right px-4 py-2 text-indigo-300 font-medium">{b.name}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-zinc-800/50">
                <td className="px-4 py-2 text-zinc-300">{row.label}</td>
                <td className={cn("px-4 py-2 text-right font-mono", betterClass(row, "a"))}>
                  {row.valA}
                </td>
                <td className={cn("px-4 py-2 text-right font-mono", betterClass(row, "b"))}>
                  {row.valB}
                </td>
              </tr>
            ))}
            <tr className="border-t border-zinc-800/50">
              <td className="px-4 py-2 text-zinc-300">Status</td>
              <td className={cn("px-4 py-2 text-right font-mono", statusStyle(a.status))}>
                {statusEmoji(a.status)} {a.status}
              </td>
              <td className={cn("px-4 py-2 text-right font-mono", statusStyle(b.status))}>
                {statusEmoji(b.status)} {b.status}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Deployments Tab ────────────────────────────────────────────────────────────

function DeploymentsTab() {
  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">
        🚀 Active Deployments
        <span className="text-zinc-500 text-sm font-normal ml-2">{DEPLOYMENTS.length} endpoints</span>
      </h2>
      <div className="space-y-3">
        {DEPLOYMENTS.map((dep) => (
          <div
            key={dep.id}
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span>{healthEmoji(dep.health)}</span>
                  <span className="font-semibold text-white">{dep.modelName}</span>
                  <span className="text-zinc-500 text-sm">v{dep.modelVersion}</span>
                  <span className={cn("text-xs font-medium", healthStyle(dep.health))}>
                    {dep.health}
                  </span>
                </div>
                <div className="text-xs text-zinc-500 mt-0.5 font-mono">{dep.endpointUrl}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500">Traffic</div>
                <div className="text-lg font-bold text-white">{dep.trafficPercent}%</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
              <MetricBadge label="p50" value={dep.latencyP50} unit="ms" />
              <MetricBadge label="p95" value={dep.latencyP95} unit="ms" />
              <MetricBadge label="p99" value={dep.latencyP99} unit="ms" />
              <MetricBadge label="Req/day" value={formatNumber(dep.requestsPerDay)} />
              <MetricBadge label="Region" value={dep.region} />
              <MetricBadge label="Deployed" value={dep.deployedAt} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Lineage Tab ────────────────────────────────────────────────────────────────

function LineageTab() {
  const grouped = LINEAGE.reduce<Record<string, LineageEntry[]>>((acc, entry) => {
    if (!acc[entry.modelName]) acc[entry.modelName] = []
    acc[entry.modelName].push(entry)
    return acc
  }, {})

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">
        🧬 Model Lineage
        <span className="text-zinc-500 text-sm font-normal ml-2">{LINEAGE.length} versions tracked</span>
      </h2>
      <div className="space-y-6">
        {Object.entries(grouped).map(([modelName, entries]) => (
          <div key={modelName} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-base font-semibold text-white mb-4">{modelName}</h3>
            <div className="space-y-0">
              {entries.map((entry, idx) => (
                <div key={entry.id} className="relative flex gap-4">
                  {/* timeline spine */}
                  <div className="flex flex-col items-center">
                    <div className="w-3 h-3 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    {idx < entries.length - 1 && (
                      <div className="w-0.5 flex-1 bg-zinc-700" />
                    )}
                  </div>
                  {/* content */}
                  <div className="pb-6 flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-white text-sm">v{entry.version}</span>
                      {entry.parentVersion && (
                        <span className="text-xs text-zinc-500">← v{entry.parentVersion}</span>
                      )}
                      {!entry.parentVersion && (
                        <Tag color="bg-emerald-500/20 text-emerald-300">initial</Tag>
                      )}
                      {entry.deployedToProd && (
                        <Tag color="bg-indigo-500/20 text-indigo-300">🚀 prod</Tag>
                      )}
                    </div>
                    <p className="text-sm text-zinc-300 mb-2">{entry.changeNotes}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      <span>👤 {entry.trainedBy}</span>
                      <span>📅 {entry.trainedAt}</span>
                      <span>📂 {entry.trainingDataVersion}</span>
                      {entry.deployedToProd && <span>🚀 Deployed: {entry.deployedToProd}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; emoji: string }[] = [
  { id: "models", label: "Models", emoji: "🤖" },
  { id: "experiments", label: "Experiments", emoji: "🧪" },
  { id: "deployments", label: "Deployments", emoji: "🚀" },
  { id: "lineage", label: "Lineage", emoji: "🧬" },
]

function MLModelRegistry() {
  const [activeTab, setActiveTab] = useState<TabId>("models")

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white mb-1">
            🤖 ML Model Registry
          </h1>
          <p className="text-zinc-400 text-sm">
            Track, deploy, and manage machine learning models across the organization
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{MODELS.length}</div>
            <div className="text-xs text-zinc-500 mt-0.5">Registered Models</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">
              {EXPERIMENTS.filter((e) => e.status === "running").length}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">Running Experiments</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{DEPLOYMENTS.length}</div>
            <div className="text-xs text-zinc-500 mt-0.5">Active Deployments</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">
              {DEPLOYMENTS.filter((d) => d.health === "healthy").length}/{DEPLOYMENTS.length}
            </div>
            <div className="text-xs text-zinc-500 mt-0.5">Healthy Endpoints</div>
          </div>
        </div>

        <TabBar tabs={TABS} active={activeTab} onSelect={setActiveTab} />

        {activeTab === "models" && <ModelsTab />}
        {activeTab === "experiments" && <ExperimentsTab />}
        {activeTab === "deployments" && <DeploymentsTab />}
        {activeTab === "lineage" && <LineageTab />}
      </div>
    </div>
  )
}

export default MLModelRegistry
