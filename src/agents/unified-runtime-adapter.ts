/**
 * Unified Runtime Adapter for cross-runtime failover.
 *
 * Provides a common abstraction layer above both pi-agent and CCSDK runtimes,
 * supporting:
 * - Auth profile rotation with cooldown across both runtimes
 * - Model fallback chains that can span runtimes
 * - Unified error handling and FailoverError propagation
 *
 * @module agents/unified-runtime-adapter
 */

import { createSubsystemLogger } from "../logging/subsystem.js";
import type { MoltbotConfig } from "../config/config.js";
import type { AgentRuntimeKind, AgentRuntimeResult } from "./agent-runtime.js";
import {
  coerceToFailoverError,
  describeFailoverError,
  isFailoverError,
  isTimeoutError,
} from "./failover-error.js";
import {
  ensureAuthProfileStore,
  isProfileInCooldown,
  markAuthProfileCooldown,
  resolveAuthProfileOrder,
  type AuthProfileStore,
} from "./auth-profiles.js";
import type { FailoverReason } from "./pi-embedded-helpers.js";

const log = createSubsystemLogger("agents/unified-runtime-adapter");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Configuration for a single runtime slot in the failover chain. */
export type RuntimeSlot = {
  /** Runtime backend to use. */
  runtime: AgentRuntimeKind;
  /** Optional provider override for this slot. */
  provider?: string;
  /** Optional model override for this slot. */
  model?: string;
};

/** Configuration for unified runtime failover. */
export type UnifiedRuntimeConfig = {
  /** Primary runtime to attempt first. */
  primaryRuntime: AgentRuntimeKind;
  /** Primary provider (shared across runtimes unless overridden). */
  provider?: string;
  /** Primary model (shared across runtimes unless overridden). */
  model?: string;
  /** Fallback runtime slots to try when primary fails. */
  fallbackRuntimes?: RuntimeSlot[];
  /** Auth profile IDs to rotate through (applies to all runtimes). */
  authProfiles?: string[];
};

/** A single failover attempt record. */
export type UnifiedFallbackAttempt = {
  runtime: AgentRuntimeKind;
  provider: string;
  model: string;
  profileId?: string;
  error: string;
  reason?: FailoverReason;
  status?: number;
  code?: string;
};

/** Result from unified runtime execution with failover. */
export type UnifiedRuntimeResult = {
  result: AgentRuntimeResult;
  runtime: AgentRuntimeKind;
  provider: string;
  model: string;
  profileId?: string;
  attempts: UnifiedFallbackAttempt[];
};

/** Parameters for running with unified failover. */
export type RunWithUnifiedFallbackParams = {
  /** Unified runtime configuration. */
  config: UnifiedRuntimeConfig;
  /** Agent directory for auth profile store. */
  agentDir?: string;
  /** Moltbot config for auth profile resolution. */
  cfg?: MoltbotConfig;
  /** The actual run function for a given runtime/provider/model/profile. */
  run: (params: {
    runtime: AgentRuntimeKind;
    provider: string;
    model: string;
    profileId?: string;
  }) => Promise<AgentRuntimeResult>;
  /** Optional callback for each error during failover. */
  onError?: (attempt: {
    runtime: AgentRuntimeKind;
    provider: string;
    model: string;
    profileId?: string;
    error: unknown;
    attempt: number;
    total: number;
  }) => void | Promise<void>;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  if (isFailoverError(err)) return false;
  const name = "name" in err ? String(err.name) : "";
  return name === "AbortError";
}

function shouldRethrowAbort(err: unknown): boolean {
  return isAbortError(err) && !isTimeoutError(err);
}

