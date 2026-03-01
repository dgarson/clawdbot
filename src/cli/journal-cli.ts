import type { Command } from "commander";
import {
  type JournalReadOptions,
  getJournalStats,
  parseRelativeTime,
  readJournalEntries,
  tailJournal,
} from "../infra/journal/reader.js";
import type { ActivityBucket, JournalEntry, JournalSeverity } from "../infra/journal/types.js";
import { clearActiveProgressLine } from "../terminal/progress-line.js";
import { createSafeStreamWriter } from "../terminal/stream-writer.js";
import { colorize, isRich, theme } from "../terminal/theme.js";

type JournalTailOpts = {
  agent?: string;
  type?: string;
  severity?: string;
  bucket?: string;
  follow?: boolean;
  json?: boolean;
  limit?: string;
};

type JournalSearchOpts = {
  agent?: string;
  type?: string;
  severity?: string;
  since?: string;
  until?: string;
  session?: string;
  run?: string;
  json?: boolean;
  limit?: string;
};

type JournalStatsOpts = {
  agent?: string;
  since?: string;
  json?: boolean;
};

const VALID_SEVERITIES: JournalSeverity[] = ["trace", "debug", "info", "warn", "error"];
const VALID_BUCKETS = new Set<ActivityBucket>(["runs", "errors", "messages", "usage", "cache"]);

function parseSeverity(input: string | undefined): JournalSeverity | undefined {
  if (!input) {
    return undefined;
  }
  const lower = input.toLowerCase() as JournalSeverity;
  return VALID_SEVERITIES.includes(lower) ? lower : undefined;
}

