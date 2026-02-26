import type { ClaudeSdkConfig } from "../../config/zod-schema.agent-runtime.js";
import type { ResolvedProviderAuth } from "../model-auth.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KnownProviderConfig = {
  baseUrl: string;
  haikuModel: string;
  sonnetModel: string;
  opusModel: string;
  requiresExplicitEmptyApiKey?: boolean;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip undefined values from process.env so the spread is type-safe. */
function parentEnv(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}

const PROVIDER_TIMEOUT_MS = "3000000";
const DEFAULT_HAIKU_MODEL_ENV = "ANTHROPIC_DEFAULT_HAIKU_MODEL";
const DEFAULT_SONNET_MODEL_ENV = "ANTHROPIC_DEFAULT_SONNET_MODEL";
const DEFAULT_OPUS_MODEL_ENV = "ANTHROPIC_DEFAULT_OPUS_MODEL";
const CLAUDE_CODE_TRAFFIC_GUARDRAILS = {
  CLAUDE_CODE_ENABLE_TELEMETRY: "0",
  DISABLE_TELEMETRY: "1",
  DISABLE_BUG_COMMAND: "1",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
} as const;

function resolveEnvOverride(env: Record<string, string>, key: string, fallback: string): string {
  const value = env[key]?.trim();
  return value ? value : fallback;
}

function scrubInheritedAnthropicEnv(env: Record<string, string>): void {
  // Credential + endpoint vars that must never leak across providers.
  delete env["ANTHROPIC_API_KEY"];
  delete env["ANTHROPIC_AUTH_TOKEN"];
  delete env["ANTHROPIC_OAUTH_TOKEN"];
  delete env["ANTHROPIC_BASE_URL"];
  // Legacy Claude env vars replaced by API_TIMEOUT_MS + ANTHROPIC_DEFAULT_*.
  delete env["ANTHROPIC_TIMEOUT"];
  delete env["ANTHROPIC_HAIKU_MODEL"];
  delete env["ANTHROPIC_SONNET_MODEL"];
  delete env["ANTHROPIC_OPUS_MODEL"];
  delete env["ANTHROPIC_DEFAULT_MODEL"];
}

function applyClaudeCodeTrafficGuardrails(env: Record<string, string>): void {
  Object.assign(env, CLAUDE_CODE_TRAFFIC_GUARDRAILS);
}

// ---------------------------------------------------------------------------
// Hardcoded provider configs — URLs and model names live here ONLY
// ---------------------------------------------------------------------------

