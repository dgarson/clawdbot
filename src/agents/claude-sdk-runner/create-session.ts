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
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ImageContent } from "@mariozechner/pi-ai";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import {
  ATTACHMENT_MANIFEST_KEY,
  loadManifestFromEntries,
  serializeManifest,
} from "./attachment-manifest.js";
import { resolveClaudeSubprocessEnv } from "./config.js";
import { buildChannelSnapshot } from "./context/channel-snapshot.js";
import { buildThreadContext } from "./context/thread-context.js";
import { buildChannelTools } from "./context/tools.js";
import { mapSdkError } from "./error-mapping.js";
import { translateSdkMessageToEvents } from "./event-adapter.js";
import { createClaudeSdkMcpToolServer } from "./mcp-tool-server.js";
import { buildProviderEnv } from "./provider-env.js";
import {
  CLAUDE_SDK_STDERR_TAIL_MAX_CHARS,
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
    case "low":
      return 4000;
    case "medium":
      return 10000;
    case "high":
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

function appendTail(currentTail: string | undefined, chunk: string, maxChars: number): string {
  if (!chunk) {
    return currentTail ?? "";
  }
  const next = `${currentTail ?? ""}${chunk}`;
  if (next.length <= maxChars) {
    return next;
  }
  return next.slice(-maxChars);
}

type AnthropicBase64ImageMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
type RuntimePromptImage = ImageContent & { media_type?: string };
type PersistedUserContent = string | Array<{ type: "text"; text: string } | ImageContent>;
type ClaudePromptInput = string | AsyncIterable<SDKUserMessage>;

const ANTHROPIC_BASE64_IMAGE_MEDIA_TYPES: ReadonlySet<AnthropicBase64ImageMediaType> = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

function normalizePromptImageMimeType(image: RuntimePromptImage): string {
  const runtimeMimeType = typeof image.mimeType === "string" ? image.mimeType.trim() : "";
  if (runtimeMimeType.length > 0) {
    return runtimeMimeType;
  }
  const legacyMimeType = typeof image.media_type === "string" ? image.media_type.trim() : "";
  if (legacyMimeType.length > 0) {
    return legacyMimeType;
  }
  return "image/png";
}

function normalizePromptImages(images: RuntimePromptImage[] | undefined): ImageContent[] {
  if (!Array.isArray(images) || images.length === 0) {
    return [];
  }
  const normalized: ImageContent[] = [];
  for (const image of images) {
    if (!image || typeof image.data !== "string" || image.data.length === 0) {
      continue;
    }
    normalized.push({
      type: "image",
      data: image.data,
      mimeType: normalizePromptImageMimeType(image),
    });
  }
  return normalized;
}

function toAnthropicImageMediaType(mimeType: string): AnthropicBase64ImageMediaType {
  const normalized = mimeType.trim().toLowerCase();
  if (normalized === "image/jpg") {
    return "image/jpeg";
  }
  if (ANTHROPIC_BASE64_IMAGE_MEDIA_TYPES.has(normalized as AnthropicBase64ImageMediaType)) {
    return normalized as AnthropicBase64ImageMediaType;
  }
  return "image/png";
}

function buildPersistedUserContent(text: string, images: ImageContent[]): PersistedUserContent {
  if (images.length === 0) {
    return text;
  }
  return [{ type: "text", text }, ...images];
}

function buildClaudePromptInput(text: string, images: ImageContent[]): ClaudePromptInput {
  if (images.length === 0) {
    return text;
  }
  const userMessage: SDKUserMessage = {
    type: "user",
    session_id: "",
    parent_tool_use_id: null,
    message: {
      role: "user",
      content: [
        { type: "text", text },
        ...images.map((image) => ({
          type: "image" as const,
          source: {
            type: "base64" as const,
            media_type: toAnthropicImageMediaType(image.mimeType),
            data: image.data,
          },
        })),
      ],
    },
  };
  return (async function* () {
    yield userMessage;
  })();
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
    // Use the caller-provided workspace for Claude SDK subprocess execution.
    cwd: params.workspaceDir,
    // Pass AbortController for canonical SDK cancellation. The SDK terminates
    // the underlying subprocess when this signal aborts. We also wire
    // interrupt() as defense-in-depth in the for-await loop.
    abortController: state.abortController,
    // Capture subprocess stderr so process exit errors have actionable context.
    // Without this the SDK discards stderr and "exited with code N" is opaque.
    stderr: (data: string) => {
      const tail = appendTail(state.lastStderr, data, CLAUDE_SDK_STDERR_TAIL_MAX_CHARS).trim();
      if (tail) {
        state.lastStderr = tail;
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

  const providerEnv = buildProviderEnv();

  const resolvedSubprocessEnv = resolveClaudeSubprocessEnv({
    providerEnv,
    claudeSdkConfig: params.claudeSdkConfig,
  });
  if (resolvedSubprocessEnv) {
    queryOptions["env"] = resolvedSubprocessEnv;
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
  const { transcriptProvider, transcriptApi } = resolveTranscriptMetadata(params.provider);

  // Build enriched system prompt with structured channel/thread context if provided.
  // The context is injected as a labeled JSON section so Claude can reference the
  // channel snapshot and thread history without needing history concatenation.
  let systemPrompt = params.systemPrompt;
  if (params.structuredContextInput) {
    const snapshot = buildChannelSnapshot(params.structuredContextInput);
    const thread = buildThreadContext(params.structuredContextInput.thread ?? null);
    const parts = ["\n\n### Channel Context", "```json", JSON.stringify(snapshot, null, 2), "```"];
    if (thread) {
      parts.push("\n### Thread Context", "```json", JSON.stringify(thread, null, 2), "```");
    }
    systemPrompt = params.systemPrompt + parts.join("\n");
  }

  // Load attachment manifest from session history for cross-turn media deduplication.
  const allEntries = params.sessionManager?.getEntries?.() ?? [];
  const manifest = loadManifestFromEntries(allEntries);

  // Build channel exploration tools from structured context (if provided).
  const channelTools = params.structuredContextInput
    ? buildChannelTools(params.structuredContextInput)
    : [];

  // Internal adapter state
  const state: ClaudeSdkEventAdapterState = {
    subscribers: [],
    streaming: false,
    compacting: false,
    pendingCompactionEnd: undefined,
    abortController: null,
    systemPrompt,
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
    sessionIdPersisted: false,
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
  // before_tool_call hooks, abort signal propagation, and loop detection upstream).
  // Channel tools are appended last so they can't shadow user-provided tools.
  const allTools = [...params.tools, ...params.customTools, ...channelTools];

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
      if (state.streaming) {
        throw new Error("Claude SDK session already has an in-flight prompt");
      }

      // Drain any pending steer text by prepending to the current prompt
      const steerText = state.pendingSteer.splice(0).join("\n");
      const effectivePrompt = steerText ? `${steerText}\n\n${text}` : text;
      const promptImages = normalizePromptImages(
        options?.images as RuntimePromptImage[] | undefined,
      );
      const persistedUserContent = buildPersistedUserContent(effectivePrompt, promptImages);
      const claudePromptInput = buildClaudePromptInput(effectivePrompt, promptImages);

      state.streaming = true;
      state.abortController = new AbortController();
      const { signal } = state.abortController;

      try {
        if (state.sessionManager?.appendMessage) {
          const userMessage = {
            role: "user" as const,
            content: persistedUserContent,
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
            content: persistedUserContent,
            timestamp: Date.now(),
          } as AgentMessage);
        }

        const queryOptions = buildQueryOptions(params, state, toolServer);
        const queryInstance = query({ prompt: claudePromptInput, options: queryOptions as never });

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
          throw new Error(state.sdkResultError);
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
      return Promise.resolve();
    },

    abortCompaction() {
      if (state.compacting) {
        state.abortController?.abort();
      }
    },

    dispose() {
      if (state.sessionIdPersisted === true) {
        return;
      }
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
          // Persist attachment manifest alongside session ID so the next session can
          // load it via loadManifestFromEntries() for cross-turn deduplication.
          if (Object.keys(manifest.entries).length > 0) {
            params.sessionManager.appendCustomEntry(
              ATTACHMENT_MANIFEST_KEY,
              serializeManifest(manifest),
            );
          }
          state.sessionIdPersisted = true;
        } catch {
          // Non-fatal — persistence failed
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
