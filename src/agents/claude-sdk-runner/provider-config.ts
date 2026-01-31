/**
 * Claude SDK provider configuration.
 *
 * Resolves provider-specific environment variables for non-Anthropic providers.
 * The Claude Agent SDK uses ANTHROPIC_BASE_URL and ANTHROPIC_API_KEY env vars
 * for custom endpoint routing, plus ANTHROPIC_DEFAULT_*_MODEL for model names.
 */

import type { OpenClawConfig } from "../../config/config.js";
import { resolveApiKeyForProvider as resolveApiKey } from "../model-auth.js";
import type { ClaudeSdkOptions } from "./session.js";
import { log } from "./logger.js";

/** Supported Claude SDK provider types. */
export type ClaudeSdkProvider = "anthropic" | "zai" | "openrouter" | "kimi";

/** Provider configuration (base URL). */
type ProviderConfig = {
  baseUrl: string;
  envVar: string;
};

/** Provider configurations for non-Anthropic providers. */
const PROVIDER_CONFIGS: Record<Exclude<ClaudeSdkProvider, "anthropic">, ProviderConfig> = {
  zai: {
    baseUrl: "https://api.z.ai/v1",
    envVar: "ZAI_API_KEY",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    envVar: "OPENROUTER_API_KEY",
  },
  kimi: {
    baseUrl: "https://api.moonshot.cn/v1",
    envVar: "KIMI_API_KEY",
  },
};

/** Default timeout for SDK requests (50 minutes). */
const DEFAULT_SDK_TIMEOUT_MS = 3000000;

/**
 * Providers that expect bare model names (no provider prefix).
 * - Anthropic: expects "claude-sonnet-4" not "anthropic/claude-sonnet-4"
 * - z.AI: expects "glm-4.7" not "zai/glm-4.7"
 *
 * OpenRouter and Kimi require the full provider/model path.
 */
const STRIP_PREFIX_PROVIDERS: Set<ClaudeSdkProvider> = new Set(["anthropic", "zai"]);

/**
 * Normalize model name for the target provider.
 *
 * - For Anthropic/z.AI: strip provider prefix ("anthropic/claude-sonnet-4" -> "claude-sonnet-4")
 * - For OpenRouter/Kimi: keep full path ("anthropic/claude-sonnet-4" stays as-is)
 */
