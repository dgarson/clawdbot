#!/usr/bin/env npx tsx
/**
 * generate-scorecard.ts — Weekly Reliability Scorecard Generator
 *
 * Reads telemetry data from JSONL sink (PR #47 format) and cost tracker output,
 * computes SLO metrics, and outputs a filled-in weekly reliability scorecard.
 *
 * Usage:
 *   npx tsx scripts/generate-scorecard.ts [options]
 *
 * Options:
 *   --week <YYYY-MM-DD>     Start date of the week to report (default: last Monday)
 *   --telemetry <path>      Path to telemetry JSONL file (default: auto-detect)
 *   --cost <path>           Path to cost tracker output (default: auto-detect)
 *   --output <path>         Output path for scorecard (default: docs/ops/scorecard-YYYY-WNN.md)
 *   --template <path>       Path to scorecard template (default: docs/ops/weekly-reliability-scorecard-template.md)
 *   --dry-run               Print to stdout instead of writing file
 *
 * Owner: Julia (CAO)
 * Created: 2026-02-22
 */

import { readFileSync, writeFileSync, existsSync, createReadStream } from "fs";
import { resolve, dirname } from "path";
import { createInterface } from "readline";

// ─── Types ──────────────────────────────────────────────────────────────────

interface TelemetryEvent {
  timestamp: string;
  type: string; // "session_complete" | "tool_call" | "cron_exec" | "pipeline_wave" | "context_snapshot"
  agent?: string;
  model?: string;
  durationMs?: number;
  status?: "success" | "error" | "timeout" | "retry";
  toolName?: string;
  retryCount?: number;
  hallucinated?: boolean;
  contextTokens?: number;
  maxContextTokens?: number;
  compacted?: boolean;
  waveId?: string;
  itemsIn?: number;
  itemsOk?: number;
  itemsError?: number;
  cronJob?: string;
  consecutiveFailures?: number;
  costUsd?: number;
  inputTokens?: number;
  outputTokens?: number;
  [key: string]: unknown;
}

