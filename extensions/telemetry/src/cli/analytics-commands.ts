/**
 * Analytics CLI sub-commands for the telemetry `tel` command group.
 *
 * Registers nine commands: sessions, session, costs, subagents, tree,
 * messages, errors, top, and model-calls. All commands respect the
 * parent `tel` --json and --agent global options via getGlobalOpts().
 */

import type { Command } from "commander";
import type { Indexer } from "../indexer.js";
import type { CostGroupBy, LeaderboardDimension } from "../queries.js";
import {
  listSessions,
  getSessionDetail,
  getCostBreakdown,
  listSubagents,
  getSubagentTree,
  listMessages,
  listErrors,
  getLeaderboard,
  getModelCalls,
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

export function registerAnalyticsCommands(tel: Command, getIndexer: () => Indexer | null): void {
  // ---------------------------------------------------------------------------
  // C1: sessions
  // ---------------------------------------------------------------------------
  tel
    .command("sessions")
    .description("List sessions with aggregate stats")
    .option("--limit <n>", "Max results", "20")
    .option("--since <date>", "Only sessions active after this date")
    .option("--until <date>", "Only sessions active before this date")
    .action((opts: { limit?: string; since?: string; until?: string }, command: Command) => {
      const { json, agent } = getGlobalOpts(command);
      const indexer = getIndexer();
      if (!indexer) {
        console.error("Telemetry indexer is not running.");
        return;
      }
      const rows = listSessions(indexer.db, {
        agentId: agent,
        since: parseDate(opts.since),
        until: parseDate(opts.until),
        limit: parseInt(opts.limit ?? "20", 10),
      });
      output(
        rows,
        (s) => ({
          session: s.sessionKey.slice(0, 20),
          agent: s.agentId ?? "-",
          runs: s.runCount,
          first: fmtTs(s.firstRunAt),
          last: fmtTs(s.lastActivityAt),
          tokens: s.totalTokens,
          tools: s.toolCallCount,
          errors: s.errorCount,
          cost: fmtCost(s.totalCostUsd),
        }),
        { json },
      );
    });

  // ---------------------------------------------------------------------------
  // C2: session <key>
  // ---------------------------------------------------------------------------
  tel
    .command("session <key>")
    .description("Full session dashboard")
    .action((key: string, _opts: unknown, command: Command) => {
      const { json, agent: _agent } = getGlobalOpts(command);
      const indexer = getIndexer();
      if (!indexer) {
        console.error("Telemetry indexer is not running.");
        return;
      }
      const detail = getSessionDetail(indexer.db, key);
      if (!detail) {
        console.log("Session not found:", key);
        return;
      }

      if (json) {
        console.log(JSON.stringify(detail, null, 2));
        return;
      }

      console.log(`\n=== Session: ${key} ===`);
      outputDetail(
        {
          agentId: detail.agentId ?? "-",
          runCount: detail.runCount,
          firstRunAt: fmtTs(detail.firstRunAt),
          lastActivityAt: fmtTs(detail.lastActivityAt),
          totalTokens: detail.totalTokens,
          toolCallCount: detail.toolCallCount,
          errorCount: detail.errorCount,
          totalCostUsd: fmtCost(detail.totalCostUsd),
        },
        { json: false },
      );

      if (detail.runs.length > 0) {
        console.log("\n--- Runs ---");
        output(
          detail.runs,
          (r) => ({
            runId: r.runId.slice(0, 16),
            model: r.model ?? "-",
            started: fmtTs(r.startedAt),
            duration: fmtDuration(r.durationMs),
            tokens: r.totalTokens,
            error: r.error ? r.error.slice(0, 40) : "-",
          }),
          { json: false },
        );
      }

      if (detail.subagents.length > 0) {
        console.log("\n--- Subagents ---");
        output(
          detail.subagents,
          (s) => ({
            agent: s.agentId ?? "-",
            task: (s.task ?? "-").slice(0, 40),
            model: s.model ?? "-",
            duration: fmtDuration(s.durationMs),
            outcome: s.outcome ?? "-",
          }),
          { json: false },
        );
      }

      if (detail.messages.length > 0) {
        console.log("\n--- Messages ---");
        output(
          detail.messages,
          (m) => ({
            ts: fmtTs(m.ts),
            dir: m.direction,
            channel: m.channel ?? "-",
            from: m.fromId ?? "-",
            preview: (m.contentPreview ?? "-").slice(0, 50),
          }),
          { json: false },
        );
      }

      if (detail.modelCostBreakdown.length > 0) {
        console.log("\n--- Cost by Model ---");
        output(
          detail.modelCostBreakdown,
          (c) => ({
            model: c.groupKey,
            calls: c.callCount,
            tokens: c.totalTokens,
            cost: fmtCost(c.totalCostUsd),
          }),
          { json: false },
        );
      }
    });

  // ---------------------------------------------------------------------------
  // C3: costs
  // ---------------------------------------------------------------------------
  tel
    .command("costs")
    .description("Cost breakdown by dimension")
    .option("--group-by <dim>", "Group by: model, provider, agent, session, day", "model")
    .option("--since <date>", "Start date")
    .option("--until <date>", "End date")
    .option("--limit <n>", "Max results", "20")
    .action(
      (
        opts: { groupBy?: string; since?: string; until?: string; limit?: string },
        command: Command,
      ) => {
        const { json, agent } = getGlobalOpts(command);
        const indexer = getIndexer();
        if (!indexer) {
          console.error("Telemetry indexer is not running.");
          return;
        }
        const rows = getCostBreakdown(indexer.db, {
          groupBy: (opts.groupBy ?? "model") as CostGroupBy,
          agentId: agent,
          since: parseDate(opts.since),
          until: parseDate(opts.until),
          limit: parseInt(opts.limit ?? "20", 10),
        });

        output(
          rows,
          (c) => ({
            group: c.groupKey,
            calls: c.callCount,
            inputTokens: c.inputTokens,
            outputTokens: c.outputTokens,
            totalTokens: c.totalTokens,
            cost: fmtCost(c.totalCostUsd),
          }),
          { json },
        );

        if (!json) {
          const totalCost = rows.reduce((sum, r) => sum + r.totalCostUsd, 0);
          const totalTokensAll = rows.reduce((sum, r) => sum + r.totalTokens, 0);
          console.log(`\n  Total: ${totalTokensAll} tokens, ${fmtCost(totalCost)}`);
        }
      },
    );

  // ---------------------------------------------------------------------------
  // C4: subagents
  // ---------------------------------------------------------------------------
  tel
    .command("subagents")
    .description("List subagent spawns")
    .option("--session <key>", "Filter by parent session key")
    .option("--run <runId>", "Filter by run ID")
    .option("--limit <n>", "Max results", "20")
    .action((opts: { session?: string; run?: string; limit?: string }, command: Command) => {
      const { json, agent } = getGlobalOpts(command);
      const indexer = getIndexer();
      if (!indexer) {
        console.error("Telemetry indexer is not running.");
        return;
      }
      const rows = listSubagents(indexer.db, {
        parentSessionKey: opts.session,
        runId: opts.run,
        agentId: agent,
        limit: parseInt(opts.limit ?? "20", 10),
      });
      output(
        rows,
        (s) => ({
          agent: s.agentId ?? "-",
          parent: (s.parentSessionKey ?? "-").slice(0, 16),
          child: (s.childSessionKey ?? "-").slice(0, 16),
          task: (s.task ?? "-").slice(0, 40),
          model: s.model ?? "-",
          duration: fmtDuration(s.durationMs),
          outcome: s.outcome ?? "-",
        }),
        { json },
      );
    });

  // ---------------------------------------------------------------------------
  // C5: tree <sessionKey>
  // ---------------------------------------------------------------------------
  tel
    .command("tree <sessionKey>")
    .description("Recursive subagent hierarchy tree")
    .action((sessionKey: string, _opts: unknown, command: Command) => {
      const { json } = getGlobalOpts(command);
      const indexer = getIndexer();
      if (!indexer) {
        console.error("Telemetry indexer is not running.");
        return;
      }
      const nodes = getSubagentTree(indexer.db, sessionKey);
      if (nodes.length === 0) {
        console.log("No subagents found for session:", sessionKey);
        return;
      }

      if (json) {
        console.log(JSON.stringify(nodes, null, 2));
        return;
      }

      for (const node of nodes) {
        const indent = "  ".repeat(node.depth);
        const prefix = node.depth > 0 ? `${indent}└─ ` : "";
        const label = node.label ?? node.agentId ?? node.childSessionKey ?? "?";
        const dur = fmtDuration(node.durationMs);
        const out = node.outcome ?? "?";
        console.log(`${prefix}${label} (${dur}, ${out})`);
      }
    });

  // ---------------------------------------------------------------------------
  // C6: messages
  // ---------------------------------------------------------------------------
  tel
    .command("messages")
    .description("List messages")
    .option("--session <key>", "Filter by session key")
    .option("--direction <dir>", "Filter: inbound or outbound")
    .option("--channel <ch>", "Filter by channel")
    .option("--limit <n>", "Max results", "50")
    .action(
      (
        opts: { session?: string; direction?: string; channel?: string; limit?: string },
        command: Command,
      ) => {
        const { json, agent } = getGlobalOpts(command);
        const indexer = getIndexer();
        if (!indexer) {
          console.error("Telemetry indexer is not running.");
          return;
        }
        const rows = listMessages(indexer.db, {
          sessionKey: opts.session,
          direction: opts.direction as "inbound" | "outbound" | undefined,
          channel: opts.channel,
          agentId: agent,
          limit: parseInt(opts.limit ?? "50", 10),
        });
        output(
          rows,
          (m) => ({
            ts: fmtTs(m.ts),
            dir: m.direction,
            channel: m.channel ?? "-",
            from: m.fromId ?? "-",
            preview: (m.contentPreview ?? "-").slice(0, 50),
          }),
          { json },
        );
      },
    );

  // ---------------------------------------------------------------------------
  // C7: errors
  // ---------------------------------------------------------------------------
  tel
    .command("errors")
    .description("Cross-table error listing")
    .option("--since <date>", "Start date")
    .option("--session <key>", "Filter by session key")
    .option("--run <runId>", "Filter by run ID")
    .option("--limit <n>", "Max results", "20")
    .action(
      (
        opts: { since?: string; session?: string; run?: string; limit?: string },
        command: Command,
      ) => {
        const { json, agent } = getGlobalOpts(command);
        const indexer = getIndexer();
        if (!indexer) {
          console.error("Telemetry indexer is not running.");
          return;
        }
        const rows = listErrors(indexer.db, {
          since: parseDate(opts.since),
          sessionKey: opts.session,
          runId: opts.run,
          agentId: agent,
          limit: parseInt(opts.limit ?? "20", 10),
        });
        output(
          rows,
          (e) => ({
            ts: fmtTs(e.ts),
            source: e.source,
            context: (e.contextId ?? "-").slice(0, 16),
            session: (e.sessionKey ?? "-").slice(0, 16),
            error: e.errorText.slice(0, 60),
          }),
          { json },
        );
      },
    );

  // ---------------------------------------------------------------------------
  // C8: top <dimension>
  // ---------------------------------------------------------------------------
  tel
    .command("top <dimension>")
    .description("Leaderboards: runs, tools, models, or sessions")
    .option("--since <date>", "Start date")
    .option("--limit <n>", "Max results", "10")
    .action((dimension: string, opts: { since?: string; limit?: string }, command: Command) => {
      const { json, agent } = getGlobalOpts(command);
      const validDimensions = ["runs", "tools", "models", "sessions"] as const;
      if (!validDimensions.includes(dimension as LeaderboardDimension)) {
        console.error("Unknown dimension:", dimension, "(expected: runs, tools, models, sessions)");
        return;
      }
      const indexer = getIndexer();
      if (!indexer) {
        console.error("Telemetry indexer is not running.");
        return;
      }
      const rows = getLeaderboard(indexer.db, dimension as LeaderboardDimension, {
        since: parseDate(opts.since),
        agentId: agent,
        limit: parseInt(opts.limit ?? "10", 10),
      });
      output(
        rows,
        (e) => ({
          key: e.key.slice(0, 30),
          count: e.count,
          tokens: e.totalTokens,
          cost: fmtCost(e.totalCostUsd),
          duration: fmtDuration(e.totalDurationMs),
        }),
        { json },
      );
    });

  // ---------------------------------------------------------------------------
  // C9: model-calls
  // ---------------------------------------------------------------------------
  tel
    .command("model-calls")
    .description("Individual LLM API calls")
    .option("--run <runId>", "Filter by run ID")
    .option("--session <key>", "Filter by session key")
    .option("--model <name>", "Filter by model name")
    .option("--limit <n>", "Max results", "50")
    .action(
      (
        opts: { run?: string; session?: string; model?: string; limit?: string },
        command: Command,
      ) => {
        const { json, agent } = getGlobalOpts(command);
        const indexer = getIndexer();
        if (!indexer) {
          console.error("Telemetry indexer is not running.");
          return;
        }
        const rows = getModelCalls(indexer.db, {
          runId: opts.run,
          sessionKey: opts.session,
          model: opts.model,
          agentId: agent,
          limit: parseInt(opts.limit ?? "50", 10),
        });
        output(
          rows,
          (m) => ({
            "#": m.callIndex ?? "-",
            model: m.model ?? "-",
            provider: m.provider ?? "-",
            in: m.inputTokens ?? 0,
            out: m.outputTokens ?? 0,
            total: m.totalTokens ?? 0,
            cost: fmtCost(m.costUsd),
            ms: m.durationMs ?? "-",
          }),
          { json },
        );
      },
    );
}
