import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = "live" | "history" | "analysis" | "settings";
type FinishReason = "stop" | "length" | "error" | "tool_calls";
type SessionStatus = "complete" | "truncated" | "error";
type StreamState = "idle" | "running" | "paused" | "done";
type ExportFormat = "json" | "csv" | "ndjson";
type RetryPolicy = "none" | "linear" | "exponential";

interface StreamSession {
  id: string;
  model: string;
  promptPreview: string;
  inputTokens: number;
  outputTokens: number;
  duration: number;
  tokensPerSec: number;
  ttft: number;
  finishReason: FinishReason;
  status: SessionStatus;
  timestamp: string;
  fullText: string;
}

interface LatencyPercentiles {
  p50: number;
  p95: number;
  p99: number;
}

interface ModelPerf {
  model: string;
  avgTtft: number;
  avgTps: number;
  errorRate: number;
  sessions: number;
}

interface ChunkBin {
  label: string;
  count: number;
}

interface ErrorBucket {
  hour: string;
  errors: number;
  total: number;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_SESSIONS: StreamSession[] = [
  {
    id: "sess-001",
    model: "claude-3-5-sonnet",
    promptPreview: "Explain quantum entanglement in simple terms...",
    inputTokens: 24,
    outputTokens: 312,
    duration: 4.8,
    tokensPerSec: 65.0,
    ttft: 182,
    finishReason: "stop",
    status: "complete",
    timestamp: "2026-02-22T05:12:00Z",
    fullText:
      "Quantum entanglement is a phenomenon where two particles become connected in such a way that measuring one instantly affects the other, regardless of distance. Think of it like a pair of magic dice...",
  },
  {
    id: "sess-002",
    model: "gpt-4o",
    promptPreview: "Write a Python function to parse nested JSON...",
    inputTokens: 41,
    outputTokens: 580,
    duration: 7.2,
    tokensPerSec: 80.6,
    ttft: 210,
    finishReason: "stop",
    status: "complete",
    timestamp: "2026-02-22T05:08:00Z",
    fullText:
      "```python\nimport json\nfrom typing import Any\n\ndef parse_nested(data: str) -> dict[str, Any]:\n    parsed = json.loads(data)\n    return flatten(parsed)\n```",
  },
  {
    id: "sess-003",
    model: "claude-3-opus",
    promptPreview: "Summarize the key themes in Crime and Punishment...",
    inputTokens: 18,
    outputTokens: 4096,
    duration: 58.1,
    tokensPerSec: 70.5,
    ttft: 240,
    finishReason: "length",
    status: "truncated",
    timestamp: "2026-02-22T04:55:00Z",
    fullText:
      "Dostoevsky's Crime and Punishment explores guilt, redemption, and the psychology of transgression. The protagonist Raskolnikov embodies the tension between rational superhumanism and moral conscience...",
  },
  {
    id: "sess-004",
    model: "gpt-4o-mini",
    promptPreview: "Translate 'The quick brown fox' to French, Spanish...",
    inputTokens: 32,
    outputTokens: 89,
    duration: 1.1,
    tokensPerSec: 80.9,
    ttft: 95,
    finishReason: "stop",
    status: "complete",
    timestamp: "2026-02-22T04:50:00Z",
    fullText:
      "French: Le rapide renard brun...\nSpanish: El rápido zorro marrón...\nGerman: Der schnelle braune Fuchs...",
  },
  {
    id: "sess-005",
    model: "claude-3-5-sonnet",
    promptPreview: "Debug this React component: const Foo = () => {...",
    inputTokens: 156,
    outputTokens: 0,
    duration: 0.3,
    tokensPerSec: 0,
    ttft: 0,
    finishReason: "error",
    status: "error",
    timestamp: "2026-02-22T04:45:00Z",
    fullText: "[Stream error: connection timeout after 300ms]",
  },
  {
    id: "sess-006",
    model: "gpt-4o",
    promptPreview: "Generate a detailed marketing plan for a SaaS product...",
    inputTokens: 88,
    outputTokens: 1240,
    duration: 15.5,
    tokensPerSec: 80.0,
    ttft: 195,
    finishReason: "stop",
    status: "complete",
    timestamp: "2026-02-22T04:30:00Z",
    fullText:
      "## SaaS Marketing Plan\n\n### Executive Summary\nA comprehensive go-to-market strategy targeting mid-market B2B customers...",
  },
  {
    id: "sess-007",
    model: "mistral-large",
    promptPreview: "What are the SOLID principles in software engineering?",
    inputTokens: 16,
    outputTokens: 445,
    duration: 6.8,
    tokensPerSec: 65.4,
    ttft: 310,
    finishReason: "stop",
    status: "complete",
    timestamp: "2026-02-22T04:15:00Z",
    fullText:
      "SOLID is an acronym for five design principles: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion...",
  },
  {
    id: "sess-008",
    model: "claude-3-5-sonnet",
    promptPreview: "Create a meal plan for a vegan athlete training for...",
    inputTokens: 67,
    outputTokens: 720,
    duration: 10.9,
    tokensPerSec: 66.1,
    ttft: 175,
    finishReason: "stop",
    status: "complete",
    timestamp: "2026-02-22T04:00:00Z",
    fullText:
      "## 7-Day Vegan Athlete Meal Plan\n\n**Monday**\nBreakfast: Overnight oats with chia seeds and berries (450 kcal)...",
  },
  {
    id: "sess-009",
    model: "gpt-4o-mini",
    promptPreview: "List 10 creative startup ideas in the climate tech space",
    inputTokens: 22,
    outputTokens: 310,
    duration: 3.8,
    tokensPerSec: 81.6,
    ttft: 88,
    finishReason: "stop",
    status: "complete",
    timestamp: "2026-02-22T03:45:00Z",
    fullText:
      "1. Biochar carbon sequestration marketplace\n2. Mycelium-based packaging as a service\n3. AI-optimized urban vertical farms...",
  },
  {
    id: "sess-010",
    model: "mistral-large",
    promptPreview: "Explain the CAP theorem with real-world examples...",
    inputTokens: 19,
    outputTokens: 4096,
    duration: 61.2,
    tokensPerSec: 66.9,
    ttft: 298,
    finishReason: "length",
    status: "truncated",
    timestamp: "2026-02-22T03:30:00Z",
    fullText:
      "The CAP theorem states that a distributed system can guarantee at most two of: Consistency, Availability, and Partition tolerance...",
  },
  {
    id: "sess-011",
    model: "claude-3-opus",
    promptPreview: "Write a short story about a time traveler who...",
    inputTokens: 55,
    outputTokens: 0,
    duration: 0.8,
    tokensPerSec: 0,
    ttft: 0,
    finishReason: "error",
    status: "error",
    timestamp: "2026-02-22T03:10:00Z",
    fullText: "[Stream error: rate limit exceeded]",
  },
  {
    id: "sess-012",
    model: "gpt-4o",
    promptPreview: "How do transformers work in modern LLMs?",
    inputTokens: 14,
    outputTokens: 890,
    duration: 11.1,
    tokensPerSec: 80.2,
    ttft: 205,
    finishReason: "stop",
    status: "complete",
    timestamp: "2026-02-22T03:00:00Z",
    fullText:
      "Transformers are neural network architectures that use self-attention mechanisms to process sequences in parallel. Unlike RNNs...",
  },
];

const CHUNK_BINS: ChunkBin[] = [
  { label: "1", count: 42 },
  { label: "2", count: 118 },
  { label: "3", count: 201 },
  { label: "4", count: 87 },
  { label: "5", count: 53 },
  { label: "6-10", count: 34 },
  { label: "11-20", count: 12 },
  { label: "21+", count: 4 },
];

const ERROR_BUCKETS: ErrorBucket[] = [
  { hour: "00:00", errors: 0, total: 8 },
  { hour: "01:00", errors: 1, total: 6 },
  { hour: "02:00", errors: 0, total: 4 },
  { hour: "03:00", errors: 2, total: 9 },
  { hour: "04:00", errors: 1, total: 11 },
  { hour: "05:00", errors: 0, total: 7 },
];

const MODEL_PERFS: ModelPerf[] = [
  { model: "claude-3-5-sonnet", avgTtft: 179, avgTps: 65.5, errorRate: 8.3, sessions: 3 },
  { model: "gpt-4o", avgTtft: 203, avgTps: 80.3, errorRate: 0.0, sessions: 3 },
  { model: "gpt-4o-mini", avgTtft: 91, avgTps: 81.1, errorRate: 0.0, sessions: 2 },
  { model: "claude-3-opus", avgTtft: 240, avgTps: 70.5, errorRate: 50.0, sessions: 2 },
  { model: "mistral-large", avgTtft: 304, avgTps: 66.2, errorRate: 0.0, sessions: 2 },
];

const TTFT_PERCENTILES: LatencyPercentiles = { p50: 195, p95: 308, p99: 412 };
const TPS_PERCENTILES: LatencyPercentiles = { p50: 72.4, p95: 81.2, p99: 81.8 };

const DEMO_TOKENS = [
  "Quantum", " entanglement", " is", " a", " fascinating", " phenomenon", " in", " physics",
  " where", " two", " particles", " become", " linked", ",", " such", " that", " the",
  " quantum", " state", " of", " one", " particle", " cannot", " be", " described",
  " independently", " of", " the", " other", ",", " regardless", " of", " the", " distance",
  " separating", " them", ".", " When", " you", " measure", " a", " property", " of",
  " one", " particle", ",", " you", " instantly", " know", " the", " corresponding",
  " property", " of", " its", " entangled", " partner", ".",
];

const MODELS = [
  "claude-3-5-sonnet",
  "claude-3-opus",
  "gpt-4o",
  "gpt-4o-mini",
  "mistral-large",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  if (ms === 0) {return "—";}
  return `${ms}ms`;
}

function formatDuration(sec: number): string {
  if (sec === 0) {return "—";}
  if (sec < 60) {return `${sec.toFixed(1)}s`;}
  return `${Math.floor(sec / 60)}m ${(sec % 60).toFixed(0)}s`;
}

function formatTimestamp(iso: string): string {
  return iso.replace("T", " ").replace("Z", "").slice(0, 16);
}

function statusColor(status: SessionStatus): string {
  if (status === "complete") {return "text-emerald-400";}
  if (status === "truncated") {return "text-amber-400";}
  return "text-rose-400";
}

function finishColor(reason: FinishReason): string {
  if (reason === "stop") {return "text-emerald-400";}
  if (reason === "length") {return "text-amber-400";}
  if (reason === "error") {return "text-rose-400";}
  return "text-primary";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
        active
          ? "bg-primary text-[var(--color-text-primary)]"
          : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
      )}
    >
      {children}
    </button>
  );
}

