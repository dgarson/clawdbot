import type { NormalizedUsage } from "../agents/usage.js";
import type { OpenClawConfig } from "../config/config.js";

export type ModelCostConfig = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
};

export type UsageTotals = {
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheWrite?: number;
  total?: number;
};

export function formatTokenCount(value?: number): string {
  if (value === undefined || !Number.isFinite(value)) {
    return "0";
  }
  const safe = Math.max(0, value);
  if (safe >= 1_000_000) {
    return `${(safe / 1_000_000).toFixed(1)}m`;
  }
  if (safe >= 1_000) {
    return `${(safe / 1_000).toFixed(safe >= 10_000 ? 0 : 1)}k`;
  }
  return String(Math.round(safe));
}

export function formatUsd(value?: number): string | undefined {
  if (value === undefined || !Number.isFinite(value)) {
    return undefined;
  }
  if (value >= 1) {
    return `$${value.toFixed(2)}`;
  }
  if (value >= 0.01) {
    return `$${value.toFixed(2)}`;
  }
  return `$${value.toFixed(4)}`;
}

// Built-in Anthropic pricing per 1M tokens (USD).
// Cache read = 0.1x input, cache write = 1.25x input per Anthropic docs.
// Prices are consistent across model generations (4.x, 3.x, etc.).
const ANTHROPIC_HAIKU_COST: ModelCostConfig = {
  input: 1,
  output: 5,
  cacheRead: 0.1,
  cacheWrite: 1.25,
};
const ANTHROPIC_SONNET_COST: ModelCostConfig = {
  input: 3,
  output: 15,
  cacheRead: 0.3,
  cacheWrite: 3.75,
};
const ANTHROPIC_OPUS_COST: ModelCostConfig = {
  input: 5,
  output: 25,
  cacheRead: 0.5,
  cacheWrite: 6.25,
};

/** Match a model ID like "claude-{family}-..." to its built-in cost config. */
function resolveAnthropicBuiltinCost(model: string): ModelCostConfig | undefined {
  if (model.startsWith("claude-haiku")) {
    return ANTHROPIC_HAIKU_COST;
  }
  if (model.startsWith("claude-sonnet")) {
    return ANTHROPIC_SONNET_COST;
  }
  if (model.startsWith("claude-opus")) {
    return ANTHROPIC_OPUS_COST;
  }
  return undefined;
}

export function resolveModelCostConfig(params: {
  provider?: string;
  model?: string;
  config?: OpenClawConfig;
}): ModelCostConfig | undefined {
  const provider = params.provider?.trim();
  const model = params.model?.trim();
  if (!provider || !model) {
    return undefined;
  }
  // Prefer explicit user config when available.
  const providers = params.config?.models?.providers ?? {};
  const entry = providers[provider]?.models?.find((item) => item.id === model);
  if (entry?.cost) {
    return entry.cost;
  }
  // Fallback: built-in Anthropic pricing by model family.
  // Match provider "anthropic" or any model starting with "claude-".
  if (provider === "anthropic" || model.startsWith("claude-")) {
    return resolveAnthropicBuiltinCost(model);
  }
  return undefined;
}

const toNumber = (value: number | undefined): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

export function estimateUsageCost(params: {
  usage?: NormalizedUsage | UsageTotals | null;
  cost?: ModelCostConfig;
}): number | undefined {
  const usage = params.usage;
  const cost = params.cost;
  if (!usage || !cost) {
    return undefined;
  }
  const input = toNumber(usage.input);
  const output = toNumber(usage.output);
  const cacheRead = toNumber(usage.cacheRead);
  const cacheWrite = toNumber(usage.cacheWrite);
  const total =
    input * cost.input +
    output * cost.output +
    cacheRead * cost.cacheRead +
    cacheWrite * cost.cacheWrite;
  if (!Number.isFinite(total)) {
    return undefined;
  }
  return total / 1_000_000;
}
