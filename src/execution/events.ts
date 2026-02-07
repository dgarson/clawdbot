/**
 * Event Router for the Agent Execution Layer.
 *
 * Provides canonical event emission and routing to hooks, logs, UI, and diagnostics.
 * This is the central hub for all execution events - every component emits through
 * the router, and consumers subscribe to receive events.
 *
 * @see docs/design/plans/opus/01-agent-execution-layer.md
 */

import type { PluginHookName } from "../plugins/types.js";
import type { ExecutionEvent, ExecutionEventKind, EventListener, Unsubscribe } from "./types.js";

// ---------------------------------------------------------------------------
// Hook Mapping
// ---------------------------------------------------------------------------

/**
 * Mapping from ExecutionEventKind to PluginHookName.
 * Events that don't map to a hook are not included.
 */
export const EVENT_TO_HOOK_MAP: Partial<Record<ExecutionEventKind, PluginHookName>> = {
  "lifecycle.start": "before_agent_start",
  "lifecycle.end": "agent_end",
  "tool.start": "before_tool_call",
  "tool.end": "after_tool_call",
  "compaction.start": "before_compaction",
  "compaction.end": "after_compaction",
} as const;

/**
 * Get the plugin hook name for an execution event kind.
 * Returns undefined if the event kind doesn't map to a hook.
 */
export function getHookForEventKind(kind: ExecutionEventKind): PluginHookName | undefined {
  return EVENT_TO_HOOK_MAP[kind];
}

// ---------------------------------------------------------------------------
// Event Router
// ---------------------------------------------------------------------------

export type EventRouterLogger = {
  debug?: (message: string) => void;
  warn?: (message: string) => void;
  error?: (message: string) => void;
};

export type EventRouterOptions = {
  /** Optional logger for debug output and error reporting. */
  logger?: EventRouterLogger;
  /** Optional runId filter - only emit events matching this runId. */
  runIdFilter?: string;
};

/**
 * EventRouter manages event emission and subscription for execution events.
 *
 * Features:
 * - Supports both sync and async listeners
 * - Handles listener errors gracefully (logs but doesn't throw)
 * - Events are emitted in order (sync listeners first, then async awaited in order)
 * - Provides unsubscribe function for cleanup
 *
 * Usage:
 * ```typescript
 * const router = new EventRouter();
 * const unsubscribe = router.subscribe((event) => {
 *   console.log('Event:', event.kind, event.data);
 * });
 *
 * router.emit({
 *   kind: 'lifecycle.start',
 *   timestamp: Date.now(),
 *   runId: 'run-123',
 *   data: { prompt: 'Hello' },
 * });
 *
 * unsubscribe(); // Clean up
 * ```
 */
export class EventRouter {
  private listeners = new Set<EventListener>();
  private logger?: EventRouterLogger;
  private runIdFilter?: string;
  private emittedEvents: ExecutionEvent[] = [];

  constructor(options: EventRouterOptions = {}) {
    this.logger = options.logger;
    this.runIdFilter = options.runIdFilter;
  }

  /**
   * Emit an event to all subscribed listeners.
   *
   * - Sync listeners are called synchronously in order
   * - Async listeners are awaited in order (not parallel, to preserve event ordering)
   * - Listener errors are caught, logged, and do not prevent other listeners from receiving events
   * - Events are stored for later retrieval via `getEmittedEvents()`
   *
   * @param event - The execution event to emit
   */
  async emit(event: ExecutionEvent): Promise<void> {
    // Filter by runId if configured
    if (this.runIdFilter && event.runId !== this.runIdFilter) {
      return;
    }

    // Store event for later retrieval
    this.emittedEvents.push(event);

    this.logger?.debug?.(`[EventRouter] emit ${event.kind} (runId=${event.runId})`);

    // Call listeners sequentially to preserve event ordering
    for (const listener of this.listeners) {
      try {
        const result = listener(event);
        // Await async listeners
        if (result && typeof result.then === "function") {
          await result;
        }
      } catch (err) {
        this.logger?.error?.(
          `[EventRouter] listener error for ${event.kind}: ${err instanceof Error ? err.message : String(err)}`,
        );
        // Continue with other listeners - errors don't break the chain
      }
    }
  }

