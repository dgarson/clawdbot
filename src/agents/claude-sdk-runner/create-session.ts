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

import { createHash } from "node:crypto";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { ImageContent } from "@mariozechner/pi-ai";
import { emitDiagnosticEvent } from "../../infra/diagnostic-events.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { createCoreHookRunner, getGlobalHookRunner } from "../../plugins/hook-runner-global.js";
import {
  ATTACHMENT_MANIFEST_KEY,
  getThreadAttachments,
  isAlreadyAttached,
  loadManifestFromEntries,
  recordAttachment,
  serializeManifest,
} from "./attachment-manifest.js";
import { resolveClaudeSubprocessEnv } from "./config.js";
import { mapSdkError } from "./error-mapping.js";
import { translateSdkMessageToEvents } from "./event-adapter.js";
import { createClaudeSdkMcpToolServer } from "./mcp-tool-server.js";
import { buildProviderEnv } from "./provider-env.js";
import {
  buildScratchpadTool,
  buildScratchpadNudge,
  detectPlanPatterns,
  SCRATCHPAD_ENTRY_KEY,
  SCRATCHPAD_NOTES_KEY,
  SCRATCHPAD_PLAN_KEY,
  SCRATCHPAD_REFS_KEY,
  type ScratchpadState,
} from "./scratchpad/index.js";
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

