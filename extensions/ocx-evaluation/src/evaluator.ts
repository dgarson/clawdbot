/**
 * Evaluation background service.
 *
 * Polls for completed, unscored runs on a configurable interval. Each cycle:
 * 1. Finds unscored completed runs
 * 2. Selects the appropriate judge profile
 * 3. Scores the run (LLM, heuristic, or hybrid)
 * 4. Generates a tool intelligence report
 * 5. Persists the scorecard
 * 6. Emits evaluation.model_feedback events
 */

import type { OpenClawPluginService, OpenClawPluginServiceContext } from "openclaw/plugin-sdk";

type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
import { aggregateModelComparison, type ComparisonQuery } from "./comparison.js";
import type { EvaluationConfig } from "./config.js";
import { JudgeStore } from "./judge-store.js";
import { scoreWithHeuristics, type HeuristicMetrics } from "./judges/heuristic-judge.js";
import { scoreWithLlm, type LlmJudgeRunData } from "./judges/llm-judge.js";
import { ScorecardStore, type ScorecardQuery } from "./scorecard-store.js";
import { buildToolIntelligenceReport } from "./tool-analyzer.js";
import type { JudgeProfile, Scorecard, ToolEvent, ToolIntelligenceReport } from "./types.js";

/**
 * Minimal run data fetched from the event ledger.
 * The evaluator consumes this shape; the actual event querying is
 * handled by hook-injected data since the ledger API is not yet available.
 */
export type PendingRun = {
  runId: string;
  agentId: string;
  sessionKey: string;
  classificationLabel: string;
  model: string;
  provider: string;
  prompt: string;
  response: string;
  toolEvents: ToolEvent[];
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
};

export type EvaluatorDeps = {
  config: EvaluationConfig;
  scorecardStore: ScorecardStore;
  judgeStore: JudgeStore;
  logger: Logger;
  /**
   * Hook to invoke an LLM for judge scoring. Provided by the plugin wiring
   * so the evaluator stays decoupled from specific LLM clients.
   */
  invokeLlm: (prompt: string, model: string) => Promise<string>;
  /**
   * Hook to emit events to the event bus (fire-and-forget).
   * Currently a no-op until the event ledger (section 01) is available.
   */
  emitEvent: (event: { family: string; type: string; data: Record<string, unknown> }) => void;
  /**
   * Hook to find unscored completed runs. Returns up to batchSize runs.
   * Backed by hook-collected data until the event ledger API is available.
   */
  findUnscoredRuns: (batchSize: number) => Promise<PendingRun[]>;
};

/**
 * Evaluate a single run: score + tool analysis + persist + emit feedback.
 */
async function evaluateRun(run: PendingRun, deps: EvaluatorDeps): Promise<Scorecard | undefined> {
  const { config, scorecardStore, judgeStore, logger } = deps;

  // Already scored?
  if (scorecardStore.hasScorecard(run.runId)) return undefined;

  // Select judge profile
  const profile = judgeStore.matchByLabel(run.classificationLabel);
  if (!profile) {
    logger.info(
      `evaluation: no judge profile for label "${run.classificationLabel}", skipping run ${run.runId}`,
    );
    return undefined;
  }

  // Score the run
  let scoringResult: Pick<
    Scorecard,
    | "overallScore"
    | "criteriaScores"
    | "confidence"
    | "reasoning"
    | "disqualified"
    | "disqualifierTriggered"
  >;

  try {
    scoringResult = await scoreRun(run, profile, deps);
  } catch (err) {
    logger.error(`evaluation: scoring failed for run ${run.runId}: ${String(err)}`);
    return undefined;
  }

  // Generate tool intelligence report
  let toolIntelligence: ToolIntelligenceReport | undefined;
  if (run.toolEvents.length > 0) {
    toolIntelligence = buildToolIntelligenceReport(run.runId, run.toolEvents);
  }

  // Build scorecard
  const scorecard: Scorecard = {
    runId: run.runId,
    agentId: run.agentId,
    sessionKey: run.sessionKey,
    judgeProfileId: profile.id,
    judgeProfileVersion: profile.version,
    overallScore: scoringResult.overallScore,
    criteriaScores: scoringResult.criteriaScores,
    confidence: scoringResult.confidence,
    reasoning: scoringResult.reasoning,
    disqualified: scoringResult.disqualified,
    disqualifierTriggered: scoringResult.disqualifierTriggered,
    toolIntelligence,
    scoredAt: new Date().toISOString(),
    model: run.model,
    provider: run.provider,
    classificationLabel: run.classificationLabel,
    costUsd: run.costUsd,
    totalTokens: run.totalTokens,
    durationMs: run.durationMs,
  };

  // Persist
  scorecardStore.append(scorecard);

  // Emit feedback event (fire-and-forget for routing plugin)
  deps.emitEvent({
    family: "evaluation",
    type: "evaluation.model_feedback",
    data: {
      model: run.model,
      classificationLabel: run.classificationLabel,
      score: scorecard.overallScore,
      costUsd: run.costUsd,
    },
  });

  // Emit quality-risk event if score is below threshold
  if (scorecard.overallScore < config.qualityRiskThreshold) {
    deps.emitEvent({
      family: "evaluation",
      type: "evaluation.quality_risk",
      data: {
        runId: run.runId,
        agentId: run.agentId,
        score: scorecard.overallScore,
        threshold: config.qualityRiskThreshold,
      },
    });
  }

  logger.info(
    `evaluation: scored run ${run.runId} = ${scorecard.overallScore} (${profile.id} v${profile.version})`,
  );

  return scorecard;
}

