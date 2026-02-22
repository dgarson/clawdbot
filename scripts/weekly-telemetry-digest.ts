#!/usr/bin/env bun
/**
 * Weekly Telemetry Digest
 *
 * Generates a weekly cost + usage summary from OpenClaw telemetry JSONL.
 * Intended to be invoked by an agent cron or directly from the shell.
 *
 * Usage:
 *   bun scripts/weekly-telemetry-digest.ts [--days 7] [--json] [--slack-channel #channel]
 *
 * Cron config example (in openclaw.config or via agent cron):
 *   crons:
 *     - id: weekly-cost-digest
 *       schedule: "0 9 * * 1"   # Every Monday at 9am
 *       message: "Run weekly telemetry digest: bun /path/to/scripts/weekly-telemetry-digest.ts"
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TelemetryEvent {
  type: string;
  timestamp: string;
  agentId?: string;
  sessionId?: string;
  durationMs?: number;
  messageCount?: number;
  success?: boolean;
  model?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

interface AgentSummary {
  agentId: string;
  sessionCount: number;
  totalCostUsd: number;
  avgCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  avgDurationMs: number;
  errorCount: number;
  topModel: string;
}

interface WeeklyDigest {
  period: { start: string; end: string; days: number };
  totals: {
    sessions: number;
    costUsd: number;
    inputTokens: number;
    outputTokens: number;
    errors: number;
  };
  byAgent: AgentSummary[];
  topModels: Array<{ model: string; sessions: number; costUsd: number }>;
  generatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readEvents(filePath: string, cutoff: Date): Promise<TelemetryEvent[]> {
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(filePath, "r");
  } catch {
    return [];
  }
  const events: TelemetryEvent[] = [];
  const rl = createInterface({ input: handle.createReadStream(), crlfDelay: Infinity });
  for await (const line of rl) {
    const t = line.trim();
    if (!t) {
      continue;
    }
    try {
      const e = JSON.parse(t) as TelemetryEvent;
      if (e.timestamp && new Date(e.timestamp) >= cutoff) {
        events.push(e);
      }
    } catch {
      // skip
    }
  }
  await handle.close();
  return events;
}

function buildDigest(events: TelemetryEvent[], days: number): WeeklyDigest {
  const agentMap = new Map<
    string,
    {
      sessions: Set<string>;
      costUsd: number;
      inputTokens: number;
      outputTokens: number;
      durationMs: number[];
      errors: number;
      models: Map<string, number>;
    }
  >();

  const modelMap = new Map<string, { sessions: number; costUsd: number }>();
  let _globalErrors = 0;

  for (const e of events) {
    const agentId = e.agentId ?? "unknown";

    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, {
        sessions: new Set(),
        costUsd: 0,
        inputTokens: 0,
        outputTokens: 0,
        durationMs: [],
        errors: 0,
        models: new Map(),
      });
    }

    const a = agentMap.get(agentId)!;

    if (e.type === "session_start" && e.sessionId) {
      a.sessions.add(e.sessionId);
    }

    if (e.type === "session_end") {
      if (e.sessionId) {
        a.sessions.add(e.sessionId);
      }
      if (typeof e.durationMs === "number") {
        a.durationMs.push(e.durationMs);
      }
    }

    if (e.type === "agent_end" && e.success === false) {
      a.errors += 1;
      _globalErrors += 1;
    }

    if (e.type === "model_usage") {
      a.costUsd += e.costUsd ?? 0;
      a.inputTokens += e.inputTokens ?? 0;
      a.outputTokens += e.outputTokens ?? 0;
      if (e.model) {
        a.models.set(e.model, (a.models.get(e.model) ?? 0) + 1);
        const mEntry = modelMap.get(e.model) ?? { sessions: 0, costUsd: 0 };
        mEntry.sessions += 1;
        mEntry.costUsd += e.costUsd ?? 0;
        modelMap.set(e.model, mEntry);
      }
    }
  }

  const byAgent: AgentSummary[] = Array.from(agentMap.entries())
    .map(([agentId, data]) => {
      const sessionCount = data.sessions.size || data.durationMs.length;
      const avgDurationMs =
        data.durationMs.length > 0
          ? data.durationMs.reduce((s, v) => s + v, 0) / data.durationMs.length
          : 0;
      const topModel =
        [...data.models.entries()].toSorted((a, b) => b[1] - a[1])[0]?.[0] ?? "unknown";

      return {
        agentId,
        sessionCount,
        totalCostUsd: data.costUsd,
        avgCostUsd: sessionCount > 0 ? data.costUsd / sessionCount : 0,
        totalInputTokens: data.inputTokens,
        totalOutputTokens: data.outputTokens,
        avgDurationMs,
        errorCount: data.errors,
        topModel,
      };
    })
    .toSorted((a, b) => b.totalCostUsd - a.totalCostUsd);

  const topModels = [...modelMap.entries()]
    .map(([model, data]) => ({ model, ...data }))
    .toSorted((a, b) => b.costUsd - a.costUsd)
    .slice(0, 5);

  const totals = byAgent.reduce(
    (acc, a) => ({
      sessions: acc.sessions + a.sessionCount,
      costUsd: acc.costUsd + a.totalCostUsd,
      inputTokens: acc.inputTokens + a.totalInputTokens,
      outputTokens: acc.outputTokens + a.totalOutputTokens,
      errors: acc.errors + a.errorCount,
    }),
    { sessions: 0, costUsd: 0, inputTokens: 0, outputTokens: 0, errors: 0 },
  );

  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  return {
    period: { start: start.toISOString(), end: end.toISOString(), days },
    totals,
    byAgent,
    topModels,
    generatedAt: new Date().toISOString(),
  };
}

function formatDigestText(digest: WeeklyDigest): string {
  const lines: string[] = [];
  lines.push(`📊 *OpenClaw Weekly Telemetry Digest* (last ${digest.period.days} days)`);
  lines.push(`_Generated: ${new Date(digest.generatedAt).toLocaleString()}_`);
  lines.push("");
  lines.push("*Totals*");
  lines.push(`  Sessions: ${digest.totals.sessions}`);
  lines.push(`  Total cost: $${digest.totals.costUsd.toFixed(4)}`);
  lines.push(
    `  Tokens: ${(digest.totals.inputTokens + digest.totals.outputTokens).toLocaleString()} (in: ${digest.totals.inputTokens.toLocaleString()} / out: ${digest.totals.outputTokens.toLocaleString()})`,
  );
  lines.push(`  Errors: ${digest.totals.errors}`);

  if (digest.topModels.length > 0) {
    lines.push("");
    lines.push("*Top Models by Cost*");
    for (const m of digest.topModels) {
      lines.push(`  ${m.model}: $${m.costUsd.toFixed(4)} across ${m.sessions} events`);
    }
  }

  if (digest.byAgent.length > 0) {
    lines.push("");
    lines.push("*By Agent* (top 10 by cost)");
    for (const a of digest.byAgent.slice(0, 10)) {
      const errStr = a.errorCount > 0 ? ` ⚠️ ${a.errorCount} errors` : "";
      lines.push(
        `  ${a.agentId}: ${a.sessionCount} sessions | $${a.totalCostUsd.toFixed(4)} total ($${a.avgCostUsd.toFixed(4)}/session) | model: ${a.topModel}${errStr}`,
      );
    }
  }

  return lines.join("\n");
}

// ─── Args ─────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { days: number; json: boolean; file: string } {
  const result = {
    days: 7,
    json: false,
    file: path.join(os.homedir(), ".openclaw", "telemetry", "events.jsonl"),
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const n = argv[i + 1];
    if (a === "--days" && n) {
      result.days = Number.parseInt(n, 10) || 7;
      i++;
    } else if (a === "--json") {
      result.json = true;
    } else if (a === "--file" && n) {
      result.file = n;
      i++;
    }
  }
  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cutoff = new Date(Date.now() - args.days * 24 * 60 * 60 * 1000);
  const events = await readEvents(args.file, cutoff);

  if (events.length === 0) {
    console.log(`No telemetry events in the last ${args.days} days.\nFile: ${args.file}`);
    return;
  }

  const digest = buildDigest(events, args.days);

  if (args.json) {
    console.log(JSON.stringify(digest, null, 2));
    return;
  }

  console.log(formatDigestText(digest));
}

main().catch((err: unknown) => {
  console.error("weekly-telemetry-digest:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
