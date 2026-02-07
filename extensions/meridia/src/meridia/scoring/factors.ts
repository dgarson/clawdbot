/**
 * Individual factor scoring functions for multi-factor memory relevance.
 *
 * Each factor scorer takes a ScoringContext and returns a score in [0, 1].
 */
import type { ScoringContext, ScoringFactors } from "./types.js";

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function summarizeToString(value: unknown, maxLen = 5000): string {
  if (value === undefined || value === null) return "";
  try {
    const raw = JSON.stringify(value);
    return raw.length <= maxLen ? raw : raw.slice(0, maxLen);
  } catch {
    return String(value).slice(0, maxLen);
  }
}

// Tools that produce side effects (irreversible actions)
const SIDE_EFFECT_TOOLS = new Set([
  "exec",
  "bash",
  "write",
  "apply_patch",
  "edit",
  "message",
  "sessions_send",
  "sessions_spawn",
  "voice_call",
  "cron",
  "gateway",
  "browser",
  "image_generate",
  "tts",
]);

// Tools that primarily read/query data
const READ_ONLY_TOOLS = new Set([
  "read",
  "tree",
  "ripgrep",
  "memory_search",
  "memory_recall",
  "memory_get",
  "memory_query",
  "memory_contextPack",
  "memory_index_status",
  "experience_search",
  "experience_reflect",
  "web_search",
  "web_fetch",
  "sessions_list",
  "sessions_history",
  "session_status",
  "work_queue",
  "work_item",
  "agents_list",
]);

// Tools that interact with external systems
const EXTERNAL_TOOLS = new Set([
  "message",
  "sessions_send",
  "voice_call",
  "web_search",
  "web_fetch",
  "browser",
  "SlackRichMessage",
  "AskSlackQuestion",
  "AskSlackForm",
  "AskSlackConfirmation",
]);

// ────────────────────────────────────────────────────────────────────────────
// Novelty Scorer
// ────────────────────────────────────────────────────────────────────────────

/**
 * Novelty: Is this new or unique information?
 *
 * Higher scores for:
 * - Error conditions (something unexpected happened)
 * - Large/complex results (more data = potentially more novel content)
 * - Tool names not commonly seen
 * - Non-standard metadata
 */
export function scoreNovelty(ctx: ScoringContext): number {
  const tool = ctx.tool.name.toLowerCase();
  let score = 0.3; // baseline

  // Errors are inherently novel — something unexpected happened
  if (ctx.tool.isError) {
    score = Math.max(score, 0.7);
  }

  // Side-effect tools produce novel state changes
  if (SIDE_EFFECT_TOOLS.has(tool)) {
    score = Math.max(score, 0.5);
  }

  // Read-only tools have lower novelty
  if (READ_ONLY_TOOLS.has(tool)) {
    score = Math.min(score, 0.25);
  }

  // Large results may contain more novel information
  const resultStr = summarizeToString(ctx.result, 3000);
  if (resultStr.length > 2000) {
    score = Math.max(score, 0.45);
  }

  // Tool metadata suggests non-standard usage
  if (ctx.tool.meta) {
    score += 0.1;
  }

  return clamp01(score);
}

// ────────────────────────────────────────────────────────────────────────────
// Impact Scorer
// ────────────────────────────────────────────────────────────────────────────

/**
 * Impact: Does this change understanding, behavior, or system state?
 *
 * Higher scores for:
 * - File writes/edits (code changes)
 * - External messaging (affects relationships)
 * - Process execution (system state changes)
 * - Configuration changes
 * - Errors that affect workflow
 */
export function scoreImpact(ctx: ScoringContext): number {
  const tool = ctx.tool.name.toLowerCase();
  let score = 0.2;

  // File modification — direct code/content impact
  if (tool === "write" || tool === "apply_patch" || tool === "edit") {
    score = 0.75;
  }

  // Process execution — system state change
  if (tool === "exec" || tool === "bash") {
    score = 0.6;
    // Build/test commands have higher impact
    const argsStr = summarizeToString(ctx.args, 500).toLowerCase();
    if (argsStr.includes("build") || argsStr.includes("test") || argsStr.includes("deploy")) {
      score = 0.7;
    }
    // Git operations are high impact
    if (
      argsStr.includes("git push") ||
      argsStr.includes("git merge") ||
      argsStr.includes("git commit")
    ) {
      score = 0.8;
    }
  }

  // External communication — relationship impact
  if (EXTERNAL_TOOLS.has(tool)) {
    score = Math.max(score, 0.65);
  }

  // Gateway/cron changes — infrastructure impact
  if (tool === "gateway" || tool === "cron") {
    score = 0.7;
  }

  // Spawning subagents — orchestration impact
  if (tool === "sessions_spawn") {
    score = 0.6;
  }

  // Memory operations — self-modification impact
  if (tool === "memory_store" || tool === "memory_ingest") {
    score = 0.5;
  }

  // Errors increase impact — something went wrong
  if (ctx.tool.isError) {
    score = Math.max(score, 0.55);
  }

  // Read operations have minimal impact
  if (READ_ONLY_TOOLS.has(tool)) {
    score = Math.min(score, 0.15);
  }

  return clamp01(score);
}

