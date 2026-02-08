import path from "node:path";
import type { JournalConfig, ToolJournalEntry } from "./types.js";
import { onAgentEvent, type AgentEventPayload } from "../agent-events.js";
import {
  initJournalPath,
  writeJournalEntry,
  pruneOldJournalFiles,
  getJournalFilePath,
  resetJournalWriter,
} from "./journal-writer.js";
import { DEFAULT_JOURNAL_TOOLS } from "./types.js";

let unsubscribe: (() => void) | null = null;

const DEFAULT_RETENTION_HOURS = 72;

type InFlightEntry = { ts: number; toolName: string };

/**
 * Start the tool journal subscriber.
 * Subscribes to agent events and writes full-fidelity tool call records.
 */
export function startJournalSubscriber(config?: JournalConfig): void {
  if (unsubscribe) {
    return; // already subscribed
  }

  const enabled = config?.enabled !== false; // default: true
  if (!enabled) {
    return;
  }

  const filePath = initJournalPath(config?.file);
  const maxResultChars = config?.maxResultChars ?? 0; // 0 = unlimited
  const redactSensitive = config?.redactSensitive ?? false;
  const toolFilter = config?.toolFilter ?? DEFAULT_JOURNAL_TOOLS;
  const retentionHours = config?.retentionHours ?? DEFAULT_RETENTION_HOURS;
  const matchAll = toolFilter.length === 1 && toolFilter[0] === "*";

  // Prune old journal files once on startup
  pruneOldJournalFiles(path.dirname(filePath), retentionHours);

  const inFlight = new Map<string, InFlightEntry>();

  unsubscribe = onAgentEvent((event: AgentEventPayload) => {
    if (event.stream !== "tool") {
      return;
    }

    const data = event.data as {
      name?: string;
      callId?: string;
      phase?: string;
      input?: Record<string, unknown>;
      output?: unknown;
      error?: unknown;
      durationMs?: number;
    };

    const toolName = data.name ?? "unknown";
    if (!matchAll && !toolFilter.includes(toolName)) {
      return;
    }

    const toolCallId = data.callId ?? event.runId;
    const phase = normalizePhase(data.phase);

    if (phase === "start") {
      inFlight.set(toolCallId, { ts: event.ts, toolName });
    }

    let durationMs: number | undefined;
    if (phase === "result") {
      const started = inFlight.get(toolCallId);
      if (started) {
        durationMs = event.ts - started.ts;
        inFlight.delete(toolCallId);
      }
      durationMs = durationMs ?? data.durationMs;
    }

    const args = phase === "start" ? maybeRedact(data.input, redactSensitive) : undefined;
    let result: unknown;
    if (phase === "result") {
      result = data.error ?? data.output;
      result = maybeTruncate(result, maxResultChars);
    }

    const entry: ToolJournalEntry = {
      ts: new Date(event.ts).toISOString(),
      phase,
      runId: event.runId,
      seq: event.seq,
      ...(event.sessionKey ? { sessionKey: event.sessionKey } : {}),
      toolName,
      toolCallId,
      ...(args !== undefined ? { args } : {}),
      ...(result !== undefined ? { result } : {}),
      ...(phase === "result" && data.error !== undefined ? { isError: true } : {}),
      ...(durationMs !== undefined ? { durationMs } : {}),
    };

    writeJournalEntry(entry);
  });
}

/**
 * Stop the journal subscriber and reset writer state.
 */
export function stopJournalSubscriber(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  resetJournalWriter();
}

export { getJournalFilePath };

function normalizePhase(phase?: string): "start" | "update" | "result" {
  if (phase === "start") {
    return "start";
  }
  if (phase === "update" || phase === "partial") {
    return "update";
  }
  return "result";
}

const SENSITIVE_KEYS = ["password", "apikey", "api_key", "secret", "token", "credential", "auth"];

function maybeRedact(
  input: Record<string, unknown> | undefined,
  redact: boolean,
): Record<string, unknown> | undefined {
  if (!input) {
    return undefined;
  }
  if (!redact) {
    return input;
  }
  const redacted = { ...input };
  for (const key of Object.keys(redacted)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some((sk) => lower.includes(sk))) {
      redacted[key] = "[REDACTED]";
    }
  }
  return redacted;
}

function maybeTruncate(value: unknown, maxChars: number): unknown {
  if (maxChars <= 0 || value === undefined) {
    return value;
  }
  const str = typeof value === "string" ? value : JSON.stringify(value);
  if (str && str.length > maxChars) {
    return str.slice(0, maxChars) + "... [truncated]";
  }
  return value;
}
