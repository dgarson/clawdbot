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
  ClaudeSdkEventAdapterState,
  ClaudeSdkSession,
  ClaudeSdkSessionParams,
} from "./types.js";

// ---------------------------------------------------------------------------
// ThinkLevel → maxThinkingTokens mapping
// From implementation-plan.md Section 5.3 and pr-21168-analysis.md Section 3
// ---------------------------------------------------------------------------

function resolveThinkingTokenBudget(thinkLevel?: string): number | null {
  switch (thinkLevel) {
    case "low":
      return 1024;
    case "medium":
      return 4096;
    case "high":
      return 16384;
    case "max":
      return 32768;
    default:
      return null; // "none" or undefined → disabled
  }
}

// ---------------------------------------------------------------------------
// Query options builder (extracted for reuse in interrupt-and-resume loop)
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

  // For claude-code and anthropic providers (or when no provider is set), the
  // subprocess is the Anthropic Claude CLI. Only Anthropic model IDs are valid
  // there, and OpenClaw's configured model may be from a different provider
  // (e.g. MiniMax, Grok). Omit the model entirely so the subprocess uses its
  // own default. For third-party providers (minimax, minimax-portal, zai,
  // openrouter, custom) the model is meaningful and is forwarded.
  // For claude-code/anthropic providers, only pass the model if it's an
  // Anthropic model ID (starts with "claude-"). When the gateway's default
  // model belongs to another provider (e.g. "MiniMax-M2.5"), omit it so the
  // subprocess falls back to its own default rather than sending a 404.
  // Third-party providers (minimax, minimax-portal, zai, openrouter, custom)
  // always forward the model unchanged.
  const sdkProvider = params.claudeSdkConfig?.provider ?? "claude-code";
  const isAnthropicProvider = sdkProvider === "claude-code" || sdkProvider === "anthropic";
  const resolvedModel =
    isAnthropicProvider && !params.modelId.startsWith("claude-") ? undefined : params.modelId;
  if (isAnthropicProvider && resolvedModel === undefined) {
    log.debug(
      `claude-sdk: omitting incompatible model "${params.modelId}" for provider "${sdkProvider}" (using subprocess default)`,
    );
  }

  const queryOptions: Record<string, unknown> = {
    ...(resolvedModel !== undefined && { model: resolvedModel }),
    mcpServers,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    systemPrompt: params.systemPrompt,
    // Explicitly empty tools array: disables Claude's built-in tool execution so
    // that OpenClaw tools are the sole execution path through the MCP bridge.
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
    params.claudeSdkConfig ?? { provider: "claude-code" },
    params.resolvedProviderAuth?.apiKey,
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
  // Internal adapter state
  const state: ClaudeSdkEventAdapterState = {
    subscribers: [],
    streaming: false,
    compacting: false,
    abortController: null,
    pendingSteer: [],
    messages: [],
    claudeSdkSessionId: params.claudeSdkResumeSessionId,
    sdkResultError: undefined,
    lastStderr: undefined,
    streamingBlockTypes: new Map(),
    streamingPartialMessage: null,
    streamingInProgress: false,
    sessionManager: params.sessionManager,
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
    sessionManager: state.sessionManager,
  });

  // ---------------------------------------------------------------------------
  // Session object implementing the AgentSession duck-typed interface
  // ---------------------------------------------------------------------------
  const session: ClaudeSdkSession = {
    // -------------------------------------------------------------------------
    // subscribe — registers an event handler, returns unsubscribe fn
    // -------------------------------------------------------------------------
    subscribe(handler) {
      state.subscribers.push(handler);
      return () => {
        const idx = state.subscribers.indexOf(handler);
        if (idx !== -1) {
          state.subscribers.splice(idx, 1);
        }
      };
    },

    // -------------------------------------------------------------------------
    // prompt — runs the Agent SDK query() loop for one turn
    // -------------------------------------------------------------------------
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
        // Persist the user message to JSONL before starting the query loop.
        // Only persist on first iteration — steer-resumed loops should not double-persist.
        let userMessagePersisted = false;
        if (!userMessagePersisted && state.sessionManager?.appendMessage) {
          try {
            state.sessionManager.appendMessage({
              role: "user",
              content: effectivePrompt,
              timestamp: Date.now(),
            });
          } catch {
            // Non-fatal — user message persistence failed
          }
          userMessagePersisted = true;
        }

        // Outer loop: supports interrupt-and-resume for mid-loop steer injection.
        // When steer() is called while query() is running, we interrupt the current
        // query at the next message yield and resume with the steer text as a new
        // user turn. This gives near-parity with Pi's mid-loop steer behavior.
        // eslint-disable-next-line no-constant-condition
        while (true) {
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

          let interruptedForSteer = false;
          try {
            for await (const message of queryInstance) {
              if (signal.aborted) {
                break;
              }
              translateSdkMessageToEvents(message as never, state);

              // Check for pending steer between SDK message yields.
              // If steer text was queued (e.g., by queueEmbeddedPiMessage),
              // interrupt the current query so we can resume with the steer
              // text as the next user message. This gives mid-loop injection.
              if (state.pendingSteer.length > 0 && !signal.aborted) {
                const qi = queryInstance as { interrupt?: () => Promise<void> };
                if (typeof qi.interrupt === "function") {
                  await qi.interrupt();
                }
                interruptedForSteer = true;
                break;
              }
            }
          } finally {
            signal.removeEventListener("abort", onAbort);
          }

          if (!interruptedForSteer || signal.aborted) {
            // Normal completion or abort — exit the outer loop
            break;
          }

          // Interrupted for steer: drain steer queue and resume with steer text
          // as the new prompt. The server-side session already has the conversation
          // context (including the interrupted response), so resume continues
          // naturally with the injected user message.
          const pendingSteer = state.pendingSteer.splice(0).join("\n");
          effectivePrompt = pendingSteer;
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
        state.streaming = false;
      }
    },

    // -------------------------------------------------------------------------
    // steer — queues text to be prepended to the next prompt
    // -------------------------------------------------------------------------
    async steer(text) {
      // KNOWN LIMITATION: In Pi, steer() injects text into the current agentic
      // loop (between tool-call rounds). In Claude SDK, the agentic loop is opaque
      // inside query() — we can't inject mid-loop. Steer text is queued and
      // prepended to the next prompt() call. This means steer messages are
      // delivered on the next turn, not mid-generation. This is acceptable for POC
      // since the message is not lost, just delayed to the next turn.
      state.pendingSteer.push(text);
    },

    // -------------------------------------------------------------------------
    // abort — cancels the current in-flight query
    // -------------------------------------------------------------------------
    abort() {
      state.abortController?.abort();
    },

    // -------------------------------------------------------------------------
    // abortCompaction — for Pi compat; only relevant if compaction detected
    // -------------------------------------------------------------------------
    abortCompaction() {
      if (state.compacting) {
        state.abortController?.abort();
      }
    },

    // -------------------------------------------------------------------------
    // dispose — persists the Claude SDK session_id via SessionManager
    // -------------------------------------------------------------------------
    dispose() {
      if (state.claudeSdkSessionId && params.sessionManager?.appendCustomEntry) {
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

    // -------------------------------------------------------------------------
    // Properties
    // -------------------------------------------------------------------------
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

    // -------------------------------------------------------------------------
    // agent shim — matches Pi's agent object surface
    // attempt.ts assigns to agent.streamFn for Pi (no-op for us) and calls
    // agent.replaceMessages() to set the history (local-only for us).
    // -------------------------------------------------------------------------
    agent: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      streamFn: undefined as any, // writable no-op — Pi compat
      replaceMessages(messages: AgentMessage[]) {
        // Local mirror update only — does NOT send history to Claude API.
        // The server-side session already has the full conversation history.
        state.messages = [...messages];
      },
    },
  };

  return session;
}
