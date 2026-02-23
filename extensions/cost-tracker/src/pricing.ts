/**
 * Model pricing table.
 * Prices are in USD per 1M tokens.
 * Format: { modelName: { input: number, output: number } }
 */

export const MODEL_PRICING: Record<string, { input: number; output: number; provider: string }> = {
  // MiniMax models
  "MiniMax-M2.5": {
    input: 0.2,
    output: 0.4,
    provider: "MiniMax",
  },
  "MiniMax-M2": {
    input: 0.15,
    output: 0.3,
    provider: "MiniMax",
  },
  "MiniMax-Text-01": {
    input: 0.2,
    output: 0.4,
    provider: "MiniMax",
  },

  // GLM models
  "glm-5": {
    input: 0.1,
    output: 0.3,
    provider: "Zhipu",
  },
  "glm-4": {
    input: 0.1,
    output: 0.3,
    provider: "Zhipu",
  },
  "glm-4-flash": {
    input: 0.05,
    output: 0.15,
    provider: "Zhipu",
  },

  // Grok models
  "grok-4": {
    input: 5.0,
    output: 15.0,
    provider: "xAI",
  },
  "grok-4-mini": {
    input: 0.4,
    output: 1.6,
    provider: "xAI",
  },
  "grok-3": {
    input: 3.0,
    output: 15.0,
    provider: "xAI",
  },
  "grok-3-mini": {
    input: 0.3,
    output: 1.5,
    provider: "xAI",
  },
  "grok-2": {
    input: 2.0,
    output: 10.0,
    provider: "xAI",
  },
  "grok-2-vision": {
    input: 2.0,
    output: 10.0,
    provider: "xAI",
  },
  "grok-beta": {
    input: 5.0,
    output: 15.0,
    provider: "xAI",
  },

  // Claude models (Anthropic)
  "claude-sonnet-4-6": {
    input: 15.0,
    output: 75.0,
    provider: "Anthropic",
  },
  "claude-opus-4-6": {
    input: 75.0,
    output: 150.0,
    provider: "Anthropic",
  },
  "claude-haiku-3-5": {
    input: 0.8,
    output: 4.0,
    provider: "Anthropic",
  },
  "claude-haiku-3": {
    input: 0.25,
    output: 1.25,
    provider: "Anthropic",
  },
  "claude-3-5-sonnet": {
    input: 3.0,
    output: 15.0,
    provider: "Anthropic",
  },
  "claude-3-opus": {
    input: 75.0,
    output: 150.0,
    provider: "Anthropic",
  },
  "claude-3-sonnet": {
    input: 3.0,
    output: 15.0,
    provider: "Anthropic",
  },
  "claude-3-haiku": {
    input: 0.25,
    output: 1.25,
    provider: "Anthropic",
  },

  // OpenAI models
  "gpt-4o": {
    input: 2.5,
    output: 10.0,
    provider: "OpenAI",
  },
  "gpt-4o-mini": {
    input: 0.15,
    output: 0.6,
    provider: "OpenAI",
  },
  "gpt-4-turbo": {
    input: 10.0,
    output: 30.0,
    provider: "OpenAI",
  },
  "gpt-4": {
    input: 30.0,
    output: 60.0,
    provider: "OpenAI",
  },

  // DeepSeek models
  "deepseek-chat": {
    input: 0.14,
    output: 0.28,
    provider: "DeepSeek",
  },
  "deepseek-coder": {
    input: 0.14,
    output: 0.28,
    provider: "DeepSeek",
  },

  // Google models
  "gemini-2.0-pro": {
    input: 1.25,
    output: 5.0,
    provider: "Google",
  },
  "gemini-2.0-flash": {
    input: 0.1,
    output: 0.4,
    provider: "Google",
  },
  "gemini-1.5-pro": {
    input: 1.25,
    output: 5.0,
    provider: "Google",
  },
  "gemini-1.5-flash": {
    input: 0.075,
    output: 0.3,
    provider: "Google",
  },

  // Mistral models
  "mistral-large": {
    input: 2.0,
    output: 6.0,
    provider: "Mistral",
  },
  "mistral-small": {
    input: 0.2,
    output: 0.6,
    provider: "Mistral",
  },
  "mistral-medium": {
    input: 0.5,
    output: 1.5,
    provider: "Mistral",
  },
};

/**
 * Get pricing for a model.
 * @param modelName - The model name (case-insensitive match)
 * @returns Pricing object or null if model not found
 */
export function getModelPricing(
  modelName: string,
): { input: number; output: number; provider: string } | null {
  if (!modelName) return null;

  // Exact match
  if (modelName in MODEL_PRICING) {
    return MODEL_PRICING[modelName];
  }

  // Case-insensitive match
  const lowerName = modelName.toLowerCase();
  for (const [key, value] of Object.entries(MODEL_PRICING)) {
    if (key.toLowerCase() === lowerName) {
      return value;
    }
  }

  // Partial match (e.g., "claude-sonnet" matches "claude-sonnet-4-6")
  for (const [key, value] of Object.entries(MODEL_PRICING)) {
    if (key.toLowerCase().includes(lowerName) || lowerName.includes(key.toLowerCase())) {
      return value;
    }
  }

  return null;
}

/**
 * Calculate cost for token usage.
 * @param usage - Token usage numbers
 * @param pricing - Model pricing
 * @returns Cost in USD
 */
export function calculateTokenCost(
  usage: { input_tokens?: number; output_tokens?: number },
  pricing: { input: number; output: number },
): number {
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;

  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  return inputCost + outputCost;
}
