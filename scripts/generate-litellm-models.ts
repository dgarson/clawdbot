/**
 * Fetches LiteLLM's model_prices_and_context_window.json and generates
 * Openclaw-format models config files with accurate cost/capability data.
 *
 * Usage:
 *   pnpm generate:models
 *   pnpm generate:models --providers anthropic,openai
 *   pnpm generate:models --litellm-proxy
 *   pnpm generate:models --write           # merges into ~/.openclaw/config.json
 *   pnpm generate:models --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const LITELLM_PRICES_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// CLI arg parsing
const args = process.argv.slice(2);
const getFlag = (name: string) => args.includes(name);
const getArg = (name: string): string | undefined => {
  const idx = args.indexOf(name);
  return idx !== -1 ? args[idx + 1] : undefined;
};

const outputDir = getArg("--output") ?? path.join(rootDir, "generated");
const providerFilter = getArg("--providers")
  ?.split(",")
  .map((p) => p.trim())
  .filter(Boolean);
const emitLitellmProxy = getFlag("--litellm-proxy");
const writeDirect = getFlag("--write");
const dryRun = getFlag("--dry-run");

// ----------------------------------------------------------------------------
// Provider mapping: litellm_provider → Openclaw ModelApi + base URL
// ----------------------------------------------------------------------------
type ModelApi =
  | "openai-completions"
  | "openai-responses"
  | "anthropic-messages"
  | "google-generative-ai"
  | "bedrock-converse-stream"
  | "ollama";

type ProviderInfo = {
  api: ModelApi;
  baseUrl: string;
};

/**
 * Canonical provider info keyed by the *normalized* provider key we emit.
 * All entries here are the single source of truth for api + baseUrl per key.
 */
const PROVIDER_INFO: Record<string, ProviderInfo> = {
  anthropic: {
    api: "anthropic-messages",
    baseUrl: "https://api.anthropic.com",
  },
  openai: {
    api: "openai-completions",
    baseUrl: "https://api.openai.com/v1",
  },
  gemini: {
    api: "google-generative-ai",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  },
  "vertex-ai": {
    api: "google-generative-ai",
    baseUrl: "https://us-central1-aiplatform.googleapis.com/v1",
  },
  "amazon-bedrock": {
    api: "bedrock-converse-stream",
    // Region-specific; override in config.json: https://bedrock-runtime.{region}.amazonaws.com
    baseUrl: "https://bedrock-runtime.us-east-1.amazonaws.com",
  },
  groq: {
    api: "openai-completions",
    baseUrl: "https://api.groq.com/openai/v1",
  },
  "together-ai": {
    api: "openai-completions",
    baseUrl: "https://api.together.xyz/v1",
  },
  openrouter: {
    api: "openai-completions",
    baseUrl: "https://openrouter.ai/api/v1",
  },
  cohere: {
    api: "openai-completions",
    baseUrl: "https://api.cohere.com/compatibility/v1",
  },
  mistral: {
    api: "openai-completions",
    baseUrl: "https://api.mistral.ai/v1",
  },
  deepseek: {
    api: "openai-completions",
    baseUrl: "https://api.deepseek.com/v1",
  },
  "fireworks-ai": {
    api: "openai-completions",
    baseUrl: "https://api.fireworks.ai/inference/v1",
  },
  perplexity: {
    api: "openai-completions",
    baseUrl: "https://api.perplexity.ai",
  },
  xai: {
    api: "openai-completions",
    baseUrl: "https://api.x.ai/v1",
  },
  "01-ai": {
    api: "openai-completions",
    baseUrl: "https://api.lingyiwanwu.com/v1",
  },
  huggingface: {
    api: "openai-completions",
    baseUrl: "https://api-inference.huggingface.co/v1",
  },
  "nvidia-nim": {
    api: "openai-completions",
    baseUrl: "https://integrate.api.nvidia.com/v1",
  },
  cerebras: {
    api: "openai-completions",
    baseUrl: "https://api.cerebras.ai/v1",
  },
  sambanova: {
    api: "openai-completions",
    baseUrl: "https://api.sambanova.ai/v1",
  },
  azure: {
    api: "openai-completions",
    baseUrl: "https://your-resource.openai.azure.com/openai",
  },
  "azure-ai": {
    api: "openai-completions",
    baseUrl: "https://your-resource.services.ai.azure.com/models",
  },
  ollama: {
    api: "ollama",
    baseUrl: "http://localhost:11434",
  },
  cloudflare: {
    api: "openai-completions",
    baseUrl: "https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/ai/v1",
  },
  replicate: {
    api: "openai-completions",
    baseUrl: "https://api.replicate.com/v1",
  },
  anyscale: {
    api: "openai-completions",
    baseUrl: "https://api.endpoints.anyscale.com/v1",
  },
  "aws-sagemaker": {
    api: "openai-completions",
    // Endpoint URL is model-specific; update baseUrl after writing
    baseUrl: "https://runtime.sagemaker.us-east-1.amazonaws.com",
  },
};

