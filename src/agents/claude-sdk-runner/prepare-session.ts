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
    getCustomEntry?: (key: string) => { value: unknown } | undefined;
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

  // 2. Load resume session ID from SessionManager
  const claudeSdkEntry = sessionManager.getCustomEntry?.("openclaw:claude-sdk-session-id");
  const claudeSdkResumeSessionId =
    typeof claudeSdkEntry?.value === "string" ? claudeSdkEntry.value : undefined;

  // 3. Create and return the session
  return createClaudeSdkSession({
    workspaceDir: resolvedWorkspace,
    agentDir,
    sessionId: params.sessionId,
    modelId: params.modelId,
    tools: builtInTools,
    customTools: allCustomTools,
    systemPrompt: systemPromptText,
    thinkLevel: params.thinkLevel,
    extraParams: params.streamParams as Record<string, unknown> | undefined,
    sessionManager,
    claudeSdkResumeSessionId,
    claudeSdkConfig,
    resolvedProviderAuth: params.resolvedProviderAuth,
  });
}
