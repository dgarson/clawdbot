/**
 * Unified agent runtime dispatch — resolves the configured runtime kind and
 * creates the appropriate AgentRuntime instance.
 *
 * Call sites that need to run the main agent (cron, followup runner, etc.)
 * should use `resolveAndCreateRuntime()` instead of hardcoding a specific
 * runtime. This ensures Claude Max / SDK runtime users get the correct
 * backend without every call site duplicating the dispatch logic.
 */

import type { OpenClawConfig } from "../config/config.js";
import type { AgentRuntime } from "./agent-runtime.js";
import type { MainAgentRuntimeKind } from "./main-agent-runtime-factory.js";
import type { CreateSdkMainAgentRuntimeParams } from "./main-agent-runtime-factory.js";
import type { PiRuntimeContext } from "./pi-agent-runtime.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  createSdkMainAgentRuntime,
  resolveSessionRuntimeKind,
} from "./main-agent-runtime-factory.js";
import { createPiAgentRuntime } from "./pi-agent-runtime.js";

const log = createSubsystemLogger("runtime-dispatch");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ResolveAndCreateRuntimeParams = {
  config: OpenClawConfig;
  agentId: string;
  sessionKey?: string;
  /** SDK-specific context (required when runtime may be "claude"). */
  sdkContext?: Omit<CreateSdkMainAgentRuntimeParams, "config" | "sessionKey">;
  /** Pi-specific context (required when runtime may be "pi"). */
  piContext?: PiRuntimeContext;
};

export type ResolvedRuntime = {
  runtime: AgentRuntime;
  kind: MainAgentRuntimeKind;
};

// ---------------------------------------------------------------------------
// Main helper
// ---------------------------------------------------------------------------

/**
 * Resolve the configured runtime kind for an agent/session and create the
 * appropriate `AgentRuntime` instance.
 *
 * If the resolved kind is `"claude"` but no `sdkContext` was provided (e.g.,
 * the caller doesn't yet support SDK runtime), this function logs a warning
 * and gracefully degrades to the Pi runtime.
 *
 * @returns The created runtime and which kind was resolved.
 */
export async function resolveAndCreateRuntime(
  params: ResolveAndCreateRuntimeParams,
): Promise<ResolvedRuntime> {
  const kind = resolveSessionRuntimeKind(params.config, params.agentId, params.sessionKey);

  if (kind === "claude") {
    if (params.sdkContext) {
      const runtime = await createSdkMainAgentRuntime({
        ...params.sdkContext,
        config: params.config,
        sessionKey: params.sessionKey,
      });
      return { runtime, kind: "claude" };
    }

    // Graceful degradation — caller doesn't support SDK context yet.
    log.warn(
      `Runtime "claude" resolved for agent=${params.agentId} ` +
        `session=${params.sessionKey ?? "n/a"} but no SDK context provided; ` +
        `falling back to Pi runtime`,
    );
  }

  if (!params.piContext) {
    throw new Error(
      `resolveAndCreateRuntime: runtime="${kind}" resolved for agent=${params.agentId} ` +
        `but no piContext was provided`,
    );
  }

  const runtime = createPiAgentRuntime(params.piContext);
  return { runtime, kind: "pi" };
}
