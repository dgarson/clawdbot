/**
 * ocx_ops unified agent tool for the OCX Platform extension.
 *
 * action="query"   — aggregated read-only snapshot of a run across the control plane.
 * action="explain" — synthesises a plain-language explanation of a control-plane event.
 *
 * Created via createOcxOpsTool factory that receives stateDir at call time
 * (populated by the service lifecycle hook in index.ts).
 *
 * Data sources:
 *  - Event ledger : lean JSONL reader (avoids importing EventStorage write state)
 *  - Scorecards   : lean JSONL reader (avoids the evaluation↔platform import cycle)
 *    Layout: {stateDir}/evaluation/scorecards/{YYYY-MM-DD}.jsonl
 *  - Health       : in-memory functions from @openclaw/ocx-observability
 *    (shared module instance within the gateway process — same state the observability
 *     plugin populates at runtime)
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { RunSummary } from "@openclaw/ocx-event-ledger/src/types.js";
import {
  getAllCurrentHealth,
  getHealthHistory,
} from "@openclaw/ocx-observability/src/monitor/health-evaluator.js";
import { Type } from "@sinclair/typebox";
import type { OpenClawPluginToolContext } from "../../../src/plugins/types.js";
import { queryScores } from "./score-store.js";

// Minimal scorecard shape — only the fields consumed by ops tools.
// Keeping this local avoids an ocx-evaluation ↔ ocx-platform import cycle.
type ScorecardRecord = {
  runId: string;
  agentId?: string;
  scoredAt: string;
  judgeProfileId: string;
  judgeProfileVersion: string;
  overallScore: number;
  confidence: number;
  criteriaScores: Record<string, number>;
  disqualified: boolean;
  disqualifierTriggered?: string;
  toolIntelligence?: {
    effectivenessScore: number;
    wastedCalls: string[];
    repeatedCalls: unknown[];
  };
  reasoning?: string;
};

// ---------------------------------------------------------------------------
// Lean event-ledger readers
// Layout: {stateDir}/event-ledger/{agentId}/{YYYY-MM-DD}.jsonl
// Summaries: {stateDir}/event-ledger/summaries/{YYYY-MM-DD}.jsonl
// ---------------------------------------------------------------------------

async function scanJsonlLines(dir: string): Promise<string[]> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return [];
  }
  const lines: string[] = [];
  for (const name of entries.filter((n) => n.endsWith(".jsonl")).sort()) {
    const content = await readFile(path.join(dir, name), "utf-8").catch(() => "");
    lines.push(...content.split("\n").filter(Boolean));
  }
  return lines;
}

export async function findRunSummary(stateDir: string, runId: string): Promise<RunSummary | null> {
  const dir = path.join(stateDir, "event-ledger", "summaries");
  for (const line of await scanJsonlLines(dir)) {
    try {
      const s = JSON.parse(line) as RunSummary;
      if (s.runId === runId) return s;
    } catch {
      /* skip malformed lines */
    }
  }
  return null;
}

// Layout: {stateDir}/evaluation/scorecards/{YYYY-MM-DD}.jsonl
export async function findScorecard(
  stateDir: string,
  runId: string,
): Promise<ScorecardRecord | null> {
  const dir = path.join(stateDir, "evaluation", "scorecards");
  for (const line of await scanJsonlLines(dir)) {
    try {
      const card = JSON.parse(line) as ScorecardRecord;
      if (card.runId === runId) return card;
    } catch {
      /* skip malformed lines */
    }
  }
  return null;
}

type LedgerEvent = {
  eventId: string;
  ts: string;
  family: string;
  type: string;
  runId: string;
  agentId?: string;
  lineageId?: string;
  sessionKey?: string;
  data: Record<string, unknown>;
};

