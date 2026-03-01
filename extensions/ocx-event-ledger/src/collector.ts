/**
 * Event collector — subscribes to all lifecycle hooks and normalizes
 * hook payloads into EventEnvelope records.
 *
 * The collector is non-blocking: it builds an envelope synchronously and
 * hands it to EventStorage.appendEvent(), which buffers the write.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { EventLedgerConfig } from "./config.js";
import type { EventStorage } from "./storage.js";
import type { EventEnvelope, EventFamily } from "./types.js";

// Monotonic counter within this process for eventId uniqueness
let seq = 0;

function nextEventId(): string {
  seq += 1;
  return `${Date.now()}-${seq}`;
}

/**
 * Truncate a string value to maxPayloadSize bytes (UTF-8 safe).
 * Returns the original string if within limits.
 */
export function truncateString(value: string, maxBytes: number): string {
  const encoded = Buffer.byteLength(value, "utf-8");
  if (encoded <= maxBytes) return value;
  // Binary-search safe truncation point
  let lo = 0;
  let hi = value.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (Buffer.byteLength(value.slice(0, mid), "utf-8") <= maxBytes) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return value.slice(0, lo);
}

/**
 * Truncate large string values inside a data payload to stay within
 * maxPayloadSize. Only top-level string fields are truncated.
 */
