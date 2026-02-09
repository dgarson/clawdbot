import { buildCrn } from "../build.js";
import { externalTaskUrl } from "../canonicalizers/external.js";

// ── Codex (ChatGPT) tasks ──────────────────────────────────────────────────

/**
 * Build a CRN for a Codex (ChatGPT) task.
 *
 * Format: `crn:v1:codex-web:global:task:{taskId}`
 */
export function buildCodexTaskCrn(params: { taskId: string; scope?: string }): string {
  return buildCrn({
    service: "codex-web",
    scope: params.scope ?? "global",
    resourceType: "task",
    resourceId: params.taskId,
  });
}

/**
 * Derive the clickable URL for a Codex task from its ID.
 *
 * Returns: `https://chatgpt.com/codex/tasks/{taskId}`
 */
export function codexTaskUrl(taskId: string): string {
  return externalTaskUrl("codex-web", taskId) ?? `https://chatgpt.com/codex/tasks/${taskId}`;
}

// ── Claude (claude.ai) tasks ───────────────────────────────────────────────

/**
 * Build a CRN for a Claude (claude.ai) task / conversation.
 *
 * Format: `crn:v1:claude-web:global:task:{taskId}`
 */
export function buildClaudeTaskCrn(params: { taskId: string; scope?: string }): string {
  return buildCrn({
    service: "claude-web",
    scope: params.scope ?? "global",
    resourceType: "task",
    resourceId: params.taskId,
  });
}

/**
 * Derive the clickable URL for a Claude web task from its ID.
 *
 * Returns: `https://claude.ai/code/session_{taskId}`
 *
 * The `taskId` is the value *after* the `session_` prefix. For example,
 * a session `session_01EWNc9EagxLbAyRBeoHkA8i` has task-id `01EWNc9EagxLbAyRBeoHkA8i`.
 */
export function claudeTaskUrl(taskId: string): string {
  return `https://claude.ai/code/session_${taskId}`;
}

// ── Generic helpers ────────────────────────────────────────────────────────

/**
 * Map from work-item ref kind → CRN builder.
 *
 * This bridges the `refs` system with the CRN system: given a ref kind and
 * a platform-specific task ID, return the canonical CRN string.
 */
export function buildExternalTaskCrn(refKind: string, taskId: string): string | undefined {
  switch (refKind) {
    case "external:codex-task":
      return buildCodexTaskCrn({ taskId });
    case "external:claude-task":
      return buildClaudeTaskCrn({ taskId });
    default:
      return undefined;
  }
}

/**
 * Map from work-item ref kind → external URL.
 *
 * Given a ref kind and a task ID, return the clickable URL to the platform.
 */
export function externalTaskUrlFromRefKind(refKind: string, taskId: string): string | undefined {
  switch (refKind) {
    case "external:codex-task":
      return codexTaskUrl(taskId);
    case "external:claude-task":
      return claudeTaskUrl(taskId);
    default:
      return undefined;
  }
}
