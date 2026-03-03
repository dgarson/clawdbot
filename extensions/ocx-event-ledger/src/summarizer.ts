/**
 * Background run summary materialization.
 *
 * Periodically scans recent session.end events and builds RunSummary records
 * for any completed runs that don't already have a summary. Summaries are
 * computed by replaying all events for a given runId and aggregating
 * token counts, costs, tool stats, and duration.
 */

import type { EventStorage } from "./storage.js";
import type { EventEnvelope, RunSummary, RunSummaryOutcome } from "./types.js";

type Logger = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

/** How often the summarizer scans for unsummarized runs (ms). */
const SCAN_INTERVAL_MS = 30_000;

export class RunSummarizer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  /** Set of runIds we have already summarized (in-memory dedup). */
  private summarizedRuns = new Set<string>();

  constructor(
    private readonly storage: EventStorage,
    private readonly logger: Logger,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.scan();
    }, SCAN_INTERVAL_MS);
    if (this.timer && typeof this.timer === "object" && "unref" in this.timer) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Scan today's and yesterday's event files for session.end events,
   * then build summaries for any runs not yet summarized.
   */
  private async scan(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
      const days = [yesterday, today];

      const agentIds = await this.storage.listAgentIds();

      for (const agentId of agentIds) {
        for (const day of days) {
          await this.scanDayForAgent(agentId, day);
        }
      }
    } catch (err) {
      this.logger.error(`[event-ledger] Summarizer scan error: ${String(err)}`);
    } finally {
      this.running = false;
    }
  }

  private async scanDayForAgent(agentId: string, day: string): Promise<void> {
    const events = await this.storage.readDayEvents(agentId, day);
    // Find session.end events that signify a completed run
    const endEvents = events.filter((e) => e.type === "session.end");

    for (const endEvt of endEvents) {
      const runId = endEvt.runId;
      if (this.summarizedRuns.has(runId)) continue;

      // Collect all events for this run across the day file
      const runEvents = events.filter((e) => e.runId === runId);
      const summary = this.buildSummary(runId, runEvents, agentId);
      if (summary) {
        this.storage.appendSummary(summary);
        this.summarizedRuns.add(runId);
      }
    }
  }

  /**
   * Build a RunSummary by aggregating events for a single run.
   */
  private buildSummary(runId: string, events: EventEnvelope[], agentId: string): RunSummary | null {
    if (events.length === 0) return null;

    // Sort by timestamp for correct ordering
    events.sort((a, b) => a.ts.localeCompare(b.ts));

    let sessionKey = "";
    let lineageId: string | undefined;
    let startedAt = "";
    let endedAt = "";
    let model = "";
    let provider = "";
    let inputTokens = 0;
    let outputTokens = 0;
    let estimatedCostUsd = 0;
    let toolCalls = 0;
    let toolFailures = 0;
    let outcome: RunSummaryOutcome = "completed";

    for (const evt of events) {
      if (!startedAt || evt.ts < startedAt) startedAt = evt.ts;
      if (!endedAt || evt.ts > endedAt) endedAt = evt.ts;
      if (evt.sessionKey) sessionKey = evt.sessionKey;
      if (evt.lineageId) lineageId = evt.lineageId;

      switch (evt.type) {
        case "budget.usage": {
          const d = evt.data;
          inputTokens += asNumber(d.inputTokens);
          outputTokens += asNumber(d.outputTokens);
          estimatedCostUsd += asNumber(d.estimatedCostUsd);
          if (typeof d.model === "string" && d.model) model = d.model;
          if (typeof d.provider === "string" && d.provider) provider = d.provider;
          break;
        }
        case "tool.invoked":
          toolCalls += 1;
          break;
        case "tool.completed": {
          if (evt.data.success === false) toolFailures += 1;
          break;
        }
        case "session.end": {
          // Check if the session ended with an error condition
          const endOutcome = evt.data.outcome;
          if (typeof endOutcome === "string") {
            if (endOutcome === "error" || endOutcome === "timeout" || endOutcome === "killed") {
              outcome = endOutcome as RunSummaryOutcome;
            }
          }
          break;
        }
      }
    }

    if (!startedAt || !endedAt) return null;

    const durationMs = new Date(endedAt).getTime() - new Date(startedAt).getTime();

    return {
      runId,
      ...(lineageId ? { lineageId } : {}),
      agentId,
      sessionKey,
      startedAt,
      endedAt,
      durationMs: Math.max(0, durationMs),
      model,
      provider,
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      toolCalls,
      toolFailures,
      outcome,
    };
  }
}

function asNumber(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