/**
 * Dispatch to the appropriate scoring method based on the judge profile.
 */
async function scoreRun(
  run: PendingRun,
  profile: JudgeProfile,
  deps: EvaluatorDeps,
): Promise<
  Pick<
    Scorecard,
    | "overallScore"
    | "criteriaScores"
    | "confidence"
    | "reasoning"
    | "disqualified"
    | "disqualifierTriggered"
  >
> {
  const heuristicMetrics: HeuristicMetrics = {
    durationMs: run.durationMs,
    inputTokens: run.inputTokens,
    outputTokens: run.outputTokens,
    toolCallCount: run.toolEvents.length,
  };

  const runMeta = { runId: run.runId, agentId: run.agentId, sessionKey: run.sessionKey };

  if (profile.method === "heuristic") {
    return scoreWithHeuristics(profile, heuristicMetrics, runMeta);
  }

  const llmRunData: LlmJudgeRunData = {
    runId: run.runId,
    agentId: run.agentId,
    sessionKey: run.sessionKey,
    prompt: run.prompt,
    response: run.response,
    toolSummary: summarizeTools(run.toolEvents),
    model: run.model,
  };

  if (profile.method === "llm") {
    return scoreWithLlm(profile, llmRunData, deps.invokeLlm, deps.logger);
  }

  // Hybrid: run both, merge results. LLM scores for quality criteria,
  // heuristic scores for efficiency criteria.
  const llmResult = await scoreWithLlm(profile, llmRunData, deps.invokeLlm, deps.logger);
  const heuristicResult = scoreWithHeuristics(profile, heuristicMetrics, runMeta);

  // Merge: prefer LLM scores for non-heuristic criteria, heuristic for efficiency criteria
  const heuristicCriterionIds = new Set(["response_time", "token_efficiency", "tool_count"]);
  const mergedScores: Record<string, number> = {};

  for (const criterion of profile.criteria) {
    if (heuristicCriterionIds.has(criterion.id)) {
      mergedScores[criterion.id] = heuristicResult.criteriaScores[criterion.id] ?? 0;
    } else {
      mergedScores[criterion.id] = llmResult.criteriaScores[criterion.id] ?? 0;
    }
  }

  // Recompute overall from merged scores
  const totalWeight = profile.criteria.reduce((sum, c) => sum + c.weight, 0);
  const overallScore = llmResult.disqualified
    ? profile.scale.min
    : totalWeight > 0
      ? Math.round(
          profile.criteria.reduce((sum, c) => {
            return sum + ((mergedScores[c.id] ?? 0) * c.weight) / totalWeight;
          }, 0),
        )
      : profile.scale.min;

  return {
    overallScore,
    criteriaScores: mergedScores,
    // Average confidence from both methods
    confidence: (llmResult.confidence + heuristicResult.confidence) / 2,
    reasoning: llmResult.reasoning,
    disqualified: llmResult.disqualified,
    disqualifierTriggered: llmResult.disqualifierTriggered,
  };
}

/** Build a brief textual summary of tool events for the LLM judge prompt. */
function summarizeTools(toolEvents: ToolEvent[]): string {
  if (toolEvents.length === 0) return "No tools were used.";

  return toolEvents
    .map((e, i) => {
      const status = e.success ? "OK" : `ERROR: ${e.error ?? "unknown"}`;
      return `${i + 1}. ${e.toolName} [${status}]`;
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Service creation
// ---------------------------------------------------------------------------

/**
 * Create the evaluation background service.
 * Returns an OpenClawPluginService that polls for unscored runs.
 */
export function createEvaluationService(deps: EvaluatorDeps): OpenClawPluginService {
  let timer: ReturnType<typeof setInterval> | undefined;

  return {
    id: "evaluation-worker",

    async start(_ctx: OpenClawPluginServiceContext) {
      deps.logger.info(
        `evaluation: worker starting (poll every ${deps.config.pollIntervalMs}ms, batch ${deps.config.batchSize})`,
      );

      const pollCycle = async () => {
        try {
          const runs = await deps.findUnscoredRuns(deps.config.batchSize);
          for (const run of runs) {
            await evaluateRun(run, deps);
          }
        } catch (err) {
          deps.logger.error(`evaluation: poll cycle failed: ${String(err)}`);
        }
      };

      // Initial poll after a short delay to let the system settle
      setTimeout(() => void pollCycle(), 5_000);
      timer = setInterval(() => void pollCycle(), deps.config.pollIntervalMs);
    },

    async stop(_ctx: OpenClawPluginServiceContext) {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      deps.logger.info("evaluation: worker stopped");
    },
  };
}

// ---------------------------------------------------------------------------
// Re-export store types for gateway method wiring
// ---------------------------------------------------------------------------

export { type ScorecardQuery } from "./scorecard-store.js";
export { type ComparisonQuery } from "./comparison.js";
export { aggregateModelComparison };
