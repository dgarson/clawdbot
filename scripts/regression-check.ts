#!/usr/bin/env bun
/**
 * OpenClaw Metric Regression Harness
 *
 * Reads telemetry JSONL and compares against a saved baseline.
 *
 * Usage:
 *   bun scripts/regression-check.ts --baseline v2026.2.1 --current HEAD
 *   bun scripts/regression-check.ts --save-baseline v2026.2.1
 *   bun scripts/regression-check.ts --list
 *
 * See also: openclaw telemetry regression (the CLI wrapper)
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
  errors?: string[];
  model?: string;
  provider?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
}

interface MetricSnapshot {
  tag: string;
  capturedAt: string;
  totalSessions: number;
  avgSessionDurationMs: number;
  p50SessionDurationMs: number;
  p95SessionDurationMs: number;
  avgTokensPerSession: number;
  avgCostPerSessionUsd: number;
  modelErrorRate: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const idx = Math.floor(sorted.length * p);
  return sorted[Math.min(idx, sorted.length - 1)] ?? 0;
}

function avg(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((s, v) => s + v, 0) / values.length;
}

async function readEvents(filePath: string): Promise<TelemetryEvent[]> {
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(filePath, "r");
  } catch {
    console.warn(`[regression-check] Telemetry file not found: ${filePath}`);
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
      events.push(JSON.parse(t) as TelemetryEvent);
    } catch {
      // skip malformed
    }
  }
  await handle.close();
  return events;
}

async function buildSnapshot(events: TelemetryEvent[], tag: string): Promise<MetricSnapshot> {
  const durations: number[] = [];
  const tokens: number[] = [];
  const costs: number[] = [];
  let agentErrors = 0;
  let agentTotal = 0;

  for (const e of events) {
    if (e.type === "session_end" && typeof e.durationMs === "number") {
      durations.push(e.durationMs);
    }
    if (e.type === "model_usage") {
      const toks = (e.inputTokens ?? 0) + (e.outputTokens ?? 0);
      if (toks > 0) {
        tokens.push(toks);
      }
      if (typeof e.costUsd === "number") {
        costs.push(e.costUsd);
      }
    }
    if (e.type === "agent_end") {
      agentTotal += 1;
      if (e.success === false) {
        agentErrors += 1;
      }
    }
  }

  const sortedDur = [...durations].toSorted((a, b) => a - b);

  return {
    tag,
    capturedAt: new Date().toISOString(),
    totalSessions: durations.length,
    avgSessionDurationMs: avg(durations),
    p50SessionDurationMs: percentile(sortedDur, 0.5),
    p95SessionDurationMs: percentile(sortedDur, 0.95),
    avgTokensPerSession: avg(tokens),
    avgCostPerSessionUsd: avg(costs),
    modelErrorRate: agentTotal > 0 ? agentErrors / agentTotal : 0,
  };
}

function baselinesDir(): string {
  return path.join(os.homedir(), ".openclaw", "telemetry", "baselines");
}

function telemetryFile(): string {
  return (
    process.env["OPENCLAW_TELEMETRY_FILE"] ??
    path.join(os.homedir(), ".openclaw", "telemetry", "events.jsonl")
  );
}

// ─── Arg parsing ──────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): {
  baseline?: string;
  current: string;
  threshold: number;
  saveBaseline?: string;
  list: boolean;
  json: boolean;
  file: string;
} {
  const result = {
    baseline: undefined as string | undefined,
    current: "HEAD",
    threshold: 0.2,
    saveBaseline: undefined as string | undefined,
    list: false,
    json: false,
    file: telemetryFile(),
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--baseline" && next) {
      result.baseline = next;
      i++;
    } else if (arg === "--current" && next) {
      result.current = next;
      i++;
    } else if (arg === "--threshold" && next) {
      result.threshold = Number.parseFloat(next) / 100;
      i++;
    } else if (arg === "--save-baseline" && next) {
      result.saveBaseline = next;
      i++;
    } else if (arg === "--file" && next) {
      result.file = next;
      i++;
    } else if (arg === "--list") {
      result.list = true;
    } else if (arg === "--json") {
      result.json = true;
    }
  }

  return result;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const dir = baselinesDir();

  // --list
  if (args.list) {
    let files: string[] = [];
    try {
      files = (await fs.readdir(dir)).filter((f) => f.endsWith(".json"));
    } catch {
      console.log("No baselines saved.");
      return;
    }
    console.log(`Baselines in ${dir}:`);
    for (const f of files) {
      const snap = JSON.parse(await fs.readFile(path.join(dir, f), "utf-8")) as MetricSnapshot;
      console.log(
        `  ${snap.tag.padEnd(30)}  captured: ${snap.capturedAt}  sessions: ${snap.totalSessions}`,
      );
    }
    return;
  }

  const events = await readEvents(args.file);

  // --save-baseline
  if (args.saveBaseline) {
    const snapshot = await buildSnapshot(events, args.saveBaseline);
    await fs.mkdir(dir, { recursive: true });
    const outPath = path.join(dir, `${args.saveBaseline}.json`);
    await fs.writeFile(outPath, JSON.stringify(snapshot, null, 2), "utf-8");
    console.log(`✓ Baseline saved: ${outPath}`);
    console.log(`  Sessions: ${snapshot.totalSessions}`);
    console.log(`  Avg duration: ${snapshot.avgSessionDurationMs.toFixed(1)} ms`);
    console.log(`  Avg cost: $${snapshot.avgCostPerSessionUsd.toFixed(5)}`);
    return;
  }

  if (!args.baseline) {
    console.error("Error: --baseline <tag> required. Use --list to see saved baselines.");
    process.exit(1);
  }

  const baselineFile = path.join(dir, `${args.baseline}.json`);
  let baseline: MetricSnapshot;
  try {
    baseline = JSON.parse(await fs.readFile(baselineFile, "utf-8")) as MetricSnapshot;
  } catch {
    console.error(`Baseline not found: ${baselineFile}`);
    console.error(
      `Save one with: bun scripts/regression-check.ts --save-baseline ${args.baseline}`,
    );
    process.exit(1);
  }

  const current = await buildSnapshot(events, args.current);

  interface Check {
    name: string;
    baseline: number;
    current: number;
    deltaPct: number;
    regression: boolean;
  }

  const checks: Check[] = [
    {
      name: "avg session duration (ms)",
      baseline: baseline.avgSessionDurationMs,
      current: current.avgSessionDurationMs,
    },
    {
      name: "p50 session duration (ms)",
      baseline: baseline.p50SessionDurationMs,
      current: current.p50SessionDurationMs,
    },
    {
      name: "p95 session duration (ms)",
      baseline: baseline.p95SessionDurationMs,
      current: current.p95SessionDurationMs,
    },
    {
      name: "avg tokens/session",
      baseline: baseline.avgTokensPerSession,
      current: current.avgTokensPerSession,
    },
    {
      name: "avg cost/session (USD)",
      baseline: baseline.avgCostPerSessionUsd,
      current: current.avgCostPerSessionUsd,
    },
    {
      name: "model error rate",
      baseline: baseline.modelErrorRate,
      current: current.modelErrorRate,
    },
  ].map((c) => {
    const deltaPct = c.baseline !== 0 ? (c.current - c.baseline) / Math.abs(c.baseline) : 0;
    return { ...c, deltaPct, regression: deltaPct > args.threshold };
  });

  if (args.json) {
    console.log(JSON.stringify({ baseline, current, threshold: args.threshold, checks }, null, 2));
    if (checks.some((c) => c.regression)) {
      process.exit(1);
    }
    return;
  }

  const thresholdPct = Math.round(args.threshold * 100);
  console.log(`\nRegression Check: ${args.baseline} → ${args.current}`);
  console.log(`Threshold: ±${thresholdPct}%  |  File: ${args.file}`);
  console.log("─".repeat(80));

  let failures = 0;
  for (const c of checks) {
    const sign = c.deltaPct >= 0 ? "+" : "";
    const deltaPct = `${sign}${(c.deltaPct * 100).toFixed(1)}%`;
    const icon = c.regression ? "✗" : "✓";
    console.log(
      `  ${icon}  ${c.name.padEnd(32)}  base: ${c.baseline.toFixed(3).padStart(10)}  curr: ${c.current.toFixed(3).padStart(10)}  Δ ${deltaPct}`,
    );
    if (c.regression) {
      failures++;
    }
  }

  console.log("─".repeat(80));
  if (failures > 0) {
    console.log(
      `\nFAILED — ${failures} regression(s) detected (>${thresholdPct}% above baseline)\n`,
    );
    process.exit(1);
  } else {
    console.log(`\nPASSED — no regressions detected\n`);
  }
}

main().catch((err: unknown) => {
  console.error("regression-check:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