// ────────────────────────────────────────────────────────────────────────────
// Relational Scorer
// ────────────────────────────────────────────────────────────────────────────

/**
 * Relational: Does this connect to known entities?
 *
 * Higher scores when:
 * - Result or args mention known people, projects, or organizations
 * - Tool involves external communication (interpersonal)
 * - Tags reference known entities
 */
export function scoreRelational(ctx: ScoringContext): number {
  let score = 0.1;
  const tool = ctx.tool.name.toLowerCase();

  // External communication is inherently relational
  if (EXTERNAL_TOOLS.has(tool)) {
    score = Math.max(score, 0.6);
  }

  // Check for known entities in args and result
  if (ctx.knownEntities && ctx.knownEntities.length > 0) {
    const combined = [
      summarizeToString(ctx.args, 2000),
      summarizeToString(ctx.result, 2000),
      ctx.tool.meta ?? "",
    ]
      .join(" ")
      .toLowerCase();

    let entityHits = 0;
    for (const entity of ctx.knownEntities) {
      if (combined.includes(entity.toLowerCase())) {
        entityHits++;
      }
    }

    if (entityHits > 0) {
      // More entity matches = higher relational score
      score = Math.max(score, Math.min(0.9, 0.4 + entityHits * 0.15));
    }
  }

  // Tags that reference entities
  if (ctx.tags && ctx.tags.length > 0) {
    score = Math.max(score, 0.3);
  }

  return clamp01(score);
}

// ────────────────────────────────────────────────────────────────────────────
// Temporal Scorer
// ────────────────────────────────────────────────────────────────────────────

/**
 * Temporal: Is this time-sensitive or evergreen?
 *
 * Higher scores for:
 * - Configuration changes (evergreen — affects future behavior)
 * - File writes (persistent changes)
 * - Decisions and commitments (future implications)
 * Lower scores for:
 * - Ephemeral queries (status checks, reads)
 * - Redundant operations
 */
export function scoreTemporal(ctx: ScoringContext): number {
  const tool = ctx.tool.name.toLowerCase();
  let score = 0.3;

  // Persistent changes have high temporal value
  if (tool === "write" || tool === "apply_patch" || tool === "edit") {
    score = 0.7;
  }

  // Gateway/cron changes are evergreen
  if (tool === "gateway" || tool === "cron") {
    score = 0.75;
  }

  // Memory operations are explicitly about persistence
  if (tool === "memory_store" || tool === "memory_ingest" || tool === "experience_capture") {
    score = 0.8;
  }

  // Git operations are highly persistent
  const argsStr = summarizeToString(ctx.args, 500).toLowerCase();
  if (tool === "exec" || tool === "bash") {
    if (argsStr.includes("git push") || argsStr.includes("git commit")) {
      score = 0.8;
    }
  }

  // Read operations are ephemeral
  if (READ_ONLY_TOOLS.has(tool)) {
    score = Math.min(score, 0.15);
  }

  // External messaging has moderate temporal value
  if (EXTERNAL_TOOLS.has(tool)) {
    score = Math.max(score, 0.5);
  }

  return clamp01(score);
}

// ────────────────────────────────────────────────────────────────────────────
// User Intent Scorer
// ────────────────────────────────────────────────────────────────────────────

/**
 * User Intent: Was this explicitly marked as important?
 *
 * Higher scores when:
 * - explicitCapture is true
 * - Tags suggest importance
 * - experience_capture tool was used
 */
export function scoreUserIntent(ctx: ScoringContext): number {
  const tool = ctx.tool.name.toLowerCase();

  // Explicit capture request — maximum user intent
  if (ctx.explicitCapture) {
    return 1.0;
  }

  // experience_capture tool — user chose to capture this
  if (tool === "experience_capture") {
    return 0.95;
  }

  // Tags suggest intentionality
  if (ctx.tags && ctx.tags.length > 0) {
    const importanceTags = ["important", "critical", "decision", "insight", "remember", "key"];
    const hasImportanceTag = ctx.tags.some((t) =>
      importanceTags.some((it) => t.toLowerCase().includes(it)),
    );
    if (hasImportanceTag) {
      return 0.8;
    }
    return 0.4; // Tags present but not explicitly important
  }

  // No explicit intent signal
  return 0.1;
}

// ────────────────────────────────────────────────────────────────────────────
// Composite Factor Calculation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate all scoring factors for a given context.
 */
export function calculateFactors(ctx: ScoringContext): ScoringFactors {
  return {
    novelty: scoreNovelty(ctx),
    impact: scoreImpact(ctx),
    relational: scoreRelational(ctx),
    temporal: scoreTemporal(ctx),
    userIntent: scoreUserIntent(ctx),
  };
}
