/**
 * Debugging configuration types.
 *
 * Provides support for channel filtering, channel-specific properties, and feature flags
 * for short-term debugging and testing.
 */

/**
 * Debugging configuration.
 */
export type DebuggingConfig = {
  /** Channels enabled for debugging (presence of key = enabled; value = channel-specific properties). */
  channels?: Record<string, Record<string, unknown>>;
  /** Optional list of feature IDs for debugging (arbitrary strings for short-term testing). */
  features?: string[];
};

/**
 * Check if a channel is enabled for debugging.
 */
export function isDebuggingEnabled(
  config: DebuggingConfig | undefined,
  channelId: string,
): boolean {
  return !!config?.channels?.[channelId];
}

/**
 * Check if a feature is enabled for debugging.
 */
export function isFeatureEnabled(config: DebuggingConfig | undefined, featureId: string): boolean {
  return config?.features?.includes(featureId) ?? false;
}
