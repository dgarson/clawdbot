import crypto from "node:crypto";
import type {
  CompactionSummaryEventPayload,
  MessageReceivedEventPayload,
  PipelineEventEnvelope,
  PipelineEventSource,
  SessionStartEventPayload,
} from "../pipeline/contracts.js";
import {
  registerInternalHook,
  unregisterInternalHook,
  type InternalHookEvent,
} from "../../hooks/internal-hooks.js";

export type MemoryPipelineEmitter = (event: PipelineEventEnvelope) => void;

export function registerMemoryPipelineHooks(options?: {
  emit?: MemoryPipelineEmitter;
  source?: PipelineEventSource;
}) {
  const emit = options?.emit ?? (() => {});
  const source = options?.source ?? "hook";

  const sessionStartHandler = (event: InternalHookEvent) => {
    const context = event.context as Record<string, unknown>;
    const payload: SessionStartEventPayload = {
      sessionKey: event.sessionKey,
      sessionId: typeof context.sessionId === "string" ? context.sessionId : undefined,
      agentId: typeof context.agentId === "string" ? context.agentId : undefined,
      channel: typeof context.channel === "string" ? context.channel : undefined,
      startedAt: new Date(event.timestamp).toISOString(),
    };
    emit(
      createEnvelope({
        type: "session.start",
        source,
        sessionKey: event.sessionKey,
        runId: typeof context.runId === "string" ? context.runId : undefined,
        traceId: typeof context.traceId === "string" ? context.traceId : undefined,
        payload,
      }),
    );
  };

  const messageReceivedHandler = (event: InternalHookEvent) => {
    const context = event.context as Record<string, unknown>;
    const payload: MessageReceivedEventPayload = {
      sessionKey: event.sessionKey,
      sessionId: typeof context.sessionId === "string" ? context.sessionId : undefined,
      messageId: typeof context.messageId === "string" ? context.messageId : undefined,
      body: typeof context.body === "string" ? context.body : "",
      channel: typeof context.channel === "string" ? context.channel : undefined,
      senderId: typeof context.senderId === "string" ? context.senderId : undefined,
      receivedAt: new Date(event.timestamp).toISOString(),
      temporal:
        context.temporal && typeof context.temporal === "object"
          ? (context.temporal as {})
          : undefined,
    };
    emit(
      createEnvelope({
        type: "message.received",
        source,
        sessionKey: event.sessionKey,
        runId: typeof context.runId === "string" ? context.runId : undefined,
        traceId: typeof context.traceId === "string" ? context.traceId : undefined,
        payload,
      }),
    );
  };

  const compactionSummaryHandler = (event: InternalHookEvent) => {
    const context = event.context as Record<string, unknown>;
    const payload: CompactionSummaryEventPayload = {
      sessionKey: event.sessionKey,
      sessionId: typeof context.sessionId === "string" ? context.sessionId : undefined,
      summary: typeof context.summary === "string" ? context.summary : "",
      tokensBefore: typeof context.tokensBefore === "number" ? context.tokensBefore : undefined,
      tokensAfter: typeof context.tokensAfter === "number" ? context.tokensAfter : undefined,
      compactedAt: new Date(event.timestamp).toISOString(),
    };
    emit(
      createEnvelope({
        type: "compaction.summary",
        source,
        sessionKey: event.sessionKey,
        runId: typeof context.runId === "string" ? context.runId : undefined,
        traceId: typeof context.traceId === "string" ? context.traceId : undefined,
        payload,
      }),
    );
  };

  registerInternalHook("session:start", sessionStartHandler);
  registerInternalHook("session:message", messageReceivedHandler);
  registerInternalHook("session:compaction_summary", compactionSummaryHandler);

  return () => {
    unregisterInternalHook("session:start", sessionStartHandler);
    unregisterInternalHook("session:message", messageReceivedHandler);
    unregisterInternalHook("session:compaction_summary", compactionSummaryHandler);
  };
}

function createEnvelope(params: {
  type: PipelineEventEnvelope["type"];
  source: PipelineEventSource;
  sessionKey?: string;
  runId?: string;
  traceId?: string;
  payload: PipelineEventEnvelope["payload"];
}): PipelineEventEnvelope {
  return {
    id: crypto.randomUUID(),
    type: params.type,
    ts: new Date().toISOString(),
    source: params.source,
    sessionKey: params.sessionKey,
    runId: params.runId,
    traceId: params.traceId,
    payload: params.payload,
  };
}
