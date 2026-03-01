/**
 * Tool intelligence analysis.
 *
 * Analyzes sequences of tool calls in a run to detect:
 * - corrections (error -> fallback, same tool different params)
 * - repetitions (same tool with similar params called multiple times)
 * - wasted calls (placeholder for Phase 2 LLM-based detection)
 *
 * Produces a ToolIntelligenceReport with an effectiveness score.
 */

import type { ToolCorrection, ToolEvent, ToolIntelligenceReport, ToolRepetition } from "./types.js";

// ---------------------------------------------------------------------------
// Correction detection
// ---------------------------------------------------------------------------

/**
 * Detect corrections in a sequence of tool calls.
 *
 * Two patterns:
 * 1. Tool error followed by a different tool = fallback_after_error
 * 2. Same tool with different params = retry_with_different_params
 */
export function detectCorrections(toolEvents: ToolEvent[]): ToolCorrection[] {
  const corrections: ToolCorrection[] = [];

  for (let i = 0; i < toolEvents.length - 1; i++) {
    const current = toolEvents[i]!;
    const next = toolEvents[i + 1]!;

    // Case 1: Tool error followed by different tool
    if (!current.success && current.toolName !== next.toolName) {
      corrections.push({
        originalCallId: current.eventId,
        originalToolName: current.toolName,
        correctedCallId: next.eventId,
        correctedToolName: next.toolName,
        reason: "fallback_after_error",
      });
    }

    // Case 2: Same tool, different params (retry)
    if (current.toolName === next.toolName && !deepEqual(current.params, next.params)) {
      corrections.push({
        originalCallId: current.eventId,
        originalToolName: current.toolName,
        correctedCallId: next.eventId,
        correctedToolName: next.toolName,
        reason: "retry_with_different_params",
      });
    }
  }

  return corrections;
}

// ---------------------------------------------------------------------------
// Repetition detection
// ---------------------------------------------------------------------------

/**
 * Detect repeated tool calls (same tool with high parameter similarity).
 * Groups calls by tool name, then computes pairwise Jaccard similarity
 * on flattened key=value sets. Groups with similarity >= 0.8 are reported.
 */
export function detectRepetitions(toolEvents: ToolEvent[]): ToolRepetition[] {
  const SIMILARITY_THRESHOLD = 0.8;

  // Group events by tool name
  const groups = new Map<string, ToolEvent[]>();
  for (const evt of toolEvents) {
    const existing = groups.get(evt.toolName);
    if (existing) {
      existing.push(evt);
    } else {
      groups.set(evt.toolName, [evt]);
    }
  }

  const repetitions: ToolRepetition[] = [];

  for (const [toolName, events] of groups) {
    if (events.length < 2) continue;

    // Check consecutive pairs for high similarity
    const clusterIds: string[] = [];
    let maxSimilarity = 0;

    for (let i = 0; i < events.length - 1; i++) {
      const sim = jaccardSimilarity(events[i]!.params, events[i + 1]!.params);
      if (sim >= SIMILARITY_THRESHOLD) {
        if (clusterIds.length === 0) {
          clusterIds.push(events[i]!.eventId);
        }
        clusterIds.push(events[i + 1]!.eventId);
        maxSimilarity = Math.max(maxSimilarity, sim);
      }
    }

    if (clusterIds.length >= 2) {
      repetitions.push({
        toolName,
        callIds: clusterIds,
        paramSimilarity: maxSimilarity,
      });
    }
  }

  return repetitions;
}

// ---------------------------------------------------------------------------
// Wasted call detection (Phase 1: simple heuristic)
// ---------------------------------------------------------------------------

/**
 * Detect wasted calls. Phase 1 heuristic: failed calls whose tool name
 * does not appear again later as a successful call are candidates.
 * Phase 2 will use LLM judgment on whether final output references tool results.
 */
export function detectWastedCalls(toolEvents: ToolEvent[]): string[] {
  const wasted: string[] = [];

  for (let i = 0; i < toolEvents.length; i++) {
    const evt = toolEvents[i]!;
    if (!evt.success) {
      // Check if a later call with the same tool succeeded
      const laterSuccess = toolEvents
        .slice(i + 1)
        .some((later) => later.toolName === evt.toolName && later.success);
      if (!laterSuccess) {
        wasted.push(evt.eventId);
      }
    }
  }

  return wasted;
}

// ---------------------------------------------------------------------------
// Effectiveness score
// ---------------------------------------------------------------------------

/**
 * Compute an effectiveness score (0-100) for a tool intelligence report.
 *
 * Factors:
 * - Success rate (40% weight): successfulCalls / totalCalls
 * - Correction penalty (30% weight): fewer corrections = higher score
 * - Wasted call penalty (20% weight): fewer wasted calls = higher score
 * - Repetition penalty (10% weight): fewer repetitions = higher score
 */
export function computeEffectivenessScore(
  report: Omit<ToolIntelligenceReport, "effectivenessScore">,
): number {
  if (report.totalCalls === 0) return 100;

  const successRate = report.successfulCalls / report.totalCalls;
  const correctionRatio = Math.min(report.corrections.length / report.totalCalls, 1);
  const wastedRatio = Math.min(report.wastedCalls.length / report.totalCalls, 1);
  const repetitionRatio = Math.min(report.repeatedCalls.length / report.totalCalls, 1);

  const score =
    successRate * 40 +
    (1 - correctionRatio) * 30 +
    (1 - wastedRatio) * 20 +
    (1 - repetitionRatio) * 10;

  return Math.round(Math.max(0, Math.min(100, score)));
}

// ---------------------------------------------------------------------------
// Build a complete report from tool events
// ---------------------------------------------------------------------------

export function buildToolIntelligenceReport(
  runId: string,
  toolEvents: ToolEvent[],
): ToolIntelligenceReport {
  const totalCalls = toolEvents.length;
  const successfulCalls = toolEvents.filter((e) => e.success).length;
  const failedCalls = totalCalls - successfulCalls;
  const corrections = detectCorrections(toolEvents);
  const wastedCalls = detectWastedCalls(toolEvents);
  const repeatedCalls = detectRepetitions(toolEvents);

  const partial = {
    runId,
    totalCalls,
    successfulCalls,
    failedCalls,
    corrections,
    wastedCalls,
    repeatedCalls,
  };

  return {
    ...partial,
    effectivenessScore: computeEffectivenessScore(partial),
  };
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Jaccard similarity on flattened key=value string sets from two param objects.
 */
function jaccardSimilarity(a: Record<string, unknown>, b: Record<string, unknown>): number {
  const setA = flattenToSet(a);
  const setB = flattenToSet(b);

  if (setA.size === 0 && setB.size === 0) return 1;

  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/** Flatten an object to a set of "key=value" strings for similarity comparison. */
function flattenToSet(obj: Record<string, unknown>, prefix = ""): Set<string> {
  const result = new Set<string>();
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      for (const item of flattenToSet(value as Record<string, unknown>, fullKey)) {
        result.add(item);
      }
    } else {
      result.add(`${fullKey}=${JSON.stringify(value)}`);
    }
  }
  return result;
}

/** Simple deep equality for plain JSON-serializable objects. */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (typeof a !== "object") return false;

  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);

  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(bObj, key) && deepEqual(aObj[key], bObj[key]),
  );
}
