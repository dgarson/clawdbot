import {
  ClaudeSdkConfigSchema,
  type ClaudeSdkConfig,
} from "../../config/zod-schema.agent-runtime.js";
import type { ResolvedProviderAuth } from "../model-auth.js";
import { log } from "../pi-embedded-runner/logger.js";
import type { EmbeddedRunAttemptParams } from "../pi-embedded-runner/run/types.js";
import { createClaudeSdkSession } from "./create-session.js";
import type { ClaudeSdkCompatibleTool, ClaudeSdkSession } from "./types.js";

const CLAUDE_SDK_RESUME_SESSION_KEY = "openclaw:claude-sdk-session-id";

type ClaudeSessionManagerLike = {
  appendCustomEntry?: (key: string, value: unknown) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getEntries?: () => Array<{ type: string; customType?: string; data?: unknown }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appendMessage?: (message: any) => string;
};

/** @internal Exported for testing only. */
export function resolveClaudeSdkConfig(
  params: EmbeddedRunAttemptParams,
  agentId: string,
): ClaudeSdkConfig | undefined {
  const agentEntry = params.config?.agents?.list?.find((a) => a.id === agentId);
  if (agentEntry?.claudeSdk === false) {
    return undefined;
  }
  const defaultsCfg = params.config?.agents?.defaults?.claudeSdk;
  const agentCfg =
    agentEntry?.claudeSdk && typeof agentEntry.claudeSdk === "object"
      ? agentEntry.claudeSdk
      : undefined;
  const merged =
    agentCfg && defaultsCfg && typeof defaultsCfg === "object"
      ? { ...defaultsCfg, ...agentCfg }
      : (agentCfg ?? defaultsCfg);
  if (!merged || typeof merged !== "object") {
    return undefined;
  }
  // Validate merged config. On failure fall back to Pi runtime rather than
  // running with a corrupted config.
  const parseResult = ClaudeSdkConfigSchema.safeParse(merged);
  if (!parseResult.success || !parseResult.data) {
    log.warn(
      `claudeSdk config validation failed after merge: ${parseResult.success ? "empty result" : parseResult.error.message}`,
    );
    return undefined;
  }
  return parseResult.data;
}

/**
 * Validates credentials and creates a ClaudeSdk session from attempt params.
 * Encapsulates all claude-sdk-specific session setup so attempt.ts stays clean.
 */
export async function prepareClaudeSdkSession(
  params: EmbeddedRunAttemptParams,
  claudeSdkConfig: ClaudeSdkConfig,
  resolvedProviderAuth: ResolvedProviderAuth | undefined,
  sessionManager: ClaudeSessionManagerLike,
  resolvedWorkspace: string,
  agentDir: string | undefined,
  systemPromptText: string,
  builtInTools: ClaudeSdkCompatibleTool[],
  allCustomTools: ClaudeSdkCompatibleTool[],
  forceFreshClaudeSession = false,
): Promise<ClaudeSdkSession> {
  // 1. Validate model ID — must use full Anthropic name (claude-* prefix).
  // Full IDs (e.g. "claude-opus-4-6") are required here for routing and display;
  // create-session.ts translates them to CLI aliases (opus/sonnet/haiku) internally
  // before passing to the subprocess, since the CLI doesn't recognise versioned IDs.
  if (!params.modelId.startsWith("claude-")) {
    throw new Error(
      `claude-sdk runtime requires a full Anthropic model ID (must start with "claude-"). ` +
        `Got: "${params.modelId}". Use the full model name, e.g. "claude-sonnet-4-5".`,
    );
  }

  // 2. Load resume session ID from SessionManager.
  // SessionManager.getCustomEntry() does not exist in pi-coding-agent; read via
  // getEntries() and search for the latest matching custom entry instead.
  // The entry's data field holds the session ID string (not `value`).
  const allEntries = sessionManager.getEntries?.() ?? [];
  const claudeSdkEntry = [...allEntries]
    .toReversed()
    .find((e) => e.type === "custom" && e.customType === CLAUDE_SDK_RESUME_SESSION_KEY);
  let claudeSdkResumeSessionId =
    typeof claudeSdkEntry?.data === "string" ? claudeSdkEntry.data : undefined;
  if (forceFreshClaudeSession && claudeSdkResumeSessionId) {
    try {
      sessionManager.appendCustomEntry?.(CLAUDE_SDK_RESUME_SESSION_KEY, null);
      sessionManager.appendCustomEntry?.("openclaw:claude-sdk-stale-resume-recovered", {
        timestamp: Date.now(),
        staleSessionId: claudeSdkResumeSessionId,
        runId: params.runId,
        sessionId: params.sessionId,
      });
    } catch {
      // Non-fatal — stale marker clear failures are handled by caller-level retries.
    }
    claudeSdkResumeSessionId = undefined;
  }

  // 3. Create and return the session
  return createClaudeSdkSession({
    workspaceDir: resolvedWorkspace,
    agentDir,
    sessionId: params.sessionId,
    sessionFile: params.sessionFile,
    runId: params.runId,
    attemptNumber: params.attemptNumber,
    modelId: params.modelId,
    provider: params.provider,
    tools: builtInTools,
    customTools: allCustomTools,
    systemPrompt: systemPromptText,
    modelCost: params.model.cost,
    // Explicit user directive (anything other than the "off" default) takes precedence
    // over the config-level thinkingDefault. If no directive was given, the config acts
    // as the agent-level default, falling back to the runtime "off" if unset.
    // TODO: explicit user "off" is indistinguishable from the default "off", so
    // thinkingDefault can override an explicit user choice. Proper fix requires
    // threading `thinkLevelExplicit` from message parsing.
    thinkLevel:
      params.thinkLevel !== "off"
        ? params.thinkLevel
        : (claudeSdkConfig.thinkingDefault ?? params.thinkLevel),
    extraParams: params.streamParams as Record<string, unknown> | undefined,
    sessionManager,
    claudeSdkResumeSessionId,
    claudeSdkConfig,
    resolvedProviderAuth,
  });
}