interface CostRecord {
  date: string;
  agent: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

interface SLOThresholds {
  target: number;
  warn: number;
  critical: number;
}

interface MetricResult {
  value: number;
  prev?: number;
  rag: "🟢" | "🟡" | "🔴";
  trend: "⬆️" | "➡️" | "⬇️";
}

// ─── Constants ──────────────────────────────────────────────────────────────

const WORKSPACE = resolve(dirname(new URL(import.meta.url).pathname), "..");

const AGENT_TIERS: Record<string, string[]> = {
  "C-suite": ["david", "xavier", "julia", "amadeus", "stephan", "drew", "robert", "tyler"],
  Leads: ["tim", "roman", "claire", "luis"],
  Workers: ["sandy", "tony", "barry", "jerry", "harry", "larry", "nate", "oscar", "vince", "piper", "quinn", "reed", "wes", "sam", "joey"],
  Merlin: ["merlin"],
};

const MODEL_FAMILIES: Record<string, RegExp> = {
  Claude: /claude|sonnet|opus|haiku/i,
  "GPT-4o / o3": /gpt-4o|o3|openai/i,
  "Gemini 2.x": /gemini/i,
  "MiniMax M2.5": /minimax/i,
};

const SLO = {
  latency: {
    p50: { target: 30_000, warn: 45_000, critical: 60_000 },
    p95: { target: 120_000, warn: 180_000, critical: 300_000 },
    p99: { target: 300_000, warn: 450_000, critical: 600_000 },
  },
  cron: {
    successRate: { target: 0.98, warn: 0.98, critical: 0.95 },
    consecutiveFailures: { target: 0, warn: 2, critical: 3 },
  },
  toolCall: {
    successRate: { target: 0.95, warn: 0.95, critical: 0.90 },
    retryRate: { target: 0.05, warn: 0.08, critical: 0.15 },
    hallucinatedRate: { target: 0.01, warn: 0.02, critical: 0.05 },
  },
  toolCallPerModel: {
    Claude: { target: 0.97 },
    "GPT-4o / o3": { target: 0.95 },
    "Gemini 2.x": { target: 0.93 },
    "MiniMax M2.5": { target: 0.92 },
  },
  discovery: {
    waveCompletion: { target: 0.90, warn: 0.90, critical: 0.80 },
    itemsProcessed: { target: 0.80, warn: 0.80, critical: 0.60 },
    waveLatency: { target: 15 * 60_000, warn: 20 * 60_000, critical: 30 * 60_000 },
  },
  context: {
    avgUtilization: { target: 0.60, warn: 0.75, critical: 0.90 },
    sessionsWarn: { target: 0.15, warn: 0.15, critical: 0.25 },
    sessionsCritical: { target: 0.05, warn: 0.05, critical: 0.10 },
    compactionRate: { target: 0.10, warn: 0.10, critical: 0.25 },
  },
  cost: {
    dailyOrg: { target: 80, warn: 80, critical: 150 },
    weeklyOrg: { target: 400, warn: 400, critical: 750 },
    perSession: { target: 3.0, warn: 3.0, critical: 6.0 },
    dailyPerTier: {
      "C-suite": { warn: 8.0, critical: 15.0 },
      Leads: { warn: 6.0, critical: 12.0 },
      Workers: { warn: 4.0, critical: 8.0 },
      Merlin: { warn: 12.0, critical: 20.0 },
    },
  },
} as const;

// ─── Utilities ──────────────────────────────────────────────────────────────

function getLastMonday(from?: Date): Date {
  const d = from ? new Date(from) : new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function getWeekNumber(d: Date): number {
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  return Math.ceil((diff / 86400000 + start.getDay() + 1) / 7);
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function ragStatus(value: number, thresholds: SLOThresholds, inverted = false): "🟢" | "🟡" | "🔴" {
  if (inverted) {
    // Lower is better (latency, cost, failure rate)
    if (value <= thresholds.target) return "🟢";
    if (value <= thresholds.warn) return "🟡";
    return "🔴";
  }
  // Higher is better (success rate)
  if (value >= thresholds.target) return "🟢";
  if (value >= thresholds.warn) return "🟡";
  return "🔴";
}

function trendArrow(current: number, previous: number | undefined, higherIsBetter: boolean): "⬆️" | "➡️" | "⬇️" {
  if (previous === undefined) return "➡️";
  const delta = current - previous;
  const threshold = Math.abs(previous) * 0.05; // 5% change threshold
  if (Math.abs(delta) < threshold) return "➡️";
  if (higherIsBetter) return delta > 0 ? "⬆️" : "⬇️";
  return delta < 0 ? "⬆️" : "⬇️";
}

function getAgentTier(agent: string): string {
  const lower = agent.toLowerCase();
  for (const [tier, agents] of Object.entries(AGENT_TIERS)) {
    if (agents.includes(lower)) return tier;
  }
  return "Unknown";
}

function getModelFamily(model: string): string {
  for (const [family, regex] of Object.entries(MODEL_FAMILIES)) {
    if (regex.test(model)) return family;
  }
  return "Other";
}

// ─── Data Loading ───────────────────────────────────────────────────────────

async function loadTelemetryJsonl(path: string): Promise<TelemetryEvent[]> {
  const events: TelemetryEvent[] = [];

  if (!existsSync(path)) {
    console.warn(`⚠️  Telemetry file not found: ${path}`);
    return events;
  }

  const rl = createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    try {
      events.push(JSON.parse(trimmed) as TelemetryEvent);
    } catch {
      // Skip malformed lines
    }
  }

  return events;
}

async function loadCostData(path: string): Promise<CostRecord[]> {
  const records: CostRecord[] = [];

  if (!existsSync(path)) {
    console.warn(`⚠️  Cost data file not found: ${path}`);
    return records;
  }

  const rl = createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) continue;
    try {
      records.push(JSON.parse(trimmed) as CostRecord);
    } catch {
      // Skip malformed lines
    }
  }

  return records;
}

// ─── Metric Computation ────────────────────────────────────────────────────

function filterByWeek(events: TelemetryEvent[], weekStart: Date): { current: TelemetryEvent[]; previous: TelemetryEvent[] } {
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const prevStart = new Date(weekStart.getTime() - 7 * 86400000);

  return {
    current: events.filter((e) => {
      const t = new Date(e.timestamp);
      return t >= weekStart && t < weekEnd;
    }),
    previous: events.filter((e) => {
      const t = new Date(e.timestamp);
      return t >= prevStart && t < weekStart;
    }),
  };
}

