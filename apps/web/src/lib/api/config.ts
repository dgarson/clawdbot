/**
 * Configuration API functions for interacting with the Clawdbrain gateway.
 *
 * These functions provide a typed interface for:
 * - Reading/writing gateway configuration
 * - Managing model provider API keys
 * - Channel configuration
 * - Agent configuration
 */

import { getGatewayClient } from "./gateway-client";
import type {
  ConfigSnapshot,
  ConfigPatchParams,
  ConfigPatchResponse,
  ChannelStatusResponse,
  WebLoginStartResponse,
  WebLoginWaitResponse,
  ModelsListResponse,
  AgentsListResponse,
  HealthResponse,
  StatusResponse,
  ClawdbrainConfig,
  ModelProviderId,
  ProviderVerifyResponse,
} from "./types";

// Configuration APIs

/**
 * Get the current gateway configuration
 */
export async function getConfig(): Promise<ConfigSnapshot> {
  const client = getGatewayClient();
  return client.request<ConfigSnapshot>("config.get", {});
}

// Schema caching for performance
const SCHEMA_CACHE_KEY = "clawdbrain:config-schema";

type CachedSchema = {
  schema: unknown;
  uiHints: Record<string, unknown>;
  version: string;
  generatedAt: string;
  cachedAt: number;
};

/**
 * Load cached schema from localStorage
 */