/**
 * Providers to skip entirely. These produce entries that will never match
 * Openclaw session transcripts or provide no useful cost data:
 *
 * - github_copilot: all costs are $0 (subscription-included), and model IDs
 *   (gpt-4o, claude-3.5-sonnet, etc.) overlap with the canonical providers,
 *   which would cause spurious $0 cost overrides in config.json.
 */
const SKIP_PROVIDERS = new Set(["github_copilot"]);

/**
 * Canonical provider priority for --litellm-proxy cross-provider deduplication.
 * When the same logical model appears under multiple providers, we keep the entry
 * from the highest-priority (lowest index) provider.
 */
const CANONICAL_PROVIDER_PRIORITY: string[] = [
  "anthropic",
  "openai",
  "gemini",
  "mistral",
  "deepseek",
  "xai",
  "cerebras",
  "groq",
  "perplexity",
  "cohere",
  "nvidia-nim",
  "fireworks-ai",
  "sambanova",
  "together-ai",
  "huggingface",
  "01-ai",
  "vertex-ai",
  "amazon-bedrock",
  "azure",
  "azure-ai",
  "openrouter",
  "cloudflare",
  "replicate",
  "anyscale",
  "aws-sagemaker",
  "ollama",
];

function canonicalProviderPriority(providerKey: string): number {
  const idx = CANONICAL_PROVIDER_PRIORITY.indexOf(providerKey);
  return idx === -1 ? CANONICAL_PROVIDER_PRIORITY.length : idx;
}

/**
 * Normalize the LiteLLM provider string to the Openclaw provider key we emit.
 * Consolidates fragmented sub-providers (vertex_ai-*, bedrock variants, etc.)
 * into single canonical keys.
 */
function normalizeProviderKey(litellmProvider: string): string {
  // All vertex_ai sub-providers → vertex-ai
  // (vertex_ai, vertex_ai_beta, vertex_ai-anthropic_models, vertex_ai-mistral_models, etc.)
  if (litellmProvider.startsWith("vertex_ai")) {
    return "vertex-ai";
  }
  // Both bedrock and bedrock_converse → amazon-bedrock
  if (litellmProvider === "bedrock" || litellmProvider === "bedrock_converse") {
    return "amazon-bedrock";
  }
  // Known renames
  const renames: Record<string, string> = {
    together_ai: "together-ai",
    fireworks_ai: "fireworks-ai",
    nvidia_nim: "nvidia-nim",
    azure_ai: "azure-ai",
    sagemaker: "aws-sagemaker",
    "01-ai": "01-ai",
  };
  return renames[litellmProvider] ?? litellmProvider;
}

/**
 * Normalize the model ID for the given LiteLLM provider, stripping provider-
 * specific prefixes so the resulting ID matches what Openclaw session transcripts
 * would report.
 *
 * Returns null to indicate this entry should be skipped entirely.
 */
function normalizeModelId(litellmProvider: string, modelId: string): string | null {
  // Skip billing commitment/reservation variants — these are not model IDs that
  // appear in session transcripts; they're billing constructs.
  if (/\bcommitment\b/.test(modelId)) {
    return null;
  }

  // Bedrock: skip any entry where the model key starts with "bedrock/".
  // These are LiteLLM routing-prefix entries (regional, invoke, GovCloud, cross-region,
  // etc.) that never appear as model IDs in Openclaw session transcripts.
  // Real Bedrock model IDs (e.g. "anthropic.claude-3-5-haiku-20241022-v1:0") have
  // no "bedrock/" prefix — the prefix lives in the LiteLLM routing key, not the model ID.
  if (litellmProvider === "bedrock" || litellmProvider === "bedrock_converse") {
    if (modelId.startsWith("bedrock/")) {
      return null;
    }
  }

  // Vertex AI: strip the sub-provider prefix from the model ID.
  // LiteLLM uses "vertex_ai/gemini-1.5-pro" or
  // "vertex_ai-anthropic_models/claude-3-5-haiku@20241022" etc.
  if (litellmProvider.startsWith("vertex_ai")) {
    const slashIdx = modelId.indexOf("/");
    if (slashIdx !== -1) {
      return modelId.slice(slashIdx + 1);
    }
    return modelId;
  }

  // OpenRouter: strip "openrouter/" prefix
  // e.g. "openrouter/anthropic/claude-3-haiku" → "anthropic/claude-3-haiku"
  if (litellmProvider === "openrouter" && modelId.startsWith("openrouter/")) {
    return modelId.slice("openrouter/".length);
  }

  return modelId;
}