function computeLatencyMetrics(sessions: TelemetryEvent[], prevSessions: TelemetryEvent[]) {
  const durations = sessions.filter((e) => e.type === "session_complete" && e.durationMs).map((e) => e.durationMs!);
  const prevDurations = prevSessions.filter((e) => e.type === "session_complete" && e.durationMs).map((e) => e.durationMs!);

  const p50 = percentile(durations, 50);
  const p95 = percentile(durations, 95);
  const p99 = percentile(durations, 99);
  const prevP50 = prevDurations.length ? percentile(prevDurations, 50) : undefined;
  const prevP95 = prevDurations.length ? percentile(prevDurations, 95) : undefined;
  const prevP99 = prevDurations.length ? percentile(prevDurations, 99) : undefined;

  return {
    p50: { value: p50, prev: prevP50, rag: ragStatus(p50, SLO.latency.p50, true), trend: trendArrow(p50, prevP50, false) },
    p95: { value: p95, prev: prevP95, rag: ragStatus(p95, SLO.latency.p95, true), trend: trendArrow(p95, prevP95, false) },
    p99: { value: p99, prev: prevP99, rag: ragStatus(p99, SLO.latency.p99, true), trend: trendArrow(p99, prevP99, false) },
    sessionCount: durations.length,
  };
}

function computeCronMetrics(events: TelemetryEvent[], prevEvents: TelemetryEvent[]) {
  const cronEvents = events.filter((e) => e.type === "cron_exec");
  const prevCronEvents = prevEvents.filter((e) => e.type === "cron_exec");

  const total = cronEvents.length;
  const successes = cronEvents.filter((e) => e.status === "success").length;
  const failures = total - successes;
  const successRate = total > 0 ? successes / total : 1;

  const prevTotal = prevCronEvents.length;
  const prevSuccesses = prevCronEvents.filter((e) => e.status === "success").length;
  const prevSuccessRate = prevTotal > 0 ? prevSuccesses / prevTotal : undefined;

  const maxConsec = cronEvents.reduce((max, e) => Math.max(max, e.consecutiveFailures ?? 0), 0);

  return {
    successRate: { value: successRate, prev: prevSuccessRate, rag: ragStatus(successRate, SLO.cron.successRate), trend: trendArrow(successRate, prevSuccessRate, true) },
    total,
    failures,
    maxConsecutiveFailures: maxConsec,
    prevTotal,
    failedJobs: cronEvents.filter((e) => e.status !== "success"),
  };
}

function computeToolCallMetrics(events: TelemetryEvent[], prevEvents: TelemetryEvent[]) {
  const toolEvents = events.filter((e) => e.type === "tool_call");
  const prevToolEvents = prevEvents.filter((e) => e.type === "tool_call");

  const total = toolEvents.length;
  const successes = toolEvents.filter((e) => e.status === "success").length;
  const retries = toolEvents.filter((e) => (e.retryCount ?? 0) > 0).length;
  const hallucinated = toolEvents.filter((e) => e.hallucinated).length;

  const successRate = total > 0 ? successes / total : 1;
  const retryRate = total > 0 ? retries / total : 0;
  const hallucinatedRate = total > 0 ? hallucinated / total : 0;

  const prevTotal = prevToolEvents.length;
  const prevSuccesses = prevToolEvents.filter((e) => e.status === "success").length;
  const prevSuccessRate = prevTotal > 0 ? prevSuccesses / prevTotal : undefined;

  // Per-model breakdown
  const modelBreakdown: Record<string, { total: number; successes: number; retries: number }> = {};
  for (const event of toolEvents) {
    const family = getModelFamily(event.model ?? "unknown");
    if (!modelBreakdown[family]) modelBreakdown[family] = { total: 0, successes: 0, retries: 0 };
    modelBreakdown[family].total++;
    if (event.status === "success") modelBreakdown[family].successes++;
    if ((event.retryCount ?? 0) > 0) modelBreakdown[family].retries++;
  }

  // Top failing tools
  const toolFailures: Record<string, { failures: number; total: number }> = {};
  for (const event of toolEvents) {
    const name = event.toolName ?? "unknown";
    if (!toolFailures[name]) toolFailures[name] = { failures: 0, total: 0 };
    toolFailures[name].total++;
    if (event.status !== "success") toolFailures[name].failures++;
  }

  const topFailingTools = Object.entries(toolFailures)
    .map(([name, stats]) => ({ name, failureRate: stats.total > 0 ? stats.failures / stats.total : 0, total: stats.total }))
    .filter((t) => t.failureRate > 0)
    .sort((a, b) => b.failureRate - a.failureRate)
    .slice(0, 3);

  return {
    successRate: { value: successRate, prev: prevSuccessRate, rag: ragStatus(successRate, SLO.toolCall.successRate), trend: trendArrow(successRate, prevSuccessRate, true) },
    retryRate: { value: retryRate, rag: ragStatus(retryRate, SLO.toolCall.retryRate, true) },
    hallucinatedRate: { value: hallucinatedRate, rag: ragStatus(hallucinatedRate, SLO.toolCall.hallucinatedRate, true) },
    modelBreakdown,
    topFailingTools,
  };
}