export async function queryLedgerEvents(
  stateDir: string,
  filter: { runId?: string; agentId?: string; family?: string; limit: number },
): Promise<LedgerEvent[]> {
  const ledgerDir = path.join(stateDir, "event-ledger");
  const results: LedgerEvent[] = [];

  let agentDirs: string[];
  try {
    const entries = await readdir(ledgerDir, { withFileTypes: true });
    agentDirs = entries
      .filter((e) => e.isDirectory() && e.name !== "summaries")
      .map((e) => path.join(ledgerDir, e.name));
  } catch {
    return [];
  }

  // Narrow to the known agent directory when agentId is provided
  const dirsToScan = filter.agentId
    ? agentDirs.filter((d) => path.basename(d) === filter.agentId)
    : agentDirs;

  for (const dir of dirsToScan) {
    if (results.length >= filter.limit) break;
    for (const line of await scanJsonlLines(dir)) {
      if (results.length >= filter.limit) break;
      try {
        const ev = JSON.parse(line) as LedgerEvent;
        if (filter.runId && ev.runId !== filter.runId) continue;
        if (filter.family && ev.family !== filter.family) continue;
        results.push(ev);
      } catch {
        /* skip */
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// ocx_ops unified tool
// ---------------------------------------------------------------------------

const OPS_ACTIONS = ["query", "explain", "scores"] as const;
type OpsAction = (typeof OPS_ACTIONS)[number];

const OPS_QUERY_DOMAINS = ["summary", "events", "scorecard", "health"] as const;
type OpsQueryDomain = (typeof OPS_QUERY_DOMAINS)[number];

const EXPLAIN_QUESTIONS = ["why_routed", "why_blocked", "why_reaped", "why_low_score"] as const;
type ExplainQuestion = (typeof EXPLAIN_QUESTIONS)[number];

const OcxOpsSchema = Type.Object({
  action: Type.Unsafe<OpsAction>({
    type: "string",
    enum: [...OPS_ACTIONS],
    description:
      "query: aggregate read-only snapshot of a run across all control-plane domains. " +
      "explain: plain-language explanation of a specific control-plane event. " +
      "scores: list historical session quality scores for an agent or session.",
  }),
  run_id: Type.Optional(
    Type.String({
      description:
        "The run ID to query or explain. Required for action=query and action=explain; unused for action=scores.",
    }),
  ),
  agent_id: Type.Optional(
    Type.String({
      description: "Agent ID — narrows event search (query) or required for why_reaped (explain).",
    }),
  ),
  // query-specific
  include: Type.Optional(
    Type.Array(
      Type.Unsafe<OpsQueryDomain>({
        type: "string",
        enum: [...OPS_QUERY_DOMAINS],
        description: "Which domains to include (action=query). Defaults to all.",
      }),
      { description: "Defaults to [summary, events, scorecard, health] when omitted." },
    ),
  ),
  event_family: Type.Optional(
    Type.String({
      description:
        "Filter events by family — model, budget, tool, orchestration, evaluation, etc. " +
        "(action=query only; omit for all families).",
    }),
  ),
  event_limit: Type.Optional(
    Type.Number({ description: "Max events to return (action=query, default 20)." }),
  ),
  // explain-specific
  question: Type.Optional(
    Type.Unsafe<ExplainQuestion>({
      type: "string",
      enum: [...EXPLAIN_QUESTIONS],
      description:
        "Required for action=explain. " +
        "why_routed: which model was chosen and why | " +
        "why_blocked: why the run was degraded or blocked (budget / routing policy) | " +
        "why_reaped: why the agent session was terminated by the reaper | " +
        "why_low_score: why this run received a low quality score",
    }),
  ),
  // scores-specific
  session_id: Type.Optional(
    Type.String({
      description: "Filter scores to a specific session ID (action=scores).",
    }),
  ),
  rubric: Type.Optional(
    Type.String({
      description:
        "Filter scores to a specific rubric dimension (action=scores, e.g. 'task_completion').",
    }),
  ),
  effective_only: Type.Optional(
    Type.Boolean({
      description:
        "When true (action=scores), return only the latest score per (session_id, rubric) pair " +
        "so overrides supersede originals. Default false.",
    }),
  ),
});

export function createOcxOpsTool(stateDir: string) {
  return {
    name: "ocx_ops",
    description:
      "Investigate runs and quality scores across the OpenClaw control plane.\n" +
      "action='query'   — aggregate snapshot: event ledger, scorecard, agent health. Start here.\n" +
      "action='explain' — plain-language explanation of a specific event (why_routed, why_blocked, why_reaped, why_low_score).\n" +
      "action='scores'  — list historical session quality scores; filter by agent_id, session_id, or rubric.",
    schema: OcxOpsSchema,
    async execute(
      params: Record<string, unknown>,
      _ctx: OpenClawPluginToolContext,
    ): Promise<string> {
      const action = params.action as OpsAction;
      const runId = params.run_id as string;
      const agentId = params.agent_id as string | undefined;

      if (action === "query") {
        const include = (params.include as OpsQueryDomain[] | undefined) ?? [...OPS_QUERY_DOMAINS];
        const eventFamily = params.event_family as string | undefined;
        const eventLimit = typeof params.event_limit === "number" ? params.event_limit : 20;

        const result: Record<string, unknown> = { ok: true, run_id: runId };

        await Promise.all(
          [
            include.includes("summary") &&
              findRunSummary(stateDir, runId).then((s) => {
                result.summary = s ?? null;
              }),
            include.includes("events") &&
              queryLedgerEvents(stateDir, {
                runId,
                agentId,
                family: eventFamily,
                limit: eventLimit,
              }).then((evs) => {
                result.events = evs;
              }),
            include.includes("scorecard") &&
              findScorecard(stateDir, runId).then((card) => {
                result.scorecard = card;
              }),
            include.includes("health") &&
              Promise.resolve().then(() => {
                result.health = agentId ? getHealthHistory(agentId, 5) : getAllCurrentHealth();
              }),
          ].filter(Boolean),
        );

        return JSON.stringify(result, null, 2);
      }

      if (action === "explain") {
        const question = params.question as ExplainQuestion | undefined;
        if (!question) {
          return JSON.stringify({
            ok: false,
            error: `question is required for action='explain'. Valid: ${EXPLAIN_QUESTIONS.join(", ")}`,
          });
        }

        const result = await explainRun(stateDir, runId, question, agentId);
        return JSON.stringify(result, null, 2);
      }

      // action === "scores"
      const sessionId = params.session_id as string | undefined;
      const rubric = params.rubric as string | undefined;
      const effectiveOnly = params.effective_only === true;
      const limit = typeof params.event_limit === "number" ? params.event_limit : 50;

      const scores = await queryScores(stateDir, {
        agentId,
        sessionId,
        rubric,
        limit,
        effectiveOnly,
      });

      return JSON.stringify({ ok: true, count: scores.length, scores }, null, 2);
    },
  };
}

// ---------------------------------------------------------------------------
// Explain helpers
// ---------------------------------------------------------------------------

/** Shared entry point for tool and CLI explain actions. */
export async function explainRun(
  stateDir: string,
  runId: string,
  question: string,
  agentId?: string,
): Promise<unknown> {
  switch (question) {
    case "why_routed":
      return explainRouted(stateDir, runId, agentId);
    case "why_blocked":
      return explainBlocked(stateDir, runId, agentId);
    case "why_reaped":
      return explainReaped(agentId);
    case "why_low_score":
      return explainLowScore(stateDir, runId);
    default:
      return {
        ok: false,
        error: `Unknown question: ${question}. Valid: ${EXPLAIN_QUESTIONS.join(", ")}`,
      };
  }
}

async function explainRouted(stateDir: string, runId: string, agentId?: string): Promise<unknown> {
  const [modelEvents, summary] = await Promise.all([
    queryLedgerEvents(stateDir, { runId, agentId, family: "model", limit: 10 }),
    findRunSummary(stateDir, runId),
  ]);

  const evidence: string[] = [];
  let explanation = "Model routing decision could not be determined from available events.";

  const classification = modelEvents.find((e) => e.type === "model.classification");
  const routed = modelEvents.find((e) => e.type === "model.routed");

  if (summary) {
    evidence.push(`Run completed using model=${summary.model}, provider=${summary.provider}`);
  }
  if (classification) {
    const d = classification.data;
    evidence.push(
      `Task classified as "${d.label}" (confidence ${d.confidence}, method ${d.method})`,
    );
  }
  if (routed) {
    const d = routed.data;
    const reason = d.reason ? String(d.reason) : "policy match (check routing.policies.list)";
    explanation = `Run routed to ${String(d.model ?? summary?.model ?? "unknown")}. Reason: ${reason}`;
    evidence.push(`Routing event: model=${String(d.model)}, reason="${reason}"`);
  } else if (summary) {
    explanation = `Run used model=${summary.model}. No explicit routing event — likely used the agent's default model.`;
  }

  return {
    ok: true,
    question: "why_routed",
    run_id: runId,
    explanation,
    evidence,
    next_actions: [
      "Call routing.policies.list to see all active policies",
      "Call routing.classify to re-classify the same prompt",
    ],
  };
}

async function explainBlocked(stateDir: string, runId: string, agentId?: string): Promise<unknown> {
  const [budgetEvents, modelEvents] = await Promise.all([
    queryLedgerEvents(stateDir, { runId, agentId, family: "budget", limit: 10 }),
    queryLedgerEvents(stateDir, { runId, agentId, family: "model", limit: 5 }),
  ]);

  const evidence: string[] = [];
  let explanation = "No budget admission events found for this run.";

  const admission = budgetEvents.find((e) => e.type === "budget.admission");
  if (admission) {
    const d = admission.data;
    const outcome = String(d.outcome ?? "unknown");
    const reason = d.reason ? String(d.reason) : "threshold exceeded";
    const scope = d.scope ? String(d.scope) : "unknown scope";
    explanation =
      outcome === "allow"
        ? `Run was admitted without restriction (budget outcome: allow).`
        : `Run was ${outcome}ed by budget policy: ${reason} (scope: ${scope})`;
    evidence.push(`Budget admission: outcome=${outcome}, scope=${scope}, reason=${reason}`);
  }

  const routed = modelEvents.find((e) => e.type === "model.routed");
  if (routed?.data?.reason) {
    evidence.push(`Routing note: ${String(routed.data.reason)}`);
  }

  return {
    ok: true,
    question: "why_blocked",
    run_id: runId,
    explanation,
    evidence,
    next_actions: [
      "Call budget.usage with level+id to see current utilisation",
      "Call budget.allocations to review active budget limits",
    ],
  };
}

function explainReaped(agentId?: string): unknown {
  if (!agentId) {
    return { ok: false, error: "agent_id is required for why_reaped explanations" };
  }

  const history = getHealthHistory(agentId, 10);
  const evidence: string[] = [];
  let explanation = `No health history found for agent ${agentId}.`;

  if (history.length > 0) {
    const recent = history[history.length - 1];
    const signalSummary = recent.signals
      .map((s) => `${s.kind}=${s.value} (threshold ${s.threshold})`)
      .join(", ");
    explanation =
      `Agent ${agentId} reached health state "${recent.state}". ` +
      `Signals: ${signalSummary || "none recorded"}.`;
    evidence.push(`Latest evaluation: state=${recent.state}, evaluatedAt=${recent.evaluatedAt}`);
    for (const s of recent.signals) {
      evidence.push(
        `Signal ${s.kind}: value=${s.value}, threshold=${s.threshold}, severity=${s.severity}`,
      );
    }
  }

  return {
    ok: true,
    question: "why_reaped",
    agent_id: agentId,
    explanation,
    evidence,
    next_actions: [
      "Call observability.health to get the current health state",
      "Call observability.reaper.history to see which reaper action was taken",
    ],
  };
}

async function explainLowScore(stateDir: string, runId: string): Promise<unknown> {
  const card = await findScorecard(stateDir, runId);
  const evidence: string[] = [];
  let explanation = `No scorecard found for run ${runId}.`;

  if (card !== null) {
    if (card.disqualified) {
      const trigger = card.disqualifierTriggered ?? "disqualifier triggered";
      explanation = `Run was disqualified by judge "${card.judgeProfileId}": ${trigger}. Score forced to 0.`;
      evidence.push(`Disqualifier: ${trigger}`);
    } else {
      const lowCriteria = Object.entries(card.criteriaScores)
        .filter(([, v]) => v < 50)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ");
      explanation =
        `Run scored ${card.overallScore}/100 on judge profile "${card.judgeProfileId}". ` +
        `Low criteria: ${lowCriteria || "none below 50"}.`;
    }
    evidence.push(
      `Judge: ${card.judgeProfileId} v${card.judgeProfileVersion}, ` +
        `score=${card.overallScore}, confidence=${card.confidence}`,
    );
    if (card.toolIntelligence) {
      const ti = card.toolIntelligence;
      evidence.push(
        `Tool effectiveness: ${ti.effectivenessScore}/100, ` +
          `wasted=${ti.wastedCalls.length}, repeated=${ti.repeatedCalls.length}`,
      );
    }
    if (card.reasoning) {
      const excerpt = card.reasoning.slice(0, 300);
      evidence.push(`LLM reasoning: ${excerpt}${card.reasoning.length > 300 ? "…" : ""}`);
    }
  }

  return {
    ok: true,
    question: "why_low_score",
    run_id: runId,
    explanation,
    evidence,
    next_actions: [
      "Call evaluation.tool_report with this runId for full tool intelligence",
      "Call evaluation.judges.list to review the judge profile criteria",
      "Call event_ledger.query with family=tool to inspect individual tool calls",
    ],
  };
}