export function truncatePayload(
  data: Record<string, unknown>,
  maxBytes: number,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      result[key] = truncateString(value, maxBytes);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Check whether a family should be captured given include/exclude lists.
 */
export function shouldCapture(
  family: EventFamily,
  families: EventFamily[],
  excludeFamilies: EventFamily[],
): boolean {
  if (excludeFamilies.length > 0 && excludeFamilies.includes(family)) return false;
  if (families.length > 0 && !families.includes(family)) return false;
  return true;
}

/**
 * Build and enqueue an event envelope.
 */
function emit(
  storage: EventStorage,
  config: EventLedgerConfig,
  family: EventFamily,
  type: string,
  runId: string,
  data: Record<string, unknown>,
  extra?: {
    lineageId?: string;
    sessionKey?: string;
    agentId?: string;
  },
): void {
  if (!shouldCapture(family, config.families, config.excludeFamilies)) return;

  const envelope: EventEnvelope = {
    eventId: nextEventId(),
    ts: new Date().toISOString(),
    version: 1,
    family,
    type,
    runId,
    ...(extra?.lineageId ? { lineageId: extra.lineageId } : {}),
    ...(extra?.sessionKey ? { sessionKey: extra.sessionKey } : {}),
    ...(extra?.agentId ? { agentId: extra.agentId } : {}),
    data: truncatePayload(data, config.maxPayloadSize),
  };

  storage.appendEvent(envelope);
}

function pickRunId(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Public API — called from index.ts register()
// ---------------------------------------------------------------------------

/**
 * Subscribe to all known lifecycle hooks and emit corresponding events.
 */
export function registerCollector(
  api: OpenClawPluginApi,
  storage: EventStorage,
  config: EventLedgerConfig,
): void {
  // TODO (Phase 2): model.fallback events need to be synthesized from sequential
  // before_model_resolve calls for the same runId within a short time window.
  // When a model resolve is followed by another resolve for the same run (e.g.
  // due to a provider error and retry with a different model), emit a
  // model.fallback event with the original and fallback model names.

  // --- model family ---
  api.on("before_model_resolve", (event, ctx) => {
    const runId = pickRunId(
      (ctx as { runId?: string }).runId,
      (event as { runId?: string }).runId,
      ctx.sessionKey,
    );
    emit(
      storage,
      config,
      "model",
      "model.resolve",
      runId ?? "model:unknown",
      {
        requestedModel: event.prompt,
      },
      {
        agentId: ctx.agentId,
        sessionKey: ctx.sessionKey,
      },
    );
  });

  // --- budget family ---
  api.on("llm_output", (event, ctx) => {
    emit(
      storage,
      config,
      "budget",
      "budget.usage",
      event.runId,
      {
        inputTokens: event.inputTokens ?? event.usage?.input ?? 0,
        outputTokens: event.outputTokens ?? event.usage?.output ?? 0,
        estimatedCostUsd: event.estimatedCostUsd ?? 0,
        model: event.model,
        provider: event.provider,
      },
      {
        agentId: ctx.agentId,
        sessionKey: ctx.sessionKey,
      },
    );
  });

  // --- tool family ---
  api.on("before_tool_call", (event, ctx) => {
    const runId = pickRunId((ctx as { runId?: string }).runId, ctx.sessionKey);
    emit(
      storage,
      config,
      "tool",
      "tool.invoked",
      runId ?? `tool:${event.toolName}`,
      {
        toolName: event.toolName,
        toolInput: JSON.stringify(event.params),
      },
      {
        agentId: ctx.agentId,
        sessionKey: ctx.sessionKey,
      },
    );
  });

  api.on("after_tool_call", (event, ctx) => {
    const runId = pickRunId((ctx as { runId?: string }).runId, ctx.sessionKey);
    // TODO: tool.blocked events cannot be detected here. When a before_tool_call
    // handler returns { block: true }, the tool call never executes, so
    // after_tool_call is never fired. To capture tool.blocked events, the
    // plugin that blocks the tool would need to emit the event itself (e.g.
    // via emitAgentEvent with data.family="tool", data.type="tool.blocked").
    emit(
      storage,
      config,
      "tool",
      "tool.completed",
      runId ?? `tool:${event.toolName}`,
      {
        toolName: event.toolName,
        durationMs: event.durationMs ?? 0,
        success: !event.error,
        outputSize: event.result ? JSON.stringify(event.result).length : 0,
      },
      {
        agentId: ctx.agentId,
        sessionKey: ctx.sessionKey,
      },
    );
  });

  // --- session family ---
  api.on("session_start", (event, ctx) => {
    emit(
      storage,
      config,
      "session",
      "session.start",
      `session:${event.sessionId}`,
      {
        sessionKey: event.sessionId,
        agentId: ctx.agentId,
      },
      {
        agentId: ctx.agentId,
        sessionKey: event.sessionId,
      },
    );
  });

  api.on("session_end", (event, ctx) => {
    emit(
      storage,
      config,
      "session",
      "session.end",
      `session:${event.sessionId}`,
      {
        sessionKey: event.sessionId,
        durationMs: event.durationMs ?? 0,
        messageCount: event.messageCount,
      },
      {
        agentId: ctx.agentId,
        sessionKey: event.sessionId,
      },
    );
  });

  api.on("after_compaction", (event, ctx) => {
    const runId = pickRunId((ctx as { runId?: string }).runId, ctx.sessionKey);
    emit(
      storage,
      config,
      "session",
      "session.compacted",
      runId ?? `session:${ctx.sessionKey ?? "unknown"}`,
      {
        sessionKey: ctx.sessionKey,
        beforeSize: event.messageCount,
        afterSize: event.compactedCount,
        tokensRecovered: event.tokenCount ?? 0,
      },
      {
        agentId: ctx.agentId,
        sessionKey: ctx.sessionKey,
      },
    );
  });

  // --- message family ---
  api.on("message_received", (event, ctx) => {
    emit(storage, config, "message", "message.received", `message:${ctx.channelId}:recv`, {
      channel: ctx.channelId,
      from: event.from,
      contentLength: event.content.length,
      hasMedia: Boolean(event.metadata?.hasMedia),
    });
  });

  api.on("message_sent", (event, ctx) => {
    emit(storage, config, "message", "message.sent", `message:${ctx.channelId}:sent`, {
      channel: ctx.channelId,
      to: event.to,
      contentLength: event.content.length,
      deliveryStatus: event.success ? "delivered" : "failed",
    });
  });

  // --- subagent family ---
  api.on("subagent_spawned", (event, ctx) => {
    emit(
      storage,
      config,
      "subagent",
      "subagent.spawned",
      event.runId,
      {
        childSessionKey: event.childSessionKey,
        parentSessionKey: ctx.requesterSessionKey,
        agentId: event.agentId,
        mode: event.mode,
        isolated: event.isolated ?? false,
      },
      {
        agentId: event.agentId,
        sessionKey: event.childSessionKey,
      },
    );
  });

  api.on("subagent_ended", (event, ctx) => {
    emit(
      storage,
      config,
      "subagent",
      "subagent.ended",
      pickRunId(event.runId, ctx.runId, event.targetSessionKey) ?? "subagent:unknown",
      {
        childSessionKey: event.targetSessionKey,
        outcome: event.outcome ?? event.reason,
        durationMs: event.endedAt ? Date.now() - event.endedAt : 0,
      },
      {
        sessionKey: event.targetSessionKey,
      },
    );
  });

  // --- prompt family ---
  api.on("before_prompt_build", (event, ctx) => {
    const runId = pickRunId((ctx as { runId?: string }).runId, ctx.sessionKey);
    emit(
      storage,
      config,
      "prompt",
      "prompt.composed",
      runId ?? "prompt:unknown",
      {
        totalTokenEstimate: event.messages.length,
      },
      {
        agentId: ctx.agentId,
        sessionKey: ctx.sessionKey,
      },
    );
  });

  // --- system family ---
  // TODO: system.error events need to be emitted by the gateway error handler
  // or via the cross-plugin event bus (emitAgentEvent with data.family="system",
  // data.type="system.error"). The event ledger cannot capture uncaught errors
  // directly since there is no plugin hook for gateway-level errors.

  api.on("gateway_start", (event) => {
    emit(storage, config, "system", "system.gateway.start", "gateway", {
      port: event.port,
    });
  });

  api.on("gateway_stop", (event) => {
    emit(storage, config, "system", "system.gateway.stop", "gateway", {
      reason: event.reason ?? "unknown",
    });
  });
}
