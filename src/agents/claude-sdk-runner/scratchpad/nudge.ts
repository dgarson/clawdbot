/**
 * Scratchpad auto-trigger nudge logic.
 *
 * Pure functions for detecting plan patterns in assistant output
 * and building nudge messages for the various trigger types.
 */

// At least 3 items to qualify as a "plan"
const NUMBERED_LIST_RE = /(?:^|\n)\s*\d+[.)]\s+\S/g;
const STEP_PATTERN_RE = /\b(?:step|phase|stage)\s+\d+/gi;
const TASK_LIST_RE = /- \[[ x]\]/g;

/**
 * Returns true if the text contains plan-like patterns:
 * - 3+ numbered list items (1. / 2. / 3.)
 * - 3+ "Step N" / "Phase N" / "Stage N" references
 * - 3+ markdown task list items (- [ ] / - [x])
 */
export function detectPlanPatterns(text: string): boolean {
  const numberedMatches = text.match(NUMBERED_LIST_RE);
  if (numberedMatches && numberedMatches.length >= 3) {
    return true;
  }

  const stepMatches = text.match(STEP_PATTERN_RE);
  if (stepMatches && stepMatches.length >= 3) {
    return true;
  }

  const taskMatches = text.match(TASK_LIST_RE);
  if (taskMatches && taskMatches.length >= 3) {
    return true;
  }

  return false;
}

export type NudgeTrigger = "turn-count" | "plan-detected" | "post-compaction" | "stale-scratchpad";

/**
 * Builds a one-line scratchpad nudge message for the given trigger type.
 * These are prepended to the user prompt via pendingSteer.
 */
export function buildScratchpadNudge(trigger: NudgeTrigger, turnCount?: number): string {
  switch (trigger) {
    case "turn-count":
      return `[Hint: You're on turn ${turnCount ?? "?"} and your scratchpad is empty. Consider saving your plan or key findings to session.scratchpad so they survive context compaction.]`;
    case "plan-detected":
      return `[Hint: You outlined a plan in your last response but your scratchpad is empty. Consider saving it to session.scratchpad so it survives context compaction.]`;
    case "post-compaction":
      return `[Hint: Context was just compacted. If you have important state (plans, findings, decisions), save or review your session.scratchpad now — earlier context may have been summarized or dropped.]`;
    case "stale-scratchpad":
      return `[Hint: Your scratchpad hasn't been updated in ${turnCount ?? "?"} turns. Review it — does it still reflect your current plan and findings? Use session.scratchpad to refresh it.]`;
  }
}
