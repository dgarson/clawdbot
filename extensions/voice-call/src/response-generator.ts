/**
 * Voice call response generator - uses the embedded Pi agent for tool support.
 * Routes voice responses through the same agent infrastructure as messaging.
 *
 * Session model:
 * - Each call gets a unique session (keyed by `voice:{callId}`) so the Pi
 *   session file tracks only the current call's conversation history.
 * - The conversation transcript is NOT duplicated into the system prompt;
 *   the Pi session file is the sole source of conversation history, preventing
 *   the O(n²) context growth that occurred when every turn replayed the full
 *   transcript via `extraSystemPrompt`.
 * - Cross-call continuity (remembering prior calls from the same number) can
 *   be added later via a summary injection or memory search.
 */

import crypto from "node:crypto";
import type { VoiceCallConfig } from "./config.js";
import { loadCoreAgentDeps, loadSessionMessages, type CoreConfig } from "./core-bridge.js";
import {
  recallConversationToolDefinition,
  createRecallConversationExecutor,
} from "./tools/recall-conversation.js";

export type VoiceResponseParams = {
  /** Voice call config */
  voiceConfig: VoiceCallConfig;
  /** Core OpenClaw config */
  coreConfig: CoreConfig;
  /** Call ID for session tracking */
  callId: string;
  /** Caller's phone number */
  from: string;
  /** Conversation transcript (kept for reference but NOT injected into system prompt) */
  transcript: Array<{ speaker: "user" | "bot"; text: string }>;
  /** Latest user message */
  userMessage: string;
};

export type VoiceResponseResult = {
  text: string | null;
  error?: string;
};

type SessionEntry = {
  sessionId: string;
  updatedAt: number;
};

/**
 * Generate a voice response using the embedded Pi agent with full tool support.
 * Uses the same agent infrastructure as messaging for consistent behavior.
 *
 * The Pi agent's session file handles conversation history natively — each
 * `runEmbeddedPiAgent()` call appends the user message and assistant response
 * to the session file, so the model sees prior turns automatically. We only
 * need to provide a stable system prompt (no transcript replay).
 */
export async function generateVoiceResponse(
  params: VoiceResponseParams,
): Promise<VoiceResponseResult> {
  const { voiceConfig, callId, from, userMessage, coreConfig } = params;

  if (!coreConfig) {
    return { text: null, error: "Core config unavailable for voice response" };
  }

  let deps: Awaited<ReturnType<typeof loadCoreAgentDeps>>;
  try {
    deps = await loadCoreAgentDeps();
  } catch (err) {
    return {
      text: null,
      error: err instanceof Error ? err.message : "Unable to load core agent dependencies",
    };
  }
  const cfg = coreConfig;

  // Session key is per-call so each call gets a fresh context window.
  // Cross-call continuity can be added later via memory/summary injection.
  const sessionKey = `voice:call:${callId}`;
  const agentId = "main";

  // Resolve paths
  const storePath = deps.resolveStorePath(cfg.session?.store, { agentId });
  const agentDir = deps.resolveAgentDir(cfg, agentId);
  const workspaceDir = deps.resolveAgentWorkspaceDir(cfg, agentId);

  // Ensure workspace exists
  await deps.ensureAgentWorkspace({ dir: workspaceDir });

  // Load or create session entry
  const sessionStore = deps.loadSessionStore(storePath);
  const now = Date.now();
  let sessionEntry = sessionStore[sessionKey] as SessionEntry | undefined;

  if (!sessionEntry) {
    sessionEntry = {
      sessionId: crypto.randomUUID(),
      updatedAt: now,
    };
    sessionStore[sessionKey] = sessionEntry;
    await deps.saveSessionStore(storePath, sessionStore);
  }

  const sessionId = sessionEntry.sessionId;
  const sessionFile = deps.resolveSessionFilePath(sessionId, sessionEntry, {
    agentId,
  });

  // Resolve model from config
  const modelRef = voiceConfig.responseModel || `${deps.DEFAULT_PROVIDER}/${deps.DEFAULT_MODEL}`;
  const slashIndex = modelRef.indexOf("/");
  const provider = slashIndex === -1 ? deps.DEFAULT_PROVIDER : modelRef.slice(0, slashIndex);
  const model = slashIndex === -1 ? modelRef : modelRef.slice(slashIndex + 1);

  // Resolve thinking level
  const thinkLevel = deps.resolveThinkingDefault({ cfg, provider, model });

  // Resolve agent identity for personalized prompt
  const identity = deps.resolveAgentIdentity(cfg, agentId);
  const agentName = identity?.name?.trim() || "assistant";

  // Check feature flag for conversation recall (under tts config)
  const enableRecall = voiceConfig.tts?.enableConversationRecall ?? false;

  // Build extra tools array
  const extraTools: Array<{
    name: string;
    description?: string;
    parameters: Record<string, unknown>;
    execute: (params: unknown) => Promise<string>;
  }> = [];

  if (enableRecall) {
    // Load full session history for recall tool
    const fullHistory = await loadSessionMessages(sessionFile);

    extraTools.push({
      name: recallConversationToolDefinition.name,
      description: recallConversationToolDefinition.description,
      parameters: recallConversationToolDefinition.parameters as Record<string, unknown>,
      execute: createRecallConversationExecutor({ fullHistory }),
    });
  }

  // Build context awareness hints based on feature flags
  // When recall is enabled, mention the tool; otherwise keep steps numbered correctly
  const contextSteps = enableRecall
    ? `1. Politely ask them to briefly remind you what they mentioned
2. Use the "recall_conversation" tool to search earlier parts of this call
3. Use memory tools to check if important facts were stored`
    : `1. Politely ask them to briefly remind you what they mentioned
2. Use memory tools to check if important facts were stored`;

  // Build a stable system prompt — conversation history is tracked by the
  // Pi session file, NOT duplicated here. This keeps the system prompt at
  // constant size regardless of how many turns the call has had.
  const extraSystemPrompt =
    voiceConfig.responseSystemPrompt ??
    `You are ${agentName}, a helpful voice assistant on a phone call.

## Response Style
- Keep responses brief and conversational (1-3 sentences max)
- Be natural and friendly
- Always greet callers warmly by name if you recognize them

## Context Awareness
Due to call duration limits, you may not see the full conversation history. If the caller references something you don't have context for:
${contextSteps}

If you need more context, ask naturally: "Could you remind me what we discussed about that?"

## Caller Info
- Phone number: ${from}
- You have access to tools - use them when helpful`;

  // Resolve timeout
  const timeoutMs = voiceConfig.responseTimeoutMs ?? deps.resolveAgentTimeoutMs({ cfg });
  const runId = `voice:${callId}:${Date.now()}`;

  try {
    const result = await deps.runEmbeddedPiAgent({
      sessionId,
      sessionKey,
      messageProvider: "voice",
      sessionFile,
      workspaceDir,
      config: cfg,
      prompt: userMessage,
      provider,
      model,
      thinkLevel,
      verboseLevel: "off",
      timeoutMs,
      runId,
      lane: "voice",
      extraSystemPrompt,
      agentDir,
      extraTools: extraTools.length > 0 ? extraTools : undefined,
    });

    // Extract text from payloads
    const texts = (result.payloads ?? [])
      .filter((p) => p.text && !p.isError)
      .map((p) => p.text?.trim())
      .filter(Boolean);

    const text = texts.join(" ") || null;

    if (!text && result.meta?.aborted) {
      return { text: null, error: "Response generation was aborted" };
    }

    return { text };
  } catch (err) {
    console.error(`[voice-call] Response generation failed:`, err);
    return { text: null, error: String(err) };
  }
}
