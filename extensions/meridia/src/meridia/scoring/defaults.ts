/**
 * Memory Relevance Scoring System — Default Configuration
 */

import type { ScoringConfig, ScoringWeights, ThresholdProfile } from "./types.js";

// ────────────────────────────────────────────────────────────────────────────
// Default Weights
// ────────────────────────────────────────────────────────────────────────────

export const DEFAULT_WEIGHTS: ScoringWeights = {
  novelty: 0.25,
  impact: 0.3,
  relational: 0.15,
  temporal: 0.1,
  userIntent: 0.2,
};

// ────────────────────────────────────────────────────────────────────────────
// Default Threshold Profiles
// ────────────────────────────────────────────────────────────────────────────

export const DEFAULT_PROFILES: Record<string, ThresholdProfile> = {
  standard: {
    name: "standard",
    captureThreshold: 0.5,
    llmEvalThreshold: 0.35,
    highValueThreshold: 0.8,
  },
  aggressive: {
    name: "aggressive",
    captureThreshold: 0.3,
    llmEvalThreshold: 0.2,
    highValueThreshold: 0.7,
  },
  conservative: {
    name: "conservative",
    captureThreshold: 0.7,
    llmEvalThreshold: 0.5,
    highValueThreshold: 0.9,
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Default Scoring Config
// ────────────────────────────────────────────────────────────────────────────

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
  weights: { ...DEFAULT_WEIGHTS },
  activeProfile: "standard",
  profiles: { ...DEFAULT_PROFILES },
  toolOverrides: [
    // External messaging always has high minimum relevance
    {
      toolPattern: "message",
      minScore: 0.6,
    },
    {
      toolPattern: "sessions_send",
      minScore: 0.6,
    },
    // File writes are important
    {
      toolPattern: "write",
      minScore: 0.5,
    },
    {
      toolPattern: "edit",
      minScore: 0.5,
    },
    {
      toolPattern: "apply_patch",
      minScore: 0.5,
    },
    // Reads are typically low value
    {
      toolPattern: "read",
      maxScore: 0.4,
    },
    // Memory operations are meta — don't capture them
    {
      toolPattern: "memory_*",
      maxScore: 0.15,
    },
    {
      toolPattern: "experience_*",
      maxScore: 0.15,
    },
  ],
  patternOverrides: [
    {
      name: "error_boost",
      condition: { type: "error" },
      action: { type: "floor", score: 0.55 },
    },
    {
      name: "large_result_boost",
      condition: { type: "largeResult", minChars: 5000 },
      action: { type: "boost", amount: 0.1 },
    },
  ],
  includeBreakdownInTrace: true,
};
