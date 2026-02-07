/**
 * Evaluation prompt templates for memory relevancy feedback.
 */

import type { MemorySearchResult } from "../types.js";
import type { RelevancyEvaluationContext } from "./types.js";

/** Max chars of agent response to include in the prompt. */
const MAX_RESPONSE_CHARS = 2000;

/** Max chars of snippet to include per result. */
const MAX_SNIPPET_CHARS = 500;

export function buildEvaluationPrompt(context: RelevancyEvaluationContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are a memory retrieval quality evaluator. Your job is to assess whether retrieved memory results were relevant to a user's query and whether the AI agent actually used them in its response.

For each result, evaluate:
1. relevanceScore (0-1): How relevant is this result to the query and user intent? 0 = completely irrelevant, 1 = perfectly relevant.
2. wasUsed (boolean): Did the agent's response incorporate or reference information from this specific result?
3. wouldBeUseful (boolean): Even if not used, would this result have been useful for answering the query? Distinguishes "irrelevant" from "relevant but agent chose a different path".
4. rationale: 1-2 sentence explanation of your judgment.
5. suggestedTags (optional string array): If you notice this result could be better categorized, suggest tags.

Return valid JSON matching this schema:
{
  "judgments": [
    {
      "resultIndex": <number>,
      "relevanceScore": <number 0-1>,
      "wasUsed": <boolean>,
      "wouldBeUseful": <boolean>,
      "rationale": "<string>",
      "suggestedTags": ["<string>"] // optional
    }
  ],
  "systemSuggestions": ["<string>"] // optional high-level suggestions
}`;

  const intentSection = context.intent
    ? `\n## Parsed Intent\n- Entities: ${context.intent.entities.join(", ") || "none"}\n- Topics: ${context.intent.topics.join(", ") || "none"}\n- Time hints: ${context.intent.timeHints.map((h) => h.phrase).join(", ") || "none"}`
    : "";

  const resultsSection = context.results
    .map((r, i) => formatResult(r, i, context.backendAttribution))
    .join("\n\n");

  const turnsSection =
    context.lastNTurns && context.lastNTurns.length > 0
      ? `\n## Recent Conversation (last ${context.lastNTurns.length} turns)\n${context.lastNTurns.map((t) => `[${t.role}]: ${t.content.slice(0, 300)}`).join("\n")}`
      : "";

  const responseSection = context.agentResponse
    ? `\n## Agent Response\n${context.agentResponse.slice(0, MAX_RESPONSE_CHARS)}`
    : "\n## Agent Response\n(not available)";

  const userPrompt = `## User Query
${context.landingPrompt}

## Retrieval Query
${context.retrievalQuery}${intentSection}${turnsSection}

## Retrieved Results (${context.results.length} total)
${resultsSection}${responseSection}

Evaluate each result and return JSON.`;

  return { systemPrompt, userPrompt };
}

function formatResult(
  result: MemorySearchResult,
  index: number,
  backendAttribution: Record<string, string[]>,
): string {
  const backend = findBackendForResult(result.path, backendAttribution);
  const snippet = (result.snippet ?? "").slice(0, MAX_SNIPPET_CHARS);
  return `### Result ${index} [${backend}] (score: ${result.score.toFixed(3)})
Path: ${result.path} (lines ${result.startLine}-${result.endLine})
${snippet}`;
}

function findBackendForResult(path: string, backendAttribution: Record<string, string[]>): string {
  for (const [backend, paths] of Object.entries(backendAttribution)) {
    if (paths.includes(path)) {
      return backend;
    }
  }
  return "unknown";
}
