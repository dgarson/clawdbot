import type { ThinkLevel } from "../auto-reply/thinking.js";
import type { OpenClawConfig } from "../config/config.js";
import { parseModelRef } from "./model-selection.js";

export type IntentClassifierIntent = "simple" | "analysis" | "coding" | "critical";

export type ModelRoutingRule = {
  /** Optional stable identifier for observability. */
  id?: string;
  /** Intent to match. */
  intent: IntentClassifierIntent;
  /** Preferred model for this intent (provider/model or model-only). */
  model: string;
  /** Optional thinking level to use with the routed model. */
  thinkLevel?: ThinkLevel;
};

export type ModelRoutingConfig = {
  /** Enable rules-based routing. */
  enabled?: boolean;
  /** Default model if no intent-specific route matches. */
  fallbackModel?: string;
  /** Optional default thinking level if no intent-specific route sets it. */
  fallbackThinkLevel?: ThinkLevel;
  /** Intent-specific routing rules. */
  rules?: ModelRoutingRule[];
};

export type IntentClassifierResult = {
  intent: IntentClassifierIntent;
  confidence: number;
  scores: Record<IntentClassifierIntent, number>;
  triggers: string[];
};

export type DynamicModelDecision = {
  provider: string;
  model: string;
  thinkLevel?: ThinkLevel;
  intent: IntentClassifierIntent;
  confidence: number;
  reason: "route" | "fallback";
};

const THINK_LEVEL_VALUES: ReadonlySet<ThinkLevel> = new Set([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
]);

const SIMPLE_KEYWORDS = [
  "what is",
  "what are",
  "who is",
  "where is",
  "when is",
  "define",
  "describe",
  "summarize",
  "translate",
  "spell",
  "status",
  "lookup",
  "find",
  "list",
  "check",
  "confirm",
  "explain",
  "short answer",
];

const ANALYSIS_KEYWORDS = [
  "analyze",
  "analysis",
  "compare",
  "evaluate",
  "recommend",
  "trade-off",
  "tradeoffs",
  "research",
  "investigate",
  "propose",
  "plan",
  "strategy",
  "diagnose",
  "root cause",
  "impact",
  "risks",
  "requirements",
  "pros and cons",
  "tradeoffs",
];

const CODING_KEYWORDS = [
  "code",
  "implement",
  "implementing",
  "implementations",
  "write",
  "writes",
  "build",
  "builds",
  "refactor",
  "debug",
  "fix",
  "function",
  "class",
  "api",
  "endpoint",
  "unit test",
  "pytest",
  "typescript",
  "javascript",
  "python",
  "shell",
  "script",
  "sql",
  "deployment",
  "commit",
  "patch",
  "github",
  "pr",
  "pull request",
];

const CRITICAL_KEYWORDS = [
  "critical",
  "security",
  "threat",
  "attack",
  "incident",
  "migration",
  "architecture",
  "compliance",
  "legal",
  "financial",
  "production",
  "contract",
  "privacy",
  "credential",
  "encryption",
  "data breach",
  "audit",
  "policy",
  "incident response",
];

const INTENT_PRIORITY: Record<IntentClassifierIntent, number> = {
  critical: 4,
  coding: 3,
  analysis: 2,
  simple: 1,
};

type IntentSignal = {
  intent: IntentClassifierIntent;
  score: number;
  triggers: string[];
};

function countKeywordMatches(text: string, patterns: string[]): string[] {
  const hits: string[] = [];
  for (const pattern of patterns) {
    if (text.includes(pattern)) {
      hits.push(pattern);
    }
  }
  return hits;
}

function unique<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items));
}

