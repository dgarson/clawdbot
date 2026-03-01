/**
 * Telemetry CLI commands registered via api.registerCli().
 *
 * Commands:
 *   telemetry runs [--session <key>] [--limit N] [--since <date>]
 *   telemetry run <runId>
 *   telemetry tools [--run <runId>] [--name <toolName>] [--limit N]
 *   telemetry timeline <sessionKey> [--limit N] [--kinds <k1,k2>]
 *   telemetry usage [--since <date>] [--until <date>] [--session <key>]
 *   telemetry events [--kind <kind>] [--limit N] [--since <date>]
 *   telemetry files [--run <runId>] [--path <glob>] [--limit N]
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { Indexer } from "./indexer.js";
import {
  listRuns,
  getRun,
  getToolCalls,
  getSessionTimeline,
  getUsageSummary,
  listEvents,
  getFileOperations,
} from "./queries.js";

/**
 * Parse an ISO date string or epoch ms string into a Unix timestamp in ms.
 * Returns undefined if the input is undefined or empty.
 */
function parseDate(input: string | undefined): number | undefined {
  if (!input) return undefined;
  // Try numeric first (epoch ms)
  const asNum = Number(input);
  if (!Number.isNaN(asNum)) return asNum;
  // Try as ISO date
  const d = new Date(input);
  if (!Number.isNaN(d.getTime())) return d.getTime();
  return undefined;
}

/**
 * Format a timestamp (ms) as a human-readable string.
 */
function fmtTs(ts: number | null | undefined): string {
  if (ts == null) return "-";
  return new Date(ts).toISOString().replace("T", " ").slice(0, 19);
}

/**
 * Format a duration in ms as "1234ms" or "12.3s".
 */
function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Register all `openclaw telemetry *` CLI sub-commands.
 */
