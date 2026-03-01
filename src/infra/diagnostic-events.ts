import type { OpenClawConfig } from "../config/config.js";

export type DiagnosticSessionState = "idle" | "processing" | "waiting";

type DiagnosticBaseEvent = {
  ts: number;
  seq: number;
};

export type DiagnosticUsageEvent = DiagnosticBaseEvent & {
  type: "model.usage";
  sessionKey?: string;
  sessionId?: string;
  channel?: string;
  provider?: string;
  model?: string;
  usage: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    promptTokens?: number;
    total?: number;
  };
  lastCallUsage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  context?: {
    limit?: number;
    used?: number;
  };
  costUsd?: number;
  durationMs?: number;
};

export type DiagnosticWebhookReceivedEvent = DiagnosticBaseEvent & {
  type: "webhook.received";
  channel: string;
  updateType?: string;
  chatId?: number | string;
};

export type DiagnosticWebhookProcessedEvent = DiagnosticBaseEvent & {
  type: "webhook.processed";
  channel: string;
  updateType?: string;
  chatId?: number | string;
  durationMs?: number;
};

export type DiagnosticWebhookErrorEvent = DiagnosticBaseEvent & {
  type: "webhook.error";
  channel: string;
  updateType?: string;
  chatId?: number | string;
  error: string;
};

export type DiagnosticMessageQueuedEvent = DiagnosticBaseEvent & {
  type: "message.queued";
  sessionKey?: string;
  sessionId?: string;
  channel?: string;
  source: string;
  queueDepth?: number;
};

export type DiagnosticMessageProcessedEvent = DiagnosticBaseEvent & {
  type: "message.processed";
  channel: string;
  messageId?: number | string;
  chatId?: number | string;
  sessionKey?: string;
  sessionId?: string;
  durationMs?: number;
  outcome: "completed" | "skipped" | "error";
  reason?: string;
  error?: string;
};

export type DiagnosticSessionStateEvent = DiagnosticBaseEvent & {
  type: "session.state";
  sessionKey?: string;
  sessionId?: string;
  prevState?: DiagnosticSessionState;
  state: DiagnosticSessionState;
  reason?: string;
  queueDepth?: number;
};

export type DiagnosticSessionStuckEvent = DiagnosticBaseEvent & {
  type: "session.stuck";
  sessionKey?: string;
  sessionId?: string;
  state: DiagnosticSessionState;
  ageMs: number;
  queueDepth?: number;
};

export type DiagnosticLaneEnqueueEvent = DiagnosticBaseEvent & {
  type: "queue.lane.enqueue";
  lane: string;
  queueSize: number;
};

export type DiagnosticLaneDequeueEvent = DiagnosticBaseEvent & {
  type: "queue.lane.dequeue";
  lane: string;
  queueSize: number;
  waitMs: number;
};

export type DiagnosticRunAttemptEvent = DiagnosticBaseEvent & {
  type: "run.attempt";
  sessionKey?: string;
  sessionId?: string;
  runId: string;
  attempt: number;
};

export type DiagnosticHeartbeatEvent = DiagnosticBaseEvent & {
  type: "diagnostic.heartbeat";
  webhooks: {
    received: number;
    processed: number;
    errors: number;
  };
  active: number;
  waiting: number;
  queued: number;
};

export type DiagnosticToolLoopEvent = DiagnosticBaseEvent & {
  type: "tool.loop";
  sessionKey?: string;
  sessionId?: string;
  toolName: string;
  level: "warning" | "critical";
  action: "warn" | "block";
  detector: "generic_repeat" | "known_poll_no_progress" | "global_circuit_breaker" | "ping_pong";
  count: number;
  message: string;
  pairedToolName?: string;
};

/** Plugin-emitted custom diagnostic event. */
export type DiagnosticPluginEvent = DiagnosticBaseEvent & {
  type: "plugin.event";
  /** Plugin identifier that emitted the event. */
  pluginId?: string;
  /** Semantic event name within the plugin (e.g. "budget.warning", "score.computed"). */
  eventType: string;
  /** Arbitrary payload data. */
  data: Record<string, unknown>;
};

/**
 * Quality score emitted for a session — by an agent during a run (self-assessment),
 * by an evaluator subagent, or by an async scoring plugin. Feeds the eval pipeline,
 * OTel, and cost-optimization dashboards.
 */
export type DiagnosticSessionScoreEvent = DiagnosticBaseEvent & {
  type: "session.score";
  sessionId?: string;
  agentId?: string;
  /** Optional task or work-item identifier (e.g. GitHub issue, sprint task ID). */
  taskId?: string;
  /** Normalized quality score in the range 0.0–1.0. */
  score: number;
  /** Rubric dimension being scored (e.g. "tool_selection", "task_completion", "response_quality"). */
  rubric: string;
  /** Optional classification tags (e.g. ["correct", "efficient", "no_hallucination"]). */
  tags?: string[];
  /** Agent ID or plugin ID that produced this score. */
  evaluatorId?: string;
  /** Arbitrary additional context for the evaluator. */
  data?: Record<string, unknown>;
};

