import type { AgentEventPayload } from "../agent-events.js";
import { onAgentEvent } from "../agent-events.js";
import type { DiagnosticEventPayload } from "../diagnostic-events.js";
import { onDiagnosticEvent } from "../diagnostic-events.js";
import type { JournalEntry } from "./types.js";
import type { JournalWriter } from "./writer.js";

/** Extracts agentId from a session key like `agent:main:slack:channel:...` */
function extractAgentId(sessionKey: string | undefined): string | undefined {
  if (!sessionKey) {
    return undefined;
  }
  const parts = sessionKey.split(":");
  if (parts.length >= 2 && parts[0] === "agent") {
    return parts[1];
  }
  return undefined;
}

function mapDiagnosticEvent(event: DiagnosticEventPayload): JournalEntry | null {
  const base = {
    ts: event.ts,
    agentId: extractAgentId("sessionKey" in event ? event.sessionKey : undefined),
    sessionKey: "sessionKey" in event ? event.sessionKey : undefined,
    sessionId: "sessionId" in event ? event.sessionId : undefined,
    runId: "runId" in event ? event.runId : undefined,
  };

  switch (event.type) {
    case "webhook.received":
      return {
        ...base,
        type: "webhook.received",
        severity: "debug",
        summary: `webhook received channel=${event.channel} type=${event.updateType ?? "unknown"}`,
        data: { channel: event.channel, updateType: event.updateType, chatId: event.chatId },
      };

    case "webhook.processed":
      return {
        ...base,
        type: "webhook.processed",
        severity: "debug",
        summary: `webhook processed channel=${event.channel} duration=${event.durationMs ?? 0}ms`,
        data: {
          channel: event.channel,
          updateType: event.updateType,
          chatId: event.chatId,
          durationMs: event.durationMs,
        },
      };

    case "webhook.error":
      return {
        ...base,
        type: "webhook.error",
        severity: "error",
        summary: `webhook error channel=${event.channel}: ${event.error}`,
        data: {
          channel: event.channel,
          updateType: event.updateType,
          chatId: event.chatId,
          error: event.error,
        },
      };

    case "message.queued":
      return {
        ...base,
        type: "message.queued",
        severity: "debug",
        summary: `message queued source=${event.source} depth=${event.queueDepth ?? 0}`,
        data: {
          channel: event.channel,
          source: event.source,
          queueDepth: event.queueDepth,
        },
      };

    case "message.processed":
      return {
        ...base,
        type: "message.processed",
        severity: event.outcome === "error" ? "error" : "info",
        summary: `message processed channel=${event.channel} outcome=${event.outcome} duration=${event.durationMs ?? 0}ms`,
        data: {
          channel: event.channel,
          messageId: event.messageId,
          chatId: event.chatId,
          durationMs: event.durationMs,
          outcome: event.outcome,
          reason: event.reason,
          error: event.error,
        },
      };

    case "session.state": {
      const isNoop = event.prevState === "idle" && event.state === "idle";
      return {
        ...base,
        type: "session.state",
        severity: isNoop ? "trace" : "debug",
        summary: `session ${event.prevState ?? "?"}→${event.state} reason=${event.reason ?? ""}`,
        data: {
          prevState: event.prevState,
          state: event.state,
          reason: event.reason,
          queueDepth: event.queueDepth,
        },
      };
    }

    case "session.stuck":
      return {
        ...base,
        type: "session.stuck",
        severity: "warn",
        summary: `stuck session age=${Math.round(event.ageMs / 1000)}s state=${event.state}`,
        data: { state: event.state, ageMs: event.ageMs, queueDepth: event.queueDepth },
      };

    case "model.usage":
      return {
        ...base,
        type: "model.usage",
        severity: "info",
        summary: `usage model=${event.model ?? "?"} input=${event.usage.input ?? 0} output=${event.usage.output ?? 0}${event.costUsd != null ? ` cost=$${event.costUsd.toFixed(4)}` : ""}`,
        data: {
          provider: event.provider,
          model: event.model,
          channel: event.channel,
          usage: event.usage,
          lastCallUsage: event.lastCallUsage,
          context: event.context,
          costUsd: event.costUsd,
          durationMs: event.durationMs,
        },
      };

    case "run.attempt":
      return {
        ...base,
        type: "run.attempt",
        severity: "info",
        summary: `run attempt #${event.attempt} runId=${event.runId}`,
        data: { attempt: event.attempt },
      };

    case "queue.lane.enqueue":
      return {
        ...base,
        type: "lane.enqueue",
        severity: "trace",
        summary: `lane enqueue lane=${event.lane} queueSize=${event.queueSize}`,
        data: { lane: event.lane, queueSize: event.queueSize },
      };

    case "queue.lane.dequeue":
      return {
        ...base,
        type: "lane.dequeue",
        severity: "trace",
        summary: `lane dequeue lane=${event.lane} waitMs=${event.waitMs} queueSize=${event.queueSize}`,
        data: { lane: event.lane, queueSize: event.queueSize, waitMs: event.waitMs },
      };

    case "diagnostic.heartbeat":
      return {
        ...base,
        type: "heartbeat",
        severity: "trace",
        summary: `heartbeat active=${event.active} waiting=${event.waiting} queued=${event.queued} webhooks=${event.webhooks.received}/${event.webhooks.processed}/${event.webhooks.errors}`,
        data: {
          webhooks: event.webhooks,
          active: event.active,
          waiting: event.waiting,
          queued: event.queued,
        },
      };

    case "tool.loop":
      return {
        ...base,
        type: "tool.loop",
        severity: event.level === "critical" ? "error" : "warn",
        summary: `tool loop ${event.toolName} detector=${event.detector} action=${event.action} count=${event.count}`,
        data: {
          toolName: event.toolName,
          level: event.level,
          action: event.action,
          detector: event.detector,
          count: event.count,
          message: event.message,
          pairedToolName: event.pairedToolName,
        },
      };

    case "session.compaction":
      return {
        ...base,
        type: "session.compaction",
        severity: "info",
        summary: `compaction trigger=${event.trigger ?? "unknown"} preTokens=${event.preTokens ?? "?"} willRetry=${event.willRetry}`,
        data: {
          trigger: event.trigger,
          preTokens: event.preTokens,
          willRetry: event.willRetry,
        },
      };

    case "session.attachments":
      return {
        ...base,
        type: "session.attachments",
        severity: "debug",
        summary: `attachments total=${event.attachmentsTotal} deduped=${event.deduplicated} reattached=${event.reattachedAfterCompaction}`,
        data: {
          attachmentsTotal: event.attachmentsTotal,
          deduplicated: event.deduplicated,
          reattachedAfterCompaction: event.reattachedAfterCompaction,
          totalMediaBytes: event.totalMediaBytes,
        },
      };

    case "session.hook":
      return {
        ...base,
        type: "session.hook",
        severity: "debug",
        summary: `hook ${event.hook} duration=${event.hookDurationMs}ms sections=${event.sectionsAdded} tools=${event.toolsAdded}`,
        data: {
          hook: event.hook,
          hookDurationMs: event.hookDurationMs,
          sectionsAdded: event.sectionsAdded,
          sectionsTotalChars: event.sectionsTotalChars,
          toolsAdded: event.toolsAdded,
        },
      };

    case "tool.execution":
      return {
        ...base,
        type: "tool.execution",
        severity: event.isError ? "warn" : "debug",
        summary: `tool ${event.toolName} duration=${event.durationMs}ms chars=${event.resultChars}${event.isError ? " ERROR" : ""}`,
        data: {
          toolName: event.toolName,
          toolCallId: event.toolCallId,
          durationMs: event.durationMs,
          resultChars: event.resultChars,
          truncated: event.truncated,
          isError: event.isError,
        },
      };

    case "plugin.event":
      return {
        ...base,
        type: `plugin.${event.eventType}`,
        severity: "info",
        summary: `plugin event ${event.pluginId ?? "?"}:${event.eventType}`,
        data: { pluginId: event.pluginId, eventType: event.eventType, ...event.data },
      };

    case "session.score":
      return {
        ...base,
        type: "session.score",
        severity: "info",
        agentId: base.agentId ?? event.agentId,
        summary: `score rubric=${event.rubric} score=${event.score.toFixed(2)} evaluator=${event.evaluatorId ?? "?"}`,
        data: {
          score: event.score,
          rubric: event.rubric,
          tags: event.tags,
          evaluatorId: event.evaluatorId,
          taskId: event.taskId,
          ...event.data,
        },
      };

    case "cache.check":
      return buildCacheInvalidationEntry({
        currentPromptHash: event.currentPromptHash,
        previousPromptHash: event.previousPromptHash,
        invalidatorBlock: event.invalidatorBlock,
        sessionKey: event.sessionKey,
        sessionId: event.sessionId,
      });

    default:
      return null;
  }
}

