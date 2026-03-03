/**
 * before_prompt_build hook handler.
 *
 * Loads PromptContributors, filters by conditions, sorts by priority (lower first),
 * and composes the system prompt. Under token pressure, strips optional contributors.
 */

import type { PromptCondition, PromptContributor, PromptContext } from "./types.js";

// ---------------------------------------------------------------------------
// Condition matching
// ---------------------------------------------------------------------------

function matchPromptCondition(condition: PromptCondition, ctx: PromptContext): boolean {
  switch (condition.kind) {
    case "agent":
      return ctx.agentId === condition.agentId;

    case "channel":
      return ctx.channel === condition.channel;

    case "classification":
      return ctx.classification === condition.label;

    case "has_tool":
      if (!ctx.toolNames) return false;
      return ctx.toolNames.includes(condition.toolName);

    case "session_type":
      if (!ctx.sessionType) return false;
      return ctx.sessionType === condition.type;

    default:
      return false;
  }
}

/** Check if ALL conditions of a contributor match the given context. */
function matchesContributor(contributor: PromptContributor, ctx: PromptContext): boolean {
  // Empty conditions = always included.
  if (contributor.conditions.length === 0) return true;
  return contributor.conditions.every((c) => matchPromptCondition(c, ctx));
}

// ---------------------------------------------------------------------------
// Rough token estimation
// ---------------------------------------------------------------------------

/** Rough estimate: 1 token per 4 characters. */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------------------------------------------------------------------------
// Prompt composition
// ---------------------------------------------------------------------------

/**
 * Filter, sort, and compose contributors into a single system prompt string.
 *
 * - Filters contributors by their conditions against the prompt context.
 * - Sorts by priority (lower = first).
 * - If a tokenBudget is set on the context, strips optional contributors
 *   from the end until the composed prompt fits the budget.
 */
export function composePrompt(
  contributors: PromptContributor[],
  ctx: PromptContext,
): string | undefined {
  // Filter by conditions
  const matching = contributors.filter((c) => matchesContributor(c, ctx));

  if (matching.length === 0) return undefined;

  // Sort by priority ascending (lower = earlier in prompt)
  matching.sort((a, b) => a.priority - b.priority);

  // Check token budget
  if (ctx.tokenBudget !== undefined && ctx.tokenBudget > 0) {
    return composeWithBudget(matching, ctx.tokenBudget);
  }

  return matching.map((c) => c.content).join("\n\n");
}

/**
 * Compose prompt respecting a token budget.
 * Required contributors are always included. Optional contributors are added
 * in priority order and dropped (from lowest priority = highest number) if
 * the budget is exceeded.
 */
function composeWithBudget(contributors: PromptContributor[], tokenBudget: number): string {
  const required = contributors.filter((c) => !c.optional);
  const optional = contributors.filter((c) => c.optional);

  // Start with required (these cannot be stripped)
  const parts: string[] = required.map((c) => c.content);
  let currentTokens = parts.reduce((sum, p) => sum + estimateTokens(p), 0);

  // Add optional contributors in priority order until budget exceeded
  for (const contributor of optional) {
    const tokens = estimateTokens(contributor.content);
    if (currentTokens + tokens > tokenBudget) {
      // Skip this and all subsequent optional contributors
      break;
    }
    parts.push(contributor.content);
    currentTokens += tokens;
  }

  return parts.join("\n\n");
}

/**
 * Build a PromptContext from the hook event and agent context.
 */
export function buildPromptContext(
  ctx: { agentId?: string; sessionKey?: string; messageProvider?: string },
  classification?: string,
  tokenBudget?: number,
  toolNames?: string[],
  sessionType?: string,
): PromptContext {
  return {
    agentId: ctx.agentId ?? "",
    sessionKey: ctx.sessionKey ?? "",
    channel: ctx.messageProvider,
    classification,
    tokenBudget,
    toolNames,
    sessionType,
  };
}