const KNOWN_PROVIDER_CONFIGS: Partial<Record<string, KnownProviderConfig>> = {
  minimax: {
    baseUrl: "https://api.minimax.io/anthropic",
    haikuModel: "MiniMax-M2.5",
    sonnetModel: "MiniMax-M2.5",
    opusModel: "MiniMax-M2.5",
  },
  "minimax-portal": {
    baseUrl: "https://api.minimax.io/anthropic",
    haikuModel: "MiniMax-M2.5",
    sonnetModel: "MiniMax-M2.5",
    opusModel: "MiniMax-M2.5",
  },
  zai: {
    baseUrl: "https://api.z.ai/api/anthropic",
    haikuModel: "GLM-4.7-Air",
    sonnetModel: "GLM-4.7",
    opusModel: "GLM-5",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api",
    haikuModel: "anthropic/claude-haiku-4-5-20251001",
    sonnetModel: "anthropic/claude-sonnet-4-6",
    opusModel: "anthropic/claude-opus-4-6",
    requiresExplicitEmptyApiKey: true,
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the env record to pass to query() options.env.
 *
 * Returns an env record for "claude-sdk" — strips leaked keys, no URL override;
 * the subprocess inherits process.env unchanged (system-inherited auth).
 *
 * For "anthropic", returns an env record only when auth resolution provided a key.
 *
 * For all other providers, returns a full env record with ANTHROPIC_* vars
 * set for the target provider's endpoint, credentials, timeout, and model aliases.
 */
export function buildProviderEnv(
  config: ClaudeSdkConfig,
  resolvedProviderAuth?: ResolvedProviderAuth,
): Record<string, string> | undefined {
  const { provider } = config;
  const resolvedApiKey = resolvedProviderAuth?.apiKey?.trim();

  if (provider === "claude-sdk") {
    // The subprocess uses the Claude CLI's own OAuth credentials from ~/.claude/.
    // Strip ANTHROPIC_API_KEY so that a key injected by the PI auth resolver
    // (e.g. a fallback provider's key) does not leak into the subprocess and
    // cause 401s. ANTHROPIC_AUTH_TOKEN is stripped for the same reason.
    const env = parentEnv();
    delete env["ANTHROPIC_API_KEY"];
    delete env["ANTHROPIC_AUTH_TOKEN"];
    delete env["ANTHROPIC_OAUTH_TOKEN"];
    applyClaudeCodeTrafficGuardrails(env);
    return env;
  }

  if (provider === "anthropic") {
    // Inject auth-resolved key into subprocess env if available.
    // Leave URL/timeout unchanged (native Anthropic endpoint).
    if (!resolvedApiKey) {
      return undefined;
    }
    const env: Record<string, string> = { ...parentEnv(), ANTHROPIC_API_KEY: resolvedApiKey };
    // Strip ANTHROPIC_AUTH_TOKEN to avoid conflicts when providing the key explicitly.
    delete env["ANTHROPIC_AUTH_TOKEN"];
    delete env["ANTHROPIC_OAUTH_TOKEN"];
    // Strip to prevent a process-level proxy URL routing native Anthropic traffic incorrectly.
    delete env["ANTHROPIC_BASE_URL"];
    delete env["API_TIMEOUT_MS"];
    applyClaudeCodeTrafficGuardrails(env);
    return env;
  }

  if (provider === "custom") {
    if (!resolvedApiKey) {
      throw new Error(
        "[claude-sdk] custom provider requires API credentials from claudeSdk.authProfileId",
      );
    }
    const authHeaderName = config.authHeaderName?.trim() || "ANTHROPIC_AUTH_TOKEN";
    const inherited = parentEnv();
    // Scrub inherited Anthropic credentials so they do not leak to a third-party endpoint.
    scrubInheritedAnthropicEnv(inherited);
    const env: Record<string, string> = {
      ...inherited,
      ANTHROPIC_BASE_URL: config.baseUrl,
      API_TIMEOUT_MS: PROVIDER_TIMEOUT_MS,
      [DEFAULT_HAIKU_MODEL_ENV]: config.anthropicDefaultHaikuModel,
      [DEFAULT_SONNET_MODEL_ENV]: config.anthropicDefaultSonnetModel,
      [DEFAULT_OPUS_MODEL_ENV]: config.anthropicDefaultOpusModel,
      ANTHROPIC_MODEL: config.anthropicDefaultSonnetModel,
      ANTHROPIC_SMALL_FAST_MODEL: config.anthropicDefaultHaikuModel,
    };
    env[authHeaderName] = resolvedApiKey;
    applyClaudeCodeTrafficGuardrails(env);
    return env;
  }

  const providerConfig = KNOWN_PROVIDER_CONFIGS[provider];
  if (!providerConfig) {
    throw new Error(`[claude-sdk] Unknown provider: ${provider}`);
  }

  const inherited = parentEnv();
  // Scrub inherited Anthropic credentials so they do not leak to a third-party endpoint.
  scrubInheritedAnthropicEnv(inherited);
  const haikuModel = resolveEnvOverride(
    inherited,
    DEFAULT_HAIKU_MODEL_ENV,
    providerConfig.haikuModel,
  );
  const sonnetModel = resolveEnvOverride(
    inherited,
    DEFAULT_SONNET_MODEL_ENV,
    providerConfig.sonnetModel,
  );
  const opusModel = resolveEnvOverride(inherited, DEFAULT_OPUS_MODEL_ENV, providerConfig.opusModel);
  const env: Record<string, string> = {
    ...inherited,
    ANTHROPIC_BASE_URL: providerConfig.baseUrl,
    API_TIMEOUT_MS: PROVIDER_TIMEOUT_MS,
    ANTHROPIC_MODEL: resolveEnvOverride(inherited, "ANTHROPIC_MODEL", sonnetModel),
    ANTHROPIC_SMALL_FAST_MODEL: resolveEnvOverride(
      inherited,
      "ANTHROPIC_SMALL_FAST_MODEL",
      haikuModel,
    ),
    [DEFAULT_HAIKU_MODEL_ENV]: haikuModel,
    [DEFAULT_SONNET_MODEL_ENV]: sonnetModel,
    [DEFAULT_OPUS_MODEL_ENV]: opusModel,
  };
  if (resolvedApiKey) {
    env["ANTHROPIC_AUTH_TOKEN"] = resolvedApiKey;
  }
  if (providerConfig.requiresExplicitEmptyApiKey) {
    env["ANTHROPIC_API_KEY"] = "";
  }
  applyClaudeCodeTrafficGuardrails(env);
  return env;
}
