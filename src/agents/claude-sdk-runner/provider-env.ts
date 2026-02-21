import type { ClaudeSdkConfig } from "../../config/zod-schema.agent-runtime.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KnownProviderConfig = {
  baseUrl: string;
  haikuModel: string;
  sonnetModel: string;
  opusModel: string;
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

const PROVIDER_TIMEOUT_MS = 3_000_000;

// ---------------------------------------------------------------------------
// Hardcoded provider configs — URLs and model names live here ONLY
// ---------------------------------------------------------------------------

const KNOWN_PROVIDER_CONFIGS: Partial<Record<string, KnownProviderConfig>> = {
  minimax: {
    baseUrl: "https://api.minimaxi.chat/v1",
    haikuModel: "MiniMax-Text-01",
    sonnetModel: "MiniMax-Text-01",
    opusModel: "MiniMax-Text-01",
  },
  "minimax-portal": {
    baseUrl: "https://api.minimax.io/anthropic",
    haikuModel: "MiniMax-M2.5",
    sonnetModel: "MiniMax-M2.5",
    opusModel: "MiniMax-M2.5",
  },
  zai: {
    baseUrl: "https://api.z.ai/api/v1",
    haikuModel: "GLM-4.7",
    sonnetModel: "GLM-4.7",
    opusModel: "GLM-5",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    haikuModel: "anthropic/claude-haiku-4-5-20251001",
    sonnetModel: "anthropic/claude-sonnet-4-6",
    opusModel: "anthropic/claude-opus-4-6",
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the env record to pass to query() options.env.
 *
 * Returns undefined for "claude-code" — no env override;
 * the subprocess inherits process.env unchanged (system-inherited auth).
 *
 * For "anthropic", returns an env record only when a resolvedApiKey is provided.
 *
 * For all other providers, returns a full env record with ANTHROPIC_* vars
 * set for the target provider's endpoint, credentials, timeout, and models.
 */
export function buildProviderEnv(
  config: ClaudeSdkConfig,
  resolvedApiKey?: string,
): Record<string, string> | undefined {
  const { provider } = config;

  if (provider === "claude-code") {
    // The subprocess uses the Claude CLI's own OAuth credentials from ~/.claude/.
    // Strip ANTHROPIC_API_KEY so that a key injected by the PI auth resolver
    // (e.g. a fallback provider's key) does not leak into the subprocess and
    // cause 401s. ANTHROPIC_AUTH_TOKEN is stripped for the same reason.
    const env = parentEnv();
    delete env["ANTHROPIC_API_KEY"];
    delete env["ANTHROPIC_AUTH_TOKEN"];
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
    // Strip to prevent a process-level proxy URL routing native Anthropic traffic incorrectly.
    delete env["ANTHROPIC_BASE_URL"];
    return env;
  }

  if (provider === "custom") {
    // config.apiKey is the escape hatch for providers without an OpenClaw auth profile
    const apiKey = config.apiKey ?? resolvedApiKey;
    const inherited = parentEnv();
    // Scrub inherited Anthropic credentials so they do not leak to a third-party endpoint.
    delete inherited["ANTHROPIC_API_KEY"];
    delete inherited["ANTHROPIC_AUTH_TOKEN"];
    delete inherited["ANTHROPIC_BASE_URL"];
    const env: Record<string, string> = {
      ...inherited,
      ANTHROPIC_BASE_URL: config.baseUrl,
      ANTHROPIC_TIMEOUT: String(PROVIDER_TIMEOUT_MS),
    };
    if (apiKey) {
      env["ANTHROPIC_API_KEY"] = apiKey;
    }
    return env;
  }

  const providerConfig = KNOWN_PROVIDER_CONFIGS[provider];
  if (!providerConfig) {
    throw new Error(`[claude-sdk] Unknown provider: ${provider}`);
  }

  const inherited = parentEnv();
  // Scrub inherited Anthropic credentials so they do not leak to a third-party endpoint.
  delete inherited["ANTHROPIC_API_KEY"];
  delete inherited["ANTHROPIC_AUTH_TOKEN"];
  delete inherited["ANTHROPIC_BASE_URL"];
  const env: Record<string, string> = {
    ...inherited,
    ANTHROPIC_BASE_URL: providerConfig.baseUrl,
    ANTHROPIC_TIMEOUT: String(PROVIDER_TIMEOUT_MS),
    ANTHROPIC_HAIKU_MODEL: providerConfig.haikuModel,
    ANTHROPIC_SONNET_MODEL: providerConfig.sonnetModel,
    ANTHROPIC_DEFAULT_MODEL: providerConfig.sonnetModel,
    ANTHROPIC_OPUS_MODEL: providerConfig.opusModel,
  };
  if (resolvedApiKey) {
    env["ANTHROPIC_API_KEY"] = resolvedApiKey;
  }
  return env;
}
