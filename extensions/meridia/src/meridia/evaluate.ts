import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { completeTextWithModelRef } from "openclaw/plugin-sdk";
import type { ScoringConfig, ScoringContext, ScoringResult } from "./scoring/types.js";
import type { MeridiaEvaluation, MeridiaToolResultContext } from "./types.js";
import { evaluateMemoryRelevance } from "./scoring/index.js";

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

function summarize(value: unknown, maxChars: number): string {
  if (value === undefined) {
    return "";
  }
  let raw = "";
  try {
    raw = JSON.stringify(value);
  } catch {
    raw = String(value);
  }
  if (raw.length <= maxChars) {
    return raw;
  }
  return `${raw.slice(0, Math.max(0, maxChars - 12))}…(truncated)`;
}

function extractFirstJsonObject(raw: string): Record<string, unknown> | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  const slice = raw.slice(start, end + 1);
  try {
    return JSON.parse(slice) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Convert a MeridiaToolResultContext to a ScoringContext for the multi-factor scorer.
 */
function toScoringContext(ctx: MeridiaToolResultContext): ScoringContext {
  return {
    tool: ctx.tool,
    args: ctx.args,
    result: ctx.result,
    session: ctx.session,
  };
}

/**
 * Legacy heuristic evaluation — maintained for backward compatibility.
 * Internally delegates to the new multi-factor scoring system.
 */
export function evaluateHeuristic(
  ctx: MeridiaToolResultContext,
  scoringConfig?: Partial<ScoringConfig>,
): MeridiaEvaluation {
  const scoringCtx = toScoringContext(ctx);
  const result = evaluateMemoryRelevance(scoringCtx, scoringConfig);

  return {
    kind: "heuristic",
    score: result.score,
    reason: result.reason,
  };
}

/**
 * Enhanced heuristic evaluation that returns full scoring details.
 */
export function evaluateHeuristicDetailed(
  ctx: MeridiaToolResultContext,
  scoringConfig?: Partial<ScoringConfig>,
): {
  evaluation: MeridiaEvaluation;
  scoring: ScoringResult;
} {
  const scoringCtx = toScoringContext(ctx);
  const scoring = evaluateMemoryRelevance(scoringCtx, scoringConfig);

  return {
    evaluation: {
      kind: "heuristic",
      score: scoring.score,
      reason: scoring.reason,
      durationMs: scoring.durationMs,
    },
    scoring,
  };
}

export async function evaluateWithLlm(params: {
  cfg: OpenClawConfig;
  ctx: MeridiaToolResultContext;
  modelRef: string;
  timeoutMs: number;
}): Promise<MeridiaEvaluation> {
  const startedAt = Date.now();
  const prompt = [
    "You are scoring whether a tool result should be captured as an experiential continuity record.",
    "Return ONLY valid JSON. No markdown.",
    "",
    "JSON schema:",
    '{ "score": 0.0, "reason": "short string" }',
    "",
    "Guidance: prioritize irreversible changes, external comms, errors, high uncertainty, or decisions affecting future behavior.",
    "",
    `toolName: ${params.ctx.tool.name}`,
    `isError: ${params.ctx.tool.isError ? "true" : "false"}`,
    params.ctx.tool.meta ? `meta: ${params.ctx.tool.meta}` : "",
    params.ctx.args !== undefined ? `args: ${summarize(params.ctx.args, 3000)}` : "",
    params.ctx.result !== undefined ? `result: ${summarize(params.ctx.result, 4000)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const res = await completeTextWithModelRef({
    cfg: params.cfg,
    modelRef: params.modelRef,
    prompt,
    timeoutMs: params.timeoutMs,
    maxTokens: 256,
  });

  const parsed = extractFirstJsonObject(res.text);
  const scoreRaw = parsed?.score;
  const score = typeof scoreRaw === "number" ? scoreRaw : Number.NaN;
  if (!Number.isFinite(score)) {
    throw new Error(`LLM returned non-numeric score: ${res.text.slice(0, 200)}`);
  }
  const reason = typeof parsed?.reason === "string" ? parsed.reason : undefined;
  const finalScore = clamp01(score);
  return {
    kind: "llm",
    model: res.model,
    score: finalScore,
    reason,
    durationMs: Date.now() - startedAt,
  };
}