function loadCachedSchema(): CachedSchema | null {
  try {
    const raw = localStorage.getItem(SCHEMA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSchema;
    if (!parsed.version || !parsed.schema) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save schema to localStorage
 */
function saveCachedSchema(cache: CachedSchema) {
  try {
    localStorage.setItem(SCHEMA_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage might be unavailable or full
  }
}

/**
 * Clear the schema cache
 */
export function clearConfigSchemaCache() {
  try {
    localStorage.removeItem(SCHEMA_CACHE_KEY);
  } catch {
    // ignore
  }
}

type ConfigSchemaResponse = {
  schema: unknown;
  uiHints?: Record<string, unknown>;
  version: string;
  generatedAt: string;
  notModified?: boolean;
};

/**
 * Get the configuration schema (for form building).
 *
 * Uses caching to avoid re-fetching the large schema on every load:
 * 1. First, returns cached schema from localStorage if available
 * 2. Then, checks with server using ifNoneMatch for 304-style caching
 * 3. Only fetches full schema when version changes
 *
 * @param options.forceRefresh - Bypass cache and fetch fresh schema
 * @param options.section - Only fetch schema for a specific section (e.g., "agents", "channels")
 */
export async function getConfigSchema(options?: {
  forceRefresh?: boolean;
  section?: string;
}): Promise<ConfigSchemaResponse> {
  const client = getGatewayClient();

  // Try to load from cache first
  const cached = !options?.forceRefresh ? loadCachedSchema() : null;

  // Build request params
  const params: { ifNoneMatch?: string; section?: string; full?: boolean } = {};

  // Use ifNoneMatch for 304-style caching
  if (cached?.version && !options?.forceRefresh) {
    params.ifNoneMatch = cached.version;
  }

  // Support section filtering
  if (options?.section) {
    params.section = options.section;
  } else {
    params.full = true;
  }

  const response = await client.request<ConfigSchemaResponse>("config.schema", params);

  // Handle 304-style "not modified" response
  if (response.notModified && cached) {
    return {
      schema: cached.schema,
      uiHints: cached.uiHints,
      version: cached.version,
      generatedAt: cached.generatedAt,
    };
  }

  // Cache the new schema (only if full schema, not section)
  if (!options?.section && response.schema) {
    saveCachedSchema({
      schema: response.schema,
      uiHints: response.uiHints ?? {},
      version: response.version,
      generatedAt: response.generatedAt,
      cachedAt: Date.now(),
    });
  }

  return response;
}

/**
 * Apply a patch to the configuration
 */
export async function patchConfig(params: ConfigPatchParams): Promise<ConfigPatchResponse> {
  const client = getGatewayClient();
  return client.request<ConfigPatchResponse>("config.patch", params);
}

/**
 * Replace the entire configuration
 */
export async function applyConfig(
  baseHash: string,
  config: ClawdbrainConfig,
  options?: { sessionKey?: string; note?: string; restartDelayMs?: number }
): Promise<ConfigPatchResponse> {
  const client = getGatewayClient();
  return client.request<ConfigPatchResponse>("config.apply", {
    baseHash,
    raw: JSON.stringify(config, null, 2),
    ...options,
  });
}

// Channel APIs

/**
 * Get status of all channels
 */
export async function getChannelsStatus(options?: {
  probe?: boolean;
  timeoutMs?: number;
}): Promise<ChannelStatusResponse> {
  const client = getGatewayClient();
  return client.request<ChannelStatusResponse>("channels.status", {
    probe: options?.probe ?? false,
    timeoutMs: options?.timeoutMs ?? 10000,
  });
}

/**
 * Logout from a specific channel
 */
export async function logoutChannel(
  channel: string,
  accountId?: string
): Promise<{ channel: string; accountId: string; cleared: boolean }> {
  const client = getGatewayClient();
  return client.request("channels.logout", { channel, accountId });
}

/**
 * Start WhatsApp web login and return QR data.
 */
export async function startWebLogin(options?: {
  force?: boolean;
  timeoutMs?: number;
}): Promise<WebLoginStartResponse> {
  const client = getGatewayClient();
  return client.request<WebLoginStartResponse>("web.login.start", {
    force: options?.force ?? false,
    timeoutMs: options?.timeoutMs ?? 30000,
  });
}

/**
 * Wait for WhatsApp web login to complete.
 */
export async function waitWebLogin(options?: {
  timeoutMs?: number;
}): Promise<WebLoginWaitResponse> {
  const client = getGatewayClient();
  return client.request<WebLoginWaitResponse>("web.login.wait", {
    timeoutMs: options?.timeoutMs ?? 120000,
  });
}

// Models APIs

/**
 * List available models
 */
export async function listModels(): Promise<ModelsListResponse> {
  const client = getGatewayClient();
  return client.request<ModelsListResponse>("models.list", {});
}

// Agents APIs

/**
 * List configured agents
 */
export async function listAgents(): Promise<AgentsListResponse> {
  const client = getGatewayClient();
  return client.request<AgentsListResponse>("agents.list", {});
}

// Health/Status APIs

/**
 * Get gateway health status
 */
export async function getHealth(probe?: boolean): Promise<HealthResponse> {
  const client = getGatewayClient();
  return client.request<HealthResponse>("health", { probe });
}

/**
 * Get overall system status
 */
export async function getStatus(): Promise<StatusResponse> {
  const client = getGatewayClient();
  return client.request<StatusResponse>("status", {});
}

// Provider API Key Management

/**
 * Verify a model provider API key by making a test request.
 * This is done client-side to avoid storing keys before validation.
 */
export async function verifyProviderApiKey(
  provider: ModelProviderId,
  apiKey: string
): Promise<ProviderVerifyResponse> {
  // Provider-specific verification endpoints
  const verifyEndpoints: Record<ModelProviderId, { url: string; headers: (key: string) => HeadersInit }> = {
    anthropic: {
      url: "https://api.anthropic.com/v1/models",
      headers: (key) => ({
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      }),
    },
    openai: {
      url: "https://api.openai.com/v1/models",
      headers: (key) => ({
        Authorization: `Bearer ${key}`,
      }),
    },
    google: {
      url: `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`,
      headers: () => ({}),
    },
    zai: {
      url: "https://api.x.ai/v1/models",
      headers: (key) => ({
        Authorization: `Bearer ${key}`,
      }),
    },
    openrouter: {
      url: "https://openrouter.ai/api/v1/models",
      headers: (key) => ({
        Authorization: `Bearer ${key}`,
      }),
    },
  };

  const endpoint = verifyEndpoints[provider];
  if (!endpoint) {
    return { ok: false, provider, error: `Unknown provider: ${provider}` };
  }

  try {
    const response = await fetch(endpoint.url, {
      method: "GET",
      headers: endpoint.headers(apiKey),
    });

    if (response.ok) {
      const data = await response.json();
      const models = extractModelIds(provider, data);
      return { ok: true, provider, models };
    } else {
      const errorText = await response.text();
      let errorMessage = "Invalid API key";
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
      } catch {
        // Use default message
      }
      return { ok: false, provider, error: errorMessage };
    }
  } catch (error) {
    return {
      ok: false,
      provider,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Extract model IDs from provider response
 */
function extractModelIds(provider: ModelProviderId, data: unknown): string[] {
  if (!data || typeof data !== "object") {return [];}

  switch (provider) {
    case "anthropic":
    case "openai":
    case "zai":
    case "openrouter": {
      const models = (data as { data?: { id: string }[] }).data;
      if (Array.isArray(models)) {
        return models.map((m) => m.id).slice(0, 10);
      }
      return [];
    }
    case "google": {
      const models = (data as { models?: { name: string }[] }).models;
      if (Array.isArray(models)) {
        return models.map((m) => m.name.replace("models/", "")).slice(0, 10);
      }
      return [];
    }
    default:
      return [];
  }
}

/**
 * Save a model provider API key to the configuration
 */
export async function saveProviderApiKey(
  provider: ModelProviderId,
  apiKey: string,
  currentConfig: ConfigSnapshot
): Promise<ConfigPatchResponse> {
  if (!currentConfig.hash) {
    throw new Error("Config hash required for patching");
  }

  // Map provider to config key
  const providerConfigKeys: Record<ModelProviderId, string> = {
    anthropic: "anthropic",
    openai: "openai",
    google: "google",
    zai: "xai",
    openrouter: "openrouter",
  };

  const configKey = providerConfigKeys[provider];
  const patch: Partial<ClawdbrainConfig> = {
    auth: {
      ...currentConfig.config?.auth,
      [configKey]: { apiKey },
    },
  };

  return patchConfig({
    baseHash: currentConfig.hash,
    raw: JSON.stringify(patch),
    note: `Configure ${provider} API key`,
  });
}

/**
 * Remove a model provider API key from the configuration
 */
export async function removeProviderApiKey(
  provider: ModelProviderId,
  currentConfig: ConfigSnapshot
): Promise<ConfigPatchResponse> {
  if (!currentConfig.hash) {
    throw new Error("Config hash required for patching");
  }

  const providerConfigKeys: Record<ModelProviderId, string> = {
    anthropic: "anthropic",
    openai: "openai",
    google: "google",
    zai: "xai",
    openrouter: "openrouter",
  };

  const configKey = providerConfigKeys[provider];
  const newAuth = { ...currentConfig.config?.auth };
  delete newAuth[configKey];

  const patch: Partial<ClawdbrainConfig> = { auth: newAuth };

  return patchConfig({
    baseHash: currentConfig.hash,
    raw: JSON.stringify(patch),
    note: `Remove ${provider} API key`,
  });
}
