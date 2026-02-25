import React, { useState, useMemo } from "react";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  Clock,
  Filter,
  GitBranch,
  Gauge,
  Search,
  Target,
  TrendingUp,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  BarChart3,
  Lightbulb,
  RotateCcw,
  Zap,
  Shield,
} from "lucide-react";
import { cn } from "../lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type DecisionType =
  | "model-selection"
  | "tool-choice"
  | "routing"
  | "escalation"
  | "self-correction";

type Outcome = "success" | "failure" | "pending";

interface Alternative {
  name: string;
  score: number;
  reason: string;
}

interface Decision {
  id: string;
  agent: string;
  agentEmoji: string;
  type: DecisionType;
  timestamp: Date;
  summary: string;
  reasoning: string[];
  alternatives: Alternative[];
  confidence: number;
  outcome: Outcome;
  outcomeDetail: string;
}

interface SelfEvalReport {
  id: string;
  agent: string;
  agentEmoji: string;
  timestamp: Date;
  performanceScore: number;
  taskCompletionRate: number;
  strengths: string[];
  improvements: string[];
  routingRecommendations: string[];
  costEfficiencyScore: number;
  costBaseline: number;
}

interface RoutingRule {
  taskType: string;
  preferredModel: string;
  fallback: string;
  reason: string;
}

type TimeRange = "1h" | "6h" | "24h" | "7d";
type SortKey = "time" | "confidence" | "agent";
type ActiveTab = "timeline" | "self-eval" | "routing";

