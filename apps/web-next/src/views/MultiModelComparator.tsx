import React, { useState } from "react";
import { cn } from "../lib/utils";

type ComparisonStatus = "idle" | "running" | "complete";
type MetricKind = "quality" | "speed" | "cost" | "tokens";

interface ModelResult {
  modelId: string;
  modelName: string;
  provider: string;
  output: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  qualityScore: number; // 1-100
  finishReason: "stop" | "length" | "error";
  error: string | null;
}

interface ComparisonRun {
  id: string;
  prompt: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  results: ModelResult[];
  ranAt: string;
}

const MODELS = [
  { id: "claude-sonnet",  name: "Claude Sonnet 4.6",  provider: "Anthropic",  enabled: true  },
  { id: "claude-opus",    name: "Claude Opus 4.6",    provider: "Anthropic",  enabled: false },
  { id: "minimax-m2",     name: "MiniMax M2.5",       provider: "MiniMax",    enabled: true  },
  { id: "gemini-flash",   name: "Gemini 2.5 Flash",   provider: "Google",     enabled: true  },
  { id: "gpt-4o",         name: "GPT-4o",             provider: "OpenAI",     enabled: false },
  { id: "gpt-4o-mini",    name: "GPT-4o Mini",        provider: "OpenAI",     enabled: false },
  { id: "llama-3-70b",    name: "Llama 3 70B",        provider: "Groq",       enabled: false },
];

