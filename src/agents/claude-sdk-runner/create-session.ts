/**
 * Claude SDK Session Adapter
 *
 * Creates a session object that implements the same duck-typed AgentSession interface
 * used by Pi, but drives the Claude Agent SDK query() loop under the hood.
 *
 * Key design points:
 * - Server-side sessions: NEVER concatenates message history into prompts.
 *   The resume parameter with persisted session_id is the sole multi-turn mechanism.
 * - In-process MCP: OpenClaw tools are exposed via createSdkMcpServer() so the
 *   Agent SDK agentic loop can call them. before_tool_call hooks fire automatically
 *   through the wrapped .execute() methods.
 * - enforceFinalTag must be false: Claude uses structured thinking, not XML tags.
 *   This is enforced in attempt.ts at the subscribeEmbeddedPiSession call.
 *
 * Per implementation-plan.md Section 4.1 and 4.4.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { mapSdkError } from "./error-mapping.js";
import { translateSdkMessageToEvents } from "./event-adapter.js";
import { createClaudeSdkMcpToolServer } from "./mcp-tool-server.js";
import { buildProviderEnv } from "./provider-env.js";
import {
  CLAUDE_SDK_STDOUT_TAIL_MAX_CHARS,
  createClaudeSdkSpawnWithStdoutTailLogging,
  type ClaudeSdkSpawnProcess,
} from "./spawn-stdout-logging.js";
import type {
  AgentRuntimeHints,
  ClaudeSdkEventAdapterState,
  ClaudeSdkSession,
  ClaudeSdkSessionParams,
} from "./types.js";

// ---------------------------------------------------------------------------
// ThinkLevel → maxThinkingTokens mapping
// OpenClaw runtime targets:
// - Default/basic thinking: ~4k tokens
// - Medium/deep thinking: ~10k tokens
// - Highest/extended thinking (ultrathink): ~40k tokens
// ---------------------------------------------------------------------------

function resolveThinkingTokenBudget(thinkLevel?: string): number | null {
  const level = thinkLevel?.toLowerCase();
  switch (level) {
    case "off":
    case "none":
      return null;
    case "minimal":
    case "low":
    case "basic":
      return 4000;
    case "medium":
    case "deep":
    case "think-hard":
      return 10000;
    case "high":
    case "xhigh":
    case "max":
    case "highest":
    case "ultrathink":
    case "extended":
      return 40000;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Query options builder
// ---------------------------------------------------------------------------

// Stream params from Pi that have no meaningful equivalent in the Claude SDK
// query API. Passing them through would either be silently ignored or cause
// unexpected behavior (e.g. temperature/maxTokens conflict with SDK defaults).
// "env" is blocked to prevent extraParams from accidentally overriding the
// provider env built by buildProviderEnv() — an empty or partial env causes
// the subprocess to fail auth (the SDK replaces process.env entirely).
const SDK_BLOCKED_EXTRA_PARAMS = new Set([
  "mcpServers",
  "permissionMode",
  "temperature",
  "maxTokens",
  "env",
]);
const log = createSubsystemLogger("agent/claude-sdk");

function resolveTranscriptMetadata(provider?: string): {
  transcriptProvider: string;
  transcriptApi: string;
} {
  const normalized = provider ?? "claude-sdk";
  if (normalized === "claude-sdk" || normalized === "anthropic") {
    return {
      transcriptProvider: "anthropic",
      transcriptApi: "anthropic-messages",
    };
  }
  return {
    transcriptProvider: normalized,
    transcriptApi: "claude-sdk",
  };
}

function buildQueryOptions(
  params: ClaudeSdkSessionParams,
  state: ClaudeSdkEventAdapterState,
  toolServer: unknown,
): Record<string, unknown> {
  // Merge caller-provided MCP servers with our internal openclaw-tools bridge.
  // Spread caller servers first so that "openclaw-tools" always wins if the
  // caller accidentally uses that key.
  const mcpServers: Record<string, unknown> = {
    ...params.mcpServers,
    "openclaw-tools": toolServer,
  };

  const queryOptions: Record<string, unknown> = {
    model: params.modelId,
    mcpServers,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    systemPrompt: state.systemPrompt,
    tools: [],
    // Enable real-time streaming: the SDK yields stream_event messages with
    // token-level deltas so the UI can show text as it generates.
    includePartialMessages: true,
    // Pass AbortController for canonical SDK cancellation. The SDK terminates
    // the underlying subprocess when this signal aborts. We also wire
    // interrupt() as defense-in-depth in the for-await loop.
    abortController: state.abortController,
    // Capture subprocess stderr so process exit errors have actionable context.
    // Without this the SDK discards stderr and "exited with code N" is opaque.
    stderr: (data: string) => {
      const trimmed = data.trim();
      if (trimmed) {
        state.lastStderr = trimmed;
      }
    },
  };

  const maxThinkingTokens = resolveThinkingTokenBudget(params.thinkLevel);
  if (maxThinkingTokens !== null) {
    queryOptions.maxThinkingTokens = maxThinkingTokens;
  }

  if (params.extraParams) {
    for (const [key, value] of Object.entries(params.extraParams)) {
      if (!SDK_BLOCKED_EXTRA_PARAMS.has(key)) {
        queryOptions[key] = value;
      }
    }
  }

  // Resume from existing server-side session if we have a session_id.
  // CRITICAL: NEVER concatenate message history — server has full context.
  if (state.claudeSdkSessionId) {
    queryOptions.resume = state.claudeSdkSessionId;
  }

  // Provider env: sets ANTHROPIC_BASE_URL, API key, timeout, and model vars for
  // non-Anthropic providers. Returns undefined for claude-code/anthropic (no override).
  const providerEnv = buildProviderEnv(
    params.claudeSdkConfig ?? { provider: "claude-sdk" as const },
  );
  if (providerEnv !== undefined) {
    queryOptions["env"] = providerEnv;
  }

  const customSpawn =
    typeof queryOptions.spawnClaudeCodeProcess === "function"
      ? (queryOptions.spawnClaudeCodeProcess as ClaudeSdkSpawnProcess)
      : undefined;
  queryOptions.spawnClaudeCodeProcess = createClaudeSdkSpawnWithStdoutTailLogging({
    baseSpawn: customSpawn,
    onExitCodeOne: (stdoutTail) => {
      const trimmed = stdoutTail.trim();
      if (!trimmed) {
        log.error("Claude Code subprocess exited with code 1 (stdout was empty).");
        return;
      }
      log.error(
        `Claude Code subprocess exited with code 1. stdout tail (last ${CLAUDE_SDK_STDOUT_TAIL_MAX_CHARS} chars):\n${trimmed}`,
      );
    },
  });

  return queryOptions;
}

// ---------------------------------------------------------------------------
// Main factory function
// ---------------------------------------------------------------------------

/**
 * Creates a Claude SDK session implementing the Pi AgentSession duck-typed interface.
 * The returned session can be used as a drop-in replacement for Pi's createAgentSession().
 */
