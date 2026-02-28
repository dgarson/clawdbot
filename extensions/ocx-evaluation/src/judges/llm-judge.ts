/**
 * LLM-based judge -- scores using a language model against a rubric.
 *
 * Constructs a prompt from the judge profile criteria and run transcript,
 * then parses the LLM response into per-criterion scores + reasoning.
 */

type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
import type { JudgeProfile, Scorecard } from "../types.js";

/** Subset of run data needed for LLM evaluation. */
export type LlmJudgeRunData = {
  runId: string;
  agentId: string;
  sessionKey: string;
  /** User prompt that initiated the run. */
  prompt: string;
  /** Final assistant response text. */
  response: string;
  /** Tool calls made during the run (summary). */
  toolSummary: string;
  /** Model used. */
  model: string;
};

/** Result from the LLM judge. */
export type LlmJudgeResult = Pick<
  Scorecard,
  | "overallScore"
  | "criteriaScores"
  | "confidence"
  | "reasoning"
  | "disqualified"
  | "disqualifierTriggered"
>;

/**
 * Build the evaluation prompt for the LLM judge.
 */
function buildJudgePrompt(profile: JudgeProfile, runData: LlmJudgeRunData): string {
  const criteriaBlock = profile.criteria
    .map((c) => `- ${c.name} (weight: ${c.weight}): ${c.description}`)
    .join("\n");

  const disqualifierBlock =
    profile.disqualifiers.length > 0
      ? `\nDisqualifiers (score = 0 if any are true):\n${profile.disqualifiers.map((d) => `- ${d}`).join("\n")}`
      : "";

  return `You are an evaluation judge. Score the following AI assistant run on a scale of ${profile.scale.min}-${profile.scale.max}.

## Criteria
${criteriaBlock}
${disqualifierBlock}

## Run Data
**User prompt:** ${runData.prompt}

**Assistant response:** ${runData.response}

**Tool usage:** ${runData.toolSummary}

## Instructions
Respond ONLY with valid JSON matching this shape (no markdown fences):
{
  "criteriaScores": { ${profile.criteria.map((c) => `"${c.id}": <number>`).join(", ")} },
  "confidence": <number 0-1>,
  "reasoning": "<brief explanation>",
  "disqualified": <boolean>,
  "disqualifierTriggered": "<string or null>"
}`;
}

/**
 * Parse the LLM judge response into structured scores.
 * Falls back to midpoint scores if parsing fails.
 */
function parseJudgeResponse(raw: string, profile: JudgeProfile, logger: Logger): LlmJudgeResult {
  const { min, max } = profile.scale;
  const midpoint = Math.round((min + max) / 2);

  try {
    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*\n?/m, "")
      .replace(/\n?```\s*$/m, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;

    const criteriaScores: Record<string, number> = {};
    const rawScores = parsed.criteriaScores as Record<string, unknown> | undefined;

    for (const criterion of profile.criteria) {
      const val = rawScores?.[criterion.id];
      criteriaScores[criterion.id] =
        typeof val === "number" ? Math.round(Math.max(min, Math.min(max, val))) : midpoint;
    }

    const disqualified = parsed.disqualified === true;
    const confidence =
      typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.5;
    const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : undefined;
    const disqualifierTriggered =
      typeof parsed.disqualifierTriggered === "string" ? parsed.disqualifierTriggered : undefined;

    // Compute weighted overall score
    const totalWeight = profile.criteria.reduce((sum, c) => sum + c.weight, 0);
    const overallScore = disqualified
      ? min
      : totalWeight > 0
        ? Math.round(
            profile.criteria.reduce((sum, c) => {
              return sum + ((criteriaScores[c.id] ?? midpoint) * c.weight) / totalWeight;
            }, 0),
          )
        : midpoint;

    return {
      overallScore,
      criteriaScores,
      confidence,
      reasoning,
      disqualified,
      disqualifierTriggered,
    };
  } catch (err) {
    logger.warn(`evaluation: failed to parse LLM judge response: ${String(err)}`);
    // Fallback: midpoint scores with low confidence
    const criteriaScores: Record<string, number> = {};
    for (const c of profile.criteria) {
      criteriaScores[c.id] = midpoint;
    }
    return {
      overallScore: midpoint,
      criteriaScores,
      confidence: 0.1,
      reasoning: "Failed to parse judge response; using fallback scores.",
      disqualified: false,
    };
  }
}

/**
 * Score a run using an LLM judge.
 *
 * The caller is responsible for providing an `invokeLlm` function that sends
 * the prompt to the configured judge model and returns the raw text response.
 * This keeps the judge decoupled from specific LLM client implementations.
 */
export async function scoreWithLlm(
  profile: JudgeProfile,
  runData: LlmJudgeRunData,
  invokeLlm: (prompt: string, model: string) => Promise<string>,
  logger: Logger,
): Promise<LlmJudgeResult> {
  const judgeModel = profile.judgeModel ?? "gpt-4.1-mini";
  const prompt = buildJudgePrompt(profile, runData);

  const rawResponse = await invokeLlm(prompt, judgeModel);
  return parseJudgeResponse(rawResponse, profile, logger);
}