function normalizeModelName(modelName: string, provider: ClaudeSdkProvider): string {
  if (STRIP_PREFIX_PROVIDERS.has(provider)) {
    return modelName.replace(/^[^/]+\//, "");
  }
  return modelName;
}

/**
 * Resolve environment variables for Claude SDK provider configuration.
 *
 * For non-Anthropic providers, returns env vars that override the SDK's
 * default Anthropic endpoint:
 * - ANTHROPIC_BASE_URL: Provider's API endpoint
 * - ANTHROPIC_API_KEY: Provider's API key
 * - ANTHROPIC_API_TIMEOUT: Request timeout
 *
 * For Anthropic provider, returns undefined (SDK uses internal auth).
 */
export async function resolveClaudeSdkProviderEnv(params: {
  provider: ClaudeSdkProvider;
  cfg?: OpenClawConfig;
  agentDir?: string;
}): Promise<Record<string, string> | undefined> {
  const { provider, cfg, agentDir } = params;

  // For Anthropic provider, try to resolve an API key
  // The SDK's "internal auth" only works in Claude Code CLI context
  // When running as a gateway, we need explicit API key auth
  if (provider === "anthropic") {
    let apiKey: string | undefined;
    try {
      const resolved = await resolveApiKey({
        provider: "anthropic",
        cfg,
        agentDir,
      });
      apiKey = resolved.apiKey;
      if (apiKey) {
        log.debug(
          `resolveClaudeSdkProviderEnv: resolved Anthropic API key from "${resolved.source}"`,
        );
      }
    } catch (err) {
      log.debug(`resolveClaudeSdkProviderEnv: no Anthropic API key available: ${String(err)}`);
    }

    if (apiKey) {
      // Use explicit API key auth
      return {
        ANTHROPIC_API_KEY: apiKey,
        ANTHROPIC_API_TIMEOUT: String(DEFAULT_SDK_TIMEOUT_MS),
      };
    }

    // No API key - fall back to SDK internal auth (only works in Claude Code CLI context)
    log.debug(
      "resolveClaudeSdkProviderEnv: no API key, using SDK internal auth for anthropic provider",
    );
    return undefined;
  }

  const config = PROVIDER_CONFIGS[provider];
  if (!config) {
    log.warn(`resolveClaudeSdkProviderEnv: unknown provider "${provider}", using SDK defaults`);
    return undefined;
  }

  // Resolve API key using existing auth infrastructure
  let apiKey: string | undefined;
  try {
    const resolved = await resolveApiKey({
      provider,
      cfg,
      agentDir,
    });
    apiKey = resolved.apiKey;
    log.debug(
      `resolveClaudeSdkProviderEnv: resolved API key for "${provider}" from "${resolved.source}"`,
    );
  } catch (err) {
    log.warn(
      `resolveClaudeSdkProviderEnv: failed to resolve API key for "${provider}": ${String(err)}`,
    );
    // Fall through - let SDK handle missing key
  }

  if (!apiKey) {
    log.warn(
      `resolveClaudeSdkProviderEnv: no API key found for "${provider}", SDK may fail to authenticate`,
    );
    // Return base URL only, SDK will error on missing key
    return {
      ANTHROPIC_BASE_URL: config.baseUrl,
      ANTHROPIC_API_TIMEOUT: String(DEFAULT_SDK_TIMEOUT_MS),
    };
  }

  return {
    ANTHROPIC_BASE_URL: config.baseUrl,
    ANTHROPIC_API_KEY: apiKey,
    ANTHROPIC_API_TIMEOUT: String(DEFAULT_SDK_TIMEOUT_MS),
  };
}

/**
 * Check if a provider is a valid Claude SDK provider.
 */
export function isValidClaudeSdkProvider(provider: string): provider is ClaudeSdkProvider {
  return provider === "anthropic" || provider in PROVIDER_CONFIGS;
}

/**
 * Resolve model name environment variables for custom SDK model mappings.
 *
 * The SDK uses these env vars to override default model names per tier:
 * - ANTHROPIC_DEFAULT_HAIKU_MODEL
 * - ANTHROPIC_DEFAULT_SONNET_MODEL
 * - ANTHROPIC_DEFAULT_OPUS_MODEL
 *
 * This is required when using non-Anthropic providers or OpenRouter where
 * the actual model names differ from Claude model names.
 *
 * Model name format depends on provider:
 * - Anthropic/z.AI: bare model name ("claude-sonnet-4", "glm-4.7")
 * - OpenRouter/Kimi: full path with provider prefix ("anthropic/claude-sonnet-4")
 */
export function resolveModelNameEnvVars(
  provider: ClaudeSdkProvider,
  claudeSdkOptions?: ClaudeSdkOptions,
): Record<string, string> | undefined {
  const models = claudeSdkOptions?.models;
  if (!models) {
    return undefined;
  }

  const env: Record<string, string> = {};

  if (models.haiku) {
    env.ANTHROPIC_DEFAULT_HAIKU_MODEL = normalizeModelName(models.haiku, provider);
  }
  if (models.sonnet) {
    env.ANTHROPIC_DEFAULT_SONNET_MODEL = normalizeModelName(models.sonnet, provider);
  }
  if (models.opus) {
    env.ANTHROPIC_DEFAULT_OPUS_MODEL = normalizeModelName(models.opus, provider);
  }

  // Return undefined if no models were set
  return Object.keys(env).length > 0 ? env : undefined;
}

/**
 * Resolve all environment variable overrides for Claude SDK.
 *
 * Combines provider config (base URL, API key) with model name mappings.
 *
 * For Anthropic provider using internal auth (no explicit API key):
 * - Returns undefined so SDK inherits full process.env
 * - This allows SDK to use Claude Code subscription auth via inherited env
 */
export async function resolveAllClaudeSdkEnv(params: {
  provider: ClaudeSdkProvider;
  cfg?: OpenClawConfig;
  agentDir?: string;
  claudeSdkOptions?: ClaudeSdkOptions;
}): Promise<Record<string, string> | undefined> {
  const { provider, cfg, agentDir, claudeSdkOptions } = params;

  // Get provider-specific env vars (base URL, API key)
  const providerEnv = await resolveClaudeSdkProviderEnv({ provider, cfg, agentDir });

  // For Anthropic using internal auth (no API key resolved), return undefined
  // so the SDK inherits full process.env and can use subscription auth
  if (provider === "anthropic" && !providerEnv) {
    log.debug("resolveAllClaudeSdkEnv: anthropic internal auth - passing through process.env");
    return undefined;
  }

  // Get model name env vars (format depends on provider)
  const modelEnv = resolveModelNameEnvVars(provider, claudeSdkOptions);

  // Combine if any are present
  if (!providerEnv && !modelEnv) {
    return undefined;
  }

  return {
    ...providerEnv,
    ...modelEnv,
  };
}
