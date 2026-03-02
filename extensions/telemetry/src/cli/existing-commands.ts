/**
 * Refactored telemetry CLI commands extracted from cli.ts into a standalone module.
 * Each command supports --json and --agent options inherited from the parent `tel` command.
 *
 * Commands:
 *   telemetry runs [--session] [--model] [--limit] [--since] [--until]
 *   telemetry run <runId>
 *   telemetry tools [--run] [--name] [--session] [--errors-only] [--limit]
 *   telemetry timeline <sessionKey> [--limit] [--kinds]
 *   telemetry usage [--since] [--until] [--session]
 *   telemetry events [--kind] [--run] [--limit] [--since] [--until] [--session]
 *   telemetry files [--run] [--path] [--session] [--limit]
 */

import type { Command } from "commander";
import type { Indexer } from "../indexer.js";
import {
  listRuns,
  getRun,
  getToolCalls,
  getSessionTimeline,
  getUsageSummary,
  listEvents,
  getFileOperations,
} from "../queries.js";
import {
  parseDate,
  fmtTs,
  fmtDuration,
  fmtCost,
  output,
  outputDetail,
  getGlobalOpts,
} from "./helpers.js";

// ---------------------------------------------------------------------------
// telemetry runs
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// telemetry run <runId>
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// telemetry tools
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// telemetry timeline <sessionKey>
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// telemetry usage
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// telemetry events
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// telemetry files
// ---------------------------------------------------------------------------

/**
 * Register the 7 core telemetry query sub-commands onto the given `tel` Command.
 * Pass `getIndexer` as a lazy accessor so it is resolved at invocation time.
 */
