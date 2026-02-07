/**
 * Centralized debug verbosity control system.
 *
 * This module consolidates all debug/trace logging decisions across the codebase.
 * It respects configuration from `debugging.channels` and `debugging.features`,
 * applies hierarchical subsystem matching, and supports standard properties
 * (verbose/debug/trace) alongside custom properties for backward compatibility.
 *
 * Priority order for verbosity decisions:
 * 1. Global verbose flag (isVerbose() → allow debug/trace)
 * 2. Suppression list (logging.suppressSubsystemDebugLogs → deny debug/trace)
 * 3. Channel config (debugging.channels[id].{verbose,debug,trace})
 * 4. Feature config (debugging.features[id].{verbose,debug,trace})
 * 5. Subsystem hierarchy walk-up (check parent subsystems)
 * 6. Context-level overrides (run-level verbosity from metadata)
 * 7. Default: deny debug/trace
 */

import type { DebuggingProps } from "../config/types.debugging.js";
import type { OpenClawConfig } from "../config/types.js";
import { isVerbose } from "../globals.js";

/**
 * Context extracted from log metadata that influences verbosity decisions.
 */
export type DebugContext = {
  /** Channel ID to check against debugging.channels */
  channel?: string;
  /** Feature name to check against debugging.features */
  feature?: string;
  /** Run ID for potential run-level verbosity overrides */
  runId?: string;
  /** Additional metadata for future extensibility */
  [key: string]: unknown;
};

/**
 * Extract debug context from log metadata.
 * Looks for standard fields: channel, feature, runId.
 */
export function getDebugContext(meta?: Record<string, unknown>): DebugContext {
  if (!meta) return {};

  return {
    channel: typeof meta.channel === "string" ? meta.channel : undefined,
    feature: typeof meta.feature === "string" ? meta.feature : undefined,
    runId: typeof meta.runId === "string" ? meta.runId : undefined,
  };
}

/**
 * Check if a subsystem should emit debug logs.
 *
 * @param subsystem - Subsystem name (e.g., "slack/send", "work-queue")
 * @param context - Optional context with channel/feature for additional checks
 * @param config - OpenClaw configuration (optional, loaded from getConfig() if not provided)
 * @returns true if debug logs should be emitted
 */
export function shouldLogDebug(
  subsystem: string,
  context?: DebugContext | Record<string, unknown>,
  config?: OpenClawConfig,
): boolean {
  return shouldLogAtLevel(subsystem, "debug", context, config);
}

/**
 * Check if a subsystem should emit trace logs.
 *
 * @param subsystem - Subsystem name (e.g., "slack/send", "work-queue")
 * @param context - Optional context with channel/feature for additional checks
 * @param config - OpenClaw configuration (optional, loaded from getConfig() if not provided)
 * @returns true if trace logs should be emitted
 */
export function shouldLogTrace(
  subsystem: string,
  context?: DebugContext | Record<string, unknown>,
  config?: OpenClawConfig,
): boolean {
  return shouldLogAtLevel(subsystem, "trace", context, config);
}

/**
 * Core verbosity decision logic.
 */
function shouldLogAtLevel(
  subsystem: string,
  level: "debug" | "trace",
  context?: DebugContext | Record<string, unknown>,
  config?: OpenClawConfig,
): boolean {
  // Priority 1: Global verbose flag
  if (isVerbose()) {
    return true;
  }

  // Load config if not provided (lazy require to avoid circular dep: config → logging)
  let cfg: OpenClawConfig = config!;
  if (!cfg) {
    try {
      const { getConfig } = require("../config/config.js");
      cfg = getConfig();
    } catch {
      // Config module unavailable (e.g., in isolated test environments) — default to no debug
      return false;
    }
  }

  // Priority 2: Suppression list
  if (isSubsystemSuppressed(subsystem, cfg)) {
    return false;
  }

  // Extract context if needed
  const ctx = context as DebugContext | undefined;

  // Priority 3: Channel config (if channel in context)
  if (ctx?.channel) {
    const channelProps = cfg.debugging?.channels?.[ctx.channel];
    if (channelProps) {
      const result = checkDebuggingProps(channelProps, level);
      if (result !== undefined) {
        return result;
      }
    }
  }

  // Priority 4: Feature config (if feature in context)
  if (ctx?.feature) {
    const featureProps = cfg.debugging?.features?.[ctx.feature];
    if (featureProps) {
      const result = checkDebuggingProps(featureProps, level);
      if (result !== undefined) {
        return result;
      }
    }
  }

  // Priority 5: Subsystem hierarchy walk-up
  // Check both channels and features dictionaries with subsystem name
  const parts = subsystem.split("/");
  for (let i = parts.length; i > 0; i--) {
    const prefix = parts.slice(0, i).join("/");

    // Check channels dictionary
    const channelProps = cfg.debugging?.channels?.[prefix];
    if (channelProps) {
      const result = checkDebuggingProps(channelProps, level);
      if (result !== undefined) {
        return result;
      }
    }

    // Check features dictionary
    const featureProps = cfg.debugging?.features?.[prefix];
    if (featureProps) {
      const result = checkDebuggingProps(featureProps, level);
      if (result !== undefined) {
        return result;
      }
    }
  }

  // Priority 6: Context-level overrides (future: run-level verbosity)
  // Placeholder for future enhancement

  // Priority 7: Default deny
  return false;
}

