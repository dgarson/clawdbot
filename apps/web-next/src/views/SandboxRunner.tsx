import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type SandboxLang = "typescript" | "python" | "bash" | "json";
type RunStatus = "idle" | "running" | "success" | "error" | "timeout";

interface SandboxRun {
  id: string;
  code: string;
  lang: SandboxLang;
  startedAt: string;
  durationMs: number;
  status: RunStatus;
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface Snippet {
  id: string;
  name: string;
  lang: SandboxLang;
  code: string;
  description: string;
  tags: string[];
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SNIPPETS: Snippet[] = [
  {
    id: "s1",
    name: "Token Counter",
    lang: "typescript",
    description: "Estimate token count for a string",
    tags: ["tokens", "util"],
    code: `// Approximate token counter
function countTokens(text: string): number {
  // ~4 chars per token on average
  const words = text.trim().split(/\\s+/);
  return Math.ceil(words.reduce((sum, w) => sum + Math.ceil(w.length / 4), 0));
}

const text = "Hello, I am an AI agent running in the OpenClaw system.";
console.log(\`Text: "\${text}"\`);
console.log(\`Estimated tokens: \${countTokens(text)}\`);
`,
  },
  {
    id: "s2",
    name: "Agent Health Check",
    lang: "bash",
    description: "Check OpenClaw gateway status",
    tags: ["ops", "gateway"],
    code: `#!/bin/bash
echo "=== OpenClaw Health Check ==="
echo "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""
echo "--- Gateway ---"
openclaw gateway status 2>/dev/null || echo "Gateway: not running"
echo ""
echo "--- Disk Usage ---"
df -h /Users/openclaw/.openclaw 2>/dev/null | tail -1
echo ""
echo "--- Recent Logs ---"
tail -5 /tmp/openclaw.log 2>/dev/null || echo "No log file found"
`,
  },
  {
    id: "s3",
    name: "JSON Schema Validator",
    lang: "json",
    description: "Validate agent config structure",
    tags: ["config", "validation"],
    code: `{
  "schema": {
    "type": "object",
    "required": ["name", "role", "model", "squad"],
    "properties": {
      "name": { "type": "string", "minLength": 2 },
      "role": { "type": "string" },
      "model": { "type": "string", "pattern": "^[a-z-]+/[\\\\w.-]+$" },
      "squad": {
        "type": "string",
        "enum": ["product-ui", "platform-core", "feature-dev", "ops"]
      },
      "tier": {
        "type": "string",
        "enum": ["executive", "principal", "senior", "worker"]
      }
    }
  },
  "sample": {
    "name": "Luis",
    "role": "Principal UX Engineer",
    "model": "anthropic/claude-sonnet-4-6",
    "squad": "product-ui",
    "tier": "principal"
  }
}`,
  },
  {
    id: "s4",
    name: "Cost Calculator",
    lang: "python",
    description: "Calculate LLM API cost from token usage",
    tags: ["cost", "billing"],
    code: `#!/usr/bin/env python3
# LLM Cost Calculator

PRICING = {
    "anthropic/claude-opus-4-6":   {"input": 15.00, "output": 75.00},
    "anthropic/claude-sonnet-4-6": {"input":  3.00, "output": 15.00},
    "minimax-portal/MiniMax-M2.5": {"input":  0.40, "output":  1.60},
    "google/gemini-flash-preview":  {"input":  0.10, "output":  0.40},
}

usage = [
    ("anthropic/claude-opus-4-6",    12500, 3200),
    ("anthropic/claude-sonnet-4-6", 450000, 85000),
    ("minimax-portal/MiniMax-M2.5", 820000, 210000),
]

total = 0
print(f"{'Model':<35} {'Input':>10} {'Output':>10} {'Cost':>10}")
print("-" * 70)
for model, inp, out in usage:
    p = PRICING.get(model, {"input": 1, "output": 4})
    cost = (inp / 1_000_000 * p["input"]) + (out / 1_000_000 * p["output"])
    total += cost
    print(f"{model:<35} {inp:>10,} {out:>10,} \${cost:>9.4f}")
print("-" * 70)
print(f"{'TOTAL':<56} \${total:>9.4f}")
`,
  },
  {
    id: "s5",
    name: "Fibonacci",
    lang: "typescript",
    description: "Memoized Fibonacci sequence",
    tags: ["algo", "example"],
    code: `// Memoized Fibonacci
const memo = new Map<number, bigint>();

function fib(n: number): bigint {
  if (n <= 1) return BigInt(n);
  if (memo.has(n)) return memo.get(n)!;
  const result = fib(n - 1) + fib(n - 2);
  memo.set(n, result);
  return result;
}

for (let i = 0; i <= 20; i++) {
  console.log(\`fib(\${i.toString().padStart(2)}) = \${fib(i)}\`);
}
`,
  },
];

const SAMPLE_RUNS: SandboxRun[] = [
  {
    id: "run-1",
    code: SNIPPETS[0].code,
    lang: "typescript",
    startedAt: "2026-02-22T02:10:00Z",
    durationMs: 234,
    status: "success",
    stdout: `Text: "Hello, I am an AI agent running in the OpenClaw system."
Estimated tokens: 14`,
    stderr: "",
    exitCode: 0,
  },
  {
    id: "run-2",
    code: SNIPPETS[3].code,
    lang: "python",
    startedAt: "2026-02-22T01:55:00Z",
    durationMs: 89,
    status: "success",
    stdout: `Model                               Input      Output       Cost
----------------------------------------------------------------------
anthropic/claude-opus-4-6           12,500       3,200   $0.4275
anthropic/claude-sonnet-4-6        450,000      85,000   $2.6250
minimax-portal/MiniMax-M2.5        820,000     210,000   $0.6640
----------------------------------------------------------------------
TOTAL                                                    $3.7165`,
    stderr: "",
    exitCode: 0,
  },
  {
    id: "run-3",
    code: "import sys\nprint(sys.version\nprint('done')",
    lang: "python",
    startedAt: "2026-02-22T01:42:00Z",
    durationMs: 45,
    status: "error",
    stdout: "",
    stderr: "  File \"<string>\", line 2\n    print(sys.version\n                     ^\nSyntaxError: '(' was never closed",
    exitCode: 1,
  },
  {
    id: "run-4",
    code: "while true; do echo 'loop'; sleep 0.1; done",
    lang: "bash",
    startedAt: "2026-02-22T01:30:00Z",
    durationMs: 30000,
    status: "timeout",
    stdout: "loop\nloop\nloop\n...",
    stderr: "Process killed: execution timeout (30s)",
    exitCode: 124,
  },
];

const LANG_CONFIG: Record<SandboxLang, { label: string; color: string; bg: string; border: string; mono: string }> = {
  typescript: { label: "TypeScript", color: "text-blue-400", bg: "bg-blue-900/20", border: "border-blue-700/50", mono: "ts" },
  python: { label: "Python", color: "text-yellow-400", bg: "bg-yellow-900/20", border: "border-yellow-700/50", mono: "py" },
  bash: { label: "Bash", color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-700/50", mono: "sh" },
  json: { label: "JSON", color: "text-orange-400", bg: "bg-orange-900/20", border: "border-orange-700/50", mono: "json" },
};

const RUN_STATUS_CONFIG: Record<RunStatus, { label: string; color: string; dot: string }> = {
  idle: { label: "Idle", color: "text-[var(--color-text-secondary)]", dot: "bg-[var(--color-surface-3)]" },
  running: { label: "Running", color: "text-amber-400", dot: "bg-amber-400 animate-pulse" },
  success: { label: "Success", color: "text-emerald-400", dot: "bg-emerald-400" },
  error: { label: "Error", color: "text-rose-400", dot: "bg-rose-400" },
  timeout: { label: "Timeout", color: "text-orange-400", dot: "bg-orange-400" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SandboxRunner() {
  const [code, setCode] = useState(SNIPPETS[0].code);
  const [lang, setLang] = useState<SandboxLang>("typescript");
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runs, setRuns] = useState<SandboxRun[]>(SAMPLE_RUNS);
  const [selectedRun, setSelectedRun] = useState<SandboxRun | null>(SAMPLE_RUNS[0]);
  const [activePanel, setActivePanel] = useState<"snippets" | "history">("snippets");
  const [outputTab, setOutputTab] = useState<"stdout" | "stderr">("stdout");

  function handleRun() {
    if (runStatus === "running") {return;}
    setRunStatus("running");
    const newRun: SandboxRun = {
      id: `run-${Date.now()}`,
      code,
      lang,
      startedAt: new Date().toISOString(),
      durationMs: 0,
      status: "running",
      stdout: "",
      stderr: "",
      exitCode: -1,
    };
    setRuns((prev) => [newRun, ...prev]);
    setSelectedRun(newRun);

    // Simulate execution
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      const success = Math.random() > 0.25;
      const finished: SandboxRun = {
        ...newRun,
        durationMs: Math.round(delay),
        status: success ? "success" : "error",
        stdout: success
          ? lang === "typescript"
            ? `[Compiled OK]\n${code.includes("console.log") ? "Output: <simulated result>" : "Module evaluated successfully."}`
            : lang === "python"
            ? "Script executed successfully.\nReturn code: 0"
            : lang === "bash"
            ? "Command completed.\n$ _"
            : "JSON parsed: valid"
          : "",
        stderr: success ? "" : `RuntimeError: Execution failed at line ${Math.floor(Math.random() * 10) + 1}\n  Unexpected token`,
        exitCode: success ? 0 : 1,
      };
      setRuns((prev) => prev.map((r) => (r.id === newRun.id ? finished : r)));
      setSelectedRun(finished);
      setRunStatus(success ? "success" : "error");
      setTimeout(() => setRunStatus("idle"), 2000);
    }, delay);
  }

  function loadSnippet(snippet: Snippet) {
    setCode(snippet.code);
    setLang(snippet.lang);
    setRunStatus("idle");
  }

  const successCount = runs.filter((r) => r.status === "success").length;
  const errorCount = runs.filter((r) => r.status === "error").length;
  const avgDuration = runs.filter((r) => r.durationMs > 0).reduce((s, r, _, a) => s + r.durationMs / a.length, 0);

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Sandbox Runner</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">Execute code safely in an isolated environment</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Lang selector */}
            <div className="flex gap-1">
              {(Object.keys(LANG_CONFIG) as SandboxLang[]).map((l) => {
                const lc = LANG_CONFIG[l];
                return (
                  <button
                    key={l}
                    onClick={() => setLang(l)}
                    className={cn(
                      "px-2.5 py-1 rounded text-xs border transition-all",
                      lang === l ? `${lc.bg} ${lc.color} ${lc.border}` : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    .{lc.mono}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleRun}
              disabled={runStatus === "running"}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                runStatus === "running"
                  ? "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] cursor-not-allowed"
                  : "bg-primary hover:bg-primary text-[var(--color-text-primary)]"
              )}
            >
              {runStatus === "running" ? (
                <><span className="animate-spin">⟳</span> Running…</>
              ) : (
                <>▶ Run</>
              )}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm">
          <span><span className="text-[var(--color-text-muted)]">Runs:</span> <span className="text-[var(--color-text-primary)] font-medium">{runs.length}</span></span>
          <span><span className="text-[var(--color-text-muted)]">Success:</span> <span className="text-emerald-400 font-medium">{successCount}</span></span>
          <span><span className="text-[var(--color-text-muted)]">Errors:</span> <span className="text-rose-400 font-medium">{errorCount}</span></span>
          <span><span className="text-[var(--color-text-muted)]">Avg duration:</span> <span className="text-primary font-medium">{Math.round(avgDuration)}ms</span></span>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className={cn("w-2 h-2 rounded-full", RUN_STATUS_CONFIG[runStatus].dot)} />
            <span className={cn("text-xs", RUN_STATUS_CONFIG[runStatus].color)}>{RUN_STATUS_CONFIG[runStatus].label}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Left: code editor + output */}
        <div className="flex-1 flex flex-col overflow-hidden border-r border-[var(--color-border)]">
          {/* Code editor */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-surface-1)]/50 border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2">
                <span className={cn("text-xs font-medium", LANG_CONFIG[lang].color)}>{LANG_CONFIG[lang].label}</span>
                <span className="text-[var(--color-text-muted)]">·</span>
                <span className="text-xs text-[var(--color-text-muted)]">{code.split("\n").length} lines</span>
              </div>
              <button
                onClick={() => setCode("")}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                Clear
              </button>
            </div>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="flex-1 bg-[var(--color-surface-0)] text-[var(--color-text-primary)] font-mono text-xs p-4 resize-none outline-none leading-relaxed"
              style={{ tabSize: 2 }}
            />
          </div>

          {/* Output panel */}
          <div className="flex-shrink-0 h-48 border-t border-[var(--color-border)] flex flex-col">
            <div className="flex items-center gap-0 px-4 bg-[var(--color-surface-1)]/50 border-b border-[var(--color-border)]">
              {(["stdout", "stderr"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setOutputTab(tab)}
                  className={cn(
                    "px-3 py-2 text-xs border-b-2 -mb-px transition-colors",
                    outputTab === tab
                      ? "border-primary text-[var(--color-text-primary)]"
                      : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {tab}
                  {tab === "stderr" && selectedRun?.stderr && (
                    <span className="ml-1.5 bg-rose-900/50 text-rose-400 px-1 rounded text-[9px]">!</span>
                  )}
                </button>
              ))}
              {selectedRun && (
                <div className="ml-auto flex items-center gap-2 text-xs">
                  <span className={cn(RUN_STATUS_CONFIG[selectedRun.status].color)}>
                    {RUN_STATUS_CONFIG[selectedRun.status].label}
                  </span>
                  {selectedRun.durationMs > 0 && (
                    <span className="text-[var(--color-text-muted)]">{selectedRun.durationMs}ms</span>
                  )}
                  <span className="text-[var(--color-text-muted)]">exit: {selectedRun.exitCode === -1 ? "…" : selectedRun.exitCode}</span>
                </div>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
              {selectedRun ? (
                outputTab === "stdout" ? (
                  selectedRun.stdout ? (
                    <pre className="text-emerald-300 whitespace-pre-wrap">{selectedRun.stdout}</pre>
                  ) : (
                    <span className="text-[var(--color-text-muted)]">No output</span>
                  )
                ) : selectedRun.stderr ? (
                  <pre className="text-rose-400 whitespace-pre-wrap">{selectedRun.stderr}</pre>
                ) : (
                  <span className="text-[var(--color-text-muted)]">No stderr</span>
                )
              ) : (
                <span className="text-[var(--color-text-muted)]">Run code to see output</span>
              )}
            </div>
          </div>
        </div>

        {/* Right: snippets + history */}
        <div className="flex-shrink-0 w-72 flex flex-col overflow-hidden">
          {/* Tab header */}
          <div className="flex border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/30">
            {(["snippets", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActivePanel(tab)}
                className={cn(
                  "flex-1 px-3 py-3 text-xs capitalize border-b-2 -mb-px transition-colors",
                  activePanel === tab
                    ? "border-primary text-[var(--color-text-primary)]"
                    : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {activePanel === "snippets" && (
              <div className="p-3 space-y-2">
                {SNIPPETS.map((snippet) => {
                  const lc = LANG_CONFIG[snippet.lang];
                  return (
                    <button
                      key={snippet.id}
                      onClick={() => loadSnippet(snippet)}
                      className="w-full text-left p-3 rounded-lg border bg-[var(--color-surface-1)] border-[var(--color-border)] hover:border-[var(--color-surface-3)] transition-all"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-[var(--color-text-primary)]">{snippet.name}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", lc.bg, lc.color, lc.border)}>
                          .{lc.mono}
                        </span>
                      </div>
                      <div className="text-xs text-[var(--color-text-secondary)] mb-2">{snippet.description}</div>
                      <div className="flex flex-wrap gap-1">
                        {snippet.tags.map((tag) => (
                          <span key={tag} className="text-[10px] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {activePanel === "history" && (
              <div className="p-3 space-y-2">
                {runs.map((run) => {
                  const rs = RUN_STATUS_CONFIG[run.status];
                  const lc = LANG_CONFIG[run.lang];
                  const isSelected = selectedRun?.id === run.id;
                  return (
                    <button
                      key={run.id}
                      onClick={() => setSelectedRun(run)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border transition-all",
                        isSelected
                          ? "bg-indigo-900/20 border-primary/50"
                          : "bg-[var(--color-surface-1)] border-[var(--color-border)] hover:border-[var(--color-surface-3)]"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={cn("flex items-center gap-1.5 text-xs font-medium", rs.color)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full", rs.dot)} />
                          {rs.label}
                        </span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", lc.bg, lc.color, lc.border)}>
                          .{lc.mono}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">
                        {run.startedAt.slice(11, 19)} · {run.durationMs > 0 ? `${run.durationMs}ms` : "…"}
                      </div>
                      {run.stdout && (
                        <div className="text-[10px] text-[var(--color-text-muted)] font-mono truncate mt-1">
                          {run.stdout.split("\n")[0]}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