// ----------------------------------------------------------------------------
// LiteLLM data types
// ----------------------------------------------------------------------------
type LiteLLMEntry = {
  litellm_provider?: string;
  mode?: string;
  max_tokens?: number;
  max_input_tokens?: number;
  max_output_tokens?: number;
  input_cost_per_token?: number;
  output_cost_per_token?: number;
  cache_read_input_token_cost?: number;
  cache_creation_input_token_cost?: number;
  supports_vision?: boolean;
  supports_reasoning?: boolean;
  supports_function_calling?: boolean;
  supports_prompt_caching?: boolean;
  deprecation_date?: string;
};

// ----------------------------------------------------------------------------
// Openclaw output types (matches src/config/types.models.ts)
// ----------------------------------------------------------------------------
type ModelDefinitionConfig = {
  id: string;
  name: string;
  api?: ModelApi;
  reasoning: boolean;
  input: Array<"text" | "image">;
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  contextWindow: number;
  maxTokens: number;
};

type ModelProviderConfig = {
  baseUrl: string;
  api?: ModelApi;
  models: ModelDefinitionConfig[];
};

type ModelsConfigOutput = {
  _generated: {
    source: string;
    generatedAt: string;
    modelCount: number;
    providerCount: number;
  };
  mode: "merge";
  providers: Record<string, ModelProviderConfig>;
};

// ----------------------------------------------------------------------------
// Cost conversion: LiteLLM uses per-token; Openclaw uses per-1M-tokens
// ----------------------------------------------------------------------------
function toPerMillion(perToken: number | undefined): number {
  if (perToken == null || perToken === 0) {
    return 0;
  }
  // Round to 6 significant figures to avoid floating point noise
  return Math.round(perToken * 1_000_000 * 1_000_000) / 1_000_000;
}

/**
 * Score how "complete" a model's cost/capability data is.
 * Used to prefer the more data-rich entry when deduplicating within a provider.
 */