function estimateImageDataBytes(data: string): number {
  const normalized = data.replace(/\s+/g, "");
  if (normalized.length === 0) {
    return 0;
  }
  const decoded = Buffer.from(normalized, "base64");
  return decoded.length > 0 ? decoded.length : Buffer.byteLength(data);
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

  // Fire before_session_create hook: collect system prompt sections and tools from
  // all registered subscribers (built-in core subscriber + plugin subscribers).
  // Falls back to a core-only HookRunner containing just the built-in
  // coreSessionContextSubscriber when the global hook runner hasn't been initialized.
  const hookEvent = {
    systemPrompt: params.systemPrompt,
    structuredContextInput: params.structuredContextInput,
    platform: params.structuredContextInput?.platform,
    channelId: params.structuredContextInput?.channelId,
    sessionKey: params.sessionId,
    diagnosticsEnabled: params.diagnosticsEnabled,
  };
  const hookStartMs = Date.now();
  const runner = getGlobalHookRunner() ?? createCoreHookRunner();
  const hookContrib = await runner.runBeforeSessionCreate(hookEvent, {
    sessionId: params.sessionId,
  });
  const hookDurationMs = Date.now() - hookStartMs;

  const hookSections = hookContrib?.systemPromptSections ?? [];
  const hookTools = hookContrib?.tools ?? [];
  const sectionsTotalChars = hookSections.reduce((sum, section) => sum + section.length, 0);
  if (params.diagnosticsEnabled) {
    log.debug(
      `before_session_create profile: sessionKey=${params.sessionId} hookDurationMs=${hookDurationMs} sectionsAdded=${hookSections.length} sectionsTotalChars=${sectionsTotalChars} toolsAdded=${hookTools.length}`,
    );
    emitDiagnosticEvent({
      type: "session.hook",
      sessionKey: params.sessionId,
      hook: "before_session_create",
      hookDurationMs,
      sectionsAdded: hookSections.length,
      sectionsTotalChars,
      toolsAdded: hookTools.length,
    });
  }

  // Append subscriber sections to the base system prompt.
  const systemPrompt =
    hookSections.length > 0
      ? params.systemPrompt + "\n\n" + hookSections.join("\n\n")
      : params.systemPrompt;

  // Load attachment manifest from session history for cross-turn media deduplication.
  const allEntries = params.sessionManager?.getEntries?.() ?? [];
  const manifest = loadManifestFromEntries(allEntries);

  // Load each scratchpad space from session history (last entry per key).
  const reversedEntries = [...allEntries].toReversed();
  const findLast = (key: string) =>
    reversedEntries.find((e) => e.type === "custom" && e.customType === key);

  const notesEntry = findLast(SCRATCHPAD_NOTES_KEY);
  const planEntry = findLast(SCRATCHPAD_PLAN_KEY);
  const refsEntry = findLast(SCRATCHPAD_REFS_KEY);

  // Backwards compat: if no new-format notes entry, load old monolithic key into notes.
  let initialNotes: string | undefined =
    notesEntry && typeof notesEntry.data === "string" ? notesEntry.data : undefined;
  if (initialNotes === undefined) {
    const legacyEntry = findLast(SCRATCHPAD_ENTRY_KEY);
    if (legacyEntry && typeof legacyEntry.data === "string") {
      initialNotes = legacyEntry.data;
    }
  }
  const initialPlan: string | undefined =
    planEntry && typeof planEntry.data === "string" ? planEntry.data : undefined;
  const initialRefs: string[] =
    refsEntry && Array.isArray(refsEntry.data)
      ? (refsEntry.data as unknown[]).filter((x): x is string => typeof x === "string")
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
    sdkModelUsage: undefined,
    lastStderr: undefined,
    streamingBlockTypes: new Map(),
    streamingPartialMessage: null,
    streamingInProgress: false,
    sessionManager: params.sessionManager,
    transcriptProvider,
    transcriptApi,
    modelCost: params.modelCost,
    sessionIdPersisted: false,
    diagnosticSessionKey: params.sessionId,
    pendingCompactionReattachments: 0,
    notes: initialNotes,
    plan: initialPlan,
    refs: initialRefs,
    turnCount: 0,
    pendingPlanNudge: false,
    pendingCompactionNudge: false,
    lastScratchpadUseTurn: 0,
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

  // Build scratchpad tool if enabled (default: on).
  const scratchpadEnabled = params.claudeSdkConfig?.scratchpad?.enabled !== false;
  const scratchpadTools: Array<(typeof hookTools)[number]> = [];
  if (scratchpadEnabled) {
    const scratchpadState: ScratchpadState = {
      get notes() {
        return state.notes;
      },
      set notes(v) {
        state.notes = v;
        state.lastScratchpadUseTurn = state.turnCount;
      },
      get plan() {
        return state.plan;
      },
      set plan(v) {
        state.plan = v;
        state.lastScratchpadUseTurn = state.turnCount;
      },
      get refs() {
        return state.refs;
      },
      set refs(v) {
        state.refs = v;
        state.lastScratchpadUseTurn = state.turnCount;
      },
      appendCustomEntry: (key, value) => {
        if (params.sessionManager?.appendCustomEntry) {
          params.sessionManager.appendCustomEntry(key, value);
        }
      },
    };
    const tool = buildScratchpadTool({ state: scratchpadState });
    scratchpadTools.push(tool as never);
    // Inject scratchpad guidance into system prompt so Claude knows the three-space API.
    const scratchpadPromptLines = [
      "## Session Scratchpad",
      "",
      "`session.scratchpad` — call with `action` (required). All three spaces are prepended to every message, surviving compaction.",
      "",
      "| Space | Limit | Use for |",
      "|-------|-------|---------|",
      "| notes | 4,000 chars | findings, decisions, constraints, partial state |",
      "| plan  | 2,000 chars | ordered step list; update as work progresses |",
      "| refs  | 50 items    | file paths, URLs, PR/issue links, identifiers |",
      "",
      "| action | params | budget enforcement |",
      "|--------|--------|-------------------|",
      "| `set_notes`    | `content` (str) | truncates to 4,000 with warning |",
      "| `append_notes` | `content` (str) | rejected if combined > 4,000; notes unchanged — use set_notes to overwrite |",
      "| `set_plan`     | `content` (str) | truncates to 2,000 with warning |",
      "| `refs.add`     | `ref` (non-empty str) | drops oldest atomically when at 50 |",
      "| `refs.remove`  | `ref` (non-empty str) | exact-match; returns error if not found |",
      "| `refs.set`     | `items` (str[]) | caps to first 50; non-strings dropped silently |",
      "",
      "Trigger `set_plan` as soon as a multi-step plan forms. Use `append_notes` for discoveries; `set_notes` when notes are getting full or need restructuring. Add refs as you identify them; remove when done.",
      "",
      "Never store: full file contents, conversation history, speculation, or the user's original request.",
    ];
    const nudgeAfterTurnsVal = params.claudeSdkConfig?.scratchpad?.nudgeAfterTurns ?? 0;
    const nudgeOnPlanVal = params.claudeSdkConfig?.scratchpad?.nudgeOnPlanDetected ?? 0;
    const nudgeCompactionVal = params.claudeSdkConfig?.scratchpad?.nudgeAfterCompaction ?? 0;
    const nudgeStaleVal = params.claudeSdkConfig?.scratchpad?.nudgeTurnsSinceLastUse ?? 0;
    if (
      nudgeAfterTurnsVal > 0 ||
      nudgeOnPlanVal > 0 ||
      nudgeCompactionVal > 0 ||
      nudgeStaleVal > 0
    ) {
      scratchpadPromptLines.push("");
      scratchpadPromptLines.push(
        "**Auto-nudges enabled:** You may see `[Hint: ...]` reminders to use your scratchpad. Follow these hints — they are triggered by turn count, plan detection, context compaction, or stale content.",
      );
    }
    const scratchpadPromptSection = scratchpadPromptLines.join("\n");
    state.systemPrompt = state.systemPrompt + "\n\n" + scratchpadPromptSection;
  }

  // Build in-process MCP tool server from OpenClaw tools (already wrapped with
  // before_tool_call hooks, abort signal propagation, and loop detection upstream).
  // Hook-contributed tools (e.g. channel.context, channel.messages) are appended last
  // so they can't shadow user-provided tools.
  const allTools = [...params.tools, ...params.customTools, ...hookTools, ...scratchpadTools];

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

  if (params.structuredContextInput?.anchor.threadId) {
    const threadId = params.structuredContextInput.anchor.threadId;
    // On compaction start, queue thread media re-attachment
    // (uses existing pendingSteer mechanism)
    state.subscribers.push((evt) => {
      if ((evt as { type: string }).type === "auto_compaction_start") {
        const threadAttachments = getThreadAttachments(manifest, threadId);
        if (threadAttachments.length > 0) {
          state.pendingCompactionReattachments += threadAttachments.length;
          state.pendingSteer.push(
            `[Post-compaction context recovery: re-attaching ${threadAttachments.length} media item(s) from this thread: ${threadAttachments.map((a) => a.display_name).join(", ")}]`,
          );
        }
      }
    });
  }

  // Plan detection subscriber: watch assistant text for plan-like patterns.
  const nudgeOnPlanDetected =
    scratchpadEnabled && (params.claudeSdkConfig?.scratchpad?.nudgeOnPlanDetected ?? 0) > 0;
  if (nudgeOnPlanDetected) {
    let currentTurnText = "";
    state.subscribers.push((evt) => {
      const evtType = (evt as { type: string }).type;
      if (evtType === "message_start") {
        currentTurnText = "";
      } else if (evtType === "message_update") {
        const ame = (evt as { assistantMessageEvent?: { type?: string; delta?: string } })
          .assistantMessageEvent;
        if (ame?.type === "text_delta" && ame.delta) {
          currentTurnText += ame.delta;
        }
      } else if (evtType === "message_end") {
        const hasContent = !!state.notes || !!state.plan || state.refs.length > 0;
        if (!hasContent && currentTurnText.length > 0 && detectPlanPatterns(currentTurnText)) {
          state.pendingPlanNudge = true;
        }
        currentTurnText = "";
      }
    });
  }

  // Compaction nudge subscriber: set flag after compaction completes.
  const nudgeAfterCompaction =
    scratchpadEnabled && (params.claudeSdkConfig?.scratchpad?.nudgeAfterCompaction ?? 0) > 0;
  if (nudgeAfterCompaction) {
    state.subscribers.push((evt) => {
      if ((evt as { type: string }).type === "auto_compaction_end") {
        state.pendingCompactionNudge = true;
      }
    });
  }

  let lastSyncedTs = params.structuredContextInput?.anchor.ts;
  if (params.structuredContextInput?.thread) {
    const threadReplies = params.structuredContextInput.thread.replies;
    if (threadReplies.length > 0) {
      const lastReplyTs = threadReplies[threadReplies.length - 1].ts;
      if (Number(lastReplyTs) > Number(lastSyncedTs)) {
        lastSyncedTs = lastReplyTs;
      }
    }
  }

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
      state.turnCount += 1;

      // --- Scratchpad auto-trigger nudges (inject into pendingSteer BEFORE draining) ---
      if (scratchpadEnabled) {
        const hasContent = !!state.notes || !!state.plan || state.refs.length > 0;
        const nudgeAfterTurns = params.claudeSdkConfig?.scratchpad?.nudgeAfterTurns ?? 0;
        if (nudgeAfterTurns > 0 && state.turnCount >= nudgeAfterTurns && !hasContent) {
          state.pendingSteer.push(buildScratchpadNudge("turn-count", state.turnCount));
        }
        if (state.pendingPlanNudge) {
          state.pendingPlanNudge = false;
          if (!hasContent) {
            state.pendingSteer.push(buildScratchpadNudge("plan-detected"));
          }
        }
        if (state.pendingCompactionNudge) {
          state.pendingCompactionNudge = false;
          state.pendingSteer.push(buildScratchpadNudge("post-compaction"));
        }
        const nudgeTurnsSinceLastUse =
          params.claudeSdkConfig?.scratchpad?.nudgeTurnsSinceLastUse ?? 0;
        if (
          nudgeTurnsSinceLastUse > 0 &&
          hasContent &&
          state.lastScratchpadUseTurn > 0 &&
          state.turnCount - state.lastScratchpadUseTurn >= nudgeTurnsSinceLastUse
        ) {
          state.pendingSteer.push(
            buildScratchpadNudge("stale-scratchpad", state.turnCount - state.lastScratchpadUseTurn),
          );
        }
      }

      if (
        params.structuredContextInput?.anchor.threadId &&
        params.structuredContextInput.fetcher.fetchNewReplies &&
        lastSyncedTs
      ) {
        try {
          const newReplies = await params.structuredContextInput.fetcher.fetchNewReplies(
            params.structuredContextInput.anchor.threadId,
            lastSyncedTs,
          );
          if (newReplies.length > 0) {
            const newRepliesText = newReplies
              .map((r) => `- ${r.authorName}: "${r.text}"`)
              .join("\n");
            state.pendingSteer.push(
              `[New messages received in this thread since your last turn:]\n${newRepliesText}`,
            );
            lastSyncedTs = newReplies[newReplies.length - 1].ts;
          }
        } catch (e) {
          log.warn("Failed to fetch new replies for context sync", { error: e });
        }
      }

      // Drain any pending steer text by prepending to the current prompt
      let steerText = state.pendingSteer.splice(0).join("\n");
      let effectivePrompt = text;
      const reattachedAfterCompaction = state.pendingCompactionReattachments;
      state.pendingCompactionReattachments = 0;

      let promptImages = normalizePromptImages(options?.images as RuntimePromptImage[] | undefined);
      const attachmentsTotal = promptImages.length;
      let deduplicated = 0;
      let totalMediaBytes = 0;

      // Deduplicate images using attachment manifest
      if (promptImages.length > 0) {
        const newImages: ImageContent[] = [];
        const alreadyAttached: string[] = [];
        for (const img of promptImages) {
          const hash = createHash("sha256").update(img.data).digest("hex");
          // Generate a synthetic artifact ID if actual is unavailable
          const artifactId = `img-${hash.slice(0, 12)}`;

          if (isAlreadyAttached(manifest, artifactId, hash)) {
            alreadyAttached.push(artifactId);
          } else {
            newImages.push(img);
            totalMediaBytes += estimateImageDataBytes(img.data);
            recordAttachment(manifest, {
              artifactId,
              displayName: `Attached Image (${img.mimeType})`,
              mediaType: img.mimeType,
              contentHash: hash,
              sourceMessageId: params.structuredContextInput?.anchor.messageId || "unknown",
              sourceThreadId: params.structuredContextInput?.anchor.threadId || null,
              turn: state.messages.length,
            });
          }
        }
        promptImages = newImages;
        deduplicated = alreadyAttached.length;
        if (alreadyAttached.length > 0) {
          const prefix = steerText ? "\n" : "";
          steerText += `${prefix}[Note: ${alreadyAttached.length} image(s) omitted because they were already attached in previous turns.]`;
        }
      }

      if (params.diagnosticsEnabled) {
        emitDiagnosticEvent({
          type: "session.attachments",
          sessionKey: state.diagnosticSessionKey,
          attachmentsTotal,
          deduplicated,
          reattachedAfterCompaction,
          totalMediaBytes,
        });
      }

      effectivePrompt = steerText ? `${steerText}\n\n${effectivePrompt}` : effectivePrompt;
      const persistedUserContent = buildPersistedUserContent(effectivePrompt, promptImages);

      // Prepend scratchpad for SDK only (not persisted to JSONL).
      // Only include sections that have content; omit the block entirely if all empty.
      let sdkPrompt = effectivePrompt;
      const hasNotes = !!state.notes;
      const hasPlan = !!state.plan;
      const hasRefs = state.refs.length > 0;
      if (hasNotes || hasPlan || hasRefs) {
        const parts: string[] = ["[Session Scratchpad]"];
        if (hasNotes) {
          parts.push(state.notes as string);
        }
        if (hasPlan) {
          if (hasNotes) {
            parts.push("");
          }
          parts.push("Plan:");
          parts.push(state.plan as string);
        }
        if (hasRefs) {
          if (hasNotes || hasPlan) {
            parts.push("");
          }
          parts.push("References:");
          for (const ref of state.refs) {
            parts.push(`• ${ref}`);
          }
        }
        parts.push("[End Scratchpad]");
        sdkPrompt = `${parts.join("\n")}\n\n${sdkPrompt}`;
      }
      const claudePromptInput = buildClaudePromptInput(sdkPrompt, promptImages);

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

        // After the query loop: log per-model cache/token usage when diagnostics enabled.
        if (params.diagnosticsEnabled && state.sdkModelUsage) {
          const promptChars = state.systemPrompt.length;
          const usageLines = Object.entries(state.sdkModelUsage)
            .map(([model, u]) => {
              const parts = [
                `model=${model}`,
                `cacheWrite=${u.cacheCreationInputTokens ?? 0}`,
                `cacheRead=${u.cacheReadInputTokens ?? 0}`,
                `input=${u.inputTokens ?? 0}`,
              ];
              return `  ${parts.join(" ")}`;
            })
            .join("\n");
          log.debug(`claude-sdk turn usage (system prompt ${promptChars} chars):\n${usageLines}`);
        }
        state.sdkModelUsage = undefined;

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
