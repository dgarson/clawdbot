import type { ClaudeSdkConfig } from "../../config/zod-schema.agent-runtime.js";
import type { EmbeddedRunAttemptParams } from "../pi-embedded-runner/run/types.js";
import { createClaudeSdkSession } from "./index.js";
import type { ClaudeSdkCompatibleTool, ClaudeSdkSession } from "./types.js";

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
  // 1. Credential validation (moved from the early check in attempt.ts)
  const provider = claudeSdkConfig.provider;
  const hasInlineKey =
    provider === "custom" && "apiKey" in claudeSdkConfig && !!claudeSdkConfig.apiKey;
  if (provider !== "claude-code" && !hasInlineKey && !params.resolvedProviderAuth?.apiKey) {
    throw new Error(
      `claude-sdk runtime requires auth credentials for provider "${provider}". ` +
        `Configure authentication via \`openclaw login\`, or for custom providers ` +
        `set \`claudeSdk.apiKey\` in your config.`,
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
    modelId: params.modelId,
    tools: builtInTools,
    customTools: allCustomTools,
    systemPrompt: systemPromptText,
    // Explicit user directive (anything other than the "off" default) takes precedence
    // over the config-level thinkingLevel. If no directive was given, the config acts
    // as the agent-level default, falling back to the runtime "off" if unset.
    thinkLevel:
      params.thinkLevel !== "off"
        ? params.thinkLevel
        : (claudeSdkConfig.thinkingLevel ?? params.thinkLevel),
    extraParams: params.streamParams as Record<string, unknown> | undefined,
    sessionManager,
    claudeSdkResumeSessionId,
    claudeSdkConfig,
    resolvedProviderAuth: params.resolvedProviderAuth,
  });
}