export function registerTelemetryCli(api: OpenClawPluginApi, getIndexer: () => Indexer | null): void {
  api.registerCli(
    ({ program }) => {
      const tel = program
        .command("telemetry")
        .description("Telemetry query commands — inspect runs, tools, events, and usage");

      // -----------------------------------------------------------------------
      // telemetry runs
      // -----------------------------------------------------------------------
      tel
        .command("runs")
        .description("List agent runs")
        .option("--session <key>", "Filter by session key")
        .option("--limit <n>", "Max results", "20")
        .option("--since <date>", "Only runs started after this date (ISO or epoch ms)")
        .action((opts: { session?: string; limit?: string; since?: string }) => {
          const indexer = getIndexer();
          if (!indexer) {
            console.error("Telemetry indexer is not running.");
            return;
          }
          const rows = listRuns(indexer.db, {
            sessionKey: opts.session,
            limit: parseInt(opts.limit ?? "20", 10),
            since: parseDate(opts.since),
          });
          if (rows.length === 0) {
            console.log("No runs found.");
            return;
          }
          console.table(
            rows.map((r) => ({
              runId: r.runId.slice(0, 16),
              session: r.sessionKey ?? "-",
              model: r.model ?? "-",
              started: fmtTs(r.startedAt),
              duration: fmtDuration(r.durationMs),
              tokens: r.totalTokens,
              tools: r.toolCallCount,
              stop: r.stopReason ?? "-",
              error: r.error ? r.error.slice(0, 40) : "-",
            })),
          );
        });

      // -----------------------------------------------------------------------
      // telemetry run <runId>
      // -----------------------------------------------------------------------
      tel
        .command("run <runId>")
        .description("Show details for a single run")
        .action((runId: string) => {
          const indexer = getIndexer();
          if (!indexer) {
            console.error("Telemetry indexer is not running.");
            return;
          }
          const detail = getRun(indexer.db, runId);
          if (!detail) {
            console.log(`Run not found: ${runId}`);
            return;
          }
          console.log("\n=== Run Detail ===");
          console.log(`  runId      : ${detail.runId}`);
          console.log(`  session    : ${detail.sessionKey ?? "-"}`);
          console.log(`  model      : ${detail.model ?? "-"} (${detail.provider ?? "-"})`);
          console.log(`  started    : ${fmtTs(detail.startedAt)}`);
          console.log(`  ended      : ${fmtTs(detail.endedAt)}`);
          console.log(`  duration   : ${fmtDuration(detail.durationMs)}`);
          console.log(`  tokens     : in=${detail.inputTokens} out=${detail.outputTokens} total=${detail.totalTokens}`);
          console.log(`  cache      : read=${detail.cacheReadTokens} write=${detail.cacheWriteTokens}`);
          console.log(`  tools      : ${detail.toolCallCount}`);
          console.log(`  compactions: ${detail.compactionCount}`);
          console.log(`  stop       : ${detail.stopReason ?? "-"}`);
          if (detail.error) console.log(`  error      : ${detail.error}`);

          if (detail.toolCalls.length > 0) {
            console.log("\n--- Tool Calls ---");
            console.table(
              detail.toolCalls.slice(0, 30).map((t) => ({
                tool: t.toolName,
                duration: fmtDuration(t.durationMs),
                error: t.isError ? (t.error?.slice(0, 40) ?? "yes") : "-",
                file: t.filePath ?? "-",
              })),
            );
          }

          if (detail.modelCalls.length > 0) {
            console.log("\n--- Model Calls ---");
            console.table(
              detail.modelCalls.map((m) => ({
                "#": m.callIndex ?? "-",
                model: m.model ?? "-",
                in: m.inputTokens ?? 0,
                out: m.outputTokens ?? 0,
                total: m.totalTokens ?? 0,
                cost: m.costUsd != null ? `$${m.costUsd.toFixed(4)}` : "-",
                ms: m.durationMs ?? "-",
              })),
            );
          }
        });

      // -----------------------------------------------------------------------
      // telemetry tools
      // -----------------------------------------------------------------------
      tel
        .command("tools")
        .description("List tool calls")
        .option("--run <runId>", "Filter by run ID")
        .option("--name <toolName>", "Filter by tool name")
        .option("--limit <n>", "Max results", "50")
        .action((opts: { run?: string; name?: string; limit?: string }) => {
          const indexer = getIndexer();
          if (!indexer) {
            console.error("Telemetry indexer is not running.");
            return;
          }
          const rows = getToolCalls(indexer.db, {
            runId: opts.run,
            toolName: opts.name,
            limit: parseInt(opts.limit ?? "50", 10),
          });
          if (rows.length === 0) {
            console.log("No tool calls found.");
            return;
          }
          console.table(
            rows.map((t) => ({
              tool: t.toolName,
              run: t.runId?.slice(0, 12) ?? "-",
              duration: fmtDuration(t.durationMs),
              error: t.isError ? (t.error?.slice(0, 40) ?? "yes") : "-",
              file: t.filePath ?? "-",
              cmd: t.execCommand?.slice(0, 40) ?? "-",
            })),
          );
        });

      // -----------------------------------------------------------------------
      // telemetry timeline <sessionKey>
      // -----------------------------------------------------------------------
      tel
        .command("timeline <sessionKey>")
        .description("Show event timeline for a session")
        .option("--limit <n>", "Max events", "100")
        .option("--kinds <kinds>", "Comma-separated event kinds to include")
        .action((sessionKey: string, opts: { limit?: string; kinds?: string }) => {
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
          if (events.length === 0) {
            console.log("No events found for session:", sessionKey);
            return;
          }
          console.table(
            events.map((e) => ({
              ts: fmtTs(e.ts),
              kind: e.kind,
              run: e.runId?.slice(0, 12) ?? "-",
            })),
          );
        });

      // -----------------------------------------------------------------------
      // telemetry usage
      // -----------------------------------------------------------------------
      tel
        .command("usage")
        .description("Show aggregated token usage summary")
        .option("--since <date>", "Start date (ISO or epoch ms)")
        .option("--until <date>", "End date (ISO or epoch ms)")
        .option("--session <key>", "Filter by session key")
        .action((opts: { since?: string; until?: string; session?: string }) => {
          const indexer = getIndexer();
          if (!indexer) {
            console.error("Telemetry indexer is not running.");
            return;
          }
          const summary = getUsageSummary(indexer.db, {
            since: parseDate(opts.since),
            until: parseDate(opts.until),
            sessionKey: opts.session,
          });
          console.log("\n=== Usage Summary ===");
          console.log(`  Total runs    : ${summary.totalRuns}`);
          console.log(`  Input tokens  : ${summary.inputTokens}`);
          console.log(`  Output tokens : ${summary.outputTokens}`);
          console.log(`  Cache read    : ${summary.cacheReadTokens}`);
          console.log(`  Cache write   : ${summary.cacheWriteTokens}`);
          console.log(`  Total tokens  : ${summary.totalTokens}`);
          console.log(`  Tool calls    : ${summary.toolCallCount}`);
          console.log(`  Est. cost USD : $${(summary.estimatedCostUsd ?? 0).toFixed(4)}`);
        });

      // -----------------------------------------------------------------------
      // telemetry events
      // -----------------------------------------------------------------------
      tel
        .command("events")
        .description("List recent telemetry events")
        .option("--kind <kind>", "Filter by event kind")
        .option("--limit <n>", "Max results", "50")
        .option("--since <date>", "Start date (ISO or epoch ms)")
        .option("--session <key>", "Filter by session key")
        .action((opts: { kind?: string; limit?: string; since?: string; session?: string }) => {
          const indexer = getIndexer();
          if (!indexer) {
            console.error("Telemetry indexer is not running.");
            return;
          }
          const events = listEvents(indexer.db, {
            kind: opts.kind,
            limit: parseInt(opts.limit ?? "50", 10),
            since: parseDate(opts.since),
            sessionKey: opts.session,
          });
          if (events.length === 0) {
            console.log("No events found.");
            return;
          }
          console.table(
            events.map((e) => ({
              ts: fmtTs(e.ts),
              kind: e.kind,
              session: e.sessionKey?.slice(0, 16) ?? "-",
              run: e.runId?.slice(0, 12) ?? "-",
            })),
          );
        });

      // -----------------------------------------------------------------------
      // telemetry files
      // -----------------------------------------------------------------------
      tel
        .command("files")
        .description("List file operations from tool calls")
        .option("--run <runId>", "Filter by run ID")
        .option("--path <glob>", "Filter by file path (substring match)")
        .option("--limit <n>", "Max results", "50")
        .action((opts: { run?: string; path?: string; limit?: string }) => {
          const indexer = getIndexer();
          if (!indexer) {
            console.error("Telemetry indexer is not running.");
            return;
          }
          const ops = getFileOperations(indexer.db, {
            runId: opts.run,
            filePath: opts.path,
            limit: parseInt(opts.limit ?? "50", 10),
          });
          if (ops.length === 0) {
            console.log("No file operations found.");
            return;
          }
          console.table(
            ops.map((f) => ({
              tool: f.toolName,
              path: f.filePath,
              run: f.runId?.slice(0, 12) ?? "-",
              error: f.isError ? "yes" : "-",
              ts: fmtTs(f.ts),
            })),
          );
        });
    },
    { commands: ["telemetry"] },
  );
}
