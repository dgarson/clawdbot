/**
 * CLI registrar for the OCX Platform extension.
 *
 * Commands:
 *   openclaw ops query   --run-id <id> [--agent <id>] [--include <domains>]
 *                        [--event-family <f>] [--event-limit <n>]
 *                        [--format <console|json|table>]
 *   openclaw ops explain --run-id <id> --question <q> [--agent <id>]
 *                        [--format <console|json|table>]
 *
 *   openclaw scores list --agent <id> [--session <id>] [--rubric <r>]
 *                        [--limit <n>] [--effective-only]
 *                        [--format <console|json|table>]
 *   openclaw scores set  --session <id> --agent <id> --score <f> --rubric <r>
 *                        [--note <text>] [--tags <t1,t2,...>]
 */

import type { OpenClawPluginCliContext } from "../../../src/plugins/types.js";
import { renderTable, type TableColumn } from "../../../src/terminal/table.js";
import { findRunSummary, queryLedgerEvents, findScorecard, explainRun } from "./ops.js";
import { appendScore, queryScores, type StoredScore } from "./score-store.js";

const EXPLAIN_QUESTIONS = ["why_routed", "why_blocked", "why_reaped", "why_low_score"] as const;

type OutputFormat = "console" | "json" | "table";

function resolveStateDir(workspaceDir: string): string {
  const env = process.env.OPENCLAW_STATE_DIR?.trim();
  if (env) return env;
  return workspaceDir;
}

function resolveFormat(raw: string | undefined): OutputFormat {
  if (raw === "json" || raw === "table") return raw;
  return "console";
}