const SAVED_RUNS: ComparisonRun[] = [
  {
    id: "run-1",
    prompt: "Explain error budgets and burn rates for SRE in 3 paragraphs.",
    systemPrompt: "You are a helpful technical writer.",
    temperature: 0.7,
    maxTokens: 512,
    ranAt: "07:05 MST",
    results: [
      {
        modelId: "claude-sonnet",
        modelName: "Claude Sonnet 4.6",
        provider: "Anthropic",
        output: "An error budget is the maximum allowable downtime or error rate for a service within a given time window, typically 30 days. It represents the gap between perfect reliability (100%) and your SLO target.\n\nThe burn rate tells you how quickly you're consuming that error budget. A burn rate of 1× means you're spending the budget at exactly the rate it replenishes. A burn rate of 2× means you'll exhaust it in half the window. Rates above 14.4× indicate you'll burn the entire 30-day budget within 2 hours.\n\nMonitoring burn rates with multiple windows (1h, 6h, 24h) helps catch incidents at different scales. Multi-window alerting reduces both false positives and slow-burn failures that might otherwise go undetected.",
        latencyMs: 1240,
        inputTokens: 84,
        outputTokens: 148,
        costUsd: 0.00089,
        qualityScore: 94,
        finishReason: "stop",
        error: null,
      },
      {
        modelId: "minimax-m2",
        modelName: "MiniMax M2.5",
        provider: "MiniMax",
        output: "Error budgets define the allowable threshold of service failures or downtime over a rolling period. If your SLO is 99.9% availability, you have 0.1% error budget — roughly 43 minutes per 30 days.\n\nBurn rate quantifies how fast that budget is being consumed relative to the replenishment rate. A burn rate of 1 means perfect equilibrium; 3× means you'll deplete the budget three times faster than it accrues. Sustained high burn rates are a strong signal to halt non-critical deployments and focus on reliability.\n\nSRE teams use multi-window burn rate alerts — typically 1h/5%, 6h/2%, and 3d/1% thresholds — to escalate incidents proportionally to their severity and impact timeline.",
        latencyMs: 890,
        inputTokens: 84,
        outputTokens: 141,
        costUsd: 0.00012,
        qualityScore: 88,
        finishReason: "stop",
        error: null,
      },
      {
        modelId: "gemini-flash",
        modelName: "Gemini 2.5 Flash",
        provider: "Google",
        output: "Error budgets quantify the acceptable level of unreliability for a service, derived directly from SLO targets. If availability target is 99.9%, the error budget is 0.1% — or about 43.8 minutes of downtime per month.\n\nBurn rate measures how quickly you're consuming that budget compared to normal. Rate of 1 = sustainable; >1 = faster consumption. Burn rate alerts fire when the rate indicates budget exhaustion will occur before the window resets.\n\nSRE teams set tiered alerts at multiple time windows to catch both acute (high burn, short window) and chronic (low burn, long window) problems, ensuring the budget acts as a data-driven throttle on risk.",
        latencyMs: 680,
        inputTokens: 84,
        outputTokens: 132,
        costUsd: 0.00008,
        qualityScore: 85,
        finishReason: "stop",
        error: null,
      },
    ],
  },
  {
    id: "run-2",
    prompt: "Write a TypeScript function to calculate burn rate given current error rate and SLO target.",
    systemPrompt: "You are a TypeScript expert. Return only code, no explanation.",
    temperature: 0.2,
    maxTokens: 256,
    ranAt: "06:48 MST",
    results: [
      {
        modelId: "claude-sonnet",
        modelName: "Claude Sonnet 4.6",
        provider: "Anthropic",
        output: "function calculateBurnRate(\n  currentErrorRate: number,\n  sloTarget: number,\n  windowHours: number = 720 // 30 days\n): number {\n  const errorBudget = 1 - sloTarget / 100;\n  const currentRate = 1 - currentErrorRate / 100;\n  return errorBudget > 0 ? currentRate / errorBudget : Infinity;\n}",
        latencyMs: 980,
        inputTokens: 68,
        outputTokens: 72,
        costUsd: 0.00052,
        qualityScore: 92,
        finishReason: "stop",
        error: null,
      },
      {
        modelId: "minimax-m2",
        modelName: "MiniMax M2.5",
        provider: "MiniMax",
        output: "const calculateBurnRate = (\n  errorRatePct: number,\n  sloTargetPct: number\n): number => {\n  const budget = (100 - sloTargetPct) / 100;\n  const actual = errorRatePct / 100;\n  return budget === 0 ? Infinity : actual / budget;\n};",
        latencyMs: 520,
        inputTokens: 68,
        outputTokens: 58,
        costUsd: 0.00006,
        qualityScore: 88,
        finishReason: "stop",
        error: null,
      },
      {
        modelId: "gemini-flash",
        modelName: "Gemini 2.5 Flash",
        provider: "Google",
        output: "function getBurnRate(errorRate: number, slo: number): number {\n  const budget = 1 - slo;\n  return budget > 0 ? errorRate / budget : Infinity;\n}",
        latencyMs: 420,
        inputTokens: 68,
        outputTokens: 36,
        costUsd: 0.00004,
        qualityScore: 78,
        finishReason: "stop",
        error: null,
      },
    ],
  },
];

const providerColor = (provider: string) => {
  if (provider === "Anthropic") return "text-purple-400 bg-purple-400/10";
  if (provider === "OpenAI")    return "text-emerald-400 bg-emerald-400/10";
  if (provider === "Google")    return "text-blue-400 bg-blue-400/10";
  if (provider === "MiniMax")   return "text-amber-400 bg-amber-400/10";
  return "text-zinc-400 bg-zinc-400/10";
};

const qualityBar = (score: number) => {
  if (score >= 90) return "bg-emerald-400";
  if (score >= 75) return "bg-amber-400";
  return "bg-rose-400";
};