function parseBucket(input: string | undefined): ActivityBucket | undefined {
  if (!input) {
    return undefined;
  }
  const lower = input.toLowerCase() as ActivityBucket;
  return VALID_BUCKETS.has(lower) ? lower : undefined;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function formatTimestamp(ts: number, rich: boolean): string {
  const date = new Date(ts);
  const time = date.toISOString().slice(11, 23);
  return colorize(rich, theme.muted, time);
}

function severityColor(severity: JournalSeverity): (value: string) => string {
  switch (severity) {
    case "error":
      return theme.error;
    case "warn":
      return theme.warn;
    case "trace":
    case "debug":
      return theme.muted;
    default:
      return theme.info;
  }
}

function formatEntry(entry: JournalEntry, rich: boolean): string {
  const time = formatTimestamp(entry.ts, rich);
  const sev = colorize(rich, severityColor(entry.severity), entry.severity.padEnd(5));
  const agent = entry.agentId ? colorize(rich, theme.accent, `[${entry.agentId}]`) : "";
  const typeLabel = colorize(rich, theme.accent, entry.type);
  const summary =
    entry.severity === "error" || entry.severity === "warn"
      ? colorize(rich, severityColor(entry.severity), entry.summary)
      : entry.summary;

  return [time, sev, agent, typeLabel, summary].filter(Boolean).join(" ");
}

function formatExpandedEntry(entry: JournalEntry, rich: boolean): string {
  const header = formatEntry(entry, rich);
  if (!entry.data || Object.keys(entry.data).length === 0) {
    return header;
  }
  const dataStr = JSON.stringify(entry.data, null, 2)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  return `${header}\n${colorize(rich, theme.muted, dataStr)}`;
}

function createWriters() {
  const writer = createSafeStreamWriter({
    beforeWrite: () => clearActiveProgressLine(),
  });
  return {
    logLine: (text: string) => writer.writeLine(process.stdout, text),
    errorLine: (text: string) => writer.writeLine(process.stderr, text),
  };
}

export function registerJournalCli(program: Command) {
  const journal = program
    .command("journal")
    .description("Query and tail structured event journals");

  // --- journal tail ---
  journal
    .command("tail")
    .description("Show recent journal entries")
    .option("--agent <id>", "Filter by agent ID")
    .option("--type <type>", "Filter by event type (e.g., run.start, cache.invalidation)")
    .option(
      "--severity <level>",
      "Minimum severity level (trace, debug, info, warn, error)",
      "info",
    )
    .option("--bucket <name>", "Read from activity bucket (runs, errors, messages, usage, cache)")
    .option("-f, --follow", "Follow mode — watch for new entries", false)
    .option("--json", "Output raw JSONL", false)
    .option("--limit <n>", "Max entries to show", "100")
    .action(async (opts: JournalTailOpts) => {
      const { logLine } = createWriters();
      const rich = isRich();
      const limit = parsePositiveInt(opts.limit, 100);
      const severity = parseSeverity(opts.severity) ?? "info";
      const bucket = parseBucket(opts.bucket);

      const readOpts: JournalReadOptions = {
        agentId: opts.agent,
        type: opts.type,
        severity,
        bucket,
        limit,
      };

      if (!opts.follow) {
        const entries = readJournalEntries(readOpts);

        if (entries.length === 0) {
          logLine(colorize(rich, theme.muted, "No journal entries found."));
          return;
        }

        // entries are newest-first, display oldest-first
        for (let i = entries.length - 1; i >= 0; i--) {
          const entry = entries[i];
          if (opts.json) {
            logLine(JSON.stringify(entry));
          } else if (entry.severity === "warn" || entry.severity === "error") {
            logLine(formatExpandedEntry(entry, rich));
          } else {
            logLine(formatEntry(entry, rich));
          }
        }
        return;
      }

      // Follow mode
      logLine(colorize(rich, theme.muted, "Tailing journal... (Ctrl+C to stop)"));

      tailJournal({
        ...readOpts,
        onEntry: (entry) => {
          if (opts.json) {
            logLine(JSON.stringify(entry));
          } else if (entry.severity === "warn" || entry.severity === "error") {
            logLine(formatExpandedEntry(entry, rich));
          } else {
            logLine(formatEntry(entry, rich));
          }
        },
      });

      // Keep process alive
      await new Promise<never>(() => {});
    });

  // --- journal search ---
  journal
    .command("search")
    .description("Search journal entries with filters")
    .option("--agent <id>", "Filter by agent ID")
    .option("--type <type>", "Filter by event type (supports glob: run.*, cache.*)")
    .option("--severity <level>", "Minimum severity level")
    .option("--since <time>", "Start time (ISO date or relative: 1h, 30m, 2d)")
    .option("--until <time>", "End time (ISO date or relative)")
    .option("--session <id>", "Filter by session ID")
    .option("--run <id>", "Filter by run ID")
    .option("--json", "Output raw JSONL", false)
    .option("--limit <n>", "Max entries to return", "50")
    .action(async (opts: JournalSearchOpts) => {
      const { logLine } = createWriters();
      const rich = isRich();

      const readOpts: JournalReadOptions = {
        agentId: opts.agent,
        type: opts.type,
        severity: parseSeverity(opts.severity),
        since: opts.since ? (parseRelativeTime(opts.since) ?? undefined) : undefined,
        until: opts.until ? (parseRelativeTime(opts.until) ?? undefined) : undefined,
        sessionId: opts.session,
        runId: opts.run,
        limit: parsePositiveInt(opts.limit, 50),
      };

      const entries = readJournalEntries(readOpts);

      if (entries.length === 0) {
        logLine(colorize(rich, theme.muted, "No matching journal entries found."));
        return;
      }

      logLine(colorize(rich, theme.muted, `Found ${entries.length} entries:`));
      logLine("");

      // Display oldest first
      for (let i = entries.length - 1; i >= 0; i--) {
        const entry = entries[i];
        if (opts.json) {
          logLine(JSON.stringify(entry));
        } else if (entry.severity === "warn" || entry.severity === "error") {
          logLine(formatExpandedEntry(entry, rich));
        } else {
          logLine(formatEntry(entry, rich));
        }
      }
    });

  // --- journal stats ---
  journal
    .command("stats")
    .description("Show journal event statistics")
    .option("--agent <id>", "Filter by agent ID")
    .option("--since <time>", "Time window (default: 24h)", "24h")
    .option("--json", "Output JSON", false)
    .action(async (opts: JournalStatsOpts) => {
      const { logLine } = createWriters();
      const rich = isRich();

      const since = parseRelativeTime(opts.since ?? "24h") ?? Date.now() - 24 * 60 * 60 * 1000;

      const stats = getJournalStats({
        agentId: opts.agent,
        since,
      });

      if (opts.json) {
        logLine(JSON.stringify(stats, null, 2));
        return;
      }

      logLine(colorize(rich, theme.accent, "Journal Statistics"));
      logLine(colorize(rich, theme.muted, "─".repeat(50)));
      logLine(`Total events: ${stats.totalEvents}`);

      if (stats.timeRange.earliest > 0) {
        logLine(
          `Time range: ${new Date(stats.timeRange.earliest).toISOString()} → ${new Date(stats.timeRange.latest).toISOString()}`,
        );
      }

      logLine("");
      logLine(colorize(rich, theme.accent, "By Severity:"));
      for (const sev of VALID_SEVERITIES) {
        const count = stats.bySeverity[sev];
        if (count > 0) {
          logLine(`  ${colorize(rich, severityColor(sev), sev.padEnd(6))} ${count}`);
        }
      }

      logLine("");
      logLine(colorize(rich, theme.accent, "By Type (top 15):"));
      const sortedTypes = Object.entries(stats.byType)
        .toSorted((a, b) => b[1] - a[1])
        .slice(0, 15);
      for (const [type, count] of sortedTypes) {
        logLine(`  ${type.padEnd(25)} ${count}`);
      }

      if (Object.keys(stats.byAgent).length > 0) {
        logLine("");
        logLine(colorize(rich, theme.accent, "By Agent:"));
        const sortedAgents = Object.entries(stats.byAgent).toSorted((a, b) => b[1] - a[1]);
        for (const [agent, count] of sortedAgents) {
          logLine(`  ${agent.padEnd(20)} ${count}`);
        }
      }

      if (stats.errorSummary.length > 0) {
        logLine("");
        logLine(colorize(rich, theme.error, "Recent Errors:"));
        for (const err of stats.errorSummary.slice(0, 10)) {
          const time = new Date(err.ts).toISOString().slice(11, 19);
          logLine(`  ${colorize(rich, theme.muted, time)} ${err.type}: ${err.summary}`);
        }
      }
    });
}