function completenessScore(model: ModelDefinitionConfig): number {
  let score = 0;
  if (model.cost.input > 0) {
    score++;
  }
  if (model.cost.output > 0) {
    score++;
  }
  if (model.cost.cacheRead > 0) {
    score++;
  }
  if (model.cost.cacheWrite > 0) {
    score++;
  }
  if (model.reasoning) {
    score++;
  }
  if (model.input.includes("image")) {
    score++;
  }
  return score;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  // In dry-run mode, all non-JSON output goes to stderr so stdout is pure JSON
  const log = dryRun ? console.error : console.log;
  log(`Fetching ${LITELLM_PRICES_URL} ...`);
  const resp = await fetch(LITELLM_PRICES_URL);
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} fetching LiteLLM prices`);
  }
  const raw = (await resp.json()) as Record<string, LiteLLMEntry>;

  // Group models by normalized provider key.
  // Inner map: normalizedModelId → ModelDefinitionConfig (deduped by completeness)
  const providerModels = new Map<string, Map<string, ModelDefinitionConfig>>();

  let skipped = 0;
  for (const [modelId, entry] of Object.entries(raw)) {
    // Skip the spec template
    if (modelId === "sample_spec") {
      skipped++;
      continue;
    }
    // Only chat models
    if (entry.mode !== "chat") {
      skipped++;
      continue;
    }
    // Must have some usable token capacity data
    const contextWindow = entry.max_input_tokens ?? entry.max_tokens;
    const maxTokens = entry.max_output_tokens ?? entry.max_tokens;
    if (!contextWindow || !maxTokens) {
      skipped++;
      continue;
    }

    const litellmProvider = entry.litellm_provider;
    if (!litellmProvider) {
      skipped++;
      continue;
    }

    // Skip providers that produce entries unusable in Openclaw
    if (SKIP_PROVIDERS.has(litellmProvider)) {
      skipped++;
      continue;
    }

    const normalizedId = normalizeModelId(litellmProvider, modelId);
    if (normalizedId === null) {
      skipped++;
      continue;
    }

    const providerKey = normalizeProviderKey(litellmProvider);

    // Apply provider filter if specified
    if (providerFilter && providerFilter.length > 0) {
      if (!providerFilter.includes(providerKey) && !providerFilter.includes(litellmProvider)) {
        continue;
      }
    }

    const model: ModelDefinitionConfig = {
      id: normalizedId,
      name: normalizedId,
      reasoning: entry.supports_reasoning === true,
      input: entry.supports_vision === true ? ["text", "image"] : ["text"],
      cost: {
        input: toPerMillion(entry.input_cost_per_token),
        output: toPerMillion(entry.output_cost_per_token),
        cacheRead: toPerMillion(entry.cache_read_input_token_cost),
        cacheWrite: toPerMillion(entry.cache_creation_input_token_cost),
      },
      contextWindow,
      maxTokens,
    };

    // Within-provider deduplication: if the same normalized ID exists from
    // multiple LiteLLM entries (e.g., bedrock + bedrock_converse for the same
    // model), keep whichever has a higher completeness score.
    const providerMap = providerModels.get(providerKey) ?? new Map<string, ModelDefinitionConfig>();
    const existing = providerMap.get(normalizedId);
    if (!existing || completenessScore(model) > completenessScore(existing)) {
      providerMap.set(normalizedId, model);
    }
    providerModels.set(providerKey, providerMap);
  }

  // Build providers map, sorted by provider key
  const providers: Record<string, ModelProviderConfig> = {};
  const sortedProviderKeys = [...providerModels.keys()].toSorted((a, b) => a.localeCompare(b));

  let totalModels = 0;
  for (const providerKey of sortedProviderKeys) {
    const modelsMap = providerModels.get(providerKey)!;
    const models = [...modelsMap.values()].toSorted((a, b) => a.id.localeCompare(b.id));
    totalModels += models.length;

    const info = PROVIDER_INFO[providerKey] ?? {
      api: "openai-completions" as ModelApi,
      // Unknown provider — baseUrl must be set manually before use.
      // Use a non-empty sentinel so the reference file is structurally valid;
      // --write skips providers whose baseUrl is still this sentinel.
      baseUrl: `https://${providerKey}.example.com`,
    };

    providers[providerKey] = {
      baseUrl: info.baseUrl,
      api: info.api,
      models,
    };
  }

  const output: ModelsConfigOutput = {
    _generated: {
      source: LITELLM_PRICES_URL,
      generatedAt: new Date().toISOString(),
      modelCount: totalModels,
      providerCount: sortedProviderKeys.length,
    },
    mode: "merge",
    providers,
  };

  const outputJson = `${JSON.stringify(output, null, 2)}\n`;

  if (dryRun) {
    process.stdout.write(outputJson);
    console.error(
      `\n[dry-run] ${totalModels} models across ${sortedProviderKeys.length} providers (${skipped} entries skipped)`,
    );
    return;
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "litellm-models.json");
  fs.writeFileSync(outputPath, outputJson);
  log(`Wrote ${outputPath}`);

  // --litellm-proxy: single "litellm" provider with deduplicated models at localhost:4000.
  //
  // Cross-provider deduplication: when the same model ID appears in multiple providers
  // (after normalization), we keep only the entry from the highest-priority canonical
  // provider (model creator > resellers). This produces a clean list for proxy routing.
  if (emitLitellmProxy) {
    // Build a deduped map: normalizedId → best (providerPriority, model)
    const proxyDeduped = new Map<string, { priority: number; model: ModelDefinitionConfig }>();

    for (const [providerKey, modelsMap] of providerModels) {
      const priority = canonicalProviderPriority(providerKey);
      for (const [modelId, model] of modelsMap) {
        const existing = proxyDeduped.get(modelId);
        if (!existing || priority < existing.priority) {
          proxyDeduped.set(modelId, { priority, model });
        }
      }
    }

    const proxyModels = [...proxyDeduped.values()]
      .map(({ model }) => model)
      .toSorted((a, b) => a.id.localeCompare(b.id));

    const proxyOutput = {
      _generated: {
        source: LITELLM_PRICES_URL,
        generatedAt: output._generated.generatedAt,
        modelCount: proxyModels.length,
        note: "All models routed through a single LiteLLM proxy at localhost:4000. Cross-provider duplicates resolved by canonical provider priority.",
      },
      mode: "merge" as const,
      providers: {
        litellm: {
          baseUrl: "http://localhost:4000",
          api: "openai-completions" as ModelApi,
          models: proxyModels,
        },
      },
    };

    const proxyPath = path.join(outputDir, "litellm-proxy-models.json");
    fs.writeFileSync(proxyPath, `${JSON.stringify(proxyOutput, null, 2)}\n`);
    log(`Wrote ${proxyPath} (${proxyModels.length} deduplicated models)`);
  }

  // --write: merge the generated providers into ~/.openclaw/config.json under models.providers.
  //
  // IMPORTANT: cost calculation (for the Usage dashboard) reads from config.json via loadConfig(),
  // NOT from {agentDir}/models.json. models.json is used only by the Pi SDK's ModelRegistry for
  // model discovery. To make cost tracking accurate, providers must live in config.json.
  if (writeDirect) {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    // Respect OPENCLAW_CONFIG_PATH / OPENCLAW_STATE_DIR env overrides if set
    const stateDir = process.env.OPENCLAW_STATE_DIR?.trim() ?? path.join(home, ".openclaw");
    const configPath =
      process.env.OPENCLAW_CONFIG_PATH?.trim() ?? path.join(stateDir, "config.json");

    let existing: Record<string, unknown> = {};
    try {
      // config.json is JSON5 — parse with JSON5 to preserve compatibility, but we write back
      // as standard JSON (valid JSON5). Comments will be lost; warn the user.
      const raw = fs.readFileSync(configPath, "utf8");
      // Simple heuristic: if the file has // or /* comments, warn before overwriting.
      if (/\/\/|\/\*/.test(raw)) {
        console.warn(
          `Warning: ${configPath} appears to contain comments. They will be lost when --write merges the providers section. Consider manually editing the file instead.`,
        );
      }
      // JSON5 is a superset of JSON, but Node's JSON.parse handles standard JSON5 files
      // that only use unquoted keys or trailing commas. Use a best-effort parse:
      existing = JSON.parse(raw.replace(/\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1")) as Record<
        string,
        unknown
      >;
    } catch {
      // config doesn't exist yet — start fresh
    }

    const existingModels = (existing.models as Record<string, unknown> | undefined) ?? {};
    const existingProviders =
      (existingModels.providers as Record<string, unknown> | undefined) ?? {};

    // Filter out providers with placeholder baseUrls (.example.com) — these are unknown
    // providers that need manual URL configuration before they can be used.
    const skippedUnknown: string[] = [];
    const writableProviders: Record<string, ModelProviderConfig> = {};
    for (const [key, providerCfg] of Object.entries(providers)) {
      if (providerCfg.baseUrl.includes(".example.com")) {
        skippedUnknown.push(key);
      } else {
        writableProviders[key] = providerCfg;
      }
    }
    if (skippedUnknown.length > 0) {
      console.warn(
        `Skipping ${skippedUnknown.length} unknown providers (no known baseUrl): ${skippedUnknown.join(", ")}`,
      );
      console.warn(`Add these to config.json manually with the correct baseUrl if needed.`);
    }

    // New providers override existing ones with the same key, preserving any custom entries
    const mergedProviders = { ...existingProviders, ...writableProviders };
    const merged = {
      ...existing,
      models: {
        ...existingModels,
        providers: mergedProviders,
      },
    };

    fs.mkdirSync(path.dirname(configPath), { recursive: true });
    fs.writeFileSync(configPath, `${JSON.stringify(merged, null, 2)}\n`);
    log(`Updated ${configPath} (models.providers merged)`);
    log(
      `Note: Restart openclaw (gateway) for cost changes to take effect (config cache is per-process).`,
    );
  }

  log(
    `Done: ${totalModels} models across ${sortedProviderKeys.length} providers (${skipped} entries skipped)`,
  );
  log(`Providers: ${sortedProviderKeys.join(", ")}`);
}

main().catch((err: unknown) => {
  console.error("Error:", err);
  process.exit(1);
});
