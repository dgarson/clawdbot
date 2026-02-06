/**
 * Memory Relevancy Feedback — types.
 *
 * Defines the evaluator interface, context, and feedback shapes for
 * LLM-based relevancy assessment of retrieved memories.
 */

import type { QueryIntent } from "../query/index.js";
import type { MemorySearchResult } from "../types.js";

// ─── Evaluator interface ────────────────────────────────────────────────────

export interface MemoryRelevancyFeedbackEvaluator {
  evaluate(context: RelevancyEvaluationContext): Promise<RelevanceFeedback>;
  shouldEvaluate(context: { sessionKey?: string; resultCount: number }): boolean;
}

// ─── Evaluation context ─────────────────────────────────────────────────────

export type RelevancyEvaluationContext = {
  results: MemorySearchResult[];
  retrievalQuery: string;
  intent?: QueryIntent;
  landingPrompt: string;
  lastNTurns?: Array<{ role: string; content: string }>;
  agentResponse?: string;
  session?: { sessionId?: string; chatType?: string; tags?: string[] };
  workItem?: { id?: string; title?: string; description?: string; tags?: string[] };
  backendAttribution: Record<string, string[]>;
  queryTraceId: string;
  sessionKey?: string;
};

// ─── Feedback output ────────────────────────────────────────────────────────

export type RelevanceFeedback = {
  id: string;
  ts: string;
  queryTraceId: string;
  query: string;
  intent?: QueryIntent;
  judgments: ResultRelevanceJudgment[];
  aggregate: RelevanceAggregate;
  systemSuggestions?: string[];
  evaluatorModel: string;
  evaluationCost: {
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
  };
};

export type ResultRelevanceJudgment = {
  resultPath: string;
  relevanceScore: number;
  wasUsed: boolean;
  wouldBeUseful: boolean;
  rationale: string;
  sourceBackend: string;
  originalScore: number;
  suggestedTags?: string[];
};

export type RelevanceAggregate = {
  precision: number;
  usedCount: number;
  retrievedCount: number;
  meanRelevanceScore: number;
  byBackend: Record<
    string,
    {
      precision: number;
      meanRelevance: number;
      count: number;
    }
  >;
};

// ─── Weight advisor types ───────────────────────────────────────────────────

export type WeightSuggestion = {
  backend: string;
  currentWeight: number;
  suggestedWeight: number;
  confidence: number;
  rationale: string;
  sampleSize: number;
  avgPrecision: number;
};
