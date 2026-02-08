import type { OpenClawConfig } from "../../config/config.js";
import { createInternalHookEvent, triggerInternalHook } from "../../hooks/internal-hooks.js";
import { splitMediaFromOutput } from "../../media/parse.js";
import {
  extractToolErrorMessage,
  extractToolResultText,
  isToolResultError,
  sanitizeToolResult,
} from "../pi-embedded-subscribe.tools.js";
import { inferToolMetaFromArgs } from "../pi-embedded-utils.js";
import { normalizeToolName } from "../tool-policy.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * Mutable run state shared between the SDK runner and hooks.
 * The runner updates `assistantTexts`; hooks update `toolMetas` and `lastToolError`.
 * The preCompactHook reads all fields for Meridia-compatible context snapshots.
 */
export type SdkHooksRunState = {
  assistantTexts: string[];
  toolMetas: Array<{ toolName?: string; meta?: string }>;
  lastToolError?: { toolName: string; meta?: string; error?: string };
};

/** Extend exec/bash tool metadata with pty/elevated flags (mirrors Pi agent). */
function extendExecMeta(toolName: string, args: unknown, meta?: string): string | undefined {
  const normalized = toolName.trim().toLowerCase();
  if (normalized !== "exec" && normalized !== "bash") {
    return meta;
  }
  if (!args || typeof args !== "object") {
    return meta;
  }
  const record = args as Record<string, unknown>;
  const flags: string[] = [];
  if (record.pty === true) {
    flags.push("pty");
  }
  if (record.elevated === true) {
    flags.push("elevated");
  }
  if (flags.length === 0) {
    return meta;
  }
  const suffix = flags.join(" · ");
  return meta ? `${meta} · ${suffix}` : suffix;
}

function normalizeSdkToolName(
  raw: string,
  mcpServerName: string,
): { name: string; rawName: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { name: "tool", rawName: "" };
  }
  const parts = trimmed.split("__");
  const withoutMcpPrefix =
    parts.length >= 3 && parts[0] === "mcp" && parts[1] === mcpServerName
      ? parts.slice(2).join("__")
      : parts.length >= 3 && parts[0] === "mcp"
        ? parts.slice(2).join("__")
        : trimmed;
  return { name: normalizeToolName(withoutMcpPrefix), rawName: trimmed };
}

export type SdkHookEventName =
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "SessionStart"
  | "SessionEnd"
  | "UserPromptSubmit"
  | "Stop"
  | "SubagentStart"
  | "SubagentStop"
  | "PreCompact";

export type SdkHookContext = {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
};

export type SdkHookCallback = (
  input: unknown,
  toolUseId: unknown,
  context: unknown,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export type SdkHookCallbackMatcher = {
  matcher?: string;
  hooks: SdkHookCallback[];
  timeout?: number;
};

export type SdkHooksConfig = Partial<Record<SdkHookEventName, SdkHookCallbackMatcher[]>>;

function sanitizeHookToolPayload(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }
  return sanitizeToolResult(value);
}

function extractHookToolText(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  }
  return extractToolResultText(value) ?? undefined;
}