function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4", className)}>
      {children}
    </div>
  );
}

function MetaBadge({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{label}</span>
      <span className={cn("text-sm font-mono font-semibold", color ?? "text-[var(--color-text-primary)]")}>
        {value}
      </span>
    </div>
  );
}

// ─── Tab: Live Stream ─────────────────────────────────────────────────────────

function LiveStreamTab() {
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [selectedModel, setSelectedModel] = useState<string>(MODELS[0]);
  const [tokenSpeed, setTokenSpeed] = useState<number>(50);
  const [jsonMode, setJsonMode] = useState<boolean>(false);
  const [displayedText, setDisplayedText] = useState<string>("");
  const [tokenIndex, setTokenIndex] = useState<number>(0);
  const [inputTokens] = useState<number>(24);
  const [outputTokens, setOutputTokens] = useState<number>(0);
  const [ttft, setTtft] = useState<number>(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [tokensPerSec, setTokensPerSec] = useState<number>(0);
  const [finishReason, setFinishReason] = useState<FinishReason | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const jsonTokens = [
    '{', '\n  "', 'answer', '":', ' "', 'Quantum', ' entanglement',
    ' occurs', ' when', ' particles', ' share', ' quantum', ' states', '.',
    '"', ',\n  "', 'confidence', '":', ' 0', '.', '97', ',\n  "',
    'tokens', '":', ' 42', '\n}',
  ];

  const tokens = jsonMode ? jsonTokens : DEMO_TOKENS;

  const clearInterval_ = () => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startStream = () => {
    clearInterval_();
    setDisplayedText("");
    setTokenIndex(0);
    setOutputTokens(0);
    setTtft(0);
    setTokensPerSec(0);
    setFinishReason(null);
    const t0 = Date.now();
    setStartTime(t0);
    setStreamState("running");

    let idx = 0;
    let firstToken = true;
    const delay = Math.max(20, 200 - tokenSpeed * 1.8);

    intervalRef.current = setInterval(() => {
      if (idx >= tokens.length) {
        clearInterval_();
        setStreamState("done");
        setFinishReason("stop");
        return;
      }
      const tok = tokens[idx];
      if (firstToken) {
        setTtft(Date.now() - t0);
        firstToken = false;
      }
      setDisplayedText((prev) => prev + tok);
      setTokenIndex(idx + 1);
      setOutputTokens(idx + 1);
      const elapsed = (Date.now() - t0) / 1000;
      if (elapsed > 0) {setTokensPerSec(Math.round((idx + 1) / elapsed));}
      idx++;
    }, delay);
  };

  const pauseStream = () => {
    if (streamState === "running") {
      clearInterval_();
      setStreamState("paused");
    } else if (streamState === "paused") {
      const t0 = startTime;
      let idx = tokenIndex;
      let delay = Math.max(20, 200 - tokenSpeed * 1.8);
      setStreamState("running");
      intervalRef.current = setInterval(() => {
        if (idx >= tokens.length) {
          clearInterval_();
          setStreamState("done");
          setFinishReason("stop");
          return;
        }
        const tok = tokens[idx];
        setDisplayedText((prev) => prev + tok);
        setTokenIndex(idx + 1);
        setOutputTokens(idx + 1);
        const elapsed = (Date.now() - t0) / 1000;
        if (elapsed > 0) {setTokensPerSec(Math.round((idx + 1) / elapsed));}
        idx++;
      }, delay);
    }
  };

  const stopStream = () => {
    clearInterval_();
    setStreamState("idle");
    setFinishReason(null);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex flex-col gap-1 min-w-[160px]">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1 flex-1 min-w-[160px]">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Token Speed: {tokenSpeed} tok/s
            </label>
            <input
              type="range"
              min={5}
              max={100}
              value={tokenSpeed}
              onChange={(e) => setTokenSpeed(Number(e.target.value))}
              className="accent-indigo-500 w-full"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Partial JSON
            </label>
            <button
              onClick={() => setJsonMode((v) => !v)}
              className={cn(
                "w-10 h-6 rounded-full transition-colors relative",
                jsonMode ? "bg-primary" : "bg-[var(--color-surface-3)]"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                  jsonMode ? "translate-x-5" : "translate-x-1"
                )}
              />
            </button>
          </div>

          <div className="flex gap-2">
            <button
              onClick={startStream}
              disabled={streamState === "running"}
              className="px-4 py-1.5 bg-primary hover:bg-primary disabled:opacity-40 text-[var(--color-text-primary)] text-sm rounded-lg transition-colors"
            >
              Start
            </button>
            <button
              onClick={pauseStream}
              disabled={streamState === "idle" || streamState === "done"}
              className="px-4 py-1.5 bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] disabled:opacity-40 text-[var(--color-text-primary)] text-sm rounded-lg transition-colors"
            >
              {streamState === "paused" ? "Resume" : "Pause"}
            </button>
            <button
              onClick={stopStream}
              disabled={streamState === "idle"}
              className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-[var(--color-text-primary)] text-sm rounded-lg transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
      </Card>

      {/* Stream output */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Card className="min-h-[240px]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
                Stream Output
              </span>
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full font-medium",
                  streamState === "running"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : streamState === "paused"
                    ? "bg-amber-500/20 text-amber-400"
                    : streamState === "done"
                    ? "bg-primary/20 text-primary"
                    : "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]"
                )}
              >
                {streamState.toUpperCase()}
              </span>
            </div>
            <div className="font-mono text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed min-h-[180px]">
              {displayedText}
              {streamState === "running" && (
                <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5 align-text-bottom" />
              )}
              {displayedText === "" && streamState === "idle" && (
                <span className="text-[var(--color-text-muted)] italic">
                  Press Start to begin stream simulation...
                </span>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-3">
          {/* Token Counter */}
          <Card>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              Token Counter
            </p>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Input</span>
                <span className="font-mono text-[var(--color-text-primary)]">{inputTokens}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Output</span>
                <span className="font-mono text-emerald-400">{outputTokens}</span>
              </div>
              <div className="h-px bg-[var(--color-surface-2)] my-1" />
              <div className="flex justify-between text-sm">
                <span className="text-[var(--color-text-secondary)]">Total</span>
                <span className="font-mono text-[var(--color-text-primary)] font-semibold">
                  {inputTokens + outputTokens}
                </span>
              </div>
            </div>
          </Card>

          {/* Stream Metadata */}
          <Card>
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-3">
              Metadata
            </p>
            <div className="grid grid-cols-2 gap-3">
              <MetaBadge label="TTFT" value={ttft ? `${ttft}ms` : "—"} color="text-primary" />
              <MetaBadge label="Tok/s" value={tokensPerSec ? `${tokensPerSec}` : "—"} color="text-emerald-400" />
              <MetaBadge
                label="Finish"
                value={finishReason ?? "—"}
                color={finishReason ? finishColor(finishReason) : "text-[var(--color-text-secondary)]"}
              />
              <MetaBadge label="Stop Seq" value={jsonMode ? '"}' : '"."'} />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: History ─────────────────────────────────────────────────────────────

function HistoryTab() {
  const [filterModel, setFilterModel] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedSession, setSelectedSession] = useState<StreamSession | null>(null);

  const filtered = MOCK_SESSIONS.filter((s) => {
    if (filterModel !== "all" && s.model !== filterModel) {return false;}
    if (filterStatus !== "all" && s.status !== filterStatus) {return false;}
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Model</label>
            <select
              value={filterModel}
              onChange={(e) => setFilterModel(e.target.value)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Models</option>
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="complete">Complete</option>
              <option value="truncated">Truncated</option>
              <option value="error">Error</option>
            </select>
          </div>
          <div className="flex items-end">
            <span className="text-sm text-[var(--color-text-secondary)]">
              {filtered.length} session{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </Card>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-surface-1)] border-b border-[var(--color-border)]">
              <th className="text-left px-4 py-3 text-[var(--color-text-muted)] font-medium">Model</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-muted)] font-medium">Prompt</th>
              <th className="text-right px-4 py-3 text-[var(--color-text-muted)] font-medium">Tokens</th>
              <th className="text-right px-4 py-3 text-[var(--color-text-muted)] font-medium">Duration</th>
              <th className="text-right px-4 py-3 text-[var(--color-text-muted)] font-medium">Tok/s</th>
              <th className="text-center px-4 py-3 text-[var(--color-text-muted)] font-medium">Finish</th>
              <th className="text-center px-4 py-3 text-[var(--color-text-muted)] font-medium">Status</th>
              <th className="text-right px-4 py-3 text-[var(--color-text-muted)] font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s, i) => (
              <tr
                key={s.id}
                onClick={() => setSelectedSession(s)}
                className={cn(
                  "border-b border-[var(--color-border)] cursor-pointer transition-colors",
                  i % 2 === 0 ? "bg-[var(--color-surface-1)]" : "bg-[var(--color-surface-1)]/60",
                  "hover:bg-[var(--color-surface-2)]",
                  selectedSession?.id === s.id && "ring-1 ring-inset ring-indigo-500/50"
                )}
              >
                <td className="px-4 py-3 text-primary font-mono text-xs">{s.model}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)] max-w-[200px] truncate">
                  {s.promptPreview}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--color-text-primary)]">
                  {s.inputTokens + s.outputTokens}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--color-text-primary)]">
                  {formatDuration(s.duration)}
                </td>
                <td className="px-4 py-3 text-right font-mono text-[var(--color-text-primary)]">
                  {s.tokensPerSec > 0 ? s.tokensPerSec.toFixed(1) : "—"}
                </td>
                <td className={cn("px-4 py-3 text-center font-mono text-xs", finishColor(s.finishReason))}>
                  {s.finishReason}
                </td>
                <td className={cn("px-4 py-3 text-center text-xs font-medium", statusColor(s.status))}>
                  {s.status}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-muted)] text-xs font-mono">
                  {formatTimestamp(s.timestamp)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Replay panel */}
      {selectedSession && (
        <Card>
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{selectedSession.model}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{selectedSession.promptPreview}</p>
            </div>
            <button
              onClick={() => setSelectedSession(null)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-lg leading-none"
            >
              ×
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <MetaBadge label="TTFT" value={formatMs(selectedSession.ttft)} color="text-primary" />
            <MetaBadge label="Tok/s" value={selectedSession.tokensPerSec > 0 ? selectedSession.tokensPerSec.toFixed(1) : "—"} color="text-emerald-400" />
            <MetaBadge label="Finish" value={selectedSession.finishReason} color={finishColor(selectedSession.finishReason)} />
            <MetaBadge label="Status" value={selectedSession.status} color={statusColor(selectedSession.status)} />
          </div>
          <div className="bg-[var(--color-surface-0)] rounded-lg p-3 font-mono text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
            {selectedSession.fullText}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Tab: Analysis ────────────────────────────────────────────────────────────

function AnalysisTab() {
  const maxChunkCount = Math.max(...CHUNK_BINS.map((b) => b.count));
  const maxErrorCount = Math.max(...ERROR_BUCKETS.map((b) => b.total));
  const maxTps = Math.max(...MODEL_PERFS.map((m) => m.avgTps));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Token distribution histogram */}
        <Card>
          <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Token Distribution</p>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">Tokens per chunk (across all sessions)</p>
          <div className="flex items-end gap-2 h-36">
            {CHUNK_BINS.map((bin) => {
              const pct = (bin.count / maxChunkCount) * 100;
              return (
                <div key={bin.label} className="flex flex-col items-center gap-1 flex-1">
                  <span className="text-xs text-[var(--color-text-muted)] font-mono">{bin.count}</span>
                  <div
                    className="w-full bg-primary/80 rounded-t-sm transition-all"
                    style={{ height: `${Math.max(pct, 2)}%` }}
                  />
                  <span className="text-xs text-[var(--color-text-muted)]">{bin.label}</span>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-2 text-center">Tokens per chunk</p>
        </Card>

        {/* Error rate over time */}
        <Card>
          <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Error Rate Over Time</p>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">Sessions and errors by hour (today)</p>
          <div className="flex items-end gap-2 h-36">
            {ERROR_BUCKETS.map((b) => {
              const totalPct = (b.total / maxErrorCount) * 100;
              const errPct = b.total > 0 ? (b.errors / maxErrorCount) * 100 : 0;
              return (
                <div key={b.hour} className="flex flex-col items-center gap-1 flex-1">
                  <div className="w-full relative" style={{ height: `${Math.max(totalPct, 4)}%` }}>
                    <div className="absolute inset-0 bg-[var(--color-surface-3)] rounded-t-sm" />
                    {errPct > 0 && (
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-rose-500/80 rounded-t-sm"
                        style={{ height: `${(b.errors / b.total) * 100}%` }}
                      />
                    )}
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)]">{b.hour}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2 justify-center">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-[var(--color-surface-3)]" />
              <span className="text-xs text-[var(--color-text-muted)]">Total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-rose-500/80" />
              <span className="text-xs text-[var(--color-text-muted)]">Errors</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Latency analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Latency Percentiles — TTFT</p>
          <div className="space-y-3">
            {(
              [
                { label: "p50", value: TTFT_PERCENTILES.p50, max: TTFT_PERCENTILES.p99 },
                { label: "p95", value: TTFT_PERCENTILES.p95, max: TTFT_PERCENTILES.p99 },
                { label: "p99", value: TTFT_PERCENTILES.p99, max: TTFT_PERCENTILES.p99 },
              ] as { label: string; value: number; max: number }[]
            ).map((p) => (
              <div key={p.label} className="flex items-center gap-3">
                <span className="text-xs font-mono text-[var(--color-text-muted)] w-8">{p.label}</span>
                <div className="flex-1 bg-[var(--color-surface-2)] rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${(p.value / p.max) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-[var(--color-text-primary)] w-14 text-right">
                  {p.value}ms
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <p className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Generation Speed Percentiles</p>
          <div className="space-y-3">
            {(
              [
                { label: "p50", value: TPS_PERCENTILES.p50, max: TPS_PERCENTILES.p99 },
                { label: "p95", value: TPS_PERCENTILES.p95, max: TPS_PERCENTILES.p99 },
                { label: "p99", value: TPS_PERCENTILES.p99, max: TPS_PERCENTILES.p99 },
              ] as { label: string; value: number; max: number }[]
            ).map((p) => (
              <div key={p.label} className="flex items-center gap-3">
                <span className="text-xs font-mono text-[var(--color-text-muted)] w-8">{p.label}</span>
                <div className="flex-1 bg-[var(--color-surface-2)] rounded-full h-2">
                  <div
                    className="bg-emerald-500 h-2 rounded-full"
                    style={{ width: `${(p.value / p.max) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-mono text-[var(--color-text-primary)] w-20 text-right">
                  {p.value.toFixed(1)} tok/s
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Model performance comparison */}
      <Card>
        <p className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Model Performance Comparison</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left pb-3 text-[var(--color-text-muted)] font-medium">Model</th>
                <th className="text-right pb-3 text-[var(--color-text-muted)] font-medium">Avg TTFT</th>
                <th className="text-right pb-3 text-[var(--color-text-muted)] font-medium">Avg Tok/s</th>
                <th className="text-right pb-3 text-[var(--color-text-muted)] font-medium">Error Rate</th>
                <th className="text-right pb-3 text-[var(--color-text-muted)] font-medium">Sessions</th>
                <th className="pb-3 pl-4 text-[var(--color-text-muted)] font-medium">Speed</th>
              </tr>
            </thead>
            <tbody>
              {MODEL_PERFS.map((mp) => (
                <tr key={mp.model} className="border-b border-[var(--color-border)]/50">
                  <td className="py-3 text-primary font-mono text-xs">{mp.model}</td>
                  <td className="py-3 text-right font-mono text-[var(--color-text-primary)]">{mp.avgTtft}ms</td>
                  <td className="py-3 text-right font-mono text-[var(--color-text-primary)]">{mp.avgTps.toFixed(1)}</td>
                  <td
                    className={cn(
                      "py-3 text-right font-mono",
                      mp.errorRate === 0
                        ? "text-emerald-400"
                        : mp.errorRate > 25
                        ? "text-rose-400"
                        : "text-amber-400"
                    )}
                  >
                    {mp.errorRate.toFixed(1)}%
                  </td>
                  <td className="py-3 text-right text-[var(--color-text-secondary)]">{mp.sessions}</td>
                  <td className="py-3 pl-4 w-32">
                    <div className="bg-[var(--color-surface-2)] rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{ width: `${(mp.avgTps / maxTps) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Tab: Settings ────────────────────────────────────────────────────────────

function SettingsTab() {
  const [endpoint, setEndpoint] = useState<string>("https://api.example.com/v1/stream");
  const [authToken, setAuthToken] = useState<string>("sk-••••••••••••••••••••••••");
  const [showToken, setShowToken] = useState<boolean>(false);
  const [timeoutMs, setTimeoutMs] = useState<number>(30000);
  const [retryPolicy, setRetryPolicy] = useState<RetryPolicy>("exponential");
  const [maxRetries, setMaxRetries] = useState<number>(3);
  const [bufferSize, setBufferSize] = useState<number>(4096);
  const [debugLogging, setDebugLogging] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");
  const [saved, setSaved] = useState<boolean>(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Endpoint */}
      <Card>
        <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Stream Endpoint</p>
        <div className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Endpoint URL
            </label>
            <input
              type="url"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Auth Token
            </label>
            <div className="flex gap-2">
              <input
                type={showToken ? "text" : "password"}
                value={authToken}
                onChange={(e) => setAuthToken(e.target.value)}
                className="flex-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
              <button
                onClick={() => setShowToken((v) => !v)}
                className="px-3 py-2 bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] text-xs rounded-lg transition-colors"
              >
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Timeouts & Retry */}
      <Card>
        <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Timeout & Retry Policy</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Timeout (ms)
            </label>
            <input
              type="number"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              min={1000}
              max={120000}
              step={1000}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Retry Policy
            </label>
            <select
              value={retryPolicy}
              onChange={(e) => setRetryPolicy(e.target.value as RetryPolicy)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="none">None</option>
              <option value="linear">Linear</option>
              <option value="exponential">Exponential Backoff</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Max Retries
            </label>
            <input
              type="number"
              value={maxRetries}
              onChange={(e) => setMaxRetries(Number(e.target.value))}
              min={0}
              max={10}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">
              Buffer Size (bytes)
            </label>
            <select
              value={bufferSize}
              onChange={(e) => setBufferSize(Number(e.target.value))}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value={1024}>1 KB</option>
              <option value={4096}>4 KB</option>
              <option value={8192}>8 KB</option>
              <option value={16384}>16 KB</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Debug & Export */}
      <Card>
        <p className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Debug & Export</p>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-primary)]">Debug Logging</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Log raw stream frames to console
              </p>
            </div>
            <button
              onClick={() => setDebugLogging((v) => !v)}
              className={cn(
                "w-10 h-6 rounded-full transition-colors relative",
                debugLogging ? "bg-primary" : "bg-[var(--color-surface-3)]"
              )}
            >
              <span
                className={cn(
                  "absolute top-1 w-4 h-4 bg-white rounded-full transition-transform",
                  debugLogging ? "translate-x-5" : "translate-x-1"
                )}
              />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-[var(--color-text-primary)]">Export Format</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Format for exporting stream sessions
              </p>
            </div>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
              className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
              <option value="ndjson">NDJSON</option>
            </select>
          </div>
        </div>
      </Card>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className={cn(
            "px-6 py-2 rounded-lg text-sm font-medium transition-colors",
            saved
              ? "bg-emerald-600 text-[var(--color-text-primary)]"
              : "bg-primary hover:bg-primary text-[var(--color-text-primary)]"
          )}
        >
          {saved ? "Saved!" : "Save Settings"}
        </button>
        <button
          onClick={() => {
            setEndpoint("https://api.example.com/v1/stream");
            setTimeoutMs(30000);
            setRetryPolicy("exponential");
            setMaxRetries(3);
            setBufferSize(4096);
            setDebugLogging(false);
            setExportFormat("json");
          }}
          className="px-6 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-sm font-medium rounded-lg transition-colors"
        >
          Reset Defaults
        </button>
      </div>
    </div>
  );
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function StreamingDebugger() {
  const [activeTab, setActiveTab] = useState<TabId>("live");

  const tabs: { id: TabId; label: string }[] = [
    { id: "live", label: "Live Stream" },
    { id: "history", label: "History" },
    { id: "analysis", label: "Analysis" },
    { id: "settings", label: "Settings" },
  ];

  const totalSessions = MOCK_SESSIONS.length;
  const errorCount = MOCK_SESSIONS.filter((s) => s.status === "error").length;
  const avgTps =
    MOCK_SESSIONS.filter((s) => s.tokensPerSec > 0).reduce((acc, s) => acc + s.tokensPerSec, 0) /
    MOCK_SESSIONS.filter((s) => s.tokensPerSec > 0).length;

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Streaming Debugger</h1>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            Real-time streaming response inspector for LLM and agent output streams
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Card className="p-3">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Sessions</p>
            <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{totalSessions}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Error Rate</p>
            <p className="text-2xl font-bold text-rose-400 mt-1">
              {((errorCount / totalSessions) * 100).toFixed(0)}%
            </p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Avg Tok/s</p>
            <p className="text-2xl font-bold text-emerald-400 mt-1">{avgTps.toFixed(1)}</p>
          </Card>
          <Card className="p-3">
            <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Models</p>
            <p className="text-2xl font-bold text-primary mt-1">{MODEL_PERFS.length}</p>
          </Card>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-1 w-fit">
          {tabs.map((tab) => (
            <TabButton
              key={tab.id}
              active={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </TabButton>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "live" && <LiveStreamTab />}
        {activeTab === "history" && <HistoryTab />}
        {activeTab === "analysis" && <AnalysisTab />}
        {activeTab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
}