function computeDiscoveryMetrics(events: TelemetryEvent[], prevEvents: TelemetryEvent[]) {
  const waves = events.filter((e) => e.type === "pipeline_wave");
  const prevWaves = prevEvents.filter((e) => e.type === "pipeline_wave");

  const completedWaves = waves.filter((e) => e.status === "success").length;
  const completionRate = waves.length > 0 ? completedWaves / waves.length : 1;

  const itemsRates = waves
    .filter((e) => e.itemsIn && e.itemsIn > 0)
    .map((e) => (e.itemsOk ?? 0) / e.itemsIn!);
  const avgItemsProcessed = itemsRates.length > 0 ? itemsRates.reduce((a, b) => a + b, 0) / itemsRates.length : 1;

  const latencies = waves.filter((e) => e.durationMs).map((e) => e.durationMs!);
  const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

  const prevCompletionRate = prevWaves.length > 0 ? prevWaves.filter((e) => e.status === "success").length / prevWaves.length : undefined;

  return {
    waveCompletion: { value: completionRate, prev: prevCompletionRate, rag: ragStatus(completionRate, SLO.discovery.waveCompletion), trend: trendArrow(completionRate, prevCompletionRate, true) },
    avgItemsProcessed: { value: avgItemsProcessed, rag: ragStatus(avgItemsProcessed, SLO.discovery.itemsProcessed) },
    avgLatency: { value: avgLatency, rag: ragStatus(avgLatency, SLO.discovery.waveLatency, true) },
    totalWaves: waves.length,
    waves,
  };
}

