import type { OpenClawConfig } from "openclaw/plugin-sdk";
import { completeTextWithModelRef } from "openclaw/plugin-sdk";
import type { ScoringBreakdown, ScoringConfig, ScoringContext } from "./scoring/types.js";
import type { MeridiaEvaluation, MeridiaToolResultContext } from "./types.js";
import {
  evaluateMemoryRelevance,
  shouldCapture as checkShouldCapture,
  isHighValue as checkIsHighValue,
  shouldUseLlmEval as checkShouldUseLlmEval,
  breakdownToTrace,
  formatBreakdown,
} from "./scoring/scorer.js";

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

export function evaluateHeuristic(ctx: MeridiaToolResultContext): MeridiaEvaluation {
  const tool = ctx.tool.name.trim().toLowerCase();
  const isError = ctx.tool.isError;
  let score = 0.1;
  let reason = "default";

  if (isError) {
    score = 0.55;
    reason = "tool_error";
  }

  if (tool === "exec" || tool === "bash") {
    score = Math.max(score, 0.5);
    reason = reason === "tool_error" ? reason : "shell_exec";
  } else if (tool === "write" || tool === "apply_patch" || tool === "edit") {
    score = Math.max(score, 0.6);
    reason = reason === "tool_error" ? reason : "filesystem_write";
  } else if (tool === "message" || tool === "sessions_send") {
    score = Math.max(score, 0.65);
    reason = reason === "tool_error" ? reason : "external_message";
  } else if (tool === "browser") {
    score = Math.max(score, 0.35);
    reason = reason === "tool_error" ? reason : "web_browse";
  } else if (tool === "read") {
    score = Math.max(score, 0.15);
    reason = reason === "tool_error" ? reason : "filesystem_read";
  }

  const resultPreviewLen = summarize(ctx.result, 2000).length;
  if (resultPreviewLen > 2000) {
    score = Math.max(score, 0.4);
    reason = reason === "tool_error" ? reason : "large_result";
  }

  const finalScore = clamp01(score);
  return {
    kind: "heuristic",
    score: finalScore,
    reason,
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

// ────────────────────────────────────────────────────────────────────────────
// Multi-Factor Relevance Scoring (bridges to scoring/ module)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Build a ScoringContext from a MeridiaToolResultContext plus optional extras.
 * This bridges the existing hook context to the new scoring system.
 */
export function buildScoringContext(
  ctx: MeridiaToolResultContext,
  extras?: {
    recentCaptures?: ScoringContext["recentCaptures"];
    userMarkedImportant?: boolean;
    contentTags?: string[];
    contentSummary?: string;
    heuristicEval?: { score: number; reason?: string };
  },
): ScoringContext {
  return {
    tool: ctx.tool,
    session: ctx.session,
    args: ctx.args,
    result: ctx.result,
    recentCaptures: extras?.recentCaptures,
    userMarkedImportant: extras?.userMarkedImportant,
    contentTags: extras?.contentTags,
    contentSummary: extras?.contentSummary,
    heuristicEval: extras?.heuristicEval,
  };
}

/**
 * Evaluate memory relevance using the multi-factor scoring system.
 *
 * This is the primary entry point for the new scoring system.
 * It returns a full breakdown with per-factor analysis and the composite score.
 *
 * @param ctx - Tool result context
 * @param extras - Additional signals (recent captures, user intent, etc.)
 * @param scoringConfig - Optional scoring configuration override
 * @returns ScoringBreakdown with composite score and factor details
 */
export function evaluateRelevance(
  ctx: MeridiaToolResultContext,
  extras?: Parameters<typeof buildScoringContext>[1],
  scoringConfig?: Partial<ScoringConfig>,
): ScoringBreakdown {
  const scoringCtx = buildScoringContext(ctx, extras);
  return evaluateMemoryRelevance(scoringCtx, scoringConfig);
}

// Re-export scoring utilities for convenience
export {
  evaluateMemoryRelevance,
  checkShouldCapture as shouldCaptureMultiFactor,
  checkIsHighValue as isHighValueMultiFactor,
  checkShouldUseLlmEval as shouldUseLlmEvalMultiFactor,
  breakdownToTrace,
  formatBreakdown,
};

export type { ScoringBreakdown, ScoringConfig, ScoringContext };
