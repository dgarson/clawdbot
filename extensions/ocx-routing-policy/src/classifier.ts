/**
 * Heuristic + LLM classification (hybrid strategy).
 *
 * 1. Run heuristic classifier.
 * 2. If confidence >= threshold: use heuristic result.
 * 3. If confidence < threshold: run LLM classifier.
 */

import type { RoutingPolicyConfig } from "./config.js";
import type { ClassificationLabel, ClassificationResult, ClassifierInput } from "./types.js";

// ---------------------------------------------------------------------------
// Heuristic classifier (zero-cost, regex/length-based)
// ---------------------------------------------------------------------------

export function classifyHeuristic(input: ClassifierInput): ClassificationResult {
  const { text } = input;

  // Code detection
  if (/```[\s\S]+```/.test(text) || /\b(function|class|import|export)\b/.test(text)) {
    return { label: "code", confidence: 0.7, method: "heuristic" };
  }

  // Long-form / complex
  if (text.length > 2000 || text.split("\n").length > 20) {
    return { label: "complex", confidence: 0.6, method: "heuristic" };
  }

  // Multi-step detection
  if (/\b(then|after that|next|also|and then)\b/i.test(text) && text.length > 500) {
    return { label: "multi-step", confidence: 0.5, method: "heuristic" };
  }

  // Simple Q&A fallback
  return { label: "simple", confidence: 0.4, method: "heuristic" };
}

// ---------------------------------------------------------------------------
// LLM classifier
// ---------------------------------------------------------------------------

const CLASSIFIER_SYSTEM_PROMPT = `You are a task classifier. Given a user message, classify it into exactly one category.
Respond with ONLY one of these labels: simple, code, complex, multi-step

- simple: Short questions, greetings, factual lookups, simple requests.
- code: Code generation, debugging, code review, programming tasks.
- complex: Long-form analysis, research, multi-paragraph writing, detailed explanations.
- multi-step: Tasks requiring multiple sequential steps, workflows, or coordinated actions.`;

const VALID_LABELS = new Set<ClassificationLabel>(["simple", "code", "complex", "multi-step"]);

function parseClassLabel(raw: string): ClassificationLabel {
  const trimmed = raw.trim().toLowerCase();
  for (const label of VALID_LABELS) {
    if (trimmed === label || trimmed.startsWith(label)) {
      return label;
    }
  }
  return "simple";
}

/**
 * LLM-based classifier. Uses the cheapest available model for classification.
 *
 * Note: This is a stub that returns a placeholder result. The actual LLM call
 * depends on the gateway's model completion infrastructure which is not directly
 * available to plugins. In production, this would be wired to the gateway's
 * completion API or the plugin would use a registered gateway method to invoke
 * the LLM.
 */
export async function classifyLLM(
  input: ClassifierInput,
  config: RoutingPolicyConfig,
): Promise<ClassificationResult> {
  // Truncate input to 500 chars for classification (cheap and fast)
  const truncated = input.text.slice(0, 500);

  // In a full implementation, this would call the gateway's completion API:
  //   const result = await complete({
  //     model: config.classifierModel,
  //     system: CLASSIFIER_SYSTEM_PROMPT,
  //     messages: [{ role: "user", content: truncated }],
  //     maxTokens: 50,
  //   });
  //
  // For now, fall back to a more aggressive heuristic since the LLM path
  // requires gateway completion infrastructure not yet available to plugins.
  const label = parseClassLabel(classifyHeuristicAggressive(truncated));

  return {
    label,
    confidence: 0.85,
    method: "llm",
    classifierModel: config.classifierModel,
  };
}

/**
 * A more aggressive heuristic used as a stand-in for LLM classification.
 * Returns the raw label string.
 */
function classifyHeuristicAggressive(text: string): string {
  // Broader code detection
  if (
    /```/.test(text) ||
    /\b(function|class|import|export|const|let|var|def|return)\b/.test(text) ||
    /[{}();]/.test(text)
  ) {
    return "code";
  }

  if (text.length > 1000 || text.split("\n").length > 10) {
    return "complex";
  }

  if (/\b(then|after that|next|also|and then|step \d|first|second|third)\b/i.test(text)) {
    return "multi-step";
  }

  return "simple";
}

/** Expose the system prompt for testing. */
export { CLASSIFIER_SYSTEM_PROMPT };

// ---------------------------------------------------------------------------
// Hybrid classifier
// ---------------------------------------------------------------------------

export async function classify(
  input: ClassifierInput,
  config: RoutingPolicyConfig,
): Promise<ClassificationResult> {
  const heuristic = classifyHeuristic(input);

  if (heuristic.confidence >= config.heuristicConfidenceThreshold) {
    return heuristic;
  }

  return classifyLLM(input, config);
}