function computeContextMetrics(events: TelemetryEvent[], prevEvents: TelemetryEvent[]) {
  const snapshots = events.filter((e) => e.type === "context_snapshot" && e.contextTokens && e.maxContextTokens);
  const prevSnapshots = prevEvents.filter((e) => e.type === "context_snapshot" && e.contextTokens && e.maxContextTokens);

  const utilizations = snapshots.map((e) => e.contextTokens! / e.maxContextTokens!);
  const avgUtil = utilizations.length > 0 ? utilizations.reduce((a, b) => a + b, 0) / utilizations.length : 0;

  const warnPct = utilizations.length > 0 ? utilizations.filter((u) => u > 0.75).length / utilizations.length : 0;
  const critPct = utilizations.length > 0 ? utilizations.filter((u) => u > 0.90).length / utilizations.length : 0;
  const compactPct = snapshots.length > 0 ? snapshots.filter((e) => e.compacted).length / snapshots.length : 0;

  const prevUtils = prevSnapshots.map((e) => e.contextTokens! / e.maxContextTokens!);
  const prevAvgUtil = prevUtils.length > 0 ? prevUtils.reduce((a, b) => a + b, 0) / prevUtils.length : undefined;

  // Per-agent breakdown
  const agentContextMap: Record<string, { utilizations: number[]; compactions: number }> = {};
  for (const snap of snapshots) {
    const agent = snap.agent ?? "unknown";
    if (!agentContextMap[agent]) agentContextMap[agent] = { utilizations: [], compactions: 0 };
    agentContextMap[agent].utilizations.push(snap.contextTokens! / snap.maxContextTokens!);
    if (snap.compacted) agentContextMap[agent].compactions++;
  }

  const topContextAgents = Object.entries(agentContextMap)
    .map(([agent, data]) => ({
      agent,
      avg: data.utilizations.reduce((a, b) => a + b, 0) / data.utilizations.length,
      peak: Math.max(...data.utilizations),
      compactions: data.compactions,
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 5);

  return {
    avgUtilization: { value: avgUtil, prev: prevAvgUtil, rag: ragStatus(avgUtil, SLO.context.avgUtilization, true), trend: trendArrow(avgUtil, prevAvgUtil, false) },
    warnPct: { value: warnPct, rag: ragStatus(warnPct, SLO.context.sessionsWarn, true) },
    critPct: { value: critPct, rag: ragStatus(critPct, SLO.context.sessionsCritical, true) },
    compactPct: { value: compactPct, rag: ragStatus(compactPct, SLO.context.compactionRate, true) },
    topAgents: topContextAgents,
  };
}

function computeCostMetrics(costRecords: CostRecord[], weekStart: Date) {
  const weekEnd = new Date(weekStart.getTime() + 7 * 86400000);
  const prevStart = new Date(weekStart.getTime() - 7 * 86400000);

  const current = costRecords.filter((r) => {
    const d = new Date(r.date);
    return d >= weekStart && d < weekEnd;
  });
  const previous = costRecords.filter((r) => {
    const d = new Date(r.date);
    return d >= prevStart && d < weekStart;
  });

  const totalCost = current.reduce((sum, r) => sum + r.costUsd, 0);
  const prevTotalCost = previous.length > 0 ? previous.reduce((sum, r) => sum + r.costUsd, 0) : undefined;

  // Daily breakdown
  const dailyCosts: Record<string, number> = {};
  for (const r of current) {
    dailyCosts[r.date] = (dailyCosts[r.date] ?? 0) + r.costUsd;
  }
  const dailyValues = Object.values(dailyCosts);
  const dailyAvg = dailyValues.length > 0 ? dailyValues.reduce((a, b) => a + b, 0) / dailyValues.length : 0;

  const peakDay = Object.entries(dailyCosts).sort(([, a], [, b]) => b - a)[0];

  // Per-agent
  const agentCosts: Record<string, number> = {};
  for (const r of current) {
    agentCosts[r.agent] = (agentCosts[r.agent] ?? 0) + r.costUsd;
  }

  const topSpenders = Object.entries(agentCosts)
    .map(([agent, total]) => ({ agent, total, dailyAvg: total / 7 }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  return {
    totalCost: { value: totalCost, prev: prevTotalCost, rag: ragStatus(totalCost, SLO.cost.weeklyOrg, true), trend: trendArrow(totalCost, prevTotalCost, false) },
    dailyAvg: { value: dailyAvg, rag: ragStatus(dailyAvg, SLO.cost.dailyOrg, true) },
    peakDay: peakDay ? { date: peakDay[0], amount: peakDay[1] } : undefined,
    topSpenders,
  };
}

// ─── Template Filling ──────────────────────────────────────────────────────

function fillTemplate(template: string, replacements: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(replacements)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  // Replace any remaining unfilled placeholders with "N/A"
  result = result.replace(/\{\{[A-Z0-9_]+\}\}/g, "N/A");
  return result;
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtPct(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function fmtUsd(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function overallRag(rags: Array<"🟢" | "🟡" | "🔴">): "🟢" | "🟡" | "🔴" {
  if (rags.includes("🔴")) return "🔴";
  if (rags.includes("🟡")) return "🟡";
  return "🟢";
}

function overallStatus(rag: "🟢" | "🟡" | "🔴"): string {
  switch (rag) {
    case "🟢":
      return "HEALTHY";
    case "🟡":
      return "DEGRADED";
    case "🔴":
      return "CRITICAL";
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const getArg = (name: string): string | undefined => {
    const idx = args.indexOf(`--${name}`);
    return idx >= 0 && idx + 1 < args.length ? args[idx + 1] : undefined;
  };
  const hasFlag = (name: string): boolean => args.includes(`--${name}`);

  // Resolve week
  const weekArg = getArg("week");
  const weekStart = weekArg ? new Date(weekArg) : getLastMonday();
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  const weekNum = getWeekNumber(weekStart);

  console.log(`📊 Generating scorecard for week of ${formatDate(weekStart)} — ${formatDate(weekEnd)}`);

  // Resolve paths
  const telemetryPath = getArg("telemetry") ?? resolve(WORKSPACE, "data", "telemetry.jsonl");
  const costPath = getArg("cost") ?? resolve(WORKSPACE, "data", "cost-tracker.jsonl");
  const templatePath = getArg("template") ?? resolve(WORKSPACE, "docs", "ops", "weekly-reliability-scorecard-template.md");
  const outputPath = getArg("output") ?? resolve(WORKSPACE, "docs", "ops", `scorecard-${weekStart.getFullYear()}-W${String(weekNum).padStart(2, "0")}.md`);

  // Load data
  console.log(`📂 Loading telemetry from: ${telemetryPath}`);
  const telemetryEvents = await loadTelemetryJsonl(telemetryPath);
  console.log(`   → ${telemetryEvents.length} events loaded`);

  console.log(`📂 Loading cost data from: ${costPath}`);
  const costRecords = await loadCostData(costPath);
  console.log(`   → ${costRecords.length} records loaded`);

  // Filter by week
  const { current, previous } = filterByWeek(telemetryEvents, weekStart);
  console.log(`📅 Current week: ${current.length} events | Previous week: ${previous.length} events`);

  // Compute metrics
  console.log(`🔢 Computing metrics...`);
  const latency = computeLatencyMetrics(current, previous);
  const cron = computeCronMetrics(current, previous);
  const toolCalls = computeToolCallMetrics(current, previous);
  const discovery = computeDiscoveryMetrics(current, previous);
  const context = computeContextMetrics(current, previous);
  const cost = computeCostMetrics(costRecords, weekStart);

  // Determine overall status
  const allRags: Array<"🟢" | "🟡" | "🔴"> = [
    latency.p95.rag,
    cron.successRate.rag,
    toolCalls.successRate.rag,
    discovery.waveCompletion.rag,
    context.avgUtilization.rag,
    cost.totalCost.rag,
  ];
  const overall = overallRag(allRags);

  // Build replacements map
  const replacements: Record<string, string> = {
    WEEK_START: formatDate(weekStart),
    WEEK_END: formatDate(weekEnd),
    GENERATED_AT: new Date().toISOString(),
    OVERALL_RAG: overall,
    OVERALL_STATUS: overallStatus(overall),
    EXECUTIVE_SUMMARY: `Scorecard auto-generated from ${current.length} telemetry events and ${costRecords.length} cost records.`,

    // Latency
    LATENCY_RAG: latency.p95.rag,
    LATENCY_TREND: latency.p95.trend,
    LATENCY_SIGNAL: `p95 = ${fmtMs(latency.p95.value)}`,
    P50_VALUE: fmtMs(latency.p50.value),
    P50_PREV: latency.p50.prev !== undefined ? fmtMs(latency.p50.prev) : "N/A",
    P50_DELTA: latency.p50.prev !== undefined ? fmtMs(latency.p50.value - latency.p50.prev) : "—",
    P50_RAG: latency.p50.rag,
    P95_VALUE: fmtMs(latency.p95.value),
    P95_PREV: latency.p95.prev !== undefined ? fmtMs(latency.p95.prev) : "N/A",
    P95_DELTA: latency.p95.prev !== undefined ? fmtMs(latency.p95.value - latency.p95.prev) : "—",
    P95_RAG: latency.p95.rag,
    P99_VALUE: fmtMs(latency.p99.value),
    P99_PREV: latency.p99.prev !== undefined ? fmtMs(latency.p99.prev) : "N/A",
    P99_DELTA: latency.p99.prev !== undefined ? fmtMs(latency.p99.value - latency.p99.prev) : "—",
    P99_RAG: latency.p99.rag,

    // Cron
    CRON_RAG: cron.successRate.rag,
    CRON_TREND: cron.successRate.trend,
    CRON_SIGNAL: `${fmtPct(cron.successRate.value)} success (${cron.total} runs)`,
    CRON_SUCCESS_RATE: fmtPct(cron.successRate.value),
    CRON_SUCCESS_PREV: cron.successRate.prev !== undefined ? fmtPct(cron.successRate.prev) : "N/A",
    CRON_SUCCESS_RAG: cron.successRate.rag,
    CRON_TOTAL: String(cron.total),
    CRON_TOTAL_PREV: String(cron.prevTotal),
    CRON_FAILURES: String(cron.failures),
    CRON_FAILURES_PREV: "N/A",
    CRON_FAILURES_RAG: cron.failures > 0 ? "🟡" : "🟢",
    CRON_CONSEC_FAIL: String(cron.maxConsecutiveFailures),
    CRON_CONSEC_PREV: "N/A",
    CRON_CONSEC_RAG: ragStatus(cron.maxConsecutiveFailures, SLO.cron.consecutiveFailures, true),

    // Tool calls
    TOOL_RAG: toolCalls.successRate.rag,
    TOOL_TREND: toolCalls.successRate.trend,
    TOOL_SIGNAL: `${fmtPct(toolCalls.successRate.value)} success rate`,
    TOOL_SUCCESS_RATE: fmtPct(toolCalls.successRate.value),
    TOOL_SUCCESS_PREV: toolCalls.successRate.prev !== undefined ? fmtPct(toolCalls.successRate.prev) : "N/A",
    TOOL_SUCCESS_RAG: toolCalls.successRate.rag,
    TOOL_RETRY_RATE: fmtPct(toolCalls.retryRate.value),
    TOOL_RETRY_PREV: "N/A",
    TOOL_RETRY_RAG: toolCalls.retryRate.rag,
    TOOL_HALLUC_RATE: fmtPct(toolCalls.hallucinatedRate.value),
    TOOL_HALLUC_PREV: "N/A",
    TOOL_HALLUC_RAG: toolCalls.hallucinatedRate.rag,

    // Discovery
    DISCOVERY_RAG: discovery.waveCompletion.rag,
    DISCOVERY_TREND: discovery.waveCompletion.trend,
    DISCOVERY_SIGNAL: `${fmtPct(discovery.waveCompletion.value)} wave completion (${discovery.totalWaves} waves)`,
    WAVE_COMPLETION: fmtPct(discovery.waveCompletion.value),
    WAVE_COMPLETION_PREV: discovery.waveCompletion.prev !== undefined ? fmtPct(discovery.waveCompletion.prev) : "N/A",
    WAVE_COMPLETION_RAG: discovery.waveCompletion.rag,
    ITEMS_PROCESSED: fmtPct(discovery.avgItemsProcessed.value),
    ITEMS_PROCESSED_PREV: "N/A",
    ITEMS_PROCESSED_RAG: discovery.avgItemsProcessed.rag,
    WAVE_LATENCY: fmtMs(discovery.avgLatency.value),
    WAVE_LATENCY_PREV: "N/A",
    WAVE_LATENCY_RAG: discovery.avgLatency.rag,
    TOTAL_WAVES: String(discovery.totalWaves),
    TOTAL_WAVES_PREV: "N/A",

    // Context
    CONTEXT_RAG: context.avgUtilization.rag,
    CONTEXT_TREND: context.avgUtilization.trend,
    CONTEXT_SIGNAL: `${fmtPct(context.avgUtilization.value)} avg utilization`,
    CTX_AVG_UTIL: fmtPct(context.avgUtilization.value),
    CTX_AVG_PREV: context.avgUtilization.prev !== undefined ? fmtPct(context.avgUtilization.prev) : "N/A",
    CTX_AVG_RAG: context.avgUtilization.rag,
    CTX_WARN_PCT: fmtPct(context.warnPct.value),
    CTX_WARN_PREV: "N/A",
    CTX_WARN_RAG: context.warnPct.rag,
    CTX_CRIT_PCT: fmtPct(context.critPct.value),
    CTX_CRIT_PREV: "N/A",
    CTX_CRIT_RAG: context.critPct.rag,
    CTX_COMPACT_PCT: fmtPct(context.compactPct.value),
    CTX_COMPACT_PREV: "N/A",
    CTX_COMPACT_RAG: context.compactPct.rag,

    // Cost
    COST_RAG: cost.totalCost.rag,
    COST_TREND: cost.totalCost.trend,
    COST_SIGNAL: `${fmtUsd(cost.totalCost.value)} total (${fmtUsd(cost.dailyAvg.value)}/day avg)`,
    COST_TOTAL: fmtUsd(cost.totalCost.value),
    COST_TOTAL_PREV: cost.totalCost.prev !== undefined ? fmtUsd(cost.totalCost.prev) : "N/A",
    COST_TOTAL_RAG: cost.totalCost.rag,
    COST_DAILY_AVG: fmtUsd(cost.dailyAvg.value),
    COST_DAILY_PREV: "N/A",
    COST_DAILY_RAG: cost.dailyAvg.rag,
    COST_PEAK_DAY: cost.peakDay?.date ?? "N/A",
    COST_PEAK_AMOUNT: cost.peakDay ? fmtUsd(cost.peakDay.amount) : "N/A",

    // Data source status
    TEL_STATUS: telemetryEvents.length > 0 ? "🟢 Active" : "🔴 No data",
    TEL_COVERAGE: telemetryEvents.length > 0 ? `${telemetryEvents.length} events` : "None",
    TEL_NOTES: telemetryEvents.length === 0 ? "Awaiting PR #47 telemetry sink deployment" : "",
    COST_TRACKER_STATUS: costRecords.length > 0 ? "🟢 Active" : "🟡 Pending",
    COST_TRACKER_COVERAGE: costRecords.length > 0 ? `${costRecords.length} records` : "None",
    COST_TRACKER_NOTES: costRecords.length === 0 ? "Cost tracker not yet available — using token-based estimates" : "",
    CRON_LOG_STATUS: "🟡 Partial",
    CRON_LOG_COVERAGE: "Via telemetry events",
    CRON_LOG_NOTES: "Structured cron logs pending — using telemetry cron_exec events",
    PIPE_STATUS: "🟡 Partial",
    PIPE_COVERAGE: "Via telemetry events",
    PIPE_NOTES: "Discovery pipeline instrumentation is basic — wave-level only",
  };

  // Fill per-agent context top 3
  for (let i = 0; i < 3; i++) {
    const agent = context.topAgents[i];
    const idx = i + 1;
    if (agent) {
      replacements[`CTX_AGENT_${idx}`] = agent.agent;
      replacements[`CTX_AGENT_${idx}_AVG`] = fmtPct(agent.avg);
      replacements[`CTX_AGENT_${idx}_PEAK`] = fmtPct(agent.peak);
      replacements[`CTX_AGENT_${idx}_COMPACT`] = String(agent.compactions);
      replacements[`CTX_AGENT_${idx}_RAG`] = ragStatus(agent.avg, SLO.context.avgUtilization, true);
    }
  }

  // Fill top cost spenders
  for (let i = 0; i < 3; i++) {
    const spender = cost.topSpenders[i];
    const idx = i + 1;
    if (spender) {
      replacements[`COST_AGENT_${idx}`] = spender.agent;
      replacements[`COST_AGENT_${idx}_TOTAL`] = fmtUsd(spender.total);
      replacements[`COST_AGENT_${idx}_DAILY`] = fmtUsd(spender.dailyAvg);
    }
  }

  // Fill top failing tools
  for (let i = 0; i < 3; i++) {
    const tool = toolCalls.topFailingTools[i];
    const idx = i + 1;
    if (tool) {
      replacements[`FAIL_TOOL_${idx}`] = tool.name;
      replacements[`FAIL_TOOL_${idx}_RATE`] = fmtPct(tool.failureRate);
      replacements[`FAIL_TOOL_${idx}_COUNT`] = String(tool.total);
    }
  }

  // Fill per-model tool success
  for (const [family, data] of Object.entries(toolCalls.modelBreakdown)) {
    const key = family.replace(/[^A-Za-z]/g, "").toUpperCase();
    const rate = data.total > 0 ? data.successes / data.total : 1;
    replacements[`${key}_SUCCESS`] = fmtPct(rate);
    replacements[`${key}_RETRIES`] = String(data.retries);
    replacements[`${key}_RAG`] = ragStatus(rate, SLO.toolCall.successRate);
  }

  // Load template
  let template: string;
  if (existsSync(templatePath)) {
    template = readFileSync(templatePath, "utf-8");
    console.log(`📝 Loaded template from: ${templatePath}`);
  } else {
    console.warn(`⚠️  Template not found at ${templatePath}, using built-in minimal template`);
    template = `# Weekly Reliability Scorecard\n\n> Week: {{WEEK_START}} — {{WEEK_END}}\n> Status: {{OVERALL_RAG}} {{OVERALL_STATUS}}\n\n{{EXECUTIVE_SUMMARY}}\n`;
  }

  // Fill and output
  const filled = fillTemplate(template, replacements);

  if (hasFlag("dry-run")) {
    console.log("\n" + filled);
  } else {
    // Ensure output directory exists
    const outDir = dirname(outputPath);
    const { mkdirSync } = await import("fs");
    mkdirSync(outDir, { recursive: true });

    writeFileSync(outputPath, filled, "utf-8");
    console.log(`✅ Scorecard written to: ${outputPath}`);
  }

  // Summary
  console.log(`\n📊 Summary:`);
  console.log(`   Overall: ${overall} ${overallStatus(overall)}`);
  console.log(`   Latency p95: ${fmtMs(latency.p95.value)} ${latency.p95.rag}`);
  console.log(`   Cron success: ${fmtPct(cron.successRate.value)} ${cron.successRate.rag}`);
  console.log(`   Tool success: ${fmtPct(toolCalls.successRate.value)} ${toolCalls.successRate.rag}`);
  console.log(`   Discovery: ${fmtPct(discovery.waveCompletion.value)} ${discovery.waveCompletion.rag}`);
  console.log(`   Context avg: ${fmtPct(context.avgUtilization.value)} ${context.avgUtilization.rag}`);
  console.log(`   Cost: ${fmtUsd(cost.totalCost.value)} ${cost.totalCost.rag}`);
}

main().catch((err) => {
  console.error("❌ Scorecard generation failed:", err);
  process.exit(1);
});