export async function createClaudeSdkSession(
  params: ClaudeSdkSessionParams,
): Promise<ClaudeSdkSession> {
  const { transcriptProvider, transcriptApi } = resolveTranscriptMetadata(
    params.claudeSdkConfig?.provider,
  );

  // Internal adapter state
  const state: ClaudeSdkEventAdapterState = {
    subscribers: [],
    streaming: false,
    compacting: false,
    abortController: null,
    systemPrompt: params.systemPrompt,
    pendingSteer: [],
    pendingToolUses: [],
    toolNameByUseId: new Map(),
    messages: [],
    messageIdCounter: 0,
    streamingMessageId: null,
    claudeSdkSessionId: params.claudeSdkResumeSessionId,
    sdkResultError: undefined,
    lastStderr: undefined,
    streamingBlockTypes: new Map(),
    streamingPartialMessage: null,
    streamingInProgress: false,
    sessionManager: params.sessionManager,
    transcriptProvider,
    transcriptApi,
    modelCost: params.modelCost,
    enableClaudeWebSearch: false,
  };

  const clearTurnToolCorrelationState = (): void => {
    if (state.pendingToolUses.length > 0 || state.toolNameByUseId.size > 0) {
      log.debug(
        `claude-sdk: clearing turn-local tool correlation state pending=${state.pendingToolUses.length} mapped=${state.toolNameByUseId.size}`,
      );
    }
    state.pendingToolUses.length = 0;
    state.toolNameByUseId.clear();
  };

  // Build in-process MCP tool server from OpenClaw tools (already wrapped with
  // before_tool_call hooks, abort signal propagation, and loop detection upstream)
  const allTools = [...params.tools, ...params.customTools];

  const toolServer = createClaudeSdkMcpToolServer({
    tools: allTools,
    emitEvent: (evt) => {
      for (const subscriber of state.subscribers) {
        subscriber(evt);
      }
    },
    getAbortSignal: () => state.abortController?.signal,
    consumePendingToolUse: () => {
      return state.pendingToolUses.shift();
    },
    appendRuntimeMessage: (message) => {
      state.messages.push(message);
    },
    sessionManager: state.sessionManager,
  });

  const session: ClaudeSdkSession = {
    subscribe(handler) {
      state.subscribers.push(handler);
      return () => {
        const idx = state.subscribers.indexOf(handler);
        if (idx !== -1) {
          state.subscribers.splice(idx, 1);
        }
      };
    },

    async prompt(text, options) {
      // Drain any pending steer text by prepending to the current prompt
      const steerText = state.pendingSteer.splice(0).join("\n");
      let effectivePrompt = steerText ? `${steerText}\n\n${text}` : text;

      state.streaming = true;
      state.abortController = new AbortController();
      const { signal } = state.abortController;

      // Embed images inline in the prompt text as markdown data URIs.
      // The SDK's Options type does NOT have a top-level `images` field. The
      // alternative is AsyncIterable<SDKUserMessage> prompt format with structured
      // multimodal content blocks, but that requires converting all prompt
      // construction (including steer text prepending) to structured format.
      // Data URI markdown is interpreted correctly by Claude and is sufficient
      // for the current use cases (screenshots, diagrams).
      if (options?.images && options.images.length > 0) {
        const imageMarkdown = options.images
          .map((img) => `![image](data:${img.media_type};base64,${img.data})`)
          .join("\n");
        effectivePrompt = `${imageMarkdown}\n\n${effectivePrompt}`;
      }

      try {
        if (state.sessionManager?.appendMessage) {
          const userMessage = {
            role: "user" as const,
            content: effectivePrompt,
            timestamp: Date.now(),
          } as AgentMessage;
          state.messages.push(userMessage);
          try {
            state.sessionManager.appendMessage(userMessage);
          } catch {
            // Non-fatal — user message persistence failed
          }
        } else {
          state.messages.push({
            role: "user",
            content: effectivePrompt,
            timestamp: Date.now(),
          } as AgentMessage);
        }

        const queryOptions = buildQueryOptions(params, state, toolServer);
        const queryInstance = query({ prompt: effectivePrompt, options: queryOptions as never });

        // Wire abort signal to queryInstance.interrupt() so cancellation works
        // even when blocked on generator.next().
        const onAbort = () => {
          const qi = queryInstance as { interrupt?: () => Promise<void> };
          if (typeof qi.interrupt === "function") {
            qi.interrupt().catch(() => {});
          }
        };
        signal.addEventListener("abort", onAbort, { once: true });

        try {
          for await (const message of queryInstance) {
            if (signal.aborted) {
              break;
            }
            translateSdkMessageToEvents(message as never, state);
          }
        } finally {
          signal.removeEventListener("abort", onAbort);
        }

        // After the query loop: throw if the SDK returned an error result message.
        // translateSdkMessageToEvents() stores the error in state.sdkResultError
        // when it encounters a result with subtype "error_*" or is_error: true.
        // Throwing here ensures prompt() rejects rather than resolving silently.
        if (state.sdkResultError) {
          const errMsg = state.sdkResultError;
          state.sdkResultError = undefined;
          throw new Error(errMsg);
        }
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") {
          // Aborted — normal flow, do not re-throw
          return;
        }
        // If SDK emitted a structured result error, keep that root cause even
        // when the subprocess exits with a generic code-1 transport error.
        if (state.sdkResultError) {
          const errMsg = state.sdkResultError;
          state.sdkResultError = undefined;
          throw mapSdkError(new Error(errMsg, { cause: err }));
        }
        // Enrich process-exit errors with captured stderr for actionable diagnostics.
        if (err instanceof Error && state.lastStderr) {
          err.message = `${err.message}\nSubprocess stderr: ${state.lastStderr}`;
        }
        throw mapSdkError(err);
      } finally {
        // Turn-local correlation state must not leak into the next prompt turn.
        // At this point, all SDK messages for this turn have already been processed.
        clearTurnToolCorrelationState();
        state.streaming = false;
      }
    },

    async steer(text) {
      state.pendingSteer.push(text);
    },

    // -------------------------------------------------------------------------
    // abort — cancels the current in-flight query
    // -------------------------------------------------------------------------
    abort(): Promise<void> {
      state.abortController?.abort();
    },

    abortCompaction() {
      if (state.compacting) {
        state.abortController?.abort();
      }
    },

    dispose() {
      if (!state.claudeSdkSessionId) {
        if (state.messages.length > 0) {
          log.warn(
            "claude-sdk dispose(): no session_id captured — server-side session may be orphaned",
          );
        }
        return;
      }
      if (params.sessionManager?.appendCustomEntry) {
        try {
          params.sessionManager.appendCustomEntry(
            "openclaw:claude-sdk-session-id",
            state.claudeSdkSessionId,
          );
        } catch {
          // Non-fatal — session_id persistence failed
        }
      }
    },

    get isStreaming() {
      return state.streaming;
    },
    get isCompacting() {
      return state.compacting;
    },
    get messages() {
      return state.messages;
    },
    get sessionId() {
      return params.sessionId;
    },
    get claudeSdkSessionId() {
      return state.claudeSdkSessionId;
    },

    // Local mirror only. Server-side session history remains authoritative.
    replaceMessages(messages: AgentMessage[]) {
      state.messages = [...messages];
    },
    setSystemPrompt(text: string) {
      state.systemPrompt = text;
    },

    runtimeHints: {
      allowSyntheticToolResults: false,
      enforceFinalTag: false,
      managesOwnHistory: true,
      supportsStreamFnWrapping: false,
      sessionFile: params.sessionFile,
    } satisfies AgentRuntimeHints,
  };

  return session;
}