export function registerExistingCommands(tel: Command, getIndexer: () => Indexer | null): void {
  // -------------------------------------------------------------------------
  // telemetry runs
  // -------------------------------------------------------------------------
  tel
    .command("runs")
    .description("List agent runs")
    .option("--session <key>", "Filter by session key")
    .option("--model <name>", "Filter by model")
    .option("--limit <n>", "Max results", "20")
    .option("--since <date>", "Only runs started after this date")
    .option("--until <date>", "Only runs started before this date")
    .action(
      (
        opts: { session?: string; model?: string; limit?: string; since?: string; until?: string },
        command: Command,
      ) => {
        const globalOpts = getGlobalOpts(command);
        const indexer = getIndexer();
        if (!indexer) {
          console.error("Telemetry indexer is not running.");
          return;
        }
        const rows = listRuns(indexer.db, {
          sessionKey: opts.session,
          agentId: globalOpts.agent,
          model: opts.model,
          limit: parseInt(opts.limit ?? "20", 10),
          since: parseDate(opts.since),
          until: parseDate(opts.until),
        });
        output(
          rows,
          (r) => ({
            runId: r.runId.slice(0, 16),
            session: r.sessionKey ?? "-",
            model: r.model ?? "-",
            started: fmtTs(r.startedAt),
            duration: fmtDuration(r.durationMs),
            tokens: r.totalTokens,
            tools: r.toolCallCount,
            stop: r.stopReason ?? "-",
            error: r.error ? r.error.slice(0, 40) : "-",
          }),
          globalOpts,
        );
      },
    );

  // -------------------------------------------------------------------------
  // telemetry run <runId>
  // -------------------------------------------------------------------------
  tel
    .command("run <runId>")
    .description("Show details for a single run")
    .action((runId: string, _opts: unknown, command: Command) => {
      const globalOpts = getGlobalOpts(command);
      const indexer = getIndexer();
      if (!indexer) {
        console.error("Telemetry indexer is not running.");
        return;
      }
      const detail = getRun(indexer.db, runId);
      if (!detail) {
        if (globalOpts.json) {
          console.log(JSON.stringify(null));
        } else {
          console.log(`Run not found: ${runId}`);
        }
        return;
      }
      if (globalOpts.json) {
        console.log(JSON.stringify(detail, null, 2));
        return;
      }
      console.log("\n=== Run Detail ===");
      outputDetail(
        {
          runId: detail.runId,
          session: detail.sessionKey ?? "-",
          model: `${detail.model ?? "-"} (${detail.provider ?? "-"})`,
          started: fmtTs(detail.startedAt),
          ended: fmtTs(detail.endedAt),
          duration: fmtDuration(detail.durationMs),
          tokens: `in=${detail.inputTokens} out=${detail.outputTokens} total=${detail.totalTokens}`,
          cache: `read=${detail.cacheReadTokens} write=${detail.cacheWriteTokens}`,
          tools: detail.toolCallCount,
          compactions: detail.compactionCount,
          stop: detail.stopReason ?? "-",
          ...(detail.error ? { error: detail.error } : {}),
        },
        globalOpts,
      );
      if (detail.toolCalls.length > 0) {
        console.log("\n--- Tool Calls ---");
        output(
          detail.toolCalls.slice(0, 30),
          (t) => ({
            tool: t.toolName,
            run: t.runId?.slice(0, 12) ?? "-",
            duration: fmtDuration(t.durationMs),
            error: t.isError ? (t.error?.slice(0, 40) ?? "yes") : "-",
            file: t.filePath ?? "-",
            cmd: t.execCommand?.slice(0, 40) ?? "-",
          }),
          globalOpts,
        );
      }
      if (detail.modelCalls.length > 0) {
        console.log("\n--- Model Calls ---");
        output(
          detail.modelCalls,
          (m) => ({
            "#": m.callIndex ?? "-",
            model: m.model ?? "-",
            in: m.inputTokens ?? 0,
            out: m.outputTokens ?? 0,
            total: m.totalTokens ?? 0,
            cost: m.costUsd != null ? `$${m.costUsd.toFixed(4)}` : "-",
            ms: m.durationMs ?? "-",
          }),
          globalOpts,
        );
      }
    });

  // -------------------------------------------------------------------------
  // telemetry tools
  // -------------------------------------------------------------------------
  tel
    .command("tools")
    .description("List tool calls")
    .option("--run <runId>", "Filter by run ID")
    .option("--name <toolName>", "Filter by tool name")
    .option("--session <key>", "Filter by session key")
    .option("--errors-only", "Show only errored tool calls")
    .option("--limit <n>", "Max results", "50")
    .action(
      (
        opts: {
          run?: string;
          name?: string;
          session?: string;
          errorsOnly?: boolean;
          limit?: string;
        },
        command: Command,
      ) => {
        const globalOpts = getGlobalOpts(command);
        const indexer = getIndexer();
        if (!indexer) {
          console.error("Telemetry indexer is not running.");
          return;
        }
        const rows = getToolCalls(indexer.db, {
          runId: opts.run,
          toolName: opts.name,
          sessionKey: opts.session,
          agentId: globalOpts.agent,
          errorsOnly: opts.errorsOnly,
          limit: parseInt(opts.limit ?? "50", 10),
        });
        output(
          rows,
          (t) => ({
            tool: t.toolName,
            run: t.runId?.slice(0, 12) ?? "-",
            duration: fmtDuration(t.durationMs),
            error: t.isError ? (t.error?.slice(0, 40) ?? "yes") : "-",
            file: t.filePath ?? "-",
            cmd: t.execCommand?.slice(0, 40) ?? "-",
          }),
          globalOpts,
        );
      },
    );

  // -------------------------------------------------------------------------
  // telemetry timeline <sessionKey>
  // -------------------------------------------------------------------------
  tel
    .command("timeline <sessionKey>")
    .description("Show event timeline for a session")
    .option("--limit <n>", "Max events", "100")
    .option("--kinds <kinds>", "Comma-separated event kinds to include")
    .action((sessionKey: string, opts: { limit?: string; kinds?: string }, command: Command) => {
      const globalOpts = getGlobalOpts(command);
      const indexer = getIndexer();
      if (!indexer) {
        console.error("Telemetry indexer is not running.");
        return;
      }
      const kinds = opts.kinds ? opts.kinds.split(",").map((k) => k.trim()) : undefined;
      const events = getSessionTimeline(indexer.db, sessionKey, {
        limit: parseInt(opts.limit ?? "100", 10),
        kinds,
      });
      output(
        events,
        (e) => ({
          ts: fmtTs(e.ts),
          kind: e.kind,
          run: e.runId?.slice(0, 12) ?? "-",
        }),
        globalOpts,
      );
    });

  // -------------------------------------------------------------------------
  // telemetry usage
  // -------------------------------------------------------------------------
  tel
    .command("usage")
    .description("Show aggregated token usage summary")
    .option("--since <date>", "Start date")
    .option("--until <date>", "End date")
    .option("--session <key>", "Filter by session key")
    .action((opts: { since?: string; until?: string; session?: string }, command: Command) => {
      const globalOpts = getGlobalOpts(command);
      const indexer = getIndexer();
      if (!indexer) {
        console.error("Telemetry indexer is not running.");
        return;
      }
      const summary = getUsageSummary(indexer.db, {
        since: parseDate(opts.since),
        until: parseDate(opts.until),
        sessionKey: opts.session,
        agentId: globalOpts.agent,
      });
      if (globalOpts.json) {
        console.log(JSON.stringify(summary, null, 2));
        return;
      }
      console.log("\n=== Usage Summary ===");
      outputDetail(
        {
          totalRuns: summary.totalRuns,
          inputTokens: summary.inputTokens,
          outputTokens: summary.outputTokens,
          cacheReadTokens: summary.cacheReadTokens,
          cacheWriteTokens: summary.cacheWriteTokens,
          totalTokens: summary.totalTokens,
          toolCallCount: summary.toolCallCount,
          estimatedCostUsd: fmtCost(summary.estimatedCostUsd),
        },
        globalOpts,
      );
    });

  // -------------------------------------------------------------------------
  // telemetry events
  // -------------------------------------------------------------------------
  tel
    .command("events")
    .description("List recent telemetry events")
    .option("--kind <kind>", "Filter by event kind")
    .option("--run <runId>", "Filter by run ID")
    .option("--limit <n>", "Max results", "50")
    .option("--since <date>", "Start date")
    .option("--until <date>", "End date")
    .option("--session <key>", "Filter by session key")
    .action(
      (
        opts: {
          kind?: string;
          run?: string;
          limit?: string;
          since?: string;
          until?: string;
          session?: string;
        },
        command: Command,
      ) => {
        const globalOpts = getGlobalOpts(command);
        const indexer = getIndexer();
        if (!indexer) {
          console.error("Telemetry indexer is not running.");
          return;
        }
        const events = listEvents(indexer.db, {
          kind: opts.kind,
          runId: opts.run,
          limit: parseInt(opts.limit ?? "50", 10),
          since: parseDate(opts.since),
          until: parseDate(opts.until),
          sessionKey: opts.session,
          agentId: globalOpts.agent,
        });
        output(
          events,
          (e) => ({
            ts: fmtTs(e.ts),
            kind: e.kind,
            session: e.sessionKey?.slice(0, 16) ?? "-",
            run: e.runId?.slice(0, 12) ?? "-",
          }),
          globalOpts,
        );
      },
    );

  // -------------------------------------------------------------------------
  // telemetry files
  // -------------------------------------------------------------------------
  tel
    .command("files")
    .description("List file operations from tool calls")
    .option("--run <runId>", "Filter by run ID")
    .option("--path <glob>", "Filter by file path (substring match)")
    .option("--session <key>", "Filter by session key")
    .option("--limit <n>", "Max results", "50")
    .action(
      (
        opts: { run?: string; path?: string; session?: string; limit?: string },
        command: Command,
      ) => {
        const globalOpts = getGlobalOpts(command);
        const indexer = getIndexer();
        if (!indexer) {
          console.error("Telemetry indexer is not running.");
          return;
        }
        const ops = getFileOperations(indexer.db, {
          runId: opts.run,
          filePath: opts.path,
          sessionKey: opts.session,
          agentId: globalOpts.agent,
          limit: parseInt(opts.limit ?? "50", 10),
        });
        output(
          ops,
          (f) => ({
            tool: f.toolName,
            path: f.filePath,
            run: f.runId?.slice(0, 12) ?? "-",
            error: f.isError ? "yes" : "-",
            ts: fmtTs(f.ts),
          }),
          globalOpts,
        );
      },
    );
}
