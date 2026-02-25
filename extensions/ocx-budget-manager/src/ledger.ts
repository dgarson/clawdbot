import { appendFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
import { clearExpiredAlerts } from "./alerts.js";
import type {
  BudgetAllocation,
  BudgetScope,
  BudgetUsage,
  BudgetWindow,
  LedgerEntry,
  UsageIncrement,
} from "./types.js";

/**
 * Compute the start and end of the current budget window.
 */
function computeWindowBounds(window: BudgetWindow): { start: Date; end: Date } {
  const now = new Date();

  switch (window.kind) {
    case "hourly": {
      const start = new Date(now);
      start.setMinutes(0, 0, 0);
      const end = new Date(start);
      end.setHours(end.getHours() + 1);
      return { start, end };
    }
    case "daily": {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return { start, end };
    }
    case "weekly": {
      const start = new Date(now);
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { start, end };
    }
    case "monthly": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start, end };
    }
    case "sprint": {
      // Sprints don't have inherent time bounds; use monthly as fallback
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start, end };
    }
    case "rolling": {
      const end = now;
      const start = new Date(now.getTime() - window.durationMs);
      return { start, end };
    }
  }
}

/** Scope key for in-memory counters and file naming. */
function scopeKey(scope: BudgetScope): string {
  return `${scope.level}:${scope.id}`;
}

/** Window key for partitioning counters by time period. */
function windowKey(window: BudgetWindow): string {
  const bounds = computeWindowBounds(window);
  return `${window.kind}:${bounds.start.toISOString()}`;
}

/** Combined key for scope + window. */
function counterKey(scope: BudgetScope, window: BudgetWindow): string {
  return `${scopeKey(scope)}|${windowKey(window)}`;
}

type UsageCounter = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  runCount: number;
  runIds: Set<string>;
  windowStart: Date;
  windowEnd: Date;
};

function emptyCounter(window: BudgetWindow): UsageCounter {
  const { start, end } = computeWindowBounds(window);
  return {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    runCount: 0,
    runIds: new Set(),
    windowStart: start,
    windowEnd: end,
  };
}

/**
 * Budget ledger: in-memory usage counters per scope/window, persisted to JSONL.
 */
export class Ledger {
  private counters = new Map<string, UsageCounter>();
  private stateDir: string;
  private logger: Logger;

  constructor(stateDir: string, logger: Logger) {
    this.stateDir = stateDir;
    this.logger = logger;
  }

  /**
   * Accumulate a usage increment into a scope's current window counter.
   * Also appends the entry to the JSONL ledger on disk.
   */
  async accumulateUsage(allocation: BudgetAllocation, usage: UsageIncrement): Promise<void> {
    const key = counterKey(allocation.scope, allocation.window);
    let counter = this.counters.get(key);

    // Check if counter is for a past window and reset if needed
    if (counter) {
      const { start } = computeWindowBounds(allocation.window);
      if (counter.windowStart.getTime() !== start.getTime()) {
        // Window boundary crossed — clear stale alert state for the new window
        clearExpiredAlerts(start.toISOString());
        counter = undefined;
      }
    }

    if (!counter) {
      counter = emptyCounter(allocation.window);
      this.counters.set(key, counter);
    }

    counter.inputTokens += usage.inputTokens;
    counter.outputTokens += usage.outputTokens;
    counter.totalTokens += usage.totalTokens;
    counter.estimatedCostUsd += usage.estimatedCostUsd;

    // Count unique runs
    if (!counter.runIds.has(usage.runId)) {
      counter.runIds.add(usage.runId);
      counter.runCount = counter.runIds.size;
    }

    // Persist to disk asynchronously (fire-and-forget for performance)
    this.persistEntry(allocation.scope, usage).catch((err) => {
      this.logger.warn(`budget-manager: failed to persist ledger entry: ${String(err)}`);
    });
  }

  /** Get current usage for a scope and window. */
  getCurrentUsage(allocation: BudgetAllocation): BudgetUsage {
    const key = counterKey(allocation.scope, allocation.window);
    const counter = this.counters.get(key);
    const { start, end } = computeWindowBounds(allocation.window);

    if (!counter || counter.windowStart.getTime() !== start.getTime()) {
      return {
        scope: allocation.scope,
        windowStart: start.toISOString(),
        windowEnd: end.toISOString(),
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
        runCount: 0,
        utilizationPct: computeUtilization(allocation, emptyCounter(allocation.window)),
      };
    }

    return {
      scope: allocation.scope,
      windowStart: counter.windowStart.toISOString(),
      windowEnd: counter.windowEnd.toISOString(),
      inputTokens: counter.inputTokens,
      outputTokens: counter.outputTokens,
      totalTokens: counter.totalTokens,
      estimatedCostUsd: counter.estimatedCostUsd,
      runCount: counter.runCount,
      utilizationPct: computeUtilization(allocation, counter),
    };
  }

  /**
   * Load historical usage from JSONL files for a scope.
   * Returns entries within the given time range.
   */
  async getHistoricalUsage(scope: BudgetScope, from: Date, to: Date): Promise<LedgerEntry[]> {
    const dir = join(this.stateDir, "ledger");
    const filename = `${scope.level}-${scope.id}.jsonl`;
    const filePath = join(dir, filename);

    try {
      const raw = await readFile(filePath, "utf-8");
      const entries: LedgerEntry[] = [];

      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line) as LedgerEntry;
          const entryTime = new Date(entry.ts);
          if (entryTime >= from && entryTime <= to) {
            entries.push(entry);
          }
        } catch {
          // Skip malformed lines
        }
      }

      return entries;
    } catch {
      return [];
    }
  }

  /** Persist a single ledger entry to the JSONL file for a scope. */
  private async persistEntry(scope: BudgetScope, usage: UsageIncrement): Promise<void> {
    const dir = join(this.stateDir, "ledger");
    await mkdir(dir, { recursive: true });

    const filename = `${scope.level}-${scope.id}.jsonl`;
    const filePath = join(dir, filename);

    const entry: LedgerEntry = {
      ts: new Date().toISOString(),
      scopeLevel: scope.level,
      scopeId: scope.id,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      totalTokens: usage.totalTokens,
      estimatedCostUsd: usage.estimatedCostUsd,
      runId: usage.runId,
      agentId: usage.agentId,
    };

    await appendFile(filePath, JSON.stringify(entry) + "\n", "utf-8");
  }
}

/** Compute utilization percentages for each limited dimension. */
function computeUtilization(
  allocation: BudgetAllocation,
  counter: UsageCounter,
): Record<string, number> {
  const pct: Record<string, number> = {};
  const { limits } = allocation;

  if (limits.maxInputTokens) {
    pct.inputTokens = counter.inputTokens / limits.maxInputTokens;
  }
  if (limits.maxOutputTokens) {
    pct.outputTokens = counter.outputTokens / limits.maxOutputTokens;
  }
  if (limits.maxTotalTokens) {
    pct.totalTokens = counter.totalTokens / limits.maxTotalTokens;
  }
  if (limits.maxCostUsd) {
    pct.costUsd = counter.estimatedCostUsd / limits.maxCostUsd;
  }
  if (limits.maxRuns) {
    pct.runs = counter.runCount / limits.maxRuns;
  }

  return pct;
}
