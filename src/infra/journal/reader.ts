import fs from "node:fs";
import path from "node:path";
import {
  listJournalFiles,
  resolveActivityDir,
  resolveAgentJournalDir,
  resolveJournalDir,
} from "./paths.js";
import type { ActivityBucket, JournalEntry, JournalSeverity } from "./types.js";

const SEVERITY_ORDER: Record<JournalSeverity, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

export type JournalReadOptions = {
  agentId?: string;
  bucket?: ActivityBucket;
  type?: string;
  severity?: JournalSeverity;
  since?: number;
  until?: number;
  sessionId?: string;
  runId?: string;
  limit?: number;
};

export type JournalStats = {
  totalEvents: number;
  byType: Record<string, number>;
  bySeverity: Record<JournalSeverity, number>;
  byAgent: Record<string, number>;
  errorSummary: Array<{ type: string; summary: string; ts: number }>;
  timeRange: { earliest: number; latest: number };
};

function matchesFilter(entry: JournalEntry, opts: JournalReadOptions): boolean {
  if (opts.severity && SEVERITY_ORDER[entry.severity] < SEVERITY_ORDER[opts.severity]) {
    return false;
  }
  if (opts.type) {
    if (opts.type.endsWith(".*")) {
      const prefix = opts.type.slice(0, -2);
      if (!entry.type.startsWith(prefix)) {
        return false;
      }
    } else if (entry.type !== opts.type) {
      return false;
    }
  }
  if (opts.since && entry.ts < opts.since) {
    return false;
  }
  if (opts.until && entry.ts > opts.until) {
    return false;
  }
  if (opts.sessionId && entry.sessionId !== opts.sessionId) {
    return false;
  }
  if (opts.runId && entry.runId !== opts.runId) {
    return false;
  }
  if (opts.agentId && entry.agentId !== opts.agentId) {
    return false;
  }
  return true;
}

function parseJournalLine(line: string): JournalEntry | null {
  const trimmed = line.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return JSON.parse(trimmed) as JournalEntry;
  } catch {
    return null;
  }
}

/** Resolve the list of journal files to read based on options. */
function resolveFiles(opts: JournalReadOptions): string[] {
  if (opts.bucket) {
    return listJournalFiles(resolveActivityDir(), opts.bucket);
  }
  if (opts.agentId) {
    return listJournalFiles(resolveAgentJournalDir(opts.agentId));
  }
  // Read from all agents
  const agentsDir = path.join(resolveJournalDir(), "agents");
  if (!fs.existsSync(agentsDir)) {
    return [];
  }
  const agents = fs.readdirSync(agentsDir).filter((d: string) => {
    try {
      return fs.statSync(path.join(agentsDir, d)).isDirectory();
    } catch {
      return false;
    }
  });
  const files: string[] = [];
  for (const agent of agents) {
    files.push(...listJournalFiles(resolveAgentJournalDir(agent)));
  }
  return files.toSorted().toReversed();
}

/** Read journal entries from files with filtering. Returns newest first. */
export function readJournalEntries(opts: JournalReadOptions): JournalEntry[] {
  const files = resolveFiles(opts);
  const limit = opts.limit ?? 1000;
  const results: JournalEntry[] = [];

  for (const file of files) {
    if (results.length >= limit) {
      break;
    }
    if (!fs.existsSync(file)) {
      continue;
    }

    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");

    // Read from end to get newest first
    for (let i = lines.length - 1; i >= 0; i--) {
      if (results.length >= limit) {
        break;
      }
      const entry = parseJournalLine(lines[i]);
      if (entry && matchesFilter(entry, opts)) {
        results.push(entry);
      }
    }
  }

  return results;
}

/** Compute aggregate stats from journal entries. */
export function getJournalStats(opts: JournalReadOptions): JournalStats {
  // Read without limit for stats
  const entries = readJournalEntries({ ...opts, limit: 100_000 });

  const stats: JournalStats = {
    totalEvents: entries.length,
    byType: {},
    bySeverity: { trace: 0, debug: 0, info: 0, warn: 0, error: 0 },
    byAgent: {},
    errorSummary: [],
    timeRange: {
      earliest: entries.length > 0 ? entries[entries.length - 1].ts : 0,
      latest: entries.length > 0 ? entries[0].ts : 0,
    },
  };

  for (const entry of entries) {
    stats.byType[entry.type] = (stats.byType[entry.type] ?? 0) + 1;
    stats.bySeverity[entry.severity] += 1;
    if (entry.agentId) {
      stats.byAgent[entry.agentId] = (stats.byAgent[entry.agentId] ?? 0) + 1;
    }
    if (entry.severity === "error" && stats.errorSummary.length < 20) {
      stats.errorSummary.push({
        type: entry.type,
        summary: entry.summary,
        ts: entry.ts,
      });
    }
  }

  return stats;
}

export type TailJournalOptions = JournalReadOptions & {
  onEntry: (entry: JournalEntry) => void;
  intervalMs?: number;
};

/** Tail a journal file for new entries. Returns a stop function. */
export function tailJournal(opts: TailJournalOptions): () => void {
  const intervalMs = opts.intervalMs ?? 1000;
  let stopped = false;
  let lastPosition = 0;

  // Find the most recent file to tail
  const files = resolveFiles(opts);
  const targetFile = files[0];
  if (!targetFile || !fs.existsSync(targetFile)) {
    return () => {
      stopped = true;
    };
  }

  // Start from end of current file
  try {
    const stats = fs.statSync(targetFile);
    lastPosition = stats.size;
  } catch {
    // start from beginning
  }

  const timer = setInterval(() => {
    if (stopped) {
      return;
    }
    try {
      const stats = fs.statSync(targetFile);
      if (stats.size <= lastPosition) {
        // File may have rotated, reset
        if (stats.size < lastPosition) {
          lastPosition = 0;
        }
        return;
      }

      const fd = fs.openSync(targetFile, "r");
      const buffer = Buffer.alloc(stats.size - lastPosition);
      fs.readSync(fd, buffer, 0, buffer.length, lastPosition);
      fs.closeSync(fd);
      lastPosition = stats.size;

      const chunk = buffer.toString("utf8");
      const lines = chunk.split("\n");
      for (const line of lines) {
        const entry = parseJournalLine(line);
        if (entry && matchesFilter(entry, opts)) {
          opts.onEntry(entry);
        }
      }
    } catch {
      // ignore read errors during tail
    }
  }, intervalMs);

  if (typeof timer === "object" && "unref" in timer) {
    timer.unref();
  }

  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

/** Parse a relative time string like "1h", "30m", "2d" to epoch ms. */
export function parseRelativeTime(input: string): number | null {
  const now = Date.now();
  const match = input.match(/^(\d+)([smhd])$/);
  if (!match) {
    // Try ISO date
    const date = new Date(input);
    if (!Number.isNaN(date.getTime())) {
      return date.getTime();
    }
    return null;
  }
  const value = Number.parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case "s":
      return now - value * 1000;
    case "m":
      return now - value * 60 * 1000;
    case "h":
      return now - value * 60 * 60 * 1000;
    case "d":
      return now - value * 24 * 60 * 60 * 1000;
    default:
      return null;
  }
}
