import type { ClaudeSdkConfig } from "../../config/zod-schema.agent-runtime.js";
import type { EmbeddedRunAttemptParams } from "../pi-embedded-runner/run/types.js";
import { createClaudeSdkSession } from "./create-session.js";
import type { ClaudeSdkCompatibleTool, ClaudeSdkSession } from "./types.js";

const CLAUDE_SDK_PROVIDERS = new Set(["claude-pro"]);

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
  if (!agentEntry?.claudeSdk || typeof agentEntry.claudeSdk !== "object") {
    if (defaultsCfg && typeof defaultsCfg === "object" && !("provider" in defaultsCfg)) {
      return undefined;
    }
    return defaultsCfg;
  }
  const merged = defaultsCfg
    ? { ...defaultsCfg, ...agentEntry.claudeSdk }
    : { ...agentEntry.claudeSdk };
  if (!("provider" in merged)) {
    return undefined;
  }
  return merged as ClaudeSdkConfig;
}

export { CLAUDE_SDK_PROVIDERS };

/**
 * Validates credentials and creates a ClaudeSdk session from attempt params.
 * Encapsulates all claude-sdk-specific session setup so attempt.ts stays clean.
 */
export async function prepareClaudeSdkSession(
  params: EmbeddedRunAttemptParams,
  claudeSdkConfig: ClaudeSdkConfig,
  sessionManager: {
    appendCustomEntry?: (key: string, value: unknown) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getEntries?: () => Array<{ type: string; customType?: string; data?: unknown }>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    appendMessage?: (message: any) => string;
  },
  resolvedWorkspace: string,
  agentDir: string | undefined,
  systemPromptText: string,
  builtInTools: ClaudeSdkCompatibleTool[],
  allCustomTools: ClaudeSdkCompatibleTool[],
): Promise<ClaudeSdkSession> {
  // 1. Validate model ID — must use full Anthropic name (claude-* prefix).
  // Short aliases like "sonnet" or "opus" are not accepted; use the full model
  // ID (e.g. "claude-sonnet-4-5") to avoid silently hitting the subprocess default.
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
    .find((e) => e.type === "custom" && e.customType === "openclaw:claude-sdk-session-id");
  const claudeSdkResumeSessionId =
    typeof claudeSdkEntry?.data === "string" ? claudeSdkEntry.data : undefined;

  // 3. Create and return the session
  return createClaudeSdkSession({
    workspaceDir: resolvedWorkspace,
    agentDir,
    sessionId: params.sessionId,
    sessionFile: params.sessionFile,
    modelId: params.modelId,
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
        : (claudeSdkConfig.thinkingDefault ?? claudeSdkConfig.thinkingLevel ?? params.thinkLevel),
    extraParams: params.streamParams as Record<string, unknown> | undefined,
    sessionManager,
    claudeSdkResumeSessionId,
    claudeSdkConfig,
  });
}