export async function registerOcxPlatformCli(ctx: OpenClawPluginCliContext): Promise<void> {
  const { program } = ctx;

  // ── ops ──────────────────────────────────────────────────────────────────

  const ops = program
    .command("ops")
    .description("Inspect control-plane data for agent runs (event ledger, scorecards, health).");

  ops
    .command("query")
    .description("Aggregate run snapshot across all control-plane domains.")
    .requiredOption("--run-id <id>", "Run ID to query.")
    .option("--agent <id>", "Agent ID — narrows event search.")
    .option(
      "--include <domains>",
      "Comma-separated domains: summary,events,scorecard,health. Default: all.",
    )
    .option("--event-family <f>", "Filter events by family (model, budget, tool, etc.).")
    .option("--event-limit <n>", "Max events to return (default: 20).", "20")
    .option("--format <fmt>", "Output format: console (default), json, table.", "console")
    .action(
      async (opts: {
        runId: string;
        agent?: string;
        include?: string;
        eventFamily?: string;
        eventLimit: string;
        format: string;
      }) => {
        const stateDir = resolveStateDir(ctx.config.agents?.defaults?.workspace ?? process.cwd());
        const runId = opts.runId;
        const agentId = opts.agent;
        const fmt = resolveFormat(opts.format);
        // health is in-memory gateway state — not accessible from a CLI subprocess.
        // Default to disk-readable domains only; user can request health explicitly
        // but will get a note that it requires live gateway context.
        const domains = opts.include
          ? (opts.include.split(",").map((s) => s.trim()) as string[])
          : ["summary", "events", "scorecard"];
        const eventLimit = parseInt(opts.eventLimit, 10) || 20;

        const result: Record<string, unknown> = { ok: true, run_id: runId };

        await Promise.all(
          [
            domains.includes("summary") &&
              findRunSummary(stateDir, runId).then((s) => {
                result.summary = s ?? null;
              }),
            domains.includes("events") &&
              queryLedgerEvents(stateDir, {
                runId,
                agentId,
                family: opts.eventFamily,
                limit: eventLimit,
              }).then((evs) => {
                result.events = evs;
              }),
            domains.includes("scorecard") &&
              findScorecard(stateDir, runId).then((card) => {
                result.scorecard = card;
              }),
            domains.includes("health") &&
              Promise.resolve().then(() => {
                // Health is in-memory gateway state; from the CLI this is always empty.
                result.health = {
                  note: "health data requires live gateway context (use ocx_ops agent tool)",
                };
              }),
          ].filter(Boolean),
        );

        if (fmt === "json") {
          process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
          return;
        }

        if (fmt === "table") {
          // ── Summary section ──────────────────────────────────────────────
          if (result.summary) {
            const s = result.summary as Record<string, unknown>;
            process.stdout.write(`\n── Summary (run: ${runId}) ──\n`);
            const kvCols: TableColumn[] = [
              { key: "field", header: "Field" },
              { key: "value", header: "Value", flex: true },
            ];
            const kvRows = [
              { field: "model", value: String(s.model ?? "?") },
              { field: "provider", value: String(s.provider ?? "?") },
              { field: "duration", value: `${s.durationMs ?? "?"}ms` },
              { field: "tokens", value: String(s.totalTokens ?? "?") },
            ];
            process.stdout.write(renderTable({ columns: kvCols, rows: kvRows }));
          }

          // ── Events section ───────────────────────────────────────────────
          if (Array.isArray(result.events) && (result.events as unknown[]).length > 0) {
            process.stdout.write(
              `\n── Events (${(result.events as unknown[]).length} returned) ──\n`,
            );
            const evCols: TableColumn[] = [
              { key: "ts", header: "Timestamp", minWidth: 20 },
              { key: "type", header: "Type", minWidth: 12 },
              { key: "family", header: "Family", minWidth: 10 },
            ];
            const evRows = (result.events as Array<Record<string, unknown>>).map((ev) => ({
              ts: ev.ts != null ? new Date(ev.ts as number).toISOString() : "?",
              type: String(ev.type ?? "?"),
              family: String(ev.family ?? "?"),
            }));
            process.stdout.write(renderTable({ columns: evCols, rows: evRows }));
          } else if (domains.includes("events")) {
            process.stdout.write("\n── Events ──\n(none)\n");
          }

          // ── Scorecard section ────────────────────────────────────────────
          if (result.scorecard) {
            const c = result.scorecard as Record<string, unknown>;
            process.stdout.write(`\n── Scorecard ──\n`);
            const scCols: TableColumn[] = [
              { key: "field", header: "Field" },
              { key: "value", header: "Value", flex: true },
            ];
            const scRows = [
              { field: "overallScore", value: String(c.overallScore ?? "?") },
              { field: "judgeProfileId", value: String(c.judgeProfileId ?? "?") },
              { field: "disqualified", value: c.disqualified ? "yes" : "no" },
            ];
            process.stdout.write(renderTable({ columns: scCols, rows: scRows }));
          }
          return;
        }

        // console (default) output
        process.stdout.write(`Run: ${runId}\n\n`);
        if (result.summary) {
          const s = result.summary as Record<string, unknown>;
          process.stdout.write(
            `Summary: model=${s.model ?? "?"}, provider=${s.provider ?? "?"}, ` +
              `duration=${s.durationMs ?? "?"}ms, tokens=${s.totalTokens ?? "?"}\n`,
          );
        }
        if (result.scorecard) {
          const c = result.scorecard as Record<string, unknown>;
          process.stdout.write(
            `Score: ${c.overallScore ?? "?"}/100 (judge: ${c.judgeProfileId ?? "?"})` +
              (c.disqualified ? " [DISQUALIFIED]" : "") +
              "\n",
          );
        }
        if (Array.isArray(result.events)) {
          process.stdout.write(`Events: ${(result.events as unknown[]).length} returned\n`);
        }
      },
    );

  ops
    .command("explain")
    .description("Plain-language explanation of a control-plane event.")
    .requiredOption("--run-id <id>", "Run ID to explain.")
    .requiredOption("--question <q>", `One of: ${EXPLAIN_QUESTIONS.join(", ")}`)
    .option("--agent <id>", "Agent ID — required for why_reaped.")
    .option("--format <fmt>", "Output format: console (default), json, table.", "console")
    .action(async (opts: { runId: string; question: string; agent?: string; format: string }) => {
      const stateDir = resolveStateDir(ctx.config.agents?.defaults?.workspace ?? process.cwd());
      const fmt = resolveFormat(opts.format);
      const result = await explainRun(stateDir, opts.runId, opts.question, opts.agent);

      if (fmt === "json") {
        process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
        return;
      }

      const r = result as Record<string, unknown>;
      if (r.ok === false) {
        process.stderr.write(`Error: ${String(r.error)}\n`);
        process.exitCode = 1;
        return;
      }

      if (fmt === "table") {
        // Explanation as a text block
        process.stdout.write(`\n── Explanation ──\n`);
        process.stdout.write(`${String(r.explanation ?? "No explanation available.")}\n`);

        // Evidence as a single-column table
        if (Array.isArray(r.evidence) && (r.evidence as unknown[]).length > 0) {
          process.stdout.write(`\n── Evidence ──\n`);
          const evCols: TableColumn[] = [{ key: "item", header: "Evidence", flex: true }];
          const evRows = (r.evidence as string[]).map((e) => ({ item: e }));
          process.stdout.write(renderTable({ columns: evCols, rows: evRows }));
        }

        // Next actions as a single-column table
        if (Array.isArray(r.next_actions) && (r.next_actions as unknown[]).length > 0) {
          process.stdout.write(`\n── Next Actions ──\n`);
          const naCols: TableColumn[] = [{ key: "action", header: "Action", flex: true }];
          const naRows = (r.next_actions as string[]).map((a) => ({ action: a }));
          process.stdout.write(renderTable({ columns: naCols, rows: naRows }));
        }
        return;
      }

      // console (default) output
      process.stdout.write(`${String(r.explanation ?? "No explanation available.")}\n`);
      if (Array.isArray(r.evidence) && (r.evidence as unknown[]).length > 0) {
        process.stdout.write("\nEvidence:\n");
        for (const e of r.evidence as string[]) {
          process.stdout.write(`  - ${e}\n`);
        }
      }
      if (Array.isArray(r.next_actions) && (r.next_actions as unknown[]).length > 0) {
        process.stdout.write("\nNext actions:\n");
        for (const a of r.next_actions as string[]) {
          process.stdout.write(`  • ${a}\n`);
        }
      }
    });

  // ── scores ────────────────────────────────────────────────────────────────

  const scores = program.command("scores").description("View and manage session quality scores.");

  scores
    .command("list")
    .description("List historical session quality scores.")
    .option("--agent <id>", "Filter by agent ID.")
    .option("--session <id>", "Filter by session ID.")
    .option("--rubric <r>", "Filter by rubric dimension (e.g. task_completion).")
    .option("--limit <n>", "Max scores to return (default: 50).", "50")
    .option(
      "--effective-only",
      "Show only the latest score per (session, rubric) — overrides supersede originals.",
    )
    .option("--format <fmt>", "Output format: console (default), json, table.", "console")
    .action(
      async (opts: {
        agent?: string;
        session?: string;
        rubric?: string;
        limit: string;
        effectiveOnly?: boolean;
        format: string;
      }) => {
        const stateDir = resolveStateDir(ctx.config.agents?.defaults?.workspace ?? process.cwd());
        const limit = parseInt(opts.limit, 10) || 50;
        const fmt = resolveFormat(opts.format);
        const results = await queryScores(stateDir, {
          agentId: opts.agent,
          sessionId: opts.session,
          rubric: opts.rubric,
          limit,
          effectiveOnly: opts.effectiveOnly === true,
        });

        if (fmt === "json") {
          process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
          return;
        }

        if (results.length === 0) {
          process.stdout.write("No session scores found.\n");
          return;
        }

        if (fmt === "table") {
          const cols: TableColumn[] = [
            { key: "ts", header: "Timestamp", minWidth: 20 },
            { key: "agent", header: "Agent", minWidth: 10, flex: true },
            { key: "session", header: "Session", minWidth: 10, flex: true },
            { key: "rubric", header: "Rubric", minWidth: 12 },
            { key: "score", header: "Score", align: "right", minWidth: 7 },
            { key: "override", header: "Override", minWidth: 8 },
            { key: "tags", header: "Tags", flex: true },
          ];
          const rows = results.map((s: StoredScore) => ({
            ts: new Date(s.ts).toISOString(),
            agent: s.agentId ?? "",
            session: s.sessionId ?? "",
            rubric: s.rubric,
            score: s.score.toFixed(3),
            override: s.isOverride ? "yes" : "no",
            tags: s.tags && s.tags.length > 0 ? s.tags.join(", ") : "",
          }));
          process.stdout.write(renderTable({ columns: cols, rows }));
          return;
        }

        // console (default) output
        for (const s of results) {
          const dt = new Date(s.ts).toISOString();
          const override = s.isOverride ? " [override]" : "";
          const tags = s.tags && s.tags.length > 0 ? ` tags=[${s.tags.join(",")}]` : "";
          const note =
            typeof s.data?.note === "string" && s.data.note ? ` note="${s.data.note}"` : "";
          process.stdout.write(
            `${dt}${override}  agent=${s.agentId ?? "?"}  session=${s.sessionId ?? "?"}  ` +
              `rubric=${s.rubric}  score=${s.score.toFixed(3)}${tags}${note}\n`,
          );
        }
      },
    );

  scores
    .command("set")
    .description("Manually apply or override a session quality score.")
    .requiredOption("--session <id>", "Session ID to score.")
    .requiredOption("--agent <id>", "Agent ID that owns the session.")
    .requiredOption("--score <f>", "Normalized score 0.0–1.0.")
    .requiredOption("--rubric <r>", "Rubric dimension (e.g. task_completion).")
    .option("--note <text>", "Short rationale (≤280 chars).")
    .option("--tags <list>", "Comma-separated tags (e.g. correct,efficient).")
    .action(
      async (opts: {
        session: string;
        agent: string;
        score: string;
        rubric: string;
        note?: string;
        tags?: string;
      }) => {
        const stateDir = resolveStateDir(ctx.config.agents?.defaults?.workspace ?? process.cwd());
        const scoreVal = parseFloat(opts.score);
        if (isNaN(scoreVal) || scoreVal < 0 || scoreVal > 1) {
          process.stderr.write("Error: --score must be a number between 0.0 and 1.0\n");
          process.exitCode = 1;
          return;
        }

        const tags =
          opts.tags
            ?.split(",")
            .map((t) => t.trim())
            .filter(Boolean) ?? [];

        const record: StoredScore = {
          ts: Date.now(),
          seq: 0,
          type: "session.score",
          sessionId: opts.session,
          agentId: opts.agent,
          score: Math.max(0, Math.min(1, scoreVal)),
          rubric: opts.rubric.trim(),
          tags: tags.length > 0 ? tags : undefined,
          evaluatorId: "cli",
          data: opts.note ? { note: opts.note } : undefined,
          isOverride: true,
          overridesSessionId: opts.session,
        };

        await appendScore(stateDir, record);
        process.stdout.write(
          `Score recorded: session=${opts.session} agent=${opts.agent} ` +
            `rubric=${opts.rubric} score=${scoreVal.toFixed(3)}\n`,
        );
      },
    );
}
