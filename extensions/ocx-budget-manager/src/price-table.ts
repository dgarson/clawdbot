import { readFile } from "node:fs/promises";
import { join } from "node:path";
type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };

/**
 * Per-model pricing: cost per 1000 tokens for input and output.
 */
export type ModelPricing = {
  inputPer1k: number;
  outputPer1k: number;
};

/** Default pricing for common models when no price table file is available. */
const DEFAULT_PRICES: Record<string, ModelPricing> = {
  "gpt-4.1": { inputPer1k: 0.002, outputPer1k: 0.008 },
  "gpt-4.1-mini": { inputPer1k: 0.0004, outputPer1k: 0.0016 },
  "gpt-4.1-nano": { inputPer1k: 0.0001, outputPer1k: 0.0004 },
  "gpt-4o": { inputPer1k: 0.0025, outputPer1k: 0.01 },
  "gpt-4o-mini": { inputPer1k: 0.00015, outputPer1k: 0.0006 },
  "claude-opus-4": { inputPer1k: 0.015, outputPer1k: 0.075 },
  "claude-sonnet-4": { inputPer1k: 0.003, outputPer1k: 0.015 },
  "claude-haiku-3.5": { inputPer1k: 0.0008, outputPer1k: 0.004 },
};

export class PriceTable {
  private prices: Record<string, ModelPricing>;

  constructor(prices?: Record<string, ModelPricing>) {
    this.prices = { ...DEFAULT_PRICES, ...prices };
  }

  /** Estimate cost in USD for a given model and token counts. */
  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = this.findPricing(model);
    if (!pricing) return 0;
    return (inputTokens / 1000) * pricing.inputPer1k + (outputTokens / 1000) * pricing.outputPer1k;
  }

  /**
   * Look up pricing for a model. Tries exact match first, then longest
   * prefix match (e.g. "gpt-4.1-mini-2025-04-14" matches "gpt-4.1-mini"
   * rather than "gpt-4.1").
   */
  findPricing(model: string): ModelPricing | undefined {
    if (this.prices[model]) return this.prices[model];

    // Use longest prefix match so "gpt-4.1-mini-*" picks "gpt-4.1-mini" over "gpt-4.1"
    let bestKey: string | undefined;
    let bestLen = 0;
    for (const key of Object.keys(this.prices)) {
      if (model.startsWith(key) && key.length > bestLen) {
        bestKey = key;
        bestLen = key.length;
      }
    }
    return bestKey ? this.prices[bestKey] : undefined;
  }
}

/**
 * Load a price table from disk, falling back to built-in defaults.
 */
export async function loadPriceTable(
  stateDir: string,
  filename: string,
  logger: Logger,
): Promise<PriceTable> {
  const filePath = join(stateDir, filename);
  try {
    const raw = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw) as Record<string, ModelPricing>;
    logger.info(`budget-manager: loaded price table from ${filePath}`);
    return new PriceTable(parsed);
  } catch {
    logger.info("budget-manager: using default price table (no custom file found)");
    return new PriceTable();
  }
}