function buildRuntimeSlots(config: UnifiedRuntimeConfig): RuntimeSlot[] {
  const slots: RuntimeSlot[] = [];
  const seen = new Set<string>();

  const addSlot = (slot: RuntimeSlot) => {
    const key = `${slot.runtime}:${slot.provider ?? ""}:${slot.model ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    slots.push(slot);
  };

  // Primary runtime.
  addSlot({
    runtime: config.primaryRuntime,
    provider: config.provider,
    model: config.model,
  });

  // Fallback runtimes.
  if (config.fallbackRuntimes) {
    for (const fb of config.fallbackRuntimes) {
      addSlot({
        runtime: fb.runtime,
        provider: fb.provider ?? config.provider,
        model: fb.model ?? config.model,
      });
    }
  }

  return slots;
}

function resolveProfilesForSlot(params: {
  slot: RuntimeSlot;
  config: UnifiedRuntimeConfig;
  cfg?: MoltbotConfig;
  authStore?: AuthProfileStore;
}): string[] {
  const { slot, config, cfg, authStore } = params;

  // If explicit profiles provided in config, use those.
  if (config.authProfiles && config.authProfiles.length > 0) {
    return config.authProfiles;
  }

  // Otherwise resolve from config/store.
  if (authStore && cfg) {
    const provider = slot.provider ?? config.provider ?? "";
    return resolveAuthProfileOrder({
      cfg,
      store: authStore,
      provider,
    });
  }

  return [];
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Run an agent with unified cross-runtime failover.
 *
 * Attempts the primary runtime first, rotating through auth profiles.
 * On persistent failures, falls back to alternate runtimes in the chain.
 *
 * @example
 * ```typescript
 * const result = await runWithUnifiedFallback({
 *   config: {
 *     primaryRuntime: "ccsdk",
 *     fallbackRuntimes: [{ runtime: "pi" }],
 *     provider: "anthropic",
 *     model: "claude-sonnet-4-20250514",
 *   },
 *   run: async ({ runtime, provider, model, profileId }) => {
 *     // Execute the agent run with the specified parameters
 *     return runtime === "ccsdk"
 *       ? await ccsdkRuntime.run(...)
 *       : await piRuntime.run(...);
 *   },
 * });
 * ```
 */
export async function runWithUnifiedFallback(
  params: RunWithUnifiedFallbackParams,
): Promise<UnifiedRuntimeResult> {
  const { config, cfg, agentDir, run, onError } = params;

  const slots = buildRuntimeSlots(config);
  const authStore = cfg
    ? ensureAuthProfileStore(agentDir, { allowKeychainPrompt: false })
    : undefined;

  const attempts: UnifiedFallbackAttempt[] = [];
  let lastError: unknown;
  let attemptNum = 0;

  // Count total possible attempts for progress reporting.
  const countTotalAttempts = () => {
    let total = 0;
    for (const slot of slots) {
      const profiles = resolveProfilesForSlot({ slot, config, cfg, authStore });
      total += Math.max(1, profiles.length);
    }
    return total;
  };
  const totalAttempts = countTotalAttempts();

  for (const slot of slots) {
    const provider = slot.provider ?? config.provider ?? "";
    const model = slot.model ?? config.model ?? "";
    const profiles = resolveProfilesForSlot({ slot, config, cfg, authStore });

    // Filter out profiles in cooldown.
    const availableProfiles =
      profiles.length > 0 && authStore
        ? profiles.filter((id) => !isProfileInCooldown(authStore, id))
        : profiles;

    // If all profiles are in cooldown, record and skip this slot.
    if (profiles.length > 0 && availableProfiles.length === 0) {
      log.debug(`All profiles for ${slot.runtime}/${provider} are in cooldown, skipping slot`);
      attempts.push({
        runtime: slot.runtime,
        provider,
        model,
        error: `All auth profiles for ${provider} are in cooldown`,
        reason: "rate_limit",
      });
      continue;
    }

    // Try each available profile (or once with no profile).
    const profilesToTry = availableProfiles.length > 0 ? availableProfiles : [undefined];

    for (const profileId of profilesToTry) {
      attemptNum += 1;

      try {
        log.debug(
          `Attempting ${slot.runtime}/${provider}/${model}${profileId ? ` (profile: ${profileId})` : ""}`,
        );

        const result = await run({
          runtime: slot.runtime,
          provider,
          model,
          profileId,
        });

        return {
          result,
          runtime: slot.runtime,
          provider,
          model,
          profileId,
          attempts,
        };
      } catch (err) {
        // Abort errors should propagate immediately (unless they're timeouts).
        if (shouldRethrowAbort(err)) {
          throw err;
        }

        // Attempt to classify the error as a failover reason.
        const failoverErr = coerceToFailoverError(err, {
          provider,
          model,
          profileId,
        });

        // If the error is not a failover-eligible error, rethrow.
        if (!failoverErr && !isFailoverError(err)) {
          throw err;
        }

        lastError = failoverErr ?? err;
        const described = describeFailoverError(lastError);

        attempts.push({
          runtime: slot.runtime,
          provider,
          model,
          profileId,
          error: described.message,
          reason: described.reason,
          status: described.status,
          code: described.code,
        });

        // Put the profile in cooldown if it's a rate limit or auth error.
        if (profileId && authStore && described.reason) {
          const shouldCooldown =
            described.reason === "rate_limit" ||
            described.reason === "auth" ||
            described.reason === "billing";
          if (shouldCooldown) {
            void markAuthProfileCooldown({
              store: authStore,
              profileId,
              agentDir,
            });
            log.debug(`Put profile ${profileId} in cooldown: ${described.reason}`);
          }
        }

        // Notify error callback.
        await onError?.({
          runtime: slot.runtime,
          provider,
          model,
          profileId,
          error: lastError,
          attempt: attemptNum,
          total: totalAttempts,
        });

        log.debug(
          `Attempt ${attemptNum}/${totalAttempts} failed: ${described.message} (${described.reason ?? "unknown"})`,
        );
      }
    }
  }

  // All attempts exhausted.
  if (attempts.length === 1 && lastError) {
    // Single attempt: throw the original error.
    throw lastError;
  }

  const summary =
    attempts.length > 0
      ? attempts
          .map(
            (a) =>
              `${a.runtime}/${a.provider}/${a.model}${a.profileId ? `[${a.profileId}]` : ""}: ${a.error}${
                a.reason ? ` (${a.reason})` : ""
              }`,
          )
          .join(" | ")
      : "unknown";

  throw new Error(`All runtimes failed (${attempts.length} attempts): ${summary}`, {
    cause: lastError instanceof Error ? lastError : undefined,
  });
}

/**
 * Check if a runtime slot is currently available (has non-cooldown profiles).
 */
export function isRuntimeSlotAvailable(params: {
  slot: RuntimeSlot;
  config: UnifiedRuntimeConfig;
  cfg?: MoltbotConfig;
  agentDir?: string;
}): boolean {
  const { slot, config, cfg, agentDir } = params;
  const authStore = cfg
    ? ensureAuthProfileStore(agentDir, { allowKeychainPrompt: false })
    : undefined;

  const profiles = resolveProfilesForSlot({ slot, config, cfg, authStore });

  if (profiles.length === 0) {
    // No profiles configured, assume available.
    return true;
  }

  if (!authStore) {
    return true;
  }

  return profiles.some((id) => !isProfileInCooldown(authStore, id));
}
