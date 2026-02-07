/**
 * Debugging configuration types.
 *
 * Provides support for channel filtering, channel-specific properties, and feature flags
 * for short-term debugging and testing.
 */

/**
 * Properties bag for a debugging entry (channel or feature).
 *
 * Standard properties:
 * - `verbose: true` - Enable both debug and trace logs (shorthand for debug=true + trace=true)
 * - `debug: true` - Enable debug logs only
 * - `trace: true` - Enable trace logs only
 *
 * Custom properties are allowed for backward compatibility and channel/feature-specific flags.
 *
 * @example
 * ```json
 * {
 *   "debugging": {
 *     "channels": {
 *       "slack": { "verbose": true },
 *       "telegram": { "debug": true }
 *     },
 *     "features": {
 *       "compaction-hooks": { "verbose": true },
 *       "memory-recall": { "trace": true }
 *     }
 *   }
 * }
 * ```
 */
export type DebuggingProps = {
  /** Enable debug + trace logs (shorthand for debug=true + trace=true) */
  verbose?: boolean;
  /** Enable debug logs only */
  debug?: boolean;
  /** Enable trace logs only */
  trace?: boolean;
  /** Custom channel/feature-specific properties for backward compatibility */
  [key: string]: unknown;
};

/**
 * Debugging configuration.
 */
export type DebuggingConfig = {
  /** Channels enabled for debugging (presence of key = enabled; value = channel-specific properties). */
  channels?: Record<string, DebuggingProps>;
  /** Features enabled for debugging (presence of key = enabled; value = feature-specific properties). */
  features?: Record<string, DebuggingProps>;
};

/**
 * Check if a channel is enabled for debugging.
 * @deprecated Use {@link enabledForChannel} instead.
 */
export function isDebuggingEnabled(
  config: DebuggingConfig | undefined,
  channelId: string,
): boolean {
  return !!config?.channels?.[channelId];
}

/**
 * Check if a feature is enabled for debugging.
 * @deprecated Use {@link enabledForFeature} instead.
 */
export function isFeatureEnabled(config: DebuggingConfig | undefined, featureId: string): boolean {
  return !!config?.features?.[featureId];
}

/** Check if a channel is enabled for debugging. */
export function enabledForChannel(config: DebuggingConfig | undefined, channelId: string): boolean {
  return !!config?.channels?.[channelId];
}

/** Check if a feature is enabled for debugging. */
export function enabledForFeature(config: DebuggingConfig | undefined, featureId: string): boolean {
  return !!config?.features?.[featureId];
}

/**
 * Check if a specific boolean property is enabled on a debugging channel.
 * Returns true only when the channel is enabled AND the property is exactly `true`.
 */
export function isChannelPropertyEnabled(
  config: DebuggingConfig | undefined,
  channelId: string,
  property: string,
): boolean {
  return (
    isDebuggingEnabled(config, channelId) && config?.channels?.[channelId]?.[property] === true
  );
}
