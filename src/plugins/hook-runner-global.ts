/**
 * Global Plugin Hook Runner
 *
 * Singleton hook runner that's initialized when plugins are loaded
 * and can be called from anywhere in the codebase.
 */

import { coreSessionContextSubscriber } from "../agents/claude-sdk-runner/context/session-context-subscriber.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { createHookRunner, type HookRunner } from "./hooks.js";
import { createEmptyPluginRegistry } from "./registry.js";
import type { PluginRegistry } from "./registry.js";
import type {
  PluginHookAgentContext,
  PluginHookBeforeSessionCreateEvent,
  PluginHookGatewayContext,
  PluginHookGatewayStopEvent,
} from "./types.js";

const log = createSubsystemLogger("plugins");

let globalHookRunner: HookRunner | null = null;
let globalRegistry: PluginRegistry | null = null;

/**
 * Initialize the global hook runner with a plugin registry.
 * Called once when plugins are loaded during gateway startup.
 */
export function initializeGlobalHookRunner(registry: PluginRegistry): void {
  globalRegistry = registry;
  globalHookRunner = createHookRunner(registry, {
    logger: {
      debug: (msg) => log.debug(msg),
      warn: (msg) => log.warn(msg),
      error: (msg) => log.error(msg),
    },
    catchErrors: true,
  });

  const hookCount = registry.hooks.length;
  if (hookCount > 0) {
    log.info(`hook runner initialized with ${hookCount} registered hooks`);
  }
}

/**
 * Get the global hook runner.
 * Returns null if plugins haven't been loaded yet.
 */
export function getGlobalHookRunner(): HookRunner | null {
  return globalHookRunner;
}

/**
 * Get the global plugin registry.
 * Returns null if plugins haven't been loaded yet.
 */
export function getGlobalPluginRegistry(): PluginRegistry | null {
  return globalRegistry;
}

/**
 * Check if any hooks are registered for a given hook name.
 */
export function hasGlobalHooks(hookName: Parameters<HookRunner["hasHooks"]>[0]): boolean {
  return globalHookRunner?.hasHooks(hookName) ?? false;
}

export async function runGlobalGatewayStopSafely(params: {
  event: PluginHookGatewayStopEvent;
  ctx: PluginHookGatewayContext;
  onError?: (err: unknown) => void;
}): Promise<void> {
  const hookRunner = getGlobalHookRunner();
  if (!hookRunner?.hasHooks("gateway_stop")) {
    return;
  }
  try {
    await hookRunner.runGatewayStop(params.event, params.ctx);
  } catch (err) {
    if (params.onError) {
      params.onError(err);
      return;
    }
    log.warn(`gateway_stop hook failed: ${String(err)}`);
  }
}

/**
 * Reset the global hook runner (for testing).
 */
export function resetGlobalHookRunner(): void {
  globalHookRunner = null;
  globalRegistry = null;
}

/**
 * Creates a minimal HookRunner containing only the built-in core subscribers.
 *
 * Used as a fallback in createClaudeSdkSession() when the global hook runner
 * hasn't been initialized (e.g. isolated unit tests that don't load plugins).
 * This ensures the before_session_create code path is identical in both
 * production (full runner) and test environments (core-only runner), which
 * prevents coverage gaps from a direct-call fallback.
 */
export function createCoreHookRunner(): HookRunner {
  const registry = createEmptyPluginRegistry();
  registry.typedHooks.push({
    pluginId: "openclaw-core",
    hookName: "before_session_create",
    handler: (event: PluginHookBeforeSessionCreateEvent, _ctx: PluginHookAgentContext) =>
      coreSessionContextSubscriber(event),
    priority: 1000,
    source: "core",
  });
  return createHookRunner(registry, {
    logger: {
      debug: (msg) => log.debug(msg),
      warn: (msg) => log.warn(msg),
      error: (msg) => log.error(msg),
    },
    catchErrors: true,
  });
}
