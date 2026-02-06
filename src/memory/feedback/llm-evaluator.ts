/**
 * LLM-based relevancy feedback evaluator.
 *
 * Single LLM call per query for <= 15 results. Fire-and-forget async
 * after agent response delivery. Rate-limited to 20 evals/hour.
 */

import { randomUUID } from "node:crypto";
import type {
  MemoryRelevancyFeedbackEvaluator,
  RelevanceFeedback,
  RelevancyEvaluationContext,
  ResultRelevanceJudgment,
  RelevanceAggregate,
} from "./types.js";
import { buildEvaluationPrompt } from "./prompts.js";

export type LlmCallParams = {
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
};

export type LlmCallResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export type LlmEvaluatorOptions = {
  llmCall: (params: LlmCallParams) => Promise<LlmCallResult>;
  model: string;
  maxResultsPerEval?: number;
  maxEvalsPerHour?: number;
  minResultsForEval?: number;
};

/** Default max results to evaluate in a single call. */
const DEFAULT_MAX_RESULTS = 10;

/** Default rate limit. */
const DEFAULT_MAX_EVALS_PER_HOUR = 20;

/** Default minimum results to trigger evaluation. */
const DEFAULT_MIN_RESULTS = 1;

type RawJudgment = {
  resultIndex: number;
  relevanceScore: number;
  wasUsed: boolean;
  wouldBeUseful: boolean;
  rationale: string;
  suggestedTags?: string[];
};

type RawResponse = {
  judgments: RawJudgment[];
  systemSuggestions?: string[];
};

export class LlmRelevancyEvaluator implements MemoryRelevancyFeedbackEvaluator {
  private readonly llmCall: LlmEvaluatorOptions["llmCall"];
  private readonly model: string;
  private readonly maxResultsPerEval: number;
  private readonly maxEvalsPerHour: number;
  private readonly minResultsForEval: number;
  private readonly evalTimestamps: number[] = [];

  constructor(options: LlmEvaluatorOptions) {
    this.llmCall = options.llmCall;
    this.model = options.model;
    this.maxResultsPerEval = options.maxResultsPerEval ?? DEFAULT_MAX_RESULTS;
    this.maxEvalsPerHour = options.maxEvalsPerHour ?? DEFAULT_MAX_EVALS_PER_HOUR;
    this.minResultsForEval = options.minResultsForEval ?? DEFAULT_MIN_RESULTS;
  }

  shouldEvaluate(context: { sessionKey?: string; resultCount: number }): boolean {
    if (context.resultCount < this.minResultsForEval) {
      return false;
    }

    // Check rolling window rate limit
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const recentCount = this.evalTimestamps.filter((ts) => ts > oneHourAgo).length;
    return recentCount < this.maxEvalsPerHour;
  }

  async evaluate(context: RelevancyEvaluationContext): Promise<RelevanceFeedback> {
    const start = Date.now();

    // Trim results if needed
    const trimmedContext =
      context.results.length > this.maxResultsPerEval
        ? { ...context, results: context.results.slice(0, this.maxResultsPerEval) }
        : context;

    const { systemPrompt, userPrompt } = buildEvaluationPrompt(trimmedContext);

    const result = await this.llmCall({
      systemPrompt,
      userPrompt,
      maxTokens: 2048,
    });

    // Record eval timestamp for rate limiting
    this.evalTimestamps.push(Date.now());
    this.pruneTimestamps();

    const durationMs = Date.now() - start;
    const parsed = this.parseResponse(result.text);
    const judgments = this.mapJudgments(parsed.judgments, trimmedContext);
    const aggregate = this.computeAggregate(judgments);

    return {
      id: randomUUID(),
      ts: new Date().toISOString(),
      queryTraceId: context.queryTraceId,
      query: context.retrievalQuery,
      intent: context.intent,
      judgments,
      aggregate,
      systemSuggestions: parsed.systemSuggestions,
      evaluatorModel: this.model,
      evaluationCost: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        durationMs,
      },
    };
  }

  private parseResponse(text: string): RawResponse {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? text.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch?.[1]?.trim() ?? text.trim();

    try {
      const parsed = JSON.parse(jsonStr) as RawResponse;
      if (!Array.isArray(parsed.judgments)) {
        return { judgments: [] };
      }
      return parsed;
    } catch {
      return { judgments: [] };
    }
  }

  private mapJudgments(
    raw: RawJudgment[],
    context: RelevancyEvaluationContext,
  ): ResultRelevanceJudgment[] {
    return raw
      .filter((j) => j.resultIndex >= 0 && j.resultIndex < context.results.length)
      .map((j) => {
        const result = context.results[j.resultIndex];
        const sourceBackend = findBackendForPath(result.path, context.backendAttribution);
        return {
          resultPath: result.path,
          relevanceScore: clamp(j.relevanceScore, 0, 1),
          wasUsed: Boolean(j.wasUsed),
          wouldBeUseful: Boolean(j.wouldBeUseful),
          rationale: j.rationale ?? "",
          sourceBackend,
          originalScore: result.score,
          suggestedTags: j.suggestedTags,
        };
      });
  }

  private computeAggregate(judgments: ResultRelevanceJudgment[]): RelevanceAggregate {
    const retrievedCount = judgments.length;
    if (retrievedCount === 0) {
      return {
        precision: 0,
        usedCount: 0,
        retrievedCount: 0,
        meanRelevanceScore: 0,
        byBackend: {},
      };
    }

    const relevantCount = judgments.filter((j) => j.relevanceScore > 0.5).length;
    const usedCount = judgments.filter((j) => j.wasUsed).length;
    const meanRelevanceScore =
      judgments.reduce((sum, j) => sum + j.relevanceScore, 0) / retrievedCount;

    // Per-backend breakdown
    const byBackend: RelevanceAggregate["byBackend"] = {};
    for (const j of judgments) {
      const existing = byBackend[j.sourceBackend];
      if (existing) {
        existing.count++;
        existing.meanRelevance += j.relevanceScore;
      } else {
        byBackend[j.sourceBackend] = {
          precision: 0,
          meanRelevance: j.relevanceScore,
          count: 1,
        };
      }
    }

    // Finalize per-backend stats
    for (const [backendId, stats] of Object.entries(byBackend)) {
      stats.meanRelevance = stats.count > 0 ? stats.meanRelevance / stats.count : 0;
      const backendRelevant = judgments.filter(
        (j) => j.sourceBackend === backendId && j.relevanceScore > 0.5,
      ).length;
      stats.precision = stats.count > 0 ? backendRelevant / stats.count : 0;
    }

    return {
      precision: relevantCount / retrievedCount,
      usedCount,
      retrievedCount,
      meanRelevanceScore,
      byBackend,
    };
  }

  private pruneTimestamps(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    while (this.evalTimestamps.length > 0 && this.evalTimestamps[0] < oneHourAgo) {
      this.evalTimestamps.shift();
    }
  }
}

function findBackendForPath(path: string, attribution: Record<string, string[]>): string {
  for (const [backend, paths] of Object.entries(attribution)) {
    if (paths.includes(path)) {
      return backend;
    }
  }
  return "unknown";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