/** Safely convert an unknown value to a display string without triggering no-base-to-string. */
function safeStr(v: unknown, fallback = "?"): string {
  if (v === undefined || v === null) {
    return fallback;
  }
  if (typeof v === "string") {
    return v;
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return String(v);
  }
  return JSON.stringify(v);
}

function mapAgentEvent(event: AgentEventPayload): JournalEntry | null {
  const base = {
    ts: event.ts,
    runId: event.runId,
    sessionKey: event.sessionKey,
    agentId: extractAgentId(event.sessionKey),
  };

  const data = event.data;

  switch (event.stream) {
    case "lifecycle": {
      const phase = typeof data.phase === "string" ? data.phase : undefined;
      if (phase === "run_start") {
        return {
          ...base,
          type: "run.start",
          severity: "info",
          summary: `run start model=${safeStr(data.model)} provider=${safeStr(data.provider)}`,
          data: data,
        };
      }
      if (phase === "run_end") {
        const isError = data.isError === true;
        return {
          ...base,
          type: "run.end",
          severity: isError ? "error" : "info",
          summary: `run ${isError ? "failed" : "completed"} duration=${safeStr(data.durationMs)}ms`,
          data: data,
        };
      }
      return {
        ...base,
        type: `lifecycle.${phase ?? "unknown"}`,
        severity: "debug",
        summary: `lifecycle ${phase ?? "unknown"}`,
        data: data,
      };
    }

    case "tool":
      return {
        ...base,
        type: "tool.call",
        severity: "debug",
        summary: `tool call ${safeStr(data.toolName)}`,
        data: data,
      };

    case "error":
      return {
        ...base,
        type: "agent.error",
        severity: "error",
        summary: `agent error: ${safeStr(data.message ?? data.error, "unknown")}`,
        data: data,
      };

    default:
      // Custom streams from plugins
      return {
        ...base,
        type: `agent.${event.stream}`,
        severity: "debug",
        summary: `agent event stream=${event.stream}`,
        data: data,
      };
  }
}

