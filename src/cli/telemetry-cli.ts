/**
 * OpenClaw Telemetry CLI
 *
 * Subcommands:
 *   openclaw telemetry cost-optimize  — Analyze telemetry events and recommend model downgrades
 *   openclaw telemetry regression      — Compare metrics against a saved baseline
 *   openclaw telemetry baselines       — List saved regression baselines
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline";
import type { Command } from "commander";

// ─── Types ───────────────────────────────────────────────────────────────────

type TelemetryEvent = SessionStartEvent | SessionEndEvent | AgentEndEvent | ModelUsageEvent;

interface BaseEvent {
  type: string;
  timestamp: string;
  agentId?: string;
  sessionId?: string;
}

interface SessionStartEvent extends BaseEvent {
  type: "session_start";
  agentId: string;
  sessionId: string;
}

interface SessionEndEvent extends BaseEvent {
  type: "session_end";
  agentId: string;
  sessionId: string;
  durationMs: number;
  messageCount: number;
}

interface AgentEndEvent extends BaseEvent {
  type: "agent_end";
  agentId: string;
  sessionId: string;
  durationMs: number;
  success: boolean;
  errors?: string[];
}

interface ModelUsageEvent extends BaseEvent {
  type: "model_usage";
  agentId?: string;
  sessionId?: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd?: number;
}

interface AgentModelStats {
  agentId: string;
  model: string;
  provider: string;
  sessionCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number;
  avgCostPerSessionUsd: number;
  avgDurationMs: number;
}

interface CostOptimizeOptions {
  days: string;
  minSavings: string;
  json: boolean;
  telemetryFile?: string;
}

interface RegressionOptions {
  baseline: string;
  current?: string;
  threshold: string;
  saveBaseline?: string;
  telemetryFile?: string;
  json: boolean;
}

interface MetricSnapshot {
  tag: string;
  capturedAt: string;
  totalSessions: number;
  avgSessionDurationMs: number;
  p95SessionDurationMs: number;
  avgTokensPerSession: number;
  avgCostPerSessionUsd: number;
  toolCallErrorRate: number;
  modelErrorRate: number;
}

// ─── Model tier hierarchy (ascending cost order) ─────────────────────────────

const MODEL_TIERS: Array<{ pattern: RegExp; tier: number; suggestedDowngrade?: string }> = [
  { pattern: /haiku|flash|mini|gemini-flash/i, tier: 1 },
  { pattern: /sonnet|glm|minimax|grok-3-mini/i, tier: 2, suggestedDowngrade: undefined },
  { pattern: /opus|gpt-4o|grok-4|gemini-pro/i, tier: 3, suggestedDowngrade: "claude-sonnet-4-6" },
];

function getModelTier(model: string): number {
  for (const entry of MODEL_TIERS) {
    if (entry.pattern.test(model)) {
      return entry.tier;
    }
  }
  return 2; // default to mid tier
}

function suggestDowngrade(model: string): string | null {
  const tier = getModelTier(model);
  if (tier <= 1) {
    return null;
  } // already lowest
  if (tier === 3) {
    return "claude-sonnet-4-6";
  }
  if (tier === 2) {
    return "claude-haiku-3-5";
  }
  return null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defaultTelemetryFile(): string {
  return path.join(os.homedir(), ".openclaw", "telemetry", "events.jsonl");
}

function defaultBaselinesDir(): string {
  return path.join(os.homedir(), ".openclaw", "telemetry", "baselines");
}

async function readTelemetryEvents(filePath: string, cutoffDate?: Date): Promise<TelemetryEvent[]> {
  let fileHandle: fs.FileHandle | undefined;
  try {
    fileHandle = await fs.open(filePath, "r");
  } catch {
    return []; // file doesn't exist yet
  }

  const events: TelemetryEvent[] = [];
  const rl = createInterface({ input: fileHandle.createReadStream(), crlfDelay: Infinity });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    try {
      const event = JSON.parse(trimmed) as TelemetryEvent;
      if (cutoffDate && event.timestamp) {
        const ts = new Date(event.timestamp);
        if (ts < cutoffDate) {
          continue;
        }
      }
      events.push(event);
    } catch {
      // skip malformed lines
    }
  }

  await fileHandle.close();
  return events;
}

function aggregateByAgentModel(events: TelemetryEvent[]): AgentModelStats[] {
  // Build per-session cost maps
  const sessionCost = new Map<
    string,
    { model: string; provider: string; costUsd: number; agentId: string }
  >();
  const sessionDuration = new Map<string, number>();

  for (const e of events) {
    if (e.type === "model_usage") {
      const mu = e;
      const key = mu.sessionId ?? "unknown";
      const existing = sessionCost.get(key);
      const cost = mu.costUsd ?? 0;
      if (!existing || cost > existing.costUsd) {
        sessionCost.set(key, {
          model: mu.model,
          provider: mu.provider,
          costUsd: (existing?.costUsd ?? 0) + cost,
          agentId: mu.agentId ?? "unknown",
        });
      } else {
        existing.costUsd += cost;
      }
    }
    if (e.type === "session_end") {
      const se = e;
      sessionDuration.set(se.sessionId, se.durationMs);
    }
  }

  // Aggregate by agentId + model
  const statsMap = new Map<string, AgentModelStats>();

  for (const [sessionId, info] of sessionCost) {
    const key = `${info.agentId}::${info.model}`;
    const existing = statsMap.get(key);
    const dur = sessionDuration.get(sessionId) ?? 0;
    if (existing) {
      existing.sessionCount += 1;
      existing.totalCostUsd += info.costUsd;
      existing.totalInputTokens += 0; // summed separately if needed
      existing.totalOutputTokens += 0;
      existing.avgDurationMs =
        (existing.avgDurationMs * (existing.sessionCount - 1) + dur) / existing.sessionCount;
    } else {
      statsMap.set(key, {
        agentId: info.agentId,
        model: info.model,
        provider: info.provider,
        sessionCount: 1,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: info.costUsd,
        avgCostPerSessionUsd: info.costUsd,
        avgDurationMs: dur,
      });
    }
  }

  // Compute averages
  for (const stats of statsMap.values()) {
    stats.avgCostPerSessionUsd =
      stats.sessionCount > 0 ? stats.totalCostUsd / stats.sessionCount : 0;
  }

  return Array.from(statsMap.values()).toSorted((a, b) => b.totalCostUsd - a.totalCostUsd);
}

// ─── cost-optimize command ────────────────────────────────────────────────────

interface CostRecommendation {
  agentId: string;
  currentModel: string;
  currentAvgCostUsd: number;
  suggestedModel: string;
  estimatedSavingsPerSession: number;
  estimatedMonthlySavingsUsd: number;
  sessionsPerMonth: number;
  sessionsSampled: number;
  confidence: "high" | "medium" | "low";
  qualityDeltaPct: number;
  borderline: boolean;
}

async function runCostOptimize(options: CostOptimizeOptions): Promise<void> {
  const telemetryFile = options.telemetryFile ?? defaultTelemetryFile();
  const days = Number.parseInt(options.days, 10) || 7;
  const minSavings = Number.parseFloat(options.minSavings) || 1.0;
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const events = await readTelemetryEvents(telemetryFile, cutoffDate);

  if (events.length === 0) {
    console.log(
      `No telemetry events found in the last ${days} days.\n` +
        `Ensure diagnostics.telemetry.enabled = true in your OpenClaw config.\n` +
        `Telemetry file: ${telemetryFile}`,
    );
    return;
  }

  const stats = aggregateByAgentModel(events);
  const recommendations: CostRecommendation[] = [];

  for (const stat of stats) {
    const suggested = suggestDowngrade(stat.model);
    if (!suggested) {
      continue;
    }

    // Heuristic cost for suggested model (rough tier multipliers)
    const currentTier = getModelTier(stat.model);
    const suggestedTier = getModelTier(suggested);
    const tierRatio = currentTier === 3 ? 0.2 : 0.15; // opus→sonnet saves ~80%, sonnet→haiku saves ~85%
    const estimatedNewCost = stat.avgCostPerSessionUsd * tierRatio;
    const savingsPerSession = stat.avgCostPerSessionUsd - estimatedNewCost;

    // Project to monthly (extrapolate from sampling period)
    const sessionsPerMonth = Math.round((stat.sessionCount / days) * 30);
    const monthlySavings = savingsPerSession * sessionsPerMonth;

    if (monthlySavings < minSavings) {
      continue;
    }

    // Quality delta heuristic based on tier jump
    const qualityDeltaPct = suggestedTier < currentTier - 1 ? 12 : currentTier === 3 ? 3 : 8;
    const borderline = qualityDeltaPct > 10;

    const confidence: "high" | "medium" | "low" =
      stat.sessionCount >= 100 ? "high" : stat.sessionCount >= 30 ? "medium" : "low";

    recommendations.push({
      agentId: stat.agentId,
      currentModel: stat.model,
      currentAvgCostUsd: stat.avgCostPerSessionUsd,
      suggestedModel: suggested,
      estimatedSavingsPerSession: savingsPerSession,
      estimatedMonthlySavingsUsd: monthlySavings,
      sessionsPerMonth,
      sessionsSampled: stat.sessionCount,
      confidence,
      qualityDeltaPct,
      borderline,
    });
  }

  if (options.json) {
    console.log(JSON.stringify(recommendations, null, 2));
    return;
  }

  if (recommendations.length === 0) {
    console.log(
      `No cost optimization opportunities found (min savings threshold: $${minSavings}/month).`,
    );
    return;
  }

  console.log(`\nCost Optimization Report — Last ${days} days\n${"─".repeat(60)}`);

  for (const rec of recommendations) {
    const borderlineNote = rec.borderline ? " — borderline, review before switching" : "";
    console.log(`
Agent: ${rec.agentId}
  Current model:   ${rec.currentModel} ($${rec.currentAvgCostUsd.toFixed(4)}/session avg)
  Suggested:       ${rec.suggestedModel} (~$${(rec.currentAvgCostUsd * 0.2).toFixed(4)}/session est.)
  Monthly savings: $${rec.estimatedMonthlySavingsUsd.toFixed(2)} (${rec.sessionsPerMonth} sessions/mo projected)
  Quality delta:   ${rec.qualityDeltaPct}%${borderlineNote}
  Confidence:      ${rec.confidence} (${rec.sessionsSampled} sessions sampled)`);
  }

  const totalSavings = recommendations.reduce((s, r) => s + r.estimatedMonthlySavingsUsd, 0);
  console.log(`\nTotal estimated monthly savings: $${totalSavings.toFixed(2)}\n`);
}

// ─── regression command ───────────────────────────────────────────────────────

function percentiles(values: number[]): { p50: number; p95: number } {
  if (values.length === 0) {
    return { p50: 0, p95: 0 };
  }
  const sorted = [...values].toSorted((a, b) => a - b);
  const p50Idx = Math.floor(sorted.length * 0.5);
  const p95Idx = Math.floor(sorted.length * 0.95);
  return {
    p50: sorted[Math.min(p50Idx, sorted.length - 1)] ?? 0,
    p95: sorted[Math.min(p95Idx, sorted.length - 1)] ?? 0,
  };
}

async function computeSnapshot(events: TelemetryEvent[], tag: string): Promise<MetricSnapshot> {
  const sessionDurations: number[] = [];
  const sessionTokens: number[] = [];
  const sessionCosts: number[] = [];
  let agentErrors = 0;
  let agentTotal = 0;

  for (const e of events) {
    if (e.type === "session_end") {
      const se = e;
      sessionDurations.push(se.durationMs);
    }
    if (e.type === "model_usage") {
      const mu = e;
      sessionTokens.push(mu.inputTokens + mu.outputTokens);
      if (mu.costUsd != null) {
        sessionCosts.push(mu.costUsd);
      }
    }
    if (e.type === "agent_end") {
      agentTotal += 1;
      if (!e.success) {
        agentErrors += 1;
      }
    }
  }

  const durPercentiles = percentiles(sessionDurations);
  const avgDur =
    sessionDurations.length > 0
      ? sessionDurations.reduce((s, v) => s + v, 0) / sessionDurations.length
      : 0;
  const avgTokens =
    sessionTokens.length > 0 ? sessionTokens.reduce((s, v) => s + v, 0) / sessionTokens.length : 0;
  const avgCost =
    sessionCosts.length > 0 ? sessionCosts.reduce((s, v) => s + v, 0) / sessionCosts.length : 0;

  return {
    tag,
    capturedAt: new Date().toISOString(),
    totalSessions: sessionDurations.length,
    avgSessionDurationMs: avgDur,
    p95SessionDurationMs: durPercentiles.p95,
    avgTokensPerSession: avgTokens,
    avgCostPerSessionUsd: avgCost,
    toolCallErrorRate: 0, // requires tool_call events (future OBS-01 enhancement)
    modelErrorRate: agentTotal > 0 ? agentErrors / agentTotal : 0,
  };
}

async function runRegression(options: RegressionOptions): Promise<void> {
  const telemetryFile = options.telemetryFile ?? defaultTelemetryFile();
  const baselinesDir = defaultBaselinesDir();
  const threshold = Number.parseFloat(options.threshold) / 100 || 0.2;

  // Save baseline mode
  if (options.saveBaseline) {
    const events = await readTelemetryEvents(telemetryFile);
    const snapshot = await computeSnapshot(events, options.saveBaseline);
    await fs.mkdir(baselinesDir, { recursive: true });
    const outPath = path.join(baselinesDir, `${options.saveBaseline}.json`);
    await fs.writeFile(outPath, JSON.stringify(snapshot, null, 2), "utf-8");
    console.log(`Baseline saved: ${outPath}`);
    return;
  }

  // Load baseline
  const baselineFile = path.join(baselinesDir, `${options.baseline}.json`);
  let baseline: MetricSnapshot;
  try {
    baseline = JSON.parse(await fs.readFile(baselineFile, "utf-8")) as MetricSnapshot;
  } catch {
    console.error(`Baseline not found: ${baselineFile}`);
    console.error(
      `Save one with: openclaw telemetry regression --save-baseline ${options.baseline}`,
    );
    process.exitCode = 1;
    return;
  }

  const events = await readTelemetryEvents(telemetryFile);
  const current = await computeSnapshot(events, options.current ?? "HEAD");

  interface Check {
    name: string;
    baseline: number;
    current: number;
    regression: boolean;
    deltaPct: number;
  }

  const checks: Check[] = [
    {
      name: "avg session duration (ms)",
      baseline: baseline.avgSessionDurationMs,
      current: current.avgSessionDurationMs,
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
    return { ...c, deltaPct, regression: deltaPct > threshold };
  });

  if (options.json) {
    console.log(JSON.stringify({ baseline, current, threshold, checks }, null, 2));
    const anyRegression = checks.some((c) => c.regression);
    if (anyRegression) {
      process.exitCode = 1;
    }
    return;
  }

  console.log(
    `\nRegression Check: ${options.baseline} → ${options.current ?? "current"}\n${"─".repeat(60)}`,
  );
  console.log(`Threshold: ±${Math.round(threshold * 100)}%\n`);

  let anyRegression = false;
  for (const check of checks) {
    const pass = !check.regression;
    const icon = pass ? "✓" : "✗";
    const delta = (check.deltaPct * 100).toFixed(1);
    const sign = check.deltaPct > 0 ? "+" : "";
    console.log(
      `  ${icon} ${check.name.padEnd(30)} baseline: ${check.baseline.toFixed(2)}  current: ${check.current.toFixed(2)}  delta: ${sign}${delta}%`,
    );
    if (!pass) {
      anyRegression = true;
    }
  }

  console.log();
  if (anyRegression) {
    console.log("FAILED — regressions detected.");
    process.exitCode = 1;
  } else {
    console.log("PASSED — no regressions.");
  }
}

// ─── baselines list command ───────────────────────────────────────────────────

async function runBaselinesList(): Promise<void> {
  const baselinesDir = defaultBaselinesDir();
  let files: string[];
  try {
    files = (await fs.readdir(baselinesDir)).filter((f) => f.endsWith(".json"));
  } catch {
    console.log("No baselines saved yet.");
    console.log(
      `Save one with: openclaw telemetry regression --save-baseline <tag> [--telemetry-file <path>]`,
    );
    return;
  }

  if (files.length === 0) {
    console.log("No baselines found.");
    return;
  }

  console.log(`\nSaved Baselines (${baselinesDir})\n`);
  for (const file of files) {
    const snap = JSON.parse(
      await fs.readFile(path.join(baselinesDir, file), "utf-8"),
    ) as MetricSnapshot;
    console.log(
      `  ${snap.tag.padEnd(30)} captured: ${snap.capturedAt}  sessions: ${snap.totalSessions}`,
    );
  }
  console.log();
}

// ─── CLI registration ─────────────────────────────────────────────────────────

export function registerTelemetryCli(program: Command): void {
  const telemetry = program
    .command("telemetry")
    .description("Telemetry analysis and cost optimization tools");

  // cost-optimize subcommand
  telemetry
    .command("cost-optimize")
    .description("Analyze telemetry data and recommend model downgrades for cost savings")
    .option("--days <n>", "Analyze the last N days of telemetry", "7")
    .option("--min-savings <usd>", "Minimum monthly savings threshold in USD", "1.00")
    .option("--json", "Output as JSON", false)
    .option("--telemetry-file <path>", "Path to telemetry JSONL file")
    .action(async (options: CostOptimizeOptions) => {
      await runCostOptimize(options).catch((err: unknown) => {
        console.error("Error:", err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      });
    });

  // regression subcommand
  telemetry
    .command("regression")
    .description("Compare current telemetry metrics against a saved baseline")
    .option("--baseline <tag>", "Baseline tag to compare against (required unless --save-baseline)")
    .option("--current <tag>", "Label for the current snapshot (default: HEAD)", "HEAD")
    .option("--threshold <pct>", "Regression threshold percentage (default: 20 → ±20%)", "20")
    .option("--save-baseline <tag>", "Save current telemetry as a baseline with this tag")
    .option("--telemetry-file <path>", "Path to telemetry JSONL file")
    .option("--json", "Output as JSON", false)
    .action(async (options: RegressionOptions) => {
      if (!options.saveBaseline && !options.baseline) {
        console.error("Error: --baseline <tag> is required (or use --save-baseline <tag>)");
        process.exitCode = 1;
        return;
      }
      await runRegression(options).catch((err: unknown) => {
        console.error("Error:", err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      });
    });

  // baselines list subcommand
  telemetry
    .command("baselines")
    .description("List saved regression baselines")
    .action(async () => {
      await runBaselinesList().catch((err: unknown) => {
        console.error("Error:", err instanceof Error ? err.message : String(err));
        process.exitCode = 1;
      });
    });
}
