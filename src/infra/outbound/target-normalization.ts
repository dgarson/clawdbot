import { getChannelPlugin, normalizeChannelId } from "../../channels/plugins/index.js";
import type { ChannelId } from "../../channels/plugins/types.js";

/**
 * Normalizes raw channel target input by trimming surrounding whitespace.
 */
export function normalizeChannelTargetInput(raw: string): string {
  return raw.trim();
}

/**
 * Normalizes a target identifier for a specific provider channel.
 *
 * Behavior:
 * - Returns `undefined` for empty or missing input.
 * - Uses the provider's `normalizeTarget` function if available.
 * - Falls back to simple whitespace trimming when no normalizer is defined.
 */
export function normalizeTargetForProvider(provider: string, raw?: string): string | undefined {
  if (!raw) {
    return undefined;
  }

  const providerId = normalizeChannelId(provider);
  const plugin = providerId ? getChannelPlugin(providerId) : undefined;
  const normalizer = plugin?.messaging?.normalizeTarget;

  // Use plugin normalizer if available, otherwise fall back to trim
  const normalized = normalizer?.(raw) ?? raw.trim();

  // Convert empty strings to undefined for consistent "no value" semantics
  return normalized || undefined;
}

/**
 * Builds a stable signature string for a channel's target resolver configuration.
 * The signature changes when resolver hints or pattern-matchers change.
 */
export function buildTargetResolverSignature(channel: ChannelId): string {
  const plugin = getChannelPlugin(channel);
  const resolver = plugin?.messaging?.targetResolver;

  const hint = resolver?.hint ?? "";
  const looksLikeSource = resolver?.looksLikeId?.toString() ?? "";

  return computeHash(`${hint}|${looksLikeSource}`);
}

/**
 * Computes a simple DJB2 hash for signature generation.
 * Uses XOR variant for better avalanche properties.
 */
function computeHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}