export type CacheInvalidationContext = {
  currentPromptHash: string;
  previousPromptHash: string;
  invalidatorBlock?: {
    name: string;
    source: string;
    byteOffset: number;
    wastedTokensEstimated?: number;
  };
  sessionKey?: string;
  sessionId?: string;
  agentId?: string;
};

/** Emit a cache invalidation journal entry from trace-export data. */
export function buildCacheInvalidationEntry(ctx: CacheInvalidationContext): JournalEntry {
  const hasChange =
    ctx.currentPromptHash !== ctx.previousPromptHash && ctx.previousPromptHash !== "";
  if (hasChange) {
    return {
      ts: Date.now(),
      type: "cache.invalidation",
      severity: "warn",
      agentId: ctx.agentId ?? extractAgentId(ctx.sessionKey),
      sessionKey: ctx.sessionKey,
      sessionId: ctx.sessionId,
      summary: `cache invalidated hash=${ctx.previousPromptHash}→${ctx.currentPromptHash}${ctx.invalidatorBlock ? ` invalidator=${ctx.invalidatorBlock.name}` : ""}${ctx.invalidatorBlock?.wastedTokensEstimated ? ` wastedTokens≈${ctx.invalidatorBlock.wastedTokensEstimated}` : ""}`,
      data: {
        previousPromptHash: ctx.previousPromptHash,
        currentPromptHash: ctx.currentPromptHash,
        invalidatorBlock: ctx.invalidatorBlock,
      },
    };
  }
  return {
    ts: Date.now(),
    type: "cache.hit",
    severity: "trace",
    agentId: ctx.agentId ?? extractAgentId(ctx.sessionKey),
    sessionKey: ctx.sessionKey,
    sessionId: ctx.sessionId,
    summary: `cache hit hash=${ctx.currentPromptHash}`,
    data: { currentPromptHash: ctx.currentPromptHash },
  };
}

export type JournalSubscriberHandle = {
  stopDiagnostic: () => void;
  stopAgent: () => void;
};

/**
 * Subscribe to diagnostic and agent events, mapping them to journal entries.
 * Returns unsubscribe handles.
 */
export function startJournalSubscriber(writer: JournalWriter): JournalSubscriberHandle {
  const stopDiagnostic = onDiagnosticEvent((event: DiagnosticEventPayload) => {
    const entry = mapDiagnosticEvent(event);
    if (entry) {
      writer.write(entry);
    }
  });

  const stopAgent = onAgentEvent((event: AgentEventPayload) => {
    const entry = mapAgentEvent(event);
    if (entry) {
      writer.write(entry);
    }
  });

  return { stopDiagnostic, stopAgent };
}

// Re-export for use in trace-export integration
export { extractAgentId };