export type DiagnosticCompactionEvent = DiagnosticBaseEvent & {
  type: "session.compaction";
  sessionKey?: string;
  preTokens?: number;
  trigger?: "manual" | "auto";
  willRetry: boolean;
};

export type DiagnosticAttachmentEvent = DiagnosticBaseEvent & {
  type: "session.attachments";
  sessionKey?: string;
  attachmentsTotal: number;
  deduplicated: number;
  reattachedAfterCompaction: number;
  totalMediaBytes: number;
};

export type DiagnosticHookProfileEvent = DiagnosticBaseEvent & {
  type: "session.hook";
  sessionKey?: string;
  hook: "before_session_create";
  hookDurationMs: number;
  sectionsAdded: number;
  sectionsTotalChars: number;
  toolsAdded: number;
};

export type DiagnosticToolExecutionEvent = DiagnosticBaseEvent & {
  type: "tool.execution";
  toolName: string;
  toolCallId: string;
  durationMs: number;
  resultChars: number;
  truncated: boolean;
  isError: boolean;
};

export type DiagnosticCacheEvent = DiagnosticBaseEvent & {
  type: "cache.check";
  sessionKey?: string;
  sessionId?: string;
  runId?: string;
  currentPromptHash: string;
  previousPromptHash: string;
  invalidatorBlock?: {
    name: string;
    source: string;
    byteOffset: number;
    wastedTokensEstimated?: number;
  };
};

export type DiagnosticEventPayload =
  | DiagnosticUsageEvent
  | DiagnosticWebhookReceivedEvent
  | DiagnosticWebhookProcessedEvent
  | DiagnosticWebhookErrorEvent
  | DiagnosticMessageQueuedEvent
  | DiagnosticMessageProcessedEvent
  | DiagnosticSessionStateEvent
  | DiagnosticSessionStuckEvent
  | DiagnosticLaneEnqueueEvent
  | DiagnosticLaneDequeueEvent
  | DiagnosticRunAttemptEvent
  | DiagnosticHeartbeatEvent
  | DiagnosticToolLoopEvent
  | DiagnosticPluginEvent
  | DiagnosticSessionScoreEvent
  | DiagnosticCompactionEvent
  | DiagnosticAttachmentEvent
  | DiagnosticHookProfileEvent
  | DiagnosticToolExecutionEvent
  | DiagnosticCacheEvent;

export type DiagnosticEventInput = DiagnosticEventPayload extends infer Event
  ? Event extends DiagnosticEventPayload
    ? Omit<Event, "seq" | "ts">
    : never
  : never;

type DiagnosticEventsGlobalState = {
  seq: number;
  listeners: Set<(evt: DiagnosticEventPayload) => void>;
  dispatchDepth: number;
};

function getDiagnosticEventsState(): DiagnosticEventsGlobalState {
  const globalStore = globalThis as typeof globalThis & {
    __openclawDiagnosticEventsState?: DiagnosticEventsGlobalState;
  };
  if (!globalStore.__openclawDiagnosticEventsState) {
    globalStore.__openclawDiagnosticEventsState = {
      seq: 0,
      listeners: new Set<(evt: DiagnosticEventPayload) => void>(),
      dispatchDepth: 0,
    };
  }
  return globalStore.__openclawDiagnosticEventsState;
}

export function isDiagnosticsEnabled(config?: OpenClawConfig): boolean {
  return config?.diagnostics?.enabled === true;
}

export function emitDiagnosticEvent(event: DiagnosticEventInput) {
  const state = getDiagnosticEventsState();
  if (state.dispatchDepth > 100) {
    console.error(
      `[diagnostic-events] recursion guard tripped at depth=${state.dispatchDepth}, dropping type=${event.type}`,
    );
    return;
  }

  const enriched = {
    ...event,
    seq: (state.seq += 1),
    ts: Date.now(),
  } satisfies DiagnosticEventPayload;
  state.dispatchDepth += 1;
  for (const listener of state.listeners) {
    try {
      listener(enriched);
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? (err.stack ?? err.message)
          : typeof err === "string"
            ? err
            : String(err);
      console.error(
        `[diagnostic-events] listener error type=${enriched.type} seq=${enriched.seq}: ${errorMessage}`,
      );
      // Ignore listener failures.
    }
  }
  state.dispatchDepth -= 1;
}

export function onDiagnosticEvent(listener: (evt: DiagnosticEventPayload) => void): () => void {
  const state = getDiagnosticEventsState();
  state.listeners.add(listener);
  return () => {
    state.listeners.delete(listener);
  };
}

export function resetDiagnosticEventsForTest(): void {
  const state = getDiagnosticEventsState();
  state.seq = 0;
  state.listeners.clear();
  state.dispatchDepth = 0;
}