  /**
   * Emit an event synchronously (fire-and-forget for async listeners).
   *
   * This is useful when you can't await the emit call but still want to
   * emit events. Async listeners will still run, but won't be awaited.
   *
   * @param event - The execution event to emit
   */
  emitSync(event: ExecutionEvent): void {
    // Filter by runId if configured
    if (this.runIdFilter && event.runId !== this.runIdFilter) {
      return;
    }

    // Store event for later retrieval
    this.emittedEvents.push(event);

    this.logger?.debug?.(`[EventRouter] emitSync ${event.kind} (runId=${event.runId})`);

    for (const listener of this.listeners) {
      try {
        const result = listener(event);
        // For async listeners, catch errors but don't await
        if (result && typeof result.then === "function") {
          result.catch((err: unknown) => {
            this.logger?.error?.(
              `[EventRouter] async listener error for ${event.kind}: ${err instanceof Error ? err.message : String(err)}`,
            );
          });
        }
      } catch (err) {
        this.logger?.error?.(
          `[EventRouter] listener error for ${event.kind}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  /**
   * Subscribe a listener to receive events.
   *
   * @param listener - Function to call for each event
   * @returns Unsubscribe function to remove the listener
   */
  subscribe(listener: EventListener): Unsubscribe {
    this.listeners.add(listener);
    this.logger?.debug?.(`[EventRouter] subscribe (count=${this.listeners.size})`);

    return () => {
      this.listeners.delete(listener);
      this.logger?.debug?.(`[EventRouter] unsubscribe (count=${this.listeners.size})`);
    };
  }

  /**
   * Get all events emitted through this router.
   * Useful for testing and diagnostics.
   */
  getEmittedEvents(): ExecutionEvent[] {
    return [...this.emittedEvents];
  }

  /**
   * Get the count of subscribed listeners.
   */
  getListenerCount(): number {
    return this.listeners.size;
  }

  /**
   * Remove all subscribers. Useful for testing cleanup.
   */
  clear(): void {
    this.listeners.clear();
    this.emittedEvents = [];
    this.logger?.debug?.("[EventRouter] clear");
  }
}

// ---------------------------------------------------------------------------
// Legacy Adapter
// ---------------------------------------------------------------------------

/**
 * Create an event listener that forwards ExecutionEvents to the legacy
 * emitAgentEvent system for backward compatibility.
 *
 * @param emitAgentEvent - The legacy emitAgentEvent function
 * @returns EventListener that forwards events
 */
export function createLegacyEventAdapter(
  emitAgentEvent: (event: {
    runId: string;
    stream: string;
    data: Record<string, unknown>;
    sessionKey?: string;
  }) => void,
): EventListener {
  return (event: ExecutionEvent) => {
    // Map ExecutionEventKind to legacy stream names
    const stream = mapEventKindToStream(event.kind);

    emitAgentEvent({
      runId: event.runId,
      stream,
      data: event.data,
      sessionKey: event.data.sessionKey as string | undefined,
    });
  };
}

/**
 * Map ExecutionEventKind to legacy AgentEventStream.
 */
function mapEventKindToStream(kind: ExecutionEventKind): string {
  const kindPrefix = kind.split(".")[0];
  switch (kindPrefix) {
    case "lifecycle":
      return "lifecycle";
    case "tool":
      return "tool";
    case "assistant":
      return "assistant";
    default:
      return kindPrefix;
  }
}

// ---------------------------------------------------------------------------
// Factory Functions
// ---------------------------------------------------------------------------

/**
 * Create an EventRouter with optional legacy event system integration.
 *
 * @param options - Router options
 * @param legacyEmit - Optional legacy emitAgentEvent function for backward compatibility
 * @returns Configured EventRouter instance
 */
export function createEventRouter(
  options: EventRouterOptions = {},
  legacyEmit?: (event: {
    runId: string;
    stream: string;
    data: Record<string, unknown>;
    sessionKey?: string;
  }) => void,
): EventRouter {
  const router = new EventRouter(options);

  // Wire up legacy event system if provided
  if (legacyEmit) {
    router.subscribe(createLegacyEventAdapter(legacyEmit));
  }

  return router;
}

// ---------------------------------------------------------------------------
// Event Builder Helpers
// ---------------------------------------------------------------------------

/**
 * Create an ExecutionEvent with the current timestamp.
 *
 * @param kind - Event kind
 * @param runId - Unique run identifier
 * @param data - Event-specific payload
 * @returns Complete ExecutionEvent
 */
export function createEvent(
  kind: ExecutionEventKind,
  runId: string,
  data: Record<string, unknown> = {},
): ExecutionEvent {
  return {
    kind,
    timestamp: Date.now(),
    runId,
    data,
  };
}

/**
 * Create a lifecycle.start event.
 */
export function createLifecycleStartEvent(
  runId: string,
  data: { prompt: string; agentId?: string; sessionKey?: string },
): ExecutionEvent {
  return createEvent("lifecycle.start", runId, data);
}

/**
 * Create a lifecycle.end event.
 */
export function createLifecycleEndEvent(
  runId: string,
  data: { success: boolean; durationMs?: number; error?: string },
): ExecutionEvent {
  return createEvent("lifecycle.end", runId, data);
}

/**
 * Create a lifecycle.error event.
 */
export function createLifecycleErrorEvent(
  runId: string,
  data: { error: string; kind?: string; retryable?: boolean },
): ExecutionEvent {
  return createEvent("lifecycle.error", runId, data);
}

/**
 * Create a tool.start event.
 */
export function createToolStartEvent(
  runId: string,
  data: { toolName: string; toolCallId: string; params?: Record<string, unknown> },
): ExecutionEvent {
  return createEvent("tool.start", runId, data);
}

/**
 * Create a tool.end event.
 */
export function createToolEndEvent(
  runId: string,
  data: {
    toolName: string;
    toolCallId: string;
    success: boolean;
    result?: unknown;
    error?: string;
    durationMs?: number;
  },
): ExecutionEvent {
  return createEvent("tool.end", runId, data);
}

/**
 * Create an assistant.partial event.
 */
export function createAssistantPartialEvent(runId: string, data: { text: string }): ExecutionEvent {
  return createEvent("assistant.partial", runId, data);
}

/**
 * Create an assistant.complete event.
 */
export function createAssistantCompleteEvent(
  runId: string,
  data: { text: string; toolCalls?: number },
): ExecutionEvent {
  return createEvent("assistant.complete", runId, data);
}

/**
 * Create a compaction.start event.
 */
export function createCompactionStartEvent(
  runId: string,
  data: { messageCount: number; tokenCount?: number },
): ExecutionEvent {
  return createEvent("compaction.start", runId, data);
}

/**
 * Create a compaction.end event.
 */
export function createCompactionEndEvent(
  runId: string,
  data: { messageCount: number; compactedCount: number; tokenCount?: number },
): ExecutionEvent {
  return createEvent("compaction.end", runId, data);
}

/**
 * Create a hook.triggered event.
 */
export function createHookTriggeredEvent(
  runId: string,
  data: { hookName: string; pluginId?: string },
): ExecutionEvent {
  return createEvent("hook.triggered", runId, data);
}
