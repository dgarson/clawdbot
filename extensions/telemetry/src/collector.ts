import type { DiagnosticEventPayload, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { onDiagnosticEvent } from "openclaw/plugin-sdk";
import type { BlobRef, TelemetryConfig, TelemetryEvent, TelemetryEventKind } from "./types.js";
import { BlobWriter } from "./blob-writer.js";
import {
  captureInput,
  captureResult,
  extractFilePath,
  extractExecCommand,
  shouldExternalize,
} from "./helpers.js";

/** Partial event passed to the write function — id/ts/seq are assigned by the writer. */
type WriteInput = Partial<TelemetryEvent> & { kind: TelemetryEventKind };

/** The write function provided by the JSONL writer. */
type WriteFn = (event: WriteInput) => void;

/**
 * Register all hook listeners and diagnostic event subscribers for telemetry capture.
 * Returns an unsubscribe function that tears down the diagnostic event subscription.
 *
 * Hooks are registered via `api.on()` and are automatically cleaned up by the
 * plugin runtime when the plugin is stopped.
 */
export function registerCollector(
  api: OpenClawPluginApi,
  write: WriteFn,
  blobWriter: BlobWriter,
): () => void {
  const cfg = (api.pluginConfig ?? {}) as TelemetryConfig;

  // ===========================================================================
  // Session lifecycle
  // ===========================================================================

  api.on("session_start", (event, ctx) => {
    write({
      kind: "session.start",
      sessionId: ctx.sessionId,
      agentId: ctx.agentId,
      sessionKey: ctx.agentId ? undefined : undefined, // sessionKey not on session context
      data: { sessionId: event.sessionId, resumedFrom: event.resumedFrom },
      source: "hook",
      hookName: "session_start",
    });
  });

  api.on("session_end", (event, ctx) => {
    write({
      kind: "session.end",
      sessionId: ctx.sessionId,
      agentId: ctx.agentId,
      data: {
        sessionId: event.sessionId,
        messageCount: event.messageCount,
        durationMs: event.durationMs,
      },
      source: "hook",
      hookName: "session_end",
    });
  });

  // ===========================================================================
  // Run lifecycle
  // ===========================================================================

  api.on("run_start", (event, _ctx) => {
    write({
      kind: "run.start",
      runId: event.runId,
      sessionKey: event.sessionKey,
      sessionId: event.sessionId,
      agentId: event.agentId,
      data: {
        model: event.model,
        provider: event.provider,
        isHeartbeat: event.isHeartbeat,
        isFollowup: event.isFollowup,
        messageCount: event.messageCount,
        compactionCount: event.compactionCount,
        originChannel: event.originChannel,
      },
      source: "hook",
      hookName: "run_start",
    });
  });

  // agent_end is the enriched run completion event (no separate run_end hook).
  api.on("agent_end", (event, ctx) => {
    write({
      kind: "run.end",
      runId: event.runId,
      sessionKey: ctx.sessionKey,
      sessionId: ctx.sessionId,
      agentId: ctx.agentId,
      data: {
        model: event.model,
        provider: event.provider,
        durationMs: event.durationMs,
        usage: event.usage,
        toolCallCount: event.toolCallCount,
        toolNames: event.toolNames,
        stopReason: event.stopReason,
        compactionCount: event.compactionCount,
        lastAssistantMessage: event.lastAssistantMessage,
      },
      error: event.error ? { message: event.error } : undefined,
      source: "hook",
      hookName: "agent_end",
    });
  });

  // ===========================================================================
  // LLM hooks
  // ===========================================================================

  api.on("llm_input", (event, ctx) => {
    const data: Record<string, unknown> = {
      provider: event.provider,
      model: event.model,
      prompt: event.prompt,
      imagesCount: event.imagesCount,
    };
    if (cfg.captureLlmPayloads) {
      data.systemPrompt = event.systemPrompt;
      data.historyMessageCount = event.historyMessages?.length;
    }
    write({
      kind: "llm.input",
      runId: event.runId,
      sessionId: event.sessionId,
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      data,
      source: "hook",
      hookName: "llm_input",
    });
  });

  api.on("llm_output", (event, ctx) => {
    write({
      kind: "llm.output",
      runId: event.runId,
      sessionId: event.sessionId,
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      data: {
        provider: event.provider,
        model: event.model,
        usage: event.usage,
        durationMs: event.durationMs,
        stopReason: event.stopReason,
        messageCount: event.messageCount,
        assistantTextLength: event.assistantTexts?.reduce((s, t) => s + t.length, 0),
      },
      source: "hook",
      hookName: "llm_output",
    });
  });

  // ===========================================================================
  // Tool hooks
  // ===========================================================================

  api.on("before_tool_call", (event, ctx) => {
    write({
      kind: "tool.start",
      runId: ctx.runId,
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      data: {
        toolName: event.toolName,
        toolCallId: event.toolCallId,
        params: captureInput(event.params, cfg.captureToolInputs ?? "full"),
      },
      source: "hook",
      hookName: "before_tool_call",
    });
  });

  api.on("after_tool_call", (event, ctx) => {
    const inputMode = cfg.captureToolInputs ?? "full";
    const resultMode = cfg.captureToolResults ?? "summary";
    const threshold = cfg.blobThresholdBytes ?? 4096;

    const blobRefs: BlobRef[] = [];

    // Externalize large inputs if needed
    let capturedParams: unknown = captureInput(event.params, inputMode);
    if (capturedParams !== undefined && shouldExternalize(capturedParams, threshold)) {
      const ref = blobWriter.write(capturedParams, "input");
      blobRefs.push(ref);
      capturedParams = undefined; // replaced by blob ref
    }

    // Externalize large results if needed
    let capturedResult: unknown = captureResult(event.result, resultMode);
    if (capturedResult !== undefined && shouldExternalize(capturedResult, threshold)) {
      const ref = blobWriter.write(capturedResult, "result");
      blobRefs.push(ref);
      capturedResult = undefined; // replaced by blob ref
    }

    const toolMeta: Record<string, unknown> = {};
    const filePath = extractFilePath(event.toolName, event.params);
    if (filePath !== undefined) toolMeta.filePath = filePath;
    const execCommand = extractExecCommand(event.toolName, event.params);
    if (execCommand !== undefined) toolMeta.execCommand = execCommand;

    write({
      kind: "tool.end",
      runId: ctx.runId,
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      data: {
        toolName: event.toolName,
        toolCallId: event.toolCallId,
        isError: event.isError ?? !!event.error,
        durationMs: event.durationMs,
        params: capturedParams,
        result: capturedResult,
        error: event.error,
        ...toolMeta,
      },
      blobRefs: blobRefs.length > 0 ? blobRefs : undefined,
      source: "hook",
      hookName: "after_tool_call",
    });
  });

  // ===========================================================================
  // Message hooks
  // ===========================================================================

  api.on("message_received", (event, ctx) => {
    write({
      kind: "message.inbound",
      sessionKey: ctx.conversationId ?? undefined,
      data: {
        from: event.from,
        contentPreview: event.content?.slice(0, 200),
        channel: ctx.channelId,
        accountId: ctx.accountId,
        conversationId: ctx.conversationId,
        timestamp: event.timestamp,
      },
      source: "hook",
      hookName: "message_received",
    });
  });

  api.on("message_sent", (event, ctx) => {
    write({
      kind: "message.outbound",
      data: {
        to: event.to,
        contentPreview: event.content?.slice(0, 200),
        success: event.success,
        error: event.error,
        channel: ctx.channelId,
      },
      source: "hook",
      hookName: "message_sent",
    });
  });

  // ===========================================================================
  // Subagent hooks
  // ===========================================================================

  api.on("subagent_spawned", (event, ctx) => {
    write({
      kind: "subagent.spawn",
      runId: event.runId,
      sessionKey: ctx.requesterSessionKey,
      data: {
        childSessionKey: event.childSessionKey,
        agentId: event.agentId,
        label: event.label,
        mode: event.mode,
        requester: event.requester,
        threadRequested: event.threadRequested,
      },
      source: "hook",
      hookName: "subagent_spawned",
    });
  });

  api.on("subagent_ended", (event, _ctx) => {
    write({
      kind: "subagent.end",
      runId: event.runId,
      sessionKey: event.targetSessionKey,
      data: {
        targetSessionKey: event.targetSessionKey,
        outcome: event.outcome,
        reason: event.reason,
        error: event.error,
        endedAt: event.endedAt,
        durationMs: event.durationMs,
        // entry fields (enriched upstream)
        task: event.entry?.task,
        label: event.entry?.label,
        startedAt: event.entry?.startedAt,
        model: event.entry?.model,
        spawnMode: event.entry?.spawnMode,
      },
      source: "hook",
      hookName: "subagent_ended",
    });
  });

  // subagent_stopping fires just before a subagent completes; capture for audit.
  api.on("subagent_stopping", (event, ctx) => {
    write({
      kind: "subagent.stop",
      runId: ctx.runId,
      sessionKey: ctx.childSessionKey,
      data: {
        childSessionKey: event.childSessionKey,
        requesterSessionKey: event.requesterSessionKey,
        agentId: event.agentId,
        task: event.task,
        label: event.label,
        outcome: event.outcome,
        reason: event.reason,
        error: event.error,
        lastAssistantMessage: event.lastAssistantMessage,
        usage: event.usage,
        durationMs: event.durationMs,
        toolsUsed: event.toolsUsed,
        steerCount: event.steerCount,
        maxSteers: event.maxSteers,
      },
      source: "hook",
      hookName: "subagent_stopping",
    });
    // Allow the subagent to proceed (no modification of the result)
  });

  // ===========================================================================
  // Compaction hooks
  // ===========================================================================

  api.on("before_compaction", (event, ctx) => {
    write({
      kind: "compaction.start",
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      data: {
        messageCount: event.messageCount,
        compactingCount: event.compactingCount,
        tokenCount: event.tokenCount,
      },
      source: "hook",
      hookName: "before_compaction",
    });
  });

  api.on("after_compaction", (event, ctx) => {
    write({
      kind: "compaction.end",
      sessionKey: ctx.sessionKey,
      agentId: ctx.agentId,
      data: {
        messageCount: event.messageCount,
        compactedCount: event.compactedCount,
      },
      source: "hook",
      hookName: "after_compaction",
    });
  });

  // ===========================================================================
  // Diagnostic events (model.usage, model.call)
  // ===========================================================================

  const unsubDiag = onDiagnosticEvent((event: DiagnosticEventPayload) => {
    try {
      handleDiagnosticEvent(event, write);
    } catch {
      // Swallow errors to prevent telemetry from disrupting the gateway.
    }
  });

  return unsubDiag;
}

// ---------------------------------------------------------------------------
// Diagnostic event handler
// ---------------------------------------------------------------------------

function handleDiagnosticEvent(event: DiagnosticEventPayload, write: WriteFn): void {
  if (event.type === "model.usage") {
    // Cumulative per-session usage snapshot
    write({
      kind: "usage.snapshot",
      sessionKey: event.sessionKey,
      sessionId: event.sessionId,
      data: {
        provider: event.provider,
        model: event.model,
        usage: event.usage,
        lastCallUsage: event.lastCallUsage,
        context: event.context,
        costUsd: event.costUsd,
        durationMs: event.durationMs,
      },
      source: "diagnostic_event",
    });
    return;
  }

  // model.call is a new diagnostic event type for per-call snapshots.
  // It may not be present in older versions of the runtime; we cast defensively.
  const anyEvent = event as Record<string, unknown>;
  if (anyEvent.type === "model.call") {
    write({
      kind: "llm.call",
      runId: typeof anyEvent.runId === "string" ? anyEvent.runId : undefined,
      sessionKey: typeof anyEvent.sessionKey === "string" ? anyEvent.sessionKey : undefined,
      sessionId: typeof anyEvent.sessionId === "string" ? anyEvent.sessionId : undefined,
      data: {
        callIndex: anyEvent.callIndex,
        provider: anyEvent.provider,
        model: anyEvent.model,
        delta: anyEvent.delta,
        cumulative: anyEvent.cumulative,
        context: anyEvent.context,
        costUsd: anyEvent.costUsd,
        durationMs: anyEvent.durationMs,
      },
      source: "diagnostic_event",
    });
  }
}