export default function MultiModelComparator() {
  const [selectedRunId, setSelectedRunId] = useState<string>("run-1");
  const [promptText, setPromptText] = useState<string>("");
  const [systemPromptText, setSystemPromptText] = useState<string>("You are a helpful assistant.");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [enabledModels, setEnabledModels] = useState<Set<string>>(new Set(["claude-sonnet", "minimax-m2", "gemini-flash"]));
  const [status, setStatus] = useState<ComparisonStatus>("idle");
  const [activeTab, setActiveTab] = useState<"compare" | "runs">("compare");
  const [metric, setMetric] = useState<MetricKind>("quality");
  const [expandedResultId, setExpandedResultId] = useState<string | null>(null);

  const selectedRun = SAVED_RUNS.find(r => r.id === selectedRunId) ?? SAVED_RUNS[0];

  function toggleModel(id: string) {
    setEnabledModels(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function runComparison() {
    if (!promptText.trim() || enabledModels.size === 0) return;
    setStatus("running");
    setTimeout(() => {
      setStatus("complete");
      setSelectedRunId(SAVED_RUNS[0].id);
      setActiveTab("compare");
    }, 2200);
  }

  function getMetricValue(result: ModelResult): string {
    if (metric === "quality") return `${result.qualityScore}/100`;
    if (metric === "speed")   return `${result.latencyMs}ms`;
    if (metric === "cost")    return `$${result.costUsd.toFixed(5)}`;
    return `${result.outputTokens} tok`;
  }

  function getMetricBar(result: ModelResult, results: ModelResult[]): number {
    const vals = results.map(r => {
      if (metric === "quality") return r.qualityScore;
      if (metric === "speed")   return 1000 / r.latencyMs; // invert: faster = higher
      if (metric === "cost")    return 1 / (r.costUsd * 1000 + 0.001); // invert: cheaper = higher
      return r.outputTokens;
    });
    const max = Math.max(...vals);
    const cur = metric === "quality" ? result.qualityScore : metric === "speed" ? 1000 / result.latencyMs : metric === "cost" ? 1 / (result.costUsd * 1000 + 0.001) : result.outputTokens;
    return max > 0 ? (cur / max) * 100 : 0;
  }

  return (
    <div className="flex h-full bg-zinc-950 overflow-hidden flex-col">
      {/* Tabs */}
      <div className="flex border-b border-zinc-800 bg-zinc-900 flex-shrink-0">
        {(["compare", "runs"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-5 py-2.5 text-sm font-medium transition-colors border-b-2 capitalize",
              activeTab === tab ? "border-indigo-500 text-indigo-300" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            {tab === "compare" ? "⚡ Compare" : `📋 History (${SAVED_RUNS.length})`}
          </button>
        ))}
      </div>

      {activeTab === "compare" ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Config sidebar */}
          <div className="w-64 flex-shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col overflow-y-auto">
            <div className="p-4">
              <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Models</div>
              <div className="space-y-1.5">
                {MODELS.map(m => (
                  <div
                    key={m.id}
                    onClick={() => toggleModel(m.id)}
                    className={cn("flex items-center gap-2 px-2 py-1.5 rounded border cursor-pointer transition-colors", enabledModels.has(m.id) ? "bg-zinc-800 border-zinc-700" : "border-zinc-800/50 opacity-50")}
                  >
                    <div className={cn("w-3 h-3 rounded border flex items-center justify-center text-[8px] flex-shrink-0", enabledModels.has(m.id) ? "bg-indigo-500 border-indigo-500 text-white" : "border-zinc-600")}>
                      {enabledModels.has(m.id) && "✓"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-medium text-white truncate">{m.name}</div>
                      <span className={cn("text-[9px] px-1 rounded", providerColor(m.provider))}>{m.provider}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">System Prompt</div>
                <textarea
                  value={systemPromptText}
                  onChange={e => setSystemPromptText(e.target.value)}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 text-white text-[10px] px-2 py-1.5 rounded resize-none focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Temperature</div>
                  <span className="text-[10px] text-zinc-300">{temperature}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.1}
                  value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full accent-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Main area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Prompt input */}
            <div className="p-4 border-b border-zinc-800 flex-shrink-0">
              <div className="flex gap-3">
                <textarea
                  value={promptText}
                  onChange={e => setPromptText(e.target.value)}
                  placeholder="Enter your prompt to compare across models..."
                  rows={3}
                  className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-sm px-3 py-2 rounded resize-none placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  onClick={runComparison}
                  disabled={!promptText.trim() || enabledModels.size === 0 || status === "running"}
                  className="bg-indigo-500 hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-medium text-sm transition-colors self-start"
                >
                  {status === "running" ? (
                    <span className="flex items-center gap-2"><span className="animate-spin w-3 h-3 border border-white border-t-transparent rounded-full inline-block" />Running…</span>
                  ) : "▶ Run"}
                </button>
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto p-4">
              {/* Metric toggle */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-xs text-zinc-500">Rank by:</span>
                <div className="flex gap-1">
                  {(["quality", "speed", "cost", "tokens"] as MetricKind[]).map(m => (
                    <button
                      key={m}
                      onClick={() => setMetric(m)}
                      className={cn("text-xs px-3 py-1 rounded border transition-colors capitalize", metric === m ? "bg-indigo-500/20 border-indigo-500 text-indigo-300" : "border-zinc-700 text-zinc-500 hover:text-zinc-300 bg-zinc-800")}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <span className="ml-auto text-xs text-zinc-500">{selectedRun.ranAt} · {selectedRun.results.length} models</span>
              </div>

              {/* Prompt preview */}
              <div className="bg-zinc-900 rounded border border-zinc-800 p-3 mb-4">
                <div className="text-[10px] text-zinc-500 mb-1">Prompt</div>
                <p className="text-xs text-zinc-300">{selectedRun.prompt}</p>
              </div>

              {/* Model outputs */}
              <div className="space-y-3">
                {selectedRun.results.sort((a, b) => b.qualityScore - a.qualityScore).map((result, i) => {
                  const barPct = getMetricBar(result, selectedRun.results);
                  const isExpanded = expandedResultId === result.modelId;
                  return (
                    <div key={result.modelId} className={cn("bg-zinc-900 rounded border overflow-hidden", i === 0 ? "border-indigo-500/40" : "border-zinc-800")}>
                      {/* Model header */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        {i === 0 && <span className="text-xs text-indigo-400 font-bold">🥇</span>}
                        {i === 1 && <span className="text-xs text-zinc-400">🥈</span>}
                        {i >= 2 && <span className="text-xs text-zinc-600">{i + 1}.</span>}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-white">{result.modelName}</span>
                            <span className={cn("text-[9px] px-1.5 py-0.5 rounded", providerColor(result.provider))}>{result.provider}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 h-1.5 bg-zinc-800 rounded overflow-hidden">
                              <div
                                className={cn("h-full rounded transition-all", metric === "quality" ? qualityBar(result.qualityScore) : "bg-indigo-400")}
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-white w-20 text-right">{getMetricValue(result)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                          <span>{result.latencyMs}ms</span>
                          <span>${result.costUsd.toFixed(5)}</span>
                          <span>{result.outputTokens}t</span>
                        </div>
                        <button
                          onClick={() => setExpandedResultId(isExpanded ? null : result.modelId)}
                          className="text-xs text-zinc-500 hover:text-zinc-300 ml-2"
                        >
                          {isExpanded ? "▲" : "▼"}
                        </button>
                      </div>

                      {/* Output preview */}
                      <div className={cn("px-4 pb-3", isExpanded ? "" : "line-clamp-3")}>
                        <pre className={cn("text-xs text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed", !isExpanded && "line-clamp-2 overflow-hidden")}>
                          {result.output}
                        </pre>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* History tab */
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4 max-w-3xl">
            {SAVED_RUNS.map(run => (
              <div key={run.id} className={cn("bg-zinc-900 rounded border cursor-pointer transition-colors hover:border-zinc-700", selectedRunId === run.id ? "border-indigo-500/40" : "border-zinc-800")} onClick={() => { setSelectedRunId(run.id); setActiveTab("compare"); }}>
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-white font-medium">{run.prompt}</p>
                    <span className="text-[10px] text-zinc-500 ml-4 flex-shrink-0">{run.ranAt}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-3">
                    {run.results.map(r => (
                      <div key={r.modelId} className="flex items-center gap-1">
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded", providerColor(r.provider))}>{r.modelName.split(" ").slice(0, 2).join(" ")}</span>
                        <span className="text-[10px] text-zinc-500">{r.qualityScore}/100</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