interface DecisionProvenanceProps {
  onNavigate?: (viewId: string) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const DECISION_TYPE_META: Record<
  DecisionType,
  { label: string; color: string; bg: string; icon: React.ReactNode }
> = {
  "model-selection": {
    label: "Model Selection",
    color: "text-primary",
    bg: "bg-primary/15 ring-violet-500/25",
    icon: <Brain className="w-3.5 h-3.5" />,
  },
  "tool-choice": {
    label: "Tool Choice",
    color: "text-sky-400",
    bg: "bg-sky-500/15 ring-sky-500/25",
    icon: <Zap className="w-3.5 h-3.5" />,
  },
  routing: {
    label: "Routing",
    color: "text-amber-400",
    bg: "bg-amber-500/15 ring-amber-500/25",
    icon: <GitBranch className="w-3.5 h-3.5" />,
  },
  escalation: {
    label: "Escalation",
    color: "text-rose-400",
    bg: "bg-rose-500/15 ring-rose-500/25",
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  "self-correction": {
    label: "Self-Correction",
    color: "text-emerald-400",
    bg: "bg-emerald-500/15 ring-emerald-500/25",
    icon: <RotateCcw className="w-3.5 h-3.5" />,
  },
};

const OUTCOME_STYLES: Record<Outcome, { label: string; color: string; bg: string }> = {
  success: { label: "Success", color: "text-emerald-400", bg: "bg-emerald-500/10 ring-emerald-500/20" },
  failure: { label: "Failure", color: "text-rose-400", bg: "bg-rose-500/10 ring-rose-500/20" },
  pending: { label: "Pending", color: "text-amber-400", bg: "bg-amber-500/10 ring-amber-500/20" },
};

// ─── Time Helpers ───────────────────────────────────────────────────────────

const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const mins = (n: number) => n * 60_000;
const hrs = (n: number) => n * 3_600_000;

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const DECISIONS: Decision[] = [
  {
    id: "d-001",
    agent: "Luis",
    agentEmoji: "\u{1F3A8}",
    type: "model-selection",
    timestamp: ago(mins(12)),
    summary: "Selected claude-sonnet-4-6 over gpt-4o for UI code generation task",
    reasoning: [
      "Task requires React/TypeScript code generation",
      "Claude Sonnet excels at structured code output with Tailwind CSS",
      "Budget allows Sonnet tier ($3/M input tokens)",
      "Previous 14 code-gen tasks with Sonnet had 97% first-pass success rate",
      "Selected claude-sonnet-4-6",
    ],
    alternatives: [
      { name: "gpt-4o", score: 72, reason: "Good at code but less consistent with Tailwind patterns" },
      { name: "claude-opus-4-6", score: 94, reason: "Highest quality but exceeds budget for this task tier" },
      { name: "gpt-4o-mini", score: 41, reason: "Insufficient quality for complex component generation" },
    ],
    confidence: 91,
    outcome: "success",
    outcomeDetail: "Generated 2,041 tokens in 3.8s, component compiled and rendered correctly",
  },
  {
    id: "d-002",
    agent: "Quinn",
    agentEmoji: "\u{1F9E0}",
    type: "routing",
    timestamp: ago(mins(28)),
    summary: "Routed simple classification task to gpt-4o-mini for cost efficiency",
    reasoning: [
      "Incoming task: classify support ticket sentiment (positive/negative/neutral)",
      "Task complexity score: 0.18 (low) — single-label classification",
      "gpt-4o-mini achieves 96.2% accuracy on sentiment benchmarks",
      "Cost savings: 94% vs claude-sonnet-4-6 for equivalent accuracy",
      "Routed to gpt-4o-mini",
    ],
    alternatives: [
      { name: "claude-sonnet-4-6", score: 98, reason: "Overkill — high accuracy but 15x cost for marginal gain" },
      { name: "gpt-4o", score: 85, reason: "Good but unnecessary for low-complexity classification" },
      { name: "claude-haiku-3.5", score: 82, reason: "Competitive but gpt-4o-mini has better latency" },
    ],
    confidence: 95,
    outcome: "success",
    outcomeDetail: "Classified 48 tickets in 1.2s avg, 97.9% accuracy vs human labels",
  },
  {
    id: "d-003",
    agent: "Xavier",
    agentEmoji: "\u{1F3D7}\u{FE0F}",
    type: "escalation",
    timestamp: ago(mins(45)),
    summary: "Escalated from sub-agent Piper to main agent — complexity exceeded sub-agent scope",
    reasoning: [
      "Sub-agent Piper (minimax-m2.5) was handling API integration task",
      "Task required cross-service authentication flow — 3 external APIs",
      "Piper's context window insufficient for full auth chain reasoning",
      "Error rate exceeded threshold: 3 failed attempts in sequence",
      "Escalated to Xavier (claude-opus-4-6) with full context handoff",
    ],
    alternatives: [
      { name: "Retry with Piper", score: 22, reason: "Already failed 3x, unlikely to succeed without more context" },
      { name: "Route to Luis", score: 68, reason: "Luis capable but Xavier has deeper architecture knowledge" },
      { name: "Split into sub-tasks", score: 55, reason: "Possible but adds latency and coordination overhead" },
    ],
    confidence: 87,
    outcome: "success",
    outcomeDetail: "Xavier completed auth integration in 12.4s, all 3 API handshakes verified",
  },
  {
    id: "d-004",
    agent: "Reed",
    agentEmoji: "\u{1F50D}",
    type: "self-correction",
    timestamp: ago(hrs(1.5)),
    summary: "Self-corrected after failed file-write tool call by switching to patch-based approach",
    reasoning: [
      "Initial approach: full file rewrite via file.write tool",
      "Tool call failed: file locked by concurrent process (EBUSY)",
      "Analyzed error — file contention from parallel build step",
      "Switched strategy: use patch-based edit tool instead of full write",
      "Patch tool supports atomic partial updates, avoids lock contention",
      "Retried with file.patch — succeeded on first attempt",
    ],
    alternatives: [
      { name: "Wait and retry file.write", score: 45, reason: "Would succeed eventually but unpredictable delay" },
      { name: "Kill competing process", score: 30, reason: "Destructive — could break build pipeline" },
      { name: "Queue for later", score: 52, reason: "Safe but adds latency to task completion" },
    ],
    confidence: 78,
    outcome: "success",
    outcomeDetail: "Patch applied in 0.3s, file integrity verified, no build disruption",
  },
  {
    id: "d-005",
    agent: "Wes",
    agentEmoji: "\u{1F4CA}",
    type: "routing",
    timestamp: ago(hrs(2)),
    summary: "Multi-step research task routed through 3-model cascade for depth and cost balance",
    reasoning: [
      "Task: comprehensive competitive analysis requiring web research + synthesis",
      "Step 1: Use gpt-4o-mini for initial web search + data extraction (cost-efficient)",
      "Step 2: Use claude-sonnet-4-6 for synthesis and pattern identification",
      "Step 3: Use claude-opus-4-6 for final strategic recommendations (highest reasoning)",
      "Cascade reduces total cost by 62% vs using Opus for all steps",
    ],
    alternatives: [
      { name: "claude-opus-4-6 for all steps", score: 96, reason: "Highest quality but 2.6x cost ($4.80 vs $1.84)" },
      { name: "claude-sonnet-4-6 for all steps", score: 74, reason: "Good balance but weaker on initial extraction" },
      { name: "Single model with RAG", score: 61, reason: "RAG retrieval quality insufficient for live web data" },
    ],
    confidence: 84,
    outcome: "success",
    outcomeDetail: "3-step cascade completed in 28.6s total, report quality scored 4.7/5 by reviewer",
  },
  {
    id: "d-006",
    agent: "Luis",
    agentEmoji: "\u{1F3A8}",
    type: "tool-choice",
    timestamp: ago(hrs(3)),
    summary: "Selected exec.run over file.write for build verification — needed live output",
    reasoning: [
      "Task: verify that generated component compiles without errors",
      "file.write would only create file — no compilation feedback",
      "exec.run with 'pnpm build' provides live TypeScript error output",
      "Build verification is a gate before committing — need pass/fail signal",
      "Selected exec.run tool with build command",
    ],
    alternatives: [
      { name: "file.write + manual check", score: 35, reason: "No automated feedback loop" },
      { name: "exec.run with tsc --noEmit", score: 80, reason: "Faster but misses bundler-specific issues" },
      { name: "Skip verification", score: 10, reason: "Violates quality gate policy" },
    ],
    confidence: 92,
    outcome: "success",
    outcomeDetail: "Build passed in 1.64s with 0 errors, 0 warnings",
  },
  {
    id: "d-007",
    agent: "Piper",
    agentEmoji: "\u{1F58C}\u{FE0F}",
    type: "model-selection",
    timestamp: ago(hrs(4)),
    summary: "Selected minimax-m2.5 for rapid UI prototyping — optimizing for speed over depth",
    reasoning: [
      "Task: generate 5 quick UI mockup variations for A/B test",
      "Speed priority: need all 5 within 10s total",
      "MiniMax M2.5 average response: 1.8s for this output size",
      "Quality sufficient for prototype-level components",
      "Cost: $0.003 per generation vs $0.12 for Sonnet",
    ],
    alternatives: [
      { name: "claude-sonnet-4-6", score: 88, reason: "Higher quality but 6.7x slower for this batch" },
      { name: "gpt-4o-mini", score: 71, reason: "Competitive speed but less consistent with design system" },
    ],
    confidence: 82,
    outcome: "success",
    outcomeDetail: "5 prototypes generated in 8.4s total, 3 selected for A/B testing",
  },
  {
    id: "d-008",
    agent: "Quinn",
    agentEmoji: "\u{1F9E0}",
    type: "self-correction",
    timestamp: ago(hrs(5)),
    summary: "Revised embedding model after detecting drift in retrieval relevance scores",
    reasoning: [
      "Monitoring detected retrieval relevance dropped from 0.89 to 0.71 over 24h",
      "Root cause: new document corpus has different token distribution",
      "Original embedding model (text-embedding-3-small) underperforming on technical docs",
      "Switched to text-embedding-3-large for technical document index",
      "Re-indexed 2,400 documents with new embeddings",
    ],
    alternatives: [
      { name: "Keep current model + tune threshold", score: 40, reason: "Band-aid fix, doesn't address root cause" },
      { name: "Switch to Cohere embed-v3", score: 72, reason: "Good alternative but requires API migration" },
    ],
    confidence: 76,
    outcome: "pending",
    outcomeDetail: "Re-indexing in progress — 1,800/2,400 documents processed",
  },
];

const SELF_EVAL_REPORTS: SelfEvalReport[] = [
  {
    id: "eval-001",
    agent: "Piper",
    agentEmoji: "\u{1F58C}\u{FE0F}",
    timestamp: ago(hrs(1)),
    performanceScore: 79,
    taskCompletionRate: 94.2,
    strengths: [
      "Fast iteration on UI prototypes (avg 1.8s per component)",
      "Consistent adherence to design system tokens",
      "Low error rate on file operations (0.4%)",
    ],
    improvements: [
      "Complex multi-file refactors exceed context window — consider chunking",
      "Build verification sometimes skipped under time pressure",
      "Should pre-validate Tailwind classes against config before generating",
    ],
    routingRecommendations: [
      "Redirect complex auth/API tasks to Xavier or Luis — success rate drops below 60% for these",
      "Consider reallocating 15% of budget from prototyping to code review passes",
      "Use gpt-4o-mini for simple color/spacing adjustments instead of MiniMax",
    ],
    costEfficiencyScore: 92,
    costBaseline: 78,
  },
  {
    id: "eval-002",
    agent: "Luis",
    agentEmoji: "\u{1F3A8}",
    timestamp: ago(hrs(3)),
    performanceScore: 94,
    taskCompletionRate: 99.1,
    strengths: [
      "Near-perfect first-pass compilation rate (97.3%)",
      "Excellent tool selection accuracy — right tool chosen 96% of the time",
      "Strong collaboration with sub-agents — clear context handoffs",
    ],
    improvements: [
      "Token usage slightly above budget on large components (+8% avg)",
      "Could batch file operations to reduce I/O overhead",
      "Self-correction latency: 4.2s avg — target is under 3s",
    ],
    routingRecommendations: [
      "Upgrade to claude-opus-4-6 for architecture-level decisions (currently using Sonnet)",
      "Delegate simple file reads to Piper to free up Sonnet capacity",
    ],
    costEfficiencyScore: 85,
    costBaseline: 78,
  },
  {
    id: "eval-003",
    agent: "Xavier",
    agentEmoji: "\u{1F3D7}\u{FE0F}",
    timestamp: ago(hrs(6)),
    performanceScore: 97,
    taskCompletionRate: 99.7,
    strengths: [
      "Exceptional reasoning depth on cross-system integration tasks",
      "Zero critical failures in the past 7 days",
      "Effective escalation handling — resolves sub-agent failures in 1.2 attempts avg",
    ],
    improvements: [
      "Cost per session is 4.6x team average — explore Sonnet for non-critical reviews",
      "Response latency (2.84s avg) could be reduced with prompt caching",
      "Delegate routine PR reviews to Tim to reduce Opus token consumption",
    ],
    routingRecommendations: [
      "Reserve Opus tier for architecture decisions and complex debugging only",
      "Route standard code reviews to Tim (claude-sonnet-4-6) — quality delta is <2%",
    ],
    costEfficiencyScore: 58,
    costBaseline: 78,
  },
  {
    id: "eval-004",
    agent: "Wes",
    agentEmoji: "\u{1F4CA}",
    timestamp: ago(hrs(8)),
    performanceScore: 88,
    taskCompletionRate: 96.4,
    strengths: [
      "Multi-step cascade routing saves 62% on research tasks",
      "High-quality synthesis — reviewer scores consistently above 4.5/5",
      "Effective at decomposing complex research into parallelizable sub-tasks",
    ],
    improvements: [
      "Web search tool sometimes returns stale cached results — add freshness check",
      "Cascade step 2 occasionally bottlenecks when Sonnet is at capacity",
      "Should add fallback routing when primary model has >5s queue time",
    ],
    routingRecommendations: [
      "Add Gemini 2.5 Pro as fallback for synthesis step when Sonnet queue exceeds 5s",
      "Use dedicated embedding model for research indexing instead of general-purpose",
    ],
    costEfficiencyScore: 91,
    costBaseline: 78,
  },
];

const ROUTING_RULES: RoutingRule[] = [
  { taskType: "Code Generation", preferredModel: "claude-sonnet-4-6", fallback: "gpt-4o", reason: "Best first-pass compilation rate for TypeScript/React" },
  { taskType: "Simple Classification", preferredModel: "gpt-4o-mini", fallback: "claude-haiku-3.5", reason: "96%+ accuracy at lowest cost tier" },
  { taskType: "Architecture Review", preferredModel: "claude-opus-4-6", fallback: "claude-sonnet-4-6", reason: "Requires deep multi-system reasoning" },
  { taskType: "UI Prototyping", preferredModel: "minimax-m2.5", fallback: "gpt-4o-mini", reason: "Fastest response for iterative design work" },
  { taskType: "Research & Synthesis", preferredModel: "cascade (mini→sonnet→opus)", fallback: "claude-sonnet-4-6", reason: "Balances depth and cost across research phases" },
  { taskType: "Document Summarization", preferredModel: "gpt-4o-mini", fallback: "claude-haiku-3.5", reason: "Cost-efficient for extractive tasks" },
  { taskType: "Complex Debugging", preferredModel: "claude-opus-4-6", fallback: "claude-sonnet-4-6", reason: "Needs strong reasoning and long-context handling" },
  { taskType: "Data Extraction", preferredModel: "gpt-4o", fallback: "gpt-4o-mini", reason: "Good structured output with function calling" },
];

// ─── Stat Helpers ───────────────────────────────────────────────────────────

function computeModelDistribution(decisions: Decision[]) {
  const counts: Record<string, number> = {};
  for (const d of decisions) {
    const model = d.summary.match(
      /claude-opus-4-6|claude-sonnet-4-6|claude-haiku-3\.5|gpt-4o-mini|gpt-4o|minimax-m2\.5|cascade/i
    );
    const key = model ? model[0] : "other";
    counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([name, count]) => ({ name, count }));
}

function computeTypeDistribution(decisions: Decision[]) {
  const counts: Record<DecisionType, number> = {
    "model-selection": 0,
    "tool-choice": 0,
    routing: 0,
    escalation: 0,
    "self-correction": 0,
  };
  for (const d of decisions) counts[d.type]++;
  return counts;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
  const color =
    value >= 90
      ? "text-emerald-400"
      : value >= 70
        ? "text-amber-400"
        : "text-rose-400";
  const bg =
    value >= 90
      ? "bg-emerald-500/10"
      : value >= 70
        ? "bg-amber-500/10"
        : "bg-rose-500/10";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-medium", bg, color)}>
      <Gauge className="w-3 h-3" />
      {value}%
    </span>
  );
}

function DecisionCard({ decision, expanded, onToggle }: {
  decision: Decision;
  expanded: boolean;
  onToggle: () => void;
}) {
  const meta = DECISION_TYPE_META[decision.type];
  const outcome = OUTCOME_STYLES[decision.outcome];

  return (
    <div className={cn(
      "border border-[var(--color-border)] rounded-lg transition-colors",
      expanded ? "bg-[var(--color-surface-1)]/80" : "bg-[var(--color-surface-0)] hover:bg-[var(--color-surface-1)]/40"
    )}>
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 rounded-lg"
      >
        <div className="flex items-start gap-3">
          {/* Agent avatar */}
          <div className="flex-none h-9 w-9 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-lg">
            {decision.agentEmoji}
          </div>

          <div className="flex-1 min-w-0">
            {/* Top row: agent, type, time */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{decision.agent}</span>
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ring-1", meta.bg, meta.color)}>
                {meta.icon}
                {meta.label}
              </span>
              <span className="text-xs text-[var(--color-text-muted)] ml-auto flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {fmtTime(decision.timestamp)} ({relTime(decision.timestamp)})
              </span>
            </div>

            {/* Summary */}
            <p className="text-sm text-[var(--color-text-primary)] mt-1.5 leading-relaxed">{decision.summary}</p>

            {/* Bottom chips */}
            <div className="flex items-center gap-2 mt-2">
              <ConfidenceBadge value={decision.confidence} />
              <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ring-1", outcome.bg, outcome.color)}>
                {decision.outcome === "success" && <CheckCircle2 className="w-3 h-3" />}
                {decision.outcome === "failure" && <XCircle className="w-3 h-3" />}
                {decision.outcome === "pending" && <Clock className="w-3 h-3" />}
                {outcome.label}
              </span>
            </div>
          </div>

          {/* Expand chevron */}
          <div className="flex-none pt-1 text-[var(--color-text-muted)]">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--color-border)] mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4">
            {/* Reasoning chain */}
            <div>
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                Reasoning Chain
              </h4>
              <ol className="space-y-1.5">
                {decision.reasoning.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-primary)]">
                    <span className="flex-none w-5 h-5 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-xs text-[var(--color-text-muted)] mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Alternatives considered */}
            <div>
              <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <ArrowRightLeft className="w-3.5 h-3.5 text-sky-400" />
                Alternatives Considered
              </h4>
              <div className="space-y-2">
                {decision.alternatives.map((alt, i) => (
                  <div key={i} className="px-3 py-2 rounded-lg bg-[var(--color-surface-2)]/60 border border-[var(--color-border)]/50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-medium text-[var(--color-text-primary)]">{alt.name}</span>
                      <span className={cn(
                        "text-xs font-mono font-semibold",
                        alt.score >= 80 ? "text-emerald-400" : alt.score >= 50 ? "text-amber-400" : "text-[var(--color-text-muted)]"
                      )}>
                        {alt.score}/100
                      </span>
                    </div>
                    <div className="h-1 w-full bg-[var(--color-surface-3)] rounded-full mb-1.5">
                      <div
                        className={cn(
                          "h-1 rounded-full",
                          alt.score >= 80 ? "bg-emerald-500" : alt.score >= 50 ? "bg-amber-500" : "bg-[var(--color-surface-3)]"
                        )}
                        style={{ width: `${alt.score}%` }}
                      />
                    </div>
                    <p className="text-xs text-[var(--color-text-muted)]">{alt.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Outcome detail */}
          <div className="mt-4 px-3 py-2.5 rounded-lg bg-[var(--color-surface-2)]/40 border border-[var(--color-border)]/50">
            <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-primary" />
              Outcome
            </h4>
            <p className="text-sm text-[var(--color-text-primary)]">{decision.outcomeDetail}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function PerformanceGauge({ score, size = 64 }: { score: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color =
    score >= 90 ? "stroke-emerald-400" : score >= 70 ? "stroke-amber-400" : "stroke-rose-400";
  const textColor =
    score >= 90 ? "text-emerald-400" : score >= 70 ? "text-amber-400" : "text-rose-400";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={4}
          className="stroke-zinc-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={color}
        />
      </svg>
      <span className={cn("absolute text-sm font-bold font-mono", textColor)}>{score}</span>
    </div>
  );
}

function SelfEvalCard({ report }: { report: SelfEvalReport }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-[var(--color-border)] rounded-lg bg-[var(--color-surface-0)]">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 rounded-lg"
      >
        <div className="flex items-center gap-3">
          <div className="flex-none h-9 w-9 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center text-lg">
            {report.agentEmoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--color-text-primary)]">{report.agent}</span>
              <span className="text-xs text-[var(--color-text-muted)]">{relTime(report.timestamp)}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-[var(--color-text-muted)]">Completion: <span className="text-[var(--color-text-primary)] font-medium">{report.taskCompletionRate}%</span></span>
              <span className="text-xs text-[var(--color-text-muted)]">Cost Eff: <span className={cn(
                "font-medium",
                report.costEfficiencyScore >= 85 ? "text-emerald-400" : report.costEfficiencyScore >= 65 ? "text-amber-400" : "text-rose-400"
              )}>{report.costEfficiencyScore}/100</span></span>
            </div>
          </div>
          <PerformanceGauge score={report.performanceScore} size={48} />
          <div className="flex-none text-[var(--color-text-muted)]">
            {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[var(--color-border)] pt-4 space-y-4">
          {/* Scores row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="px-3 py-2 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] text-center">
              <p className="text-xs text-[var(--color-text-muted)]">Performance</p>
              <p className={cn(
                "text-lg font-bold font-mono mt-0.5",
                report.performanceScore >= 90 ? "text-emerald-400" : report.performanceScore >= 70 ? "text-amber-400" : "text-rose-400"
              )}>{report.performanceScore}</p>
            </div>
            <div className="px-3 py-2 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] text-center">
              <p className="text-xs text-[var(--color-text-muted)]">Completion</p>
              <p className="text-lg font-bold font-mono text-[var(--color-text-primary)] mt-0.5">{report.taskCompletionRate}%</p>
            </div>
            <div className="px-3 py-2 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] text-center">
              <p className="text-xs text-[var(--color-text-muted)]">Cost Efficiency</p>
              <p className={cn(
                "text-lg font-bold font-mono mt-0.5",
                report.costEfficiencyScore >= report.costBaseline ? "text-emerald-400" : "text-rose-400"
              )}>
                {report.costEfficiencyScore}
                <span className="text-xs text-[var(--color-text-muted)] ml-1">/ {report.costBaseline} baseline</span>
              </p>
            </div>
          </div>

          {/* Strengths */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Areas of Strength
            </h4>
            <ul className="space-y-1">
              {report.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-primary)]">
                  <span className="text-emerald-500 mt-0.5 flex-none">+</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Improvements */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              Areas for Improvement
            </h4>
            <ul className="space-y-1">
              {report.improvements.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-primary)]">
                  <span className="text-amber-500 mt-0.5 flex-none">-</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Routing Recommendations */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <GitBranch className="w-3.5 h-3.5 text-primary" />
              Routing Recommendations
            </h4>
            <ul className="space-y-1">
              {report.routingRecommendations.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-[var(--color-text-primary)]">
                  <span className="text-primary mt-0.5 flex-none">&rarr;</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function DistributionBar({
  items,
  total,
}: {
  items: { name: string; count: number; color: string }[];
  total: number;
}) {
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-[var(--color-surface-2)]">
        {items.map((item) => (
          <div
            key={item.name}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", item.color)}
            style={{ width: `${(item.count / total) * 100}%` }}
            title={`${item.name}: ${item.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {items.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span className={cn("w-2 h-2 rounded-full", item.color)} />
            <span className="text-xs text-[var(--color-text-secondary)]">{item.name}</span>
            <span className="text-xs text-[var(--color-text-muted)] font-mono">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Model color mapping ────────────────────────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  "claude-sonnet-4-6": "bg-primary",
  "claude-opus-4-6": "bg-primary",
  "gpt-4o-mini": "bg-emerald-500",
  "gpt-4o": "bg-sky-500",
  "minimax-m2.5": "bg-amber-500",
  cascade: "bg-rose-400",
  other: "bg-[var(--color-surface-3)]",
};

// ─── Main View ──────────────────────────────────────────────────────────────

export default function DecisionProvenance({ onNavigate }: DecisionProvenanceProps) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("timeline");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<TimeRange>("24h");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("time");
  const [expandedId, setExpandedId] = useState<string | null>("d-001");

  const agents = useMemo(
    () => Array.from(new Set(DECISIONS.map((d) => d.agent))).sort(),
    []
  );

  const filteredDecisions = useMemo(() => {
    const rangeMsMap: Record<TimeRange, number> = {
      "1h": 3_600_000,
      "6h": 21_600_000,
      "24h": 86_400_000,
      "7d": 604_800_000,
    };
    const rangeMs = rangeMsMap[timeRange];

    let result = DECISIONS.filter((d) => {
      if (agentFilter !== "all" && d.agent !== agentFilter) return false;
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (now.getTime() - d.timestamp.getTime() > rangeMs) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const searchable = [d.summary, ...d.reasoning, d.outcomeDetail].join(" ").toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      if (sortKey === "time") return b.timestamp.getTime() - a.timestamp.getTime();
      if (sortKey === "confidence") return b.confidence - a.confidence;
      return a.agent.localeCompare(b.agent);
    });

    return result;
  }, [agentFilter, typeFilter, timeRange, searchQuery, sortKey]);

  // Routing insights stats
  const modelDist = useMemo(() => computeModelDistribution(DECISIONS), []);
  const typeDist = useMemo(() => computeTypeDistribution(DECISIONS), []);
  const avgConfidence = useMemo(
    () => Math.round(DECISIONS.reduce((s, d) => s + d.confidence, 0) / DECISIONS.length),
    []
  );
  const selfCorrectionRate = useMemo(
    () => Math.round((DECISIONS.filter((d) => d.type === "self-correction").length / DECISIONS.length) * 100),
    []
  );

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode }[] = [
    { id: "timeline", label: "Decision Timeline", icon: <Clock className="w-4 h-4" /> },
    { id: "self-eval", label: "Self-Eval Reports", icon: <TrendingUp className="w-4 h-4" /> },
    { id: "routing", label: "Routing Insights", icon: <GitBranch className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-[var(--color-border)] px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Decision Provenance & Self-Eval
            </h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
              Understand why agents made the decisions they did — model selection, routing, tool choice, and self-evaluation
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
            <span><span className="text-[var(--color-text-primary)] font-semibold">{DECISIONS.length}</span> decisions</span>
            <span><span className="text-emerald-400 font-semibold">{avgConfidence}%</span> avg confidence</span>
            <span><span className="text-amber-400 font-semibold">{selfCorrectionRate}%</span> self-correction rate</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                activeTab === tab.id
                  ? "bg-primary text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* ─── Timeline Tab ──────────────────────────────────────────── */}
        {activeTab === "timeline" && (
          <div className="h-full flex flex-col">
            {/* Filters bar */}
            <div className="shrink-0 px-6 py-3 border-b border-[var(--color-border)] flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                <Filter className="w-3.5 h-3.5" />
                Filters:
              </div>

              <select
                value={agentFilter}
                onChange={(e) => setAgentFilter(e.target.value)}
                aria-label="Filter by agent"
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Agents</option>
                {agents.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                aria-label="Filter by decision type"
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                {Object.entries(DECISION_TYPE_META).map(([key, meta]) => (
                  <option key={key} value={key}>{meta.label}</option>
                ))}
              </select>

              <div className="flex items-center gap-1">
                {(["1h", "6h", "24h", "7d"] as TimeRange[]).map((range) => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range)}
                    className={cn(
                      "px-2 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      timeRange === range
                        ? "bg-primary text-[var(--color-text-primary)]"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                    )}
                  >
                    {range}
                  </button>
                ))}
              </div>

              <div className="relative ml-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reasoning..."
                  aria-label="Search decision reasoning"
                  className="pl-8 pr-3 py-1.5 text-xs bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500 w-52"
                />
              </div>

              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                aria-label="Sort decisions by"
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="time">Sort: Time</option>
                <option value="confidence">Sort: Confidence</option>
                <option value="agent">Sort: Agent</option>
              </select>
            </div>

            {/* Decision list */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-3 max-w-4xl">
                {filteredDecisions.map((d) => (
                  <DecisionCard
                    key={d.id}
                    decision={d}
                    expanded={expandedId === d.id}
                    onToggle={() => setExpandedId(expandedId === d.id ? null : d.id)}
                  />
                ))}
                {filteredDecisions.length === 0 && (
                  <div className="text-center py-12">
                    <Search className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-3" />
                    <p className="text-sm text-[var(--color-text-muted)]">No decisions match the current filters.</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-1">Try adjusting the time range or clearing filters.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ─── Self-Eval Tab ─────────────────────────────────────────── */}
        {activeTab === "self-eval" && (
          <div className="h-full overflow-y-auto px-6 py-4">
            <div className="max-w-3xl space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Agent Self-Evaluation Reports</h2>
                <span className="text-xs text-[var(--color-text-muted)]">{SELF_EVAL_REPORTS.length} reports</span>
              </div>
              {SELF_EVAL_REPORTS.map((report) => (
                <SelfEvalCard key={report.id} report={report} />
              ))}
            </div>
          </div>
        )}

        {/* ─── Routing Insights Tab ──────────────────────────────────── */}
        {activeTab === "routing" && (
          <div className="h-full overflow-y-auto px-6 py-4">
            <div className="max-w-5xl space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Decisions", value: DECISIONS.length.toString(), sub: "tracked", color: "text-[var(--color-text-primary)]" },
                  { label: "Avg Confidence", value: `${avgConfidence}%`, sub: "across all decisions", color: "text-emerald-400" },
                  { label: "Self-Correction Rate", value: `${selfCorrectionRate}%`, sub: "decisions revised", color: "text-amber-400" },
                  {
                    label: "Success Rate",
                    value: `${Math.round((DECISIONS.filter((d) => d.outcome === "success").length / DECISIONS.length) * 100)}%`,
                    sub: "positive outcomes",
                    color: "text-emerald-400",
                  },
                ].map(({ label, value, sub, color }) => (
                  <div key={label} className="px-4 py-3 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
                    <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
                    <p className={cn("text-xl font-bold font-mono mt-1", color)}>{value}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Model distribution */}
              <div className="px-5 py-4 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
                <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5 text-primary" />
                  Model Selection Distribution
                </h3>
                <DistributionBar
                  items={modelDist.map((m) => ({
                    name: m.name,
                    count: m.count,
                    color: MODEL_COLORS[m.name] || MODEL_COLORS.other,
                  }))}
                  total={DECISIONS.length}
                />
              </div>

              {/* Decision type distribution */}
              <div className="px-5 py-4 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
                <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-sky-400" />
                  Decision Type Distribution
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {(Object.entries(typeDist) as [DecisionType, number][]).map(([type, count]) => {
                    const meta = DECISION_TYPE_META[type];
                    return (
                      <div key={type} className="text-center px-3 py-2 rounded-lg bg-[var(--color-surface-2)]/60 border border-[var(--color-border)]/50">
                        <div className={cn("flex items-center justify-center gap-1 mb-1", meta.color)}>
                          {meta.icon}
                        </div>
                        <p className="text-lg font-bold font-mono text-[var(--color-text-primary)]">{count}</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{meta.label}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Routing rules table */}
              <div className="rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] overflow-hidden">
                <div className="px-5 py-3 border-b border-[var(--color-border)]">
                  <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider flex items-center gap-1.5">
                    <GitBranch className="w-3.5 h-3.5 text-amber-400" />
                    Active Routing Rules
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--color-border)]">
                        <th className="text-left px-4 py-2.5 font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Task Type</th>
                        <th className="text-left px-4 py-2.5 font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Preferred Model</th>
                        <th className="text-left px-4 py-2.5 font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Fallback</th>
                        <th className="text-left px-4 py-2.5 font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--color-border)]/50">
                      {ROUTING_RULES.map((rule, i) => (
                        <tr key={i} className="hover:bg-[var(--color-surface-2)]/40 transition-colors">
                          <td className="px-4 py-2.5 font-medium text-[var(--color-text-primary)]">{rule.taskType}</td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-primary">{rule.preferredModel}</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="font-mono text-[var(--color-text-secondary)]">{rule.fallback}</span>
                          </td>
                          <td className="px-4 py-2.5 text-[var(--color-text-muted)] max-w-xs">{rule.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confidence distribution by agent */}
              <div className="px-5 py-4 rounded-lg bg-[var(--color-surface-1)] border border-[var(--color-border)]">
                <h3 className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                  Confidence by Agent
                </h3>
                <div className="space-y-2.5">
                  {agents.map((agent) => {
                    const agentDecisions = DECISIONS.filter((d) => d.agent === agent);
                    const avg = Math.round(
                      agentDecisions.reduce((s, d) => s + d.confidence, 0) / agentDecisions.length
                    );
                    const emoji = agentDecisions[0]?.agentEmoji || "\u{1F916}";
                    return (
                      <div key={agent}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-[var(--color-text-primary)] flex items-center gap-1.5">
                            <span>{emoji}</span>
                            {agent}
                            <span className="text-[var(--color-text-muted)]">({agentDecisions.length} decisions)</span>
                          </span>
                          <span className={cn(
                            "text-xs font-mono font-semibold",
                            avg >= 90 ? "text-emerald-400" : avg >= 70 ? "text-amber-400" : "text-rose-400"
                          )}>
                            {avg}%
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-[var(--color-surface-2)] rounded-full">
                          <div
                            className={cn(
                              "h-1.5 rounded-full transition-all",
                              avg >= 90 ? "bg-emerald-500" : avg >= 70 ? "bg-amber-500" : "bg-rose-500"
                            )}
                            style={{ width: `${avg}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