/**
 * Check if a DebuggingProps object allows logging at the given level.
 * Supports standard properties (verbose/debug/trace) and custom properties
 * for backward compatibility (e.g., sendTracing, sendDebug).
 *
 * Returns:
 * - true: explicitly enabled
 * - false: explicitly disabled
 * - undefined: not specified (continue checking parent rules)
 */
function checkDebuggingProps(props: DebuggingProps, level: "debug" | "trace"): boolean | undefined {
  // Highest priority: suppressLogging (explicit suppression)
  if (props.suppressLogging === true) {
    return false;
  }

  // Standard property: verbose (enables both debug and trace)
  if (props.verbose === true) {
    return true;
  }
  if (props.verbose === false) {
    return false;
  }

  // Standard property: debug (enables debug only)
  if (level === "debug") {
    if (props.debug === true) {
      return true;
    }
    if (props.debug === false) {
      return false;
    }
  }

  // Standard property: trace (enables trace only)
  if (level === "trace") {
    if (props.trace === true) {
      return true;
    }
    if (props.trace === false) {
      return false;
    }
  }

  // Backward compatibility: check for custom properties
  // Examples: sendTracing, sendDebug, etc.
  const customDebugKey = `${level}`;
  const customTracingKey = level === "trace" ? "tracing" : undefined;
  const customSendDebugKey = level === "debug" ? "sendDebug" : undefined;
  const customSendTracingKey = level === "trace" ? "sendTracing" : undefined;

  if (customDebugKey && props[customDebugKey] === true) {
    return true;
  }
  if (customTracingKey && props[customTracingKey] === true) {
    return true;
  }
  if (customSendDebugKey && props[customSendDebugKey] === true) {
    return true;
  }
  if (customSendTracingKey && props[customSendTracingKey] === true) {
    return true;
  }

  // Not specified - continue checking parent rules
  return undefined;
}

/**
 * Build a concise one-line summary of active debugging/logging configuration.
 * Returns undefined if everything is at defaults (nothing to report).
 */
export function summarizeLoggingConfig(config: OpenClawConfig): string | undefined {
  const parts: string[] = [];

  // Debugging channels
  const channels = config.debugging?.channels;
  if (channels && Object.keys(channels).length > 0) {
    const entries = Object.entries(channels).map(([id, props]) => {
      const flags: string[] = [];
      if (props.suppressLogging === true) flags.push("suppressed");
      else if (props.verbose === true) flags.push("verbose");
      else {
        if (props.debug === true) flags.push("debug");
        if (props.trace === true) flags.push("trace");
      }
      return flags.length > 0 ? `${id}(${flags.join(",")})` : id;
    });
    parts.push(`channels=[${entries.join(", ")}]`);
  }

  // Debugging features
  const features = config.debugging?.features;
  if (features && Object.keys(features).length > 0) {
    const entries = Object.entries(features).map(([id, props]) => {
      const flags: string[] = [];
      if (props.suppressLogging === true) flags.push("suppressed");
      else if (props.verbose === true) flags.push("verbose");
      else {
        if (props.debug === true) flags.push("debug");
        if (props.trace === true) flags.push("trace");
      }
      return flags.length > 0 ? `${id}(${flags.join(",")})` : id;
    });
    parts.push(`features=[${entries.join(", ")}]`);
  }

  // Suppressed subsystems
  const suppressed = config.logging?.suppressSubsystemDebugLogs;
  if (suppressed && suppressed.length > 0) {
    parts.push(`suppressed=[${suppressed.join(", ")}]`);
  }

  if (parts.length === 0) return undefined;
  return parts.join(" ");
}

/**
 * Check if a subsystem is in the suppression list.
 */
function isSubsystemSuppressed(subsystem: string, config: OpenClawConfig): boolean {
  const suppressList = config.logging?.suppressSubsystemDebugLogs;
  if (!suppressList || suppressList.length === 0) {
    return false;
  }

  // Check exact match and prefix matches
  return suppressList.some((pattern) => {
    if (pattern === subsystem) {
      return true;
    }
    // Support wildcard patterns like "slack/*"
    if (pattern.endsWith("/*")) {
      const prefix = pattern.slice(0, -2);
      return subsystem === prefix || subsystem.startsWith(`${prefix}/`);
    }
    return false;
  });
}