export function buildClawdbrainSdkHooks(params: {
  mcpServerName: string;
  emitEvent: (stream: string, data: Record<string, unknown>) => void;
  onToolResult?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  onToolStartEvent?: (evt: {
    name: string;
    toolCallId?: string;
    args?: Record<string, unknown>;
  }) => void;
  onToolEndEvent?: (evt: { name: string; toolCallId?: string; isError: boolean }) => void;
  // Internal hook bridging params (Proposals 1, 2, 5, 7)
  config?: OpenClawConfig;
  runId?: string;
  sessionId?: string;
  sessionKey?: string;
  /** Mutable run state for precompact context and tool:result bridging. */
  runState?: SdkHooksRunState;
  /** When false, suppress tool output via onToolResult (P6). */
  shouldEmitToolOutput?: boolean;
}): SdkHooksConfig {
  // Tool metadata tracking (P5): maps toolCallId → inferred meta string
  const toolMetaById = new Map<string, string | undefined>();
  // Resolve the session key for internal hook events once
  const hookSessionKey = params.sessionKey ?? params.sessionId ?? params.runId;

  const emitHook = (hookEventName: SdkHookEventName, input: unknown, toolUseId: unknown) => {
    const payload = isRecord(input) ? input : { input };
    params.emitEvent("hook", { hookEventName, toolUseId, ...payload });
  };

  const toolStartHook: SdkHookCallback = async (input, toolUseId) => {
    emitHook("PreToolUse", input, toolUseId);

    const record = isRecord(input) ? input : undefined;
    const rawName = typeof record?.tool_name === "string" ? record.tool_name : "";
    const normalized = normalizeSdkToolName(rawName, params.mcpServerName);
    const args = sanitizeHookToolPayload(record?.tool_input);
    const toolCallId = typeof toolUseId === "string" ? toolUseId : undefined;

    // Track tool meta for enriched tool:result events (P5)
    const meta = extendExecMeta(
      normalized.name,
      args,
      inferToolMetaFromArgs(normalized.name, args),
    );
    if (toolCallId) {
      toolMetaById.set(toolCallId, meta);
    }

    params.emitEvent("tool", {
      phase: "start",
      name: normalized.name,
      ...(normalized.rawName ? { rawName: normalized.rawName } : {}),
      toolCallId,
      ...(meta ? { meta } : {}),
      args: isRecord(args) ? args : args !== undefined ? { value: args } : undefined,
    });

    if (toolCallId && isRecord(args)) {
      try {
        params.onToolStartEvent?.({ name: normalized.name, toolCallId, args });
      } catch {
        // ignore callback errors
      }
    }

    return {};
  };

  const toolResultHook: SdkHookCallback = async (input, toolUseId) => {
    emitHook("PostToolUse", input, toolUseId);

    const record = isRecord(input) ? input : undefined;
    const rawName = typeof record?.tool_name === "string" ? record.tool_name : "";
    const normalized = normalizeSdkToolName(rawName, params.mcpServerName);
    const resultRaw = record?.tool_response;
    const sanitized = sanitizeHookToolPayload(resultRaw);
    const resultText = extractHookToolText(resultRaw);
    const toolCallId = typeof toolUseId === "string" ? toolUseId : undefined;
    const isToolError = isToolResultError(resultRaw);

    // Retrieve and clean up tracked tool meta (P5)
    const meta = toolCallId ? toolMetaById.get(toolCallId) : undefined;
    if (toolCallId) {
      toolMetaById.delete(toolCallId);
    }

    // Extract and sanitize tool args for the hook event
    const toolArgs = isRecord(record?.tool_input)
      ? sanitizeHookToolPayload(record.tool_input)
      : undefined;

    // Accumulate tool meta state for precompact context (P2)
    if (params.runState) {
      params.runState.toolMetas.push({ toolName: normalized.name, meta });
      if (isToolError) {
        params.runState.lastToolError = {
          toolName: normalized.name,
          meta,
          error: extractToolErrorMessage(sanitized),
        };
      }
    }

    params.emitEvent("tool", {
      phase: "result",
      name: normalized.name,
      ...(normalized.rawName ? { rawName: normalized.rawName } : {}),
      toolCallId,
      ...(meta ? { meta } : {}),
      isError: isToolError,
      result: sanitized,
      ...(resultText ? { resultText } : {}),
    });

    if (toolCallId) {
      try {
        params.onToolEndEvent?.({ name: normalized.name, toolCallId, isError: isToolError });
      } catch {
        // ignore callback errors
      }
    }

    // Bridge to internal hook system for Meridia experiential-capture (P1 CRITICAL)
    if (hookSessionKey) {
      const hookEvent = createInternalHookEvent("agent", "tool:result", hookSessionKey, {
        cfg: params.config,
        runId: params.runId,
        sessionId: params.sessionId,
        sessionKey: params.sessionKey,
        toolName: normalized.name,
        toolCallId,
        meta,
        isError: isToolError,
        args: toolArgs,
        result: sanitized,
        // Include recent assistant text for richer context (P7)
        recentAssistantText: params.runState?.assistantTexts.slice(-3).join("\n").slice(-2000),
      });
      void Promise.resolve(triggerInternalHook(hookEvent)).catch(() => {});
    }

    if (resultText && params.onToolResult && params.shouldEmitToolOutput !== false) {
      try {
        const resultSplit = splitMediaFromOutput(resultText);
        await params.onToolResult({
          text: resultSplit.text,
          ...(resultSplit.mediaUrls?.length ? { mediaUrls: resultSplit.mediaUrls } : {}),
        });
      } catch {
        // ignore callback errors
      }
    }

    return {};
  };

  const toolFailureHook: SdkHookCallback = async (input, toolUseId) => {
    emitHook("PostToolUseFailure", input, toolUseId);

    const record = isRecord(input) ? input : undefined;
    const rawName = typeof record?.tool_name === "string" ? record.tool_name : "";
    const normalized = normalizeSdkToolName(rawName, params.mcpServerName);
    const error = extractToolErrorMessage(record ?? input);
    const toolCallId = typeof toolUseId === "string" ? toolUseId : undefined;

    // Retrieve and clean up tracked tool meta (P5)
    const meta = toolCallId ? toolMetaById.get(toolCallId) : undefined;
    if (toolCallId) {
      toolMetaById.delete(toolCallId);
    }

    // Extract and sanitize tool args for the hook event
    const toolArgs = isRecord(record?.tool_input)
      ? sanitizeHookToolPayload(record.tool_input)
      : undefined;

    // Accumulate tool meta state for precompact context (P2)
    if (params.runState) {
      params.runState.toolMetas.push({ toolName: normalized.name, meta });
      params.runState.lastToolError = {
        toolName: normalized.name,
        meta,
        error,
      };
    }

    params.emitEvent("tool", {
      phase: "result",
      name: normalized.name,
      ...(normalized.rawName ? { rawName: normalized.rawName } : {}),
      toolCallId,
      ...(meta ? { meta } : {}),
      isError: true,
      ...(error ? { error } : {}),
    });

    if (toolCallId) {
      try {
        params.onToolEndEvent?.({ name: normalized.name, toolCallId, isError: true });
      } catch {
        // ignore callback errors
      }
    }

    // Bridge to internal hook system for Meridia experiential-capture (P1 CRITICAL)
    if (hookSessionKey) {
      const hookEvent = createInternalHookEvent("agent", "tool:result", hookSessionKey, {
        cfg: params.config,
        runId: params.runId,
        sessionId: params.sessionId,
        sessionKey: params.sessionKey,
        toolName: normalized.name,
        toolCallId,
        meta,
        isError: true,
        args: toolArgs,
        result: error,
        recentAssistantText: params.runState?.assistantTexts.slice(-3).join("\n").slice(-2000),
      });
      void Promise.resolve(triggerInternalHook(hookEvent)).catch(() => {});
    }

    if (error && params.onToolResult && params.shouldEmitToolOutput !== false) {
      try {
        const errorSplit = splitMediaFromOutput(error);
        await params.onToolResult({
          text: errorSplit.text,
          ...(errorSplit.mediaUrls?.length ? { mediaUrls: errorSplit.mediaUrls } : {}),
        });
      } catch {
        // ignore callback errors
      }
    }

    return {};
  };

  const passthroughHook =
    (hookEventName: SdkHookEventName): SdkHookCallback =>
    async (input, toolUseId, context) => {
      void context;
      emitHook(hookEventName, input, toolUseId);
      return {};
    };

  /**
   * PreCompact hook handler — emits compaction start event compatible with Pi Agent.
   * The SDK fires this hook before auto-compaction begins.
   * Input shape: { hook_event_name: 'PreCompact', trigger: 'manual' | 'auto', custom_instructions: string | null }
   *
   * IMPORTANT: We intentionally filter out `custom_instructions` to avoid leaking
   * compaction prompts/summaries into broadcast events or logs.
   */
  const preCompactHook: SdkHookCallback = async (input, toolUseId) => {
    const record = isRecord(input) ? input : undefined;
    const trigger = typeof record?.trigger === "string" ? record.trigger : "auto";

    // Emit hook event with only safe metadata (no custom_instructions)
    params.emitEvent("hook", {
      hookEventName: "PreCompact",
      toolUseId,
      hook_event_name: record?.hook_event_name,
      trigger,
    });

    // Emit compaction start event matching Pi Agent's format
    // (stream: "compaction", data: { phase: "start" })
    params.emitEvent("compaction", {
      phase: "start",
      trigger,
      source: "claude-agent-sdk",
    });

    // Bridge to internal hook system with rich context for Meridia snapshots (P2)
    if (hookSessionKey) {
      const state = params.runState;
      const hookEvent = createInternalHookEvent("agent", "precompact", hookSessionKey, {
        cfg: params.config,
        runId: params.runId,
        sessionId: params.sessionId,
        sessionKey: params.sessionKey,
        trigger,
        source: "claude-agent-sdk",
        // Rich context fields matching Pi agent (for Meridia compaction handler)
        assistantTextCount: state?.assistantTexts.length ?? 0,
        assistantTextsTail: state?.assistantTexts.slice(-5) ?? [],
        toolMetaCount: state?.toolMetas.length ?? 0,
        toolMetasTail: state?.toolMetas.slice(-10) ?? [],
        lastToolError: state?.lastToolError,
      });
      void Promise.resolve(triggerInternalHook(hookEvent)).catch(() => {});
    }

    return {};
  };

  return {
    PreToolUse: [{ hooks: [toolStartHook] }],
    PostToolUse: [{ hooks: [toolResultHook] }],
    PostToolUseFailure: [{ hooks: [toolFailureHook] }],
    Notification: [{ hooks: [passthroughHook("Notification")] }],
    SessionStart: [{ hooks: [passthroughHook("SessionStart")] }],
    SessionEnd: [{ hooks: [passthroughHook("SessionEnd")] }],
    UserPromptSubmit: [{ hooks: [passthroughHook("UserPromptSubmit")] }],
    Stop: [{ hooks: [passthroughHook("Stop")] }],
    SubagentStart: [{ hooks: [passthroughHook("SubagentStart")] }],
    SubagentStop: [{ hooks: [passthroughHook("SubagentStop")] }],
    PreCompact: [{ hooks: [preCompactHook] }],
  };
}