export function classifyPromptIntent(prompt: string): IntentClassifierResult {
  const text = prompt.toLowerCase();
  const words = text.split(/\s+/).filter(Boolean);

  const simpleHits = countKeywordMatches(text, SIMPLE_KEYWORDS);
  const analysisHits = countKeywordMatches(text, ANALYSIS_KEYWORDS);
  const codingHits = countKeywordMatches(text, CODING_KEYWORDS);
  const criticalHits = countKeywordMatches(text, CRITICAL_KEYWORDS);

  let simpleScore = simpleHits.length * 1.6;
  let analysisScore = analysisHits.length * 1.9;
  let codingScore = codingHits.length * 1.9;
  let criticalScore = criticalHits.length * 2.1;

  if (text.includes("```")) {
    codingScore += 1.2;
    codingHits.push("code-block");
  }
  if (text.includes("http://") || text.includes("https://")) {
    analysisScore += 0.3;
  }
  if (text.includes("```")) {
    analysisScore += 0.2;
  }

  if (words.length <= 24) {
    simpleScore += 0.5;
    simpleHits.push("short-input");
  }
  if (words.length >= 120) {
    analysisScore += 1.0;
    codingScore += 0.6;
    analysisHits.push("long-input");
    criticalHits.push("complex-len");
  }

  const signals: IntentSignal[] = [
    { intent: "simple", score: simpleScore, triggers: simpleHits },
    { intent: "analysis", score: analysisScore, triggers: analysisHits },
    { intent: "coding", score: codingScore, triggers: codingHits },
    { intent: "critical", score: criticalScore, triggers: criticalHits },
  ];

  signals.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return INTENT_PRIORITY[b.intent] - INTENT_PRIORITY[a.intent];
  });

  const best = signals[0];
  const runnerUp = signals[1] ?? { score: 0, triggers: [] };
  const scoreTotal = best.score + runnerUp.score;
  const confidence =
    scoreTotal === 0
      ? 0
      : Number(Math.min(1, (best.score - runnerUp.score + 1) / (scoreTotal + 1)).toFixed(2));

  const scores: Record<IntentClassifierIntent, number> = {
    simple: simpleScore,
    analysis: analysisScore,
    coding: codingScore,
    critical: criticalScore,
  };

  return {
    intent: best.intent,
    confidence,
    scores,
    triggers: unique(best.triggers),
  };
}

function normalizeThinkLevel(value: unknown): ThinkLevel | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return undefined;
  }

  return THINK_LEVEL_VALUES.has(trimmed as ThinkLevel) ? (trimmed as ThinkLevel) : undefined;
}

function resolveModelRef(params: {
  defaultProvider: string;
  defaultModel: string;
  modelRef?: string;
}): { provider: string; model: string } {
  const parsed = parseModelRef(
    params.modelRef ?? `${params.defaultProvider}/${params.defaultModel}`,
    params.defaultProvider,
  );
  return {
    provider: parsed?.provider ?? params.defaultProvider,
    model: parsed?.model ?? params.defaultModel,
  };
}

export function resolveDynamicModelRoute(params: {
  prompt: string;
  defaultProvider: string;
  defaultModel: string;
  config?: OpenClawConfig;
  modelRoutingConfig?: ModelRoutingConfig;
}): DynamicModelDecision | null {
  const config = params.modelRoutingConfig ?? params.config?.agents?.defaults?.modelRouting;
  if (!config?.enabled) {
    return null;
  }

  const classification = classifyPromptIntent(params.prompt);
  const matchedRoute = config.rules?.find(
    (route) => route.intent === classification.intent && route.model.trim().length > 0,
  );

  const modelRef =
    matchedRoute?.model ??
    config.fallbackModel ??
    config.rules?.find((route) => route.intent === "simple")?.model;

  if (!modelRef) {
    return null;
  }

  const selection = resolveModelRef({
    defaultProvider: params.defaultProvider,
    defaultModel: params.defaultModel,
    modelRef,
  });

  return {
    provider: selection.provider,
    model: selection.model,
    thinkLevel:
      normalizeThinkLevel(matchedRoute?.thinkLevel) ??
      normalizeThinkLevel(config.fallbackThinkLevel),
    intent: classification.intent,
    confidence: classification.confidence,
    reason: matchedRoute ? "route" : "fallback",
  };
}
