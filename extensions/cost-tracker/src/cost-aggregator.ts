/**
 * Cost aggregator - reads telemetry JSONL and computes per-agent costs.
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { getModelPricing, calculateTokenCost } from "./pricing.js";
import type {
  TelemetryEntry,
  DailyCostSummary,
  AgentCost,
  ModelCost,
  BudgetAlertConfig,
  BudgetAlert,
  CostTrackerConfig,
} from "./types.js";

/**
 * Parse a single line from telemetry JSONL.
 */
function parseLine(line: string): TelemetryEntry | null {
  try {
    const obj = JSON.parse(line) as Partial<TelemetryEntry>;
    if (!obj || typeof obj !== "object") return null;
    if (obj.action !== "finished") return null;
    if (typeof obj.ts !== "number" || !Number.isFinite(obj.ts)) return null;
    if (typeof obj.jobId !== "string") return null;
    return obj as TelemetryEntry;
  } catch {
    return null;
  }
}

/**
 * List all JSONL files in a directory.
 */
async function listJsonlFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".jsonl"))
      .map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}

/**
 * Read and parse telemetry entries from JSONL files in a directory.
 */
async function readTelemetryEntries(
  telemetryPath: string,
  fromMs: number,
  toMs: number,
  agentIdFilter?: string,
): Promise<TelemetryEntry[]> {
  const files = await listJsonlFiles(telemetryPath);
  const entries: TelemetryEntry[] = [];

  for (const file of files) {
    try {
      const raw = await fs.readFile(file, "utf-8");
      if (!raw.trim()) continue;

      const lines = raw.split("\n");
      for (const line of lines) {
        const entry = parseLine(line.trim());
        if (!entry) continue;
        if (entry.ts < fromMs || entry.ts > toMs) continue;
        if (agentIdFilter && entry.agentId !== agentIdFilter) continue;
        entries.push(entry);
      }
    } catch {
      // Skip files that can't be read
      continue;
    }
  }

  return entries;
}

/**
 * Aggregate costs by agent from telemetry entries.
 */
export function aggregateCostsByAgent(entries: TelemetryEntry[]): AgentCost[] {
  const agentMap = new Map<string, AgentCost>();

  for (const entry of entries) {
    const agentId = entry.agentId ?? entry.jobId ?? "unknown";
    const model = entry.model ?? "<unknown>";

    if (!agentMap.has(agentId)) {
      agentMap.set(agentId, {
        agentId,
        runs: 0,
        models: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalCost: 0,
      });
    }

    const agentCost = agentMap.get(agentId)!;
    agentCost.runs++;

    // Find or create model cost
    let modelCost = agentCost.models.find((m) => m.model === model);
    if (!modelCost) {
      const pricing = getModelPricing(model);
      modelCost = {
        model,
        provider: pricing?.provider ?? "unknown",
        runs: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        inputCost: 0,
        outputCost: 0,
        totalCost: 0,
      };
      agentCost.models.push(modelCost);
    }

    modelCost.runs++;

    const usage = entry.usage ?? {};
    const inputTokens = usage.input_tokens ?? 0;
    const outputTokens = usage.output_tokens ?? 0;
    const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;

    modelCost.inputTokens += inputTokens;
    modelCost.outputTokens += outputTokens;
    modelCost.totalTokens += totalTokens;

    // Calculate cost
    const pricing = getModelPricing(model);
    if (pricing) {
      const cost = calculateTokenCost(usage, pricing);
      modelCost.inputCost += (inputTokens / 1_000_000) * pricing.input;
      modelCost.outputCost += (outputTokens / 1_000_000) * pricing.output;
      modelCost.totalCost = modelCost.inputCost + modelCost.outputCost;
      agentCost.totalCost += modelCost.totalCost;
    }

    agentCost.totalInputTokens += inputTokens;
    agentCost.totalOutputTokens += outputTokens;
    agentCost.totalTokens += totalTokens;
  }

  // Sort models within each agent by total cost descending
  for (const agentCost of agentMap.values()) {
    agentCost.models.sort((a, b) => b.totalCost - a.totalCost);
  }

  // Sort agents by total cost descending
  return Array.from(agentMap.values()).sort((a, b) => b.totalCost - a.totalCost);
}

/**
 * Compute daily cost summary.
 */
export async function computeDailyCostSummary(
  telemetryPath: string,
  date: Date,
): Promise<DailyCostSummary> {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const entries = await readTelemetryEntries(
    telemetryPath,
    startOfDay.getTime(),
    endOfDay.getTime(),
  );

  const agents = aggregateCostsByAgent(entries);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  let totalCost = 0;

  for (const agent of agents) {
    totalInputTokens += agent.totalInputTokens;
    totalOutputTokens += agent.totalOutputTokens;
    totalTokens += agent.totalTokens;
    totalCost += agent.totalCost;
  }

  return {
    date: startOfDay.toISOString().split("T")[0],
    from: startOfDay.toISOString(),
    to: endOfDay.toISOString(),
    totalRuns: agents.reduce((sum, a) => sum + a.runs, 0),
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    totalCost,
    agents,
  };
}

/**
 * Compute cost summary for a time range.
 */
export async function computeCostSummary(
  telemetryPath: string,
  fromMs: number,
  toMs: number,
): Promise<{
  from: string;
  to: string;
  totalRuns: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  agents: AgentCost[];
}> {
  const entries = await readTelemetryEntries(telemetryPath, fromMs, toMs);
  const agents = aggregateCostsByAgent(entries);

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;
  let totalCost = 0;

  for (const agent of agents) {
    totalInputTokens += agent.totalInputTokens;
    totalOutputTokens += agent.totalOutputTokens;
    totalTokens += agent.totalTokens;
    totalCost += agent.totalCost;
  }

  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    totalRuns: agents.reduce((sum, a) => sum + a.runs, 0),
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    totalCost,
    agents,
  };
}

/**
 * Check budget alerts.
 */
export function checkBudgetAlerts(
  summary: DailyCostSummary,
  config: BudgetAlertConfig,
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];

  if (!config.enabled) return alerts;

  // Daily budget check
  if (config.dailyLimit && summary.totalCost > config.dailyLimit) {
    alerts.push({
      type: "daily",
      threshold: config.dailyLimit,
      currentSpend: summary.totalCost,
      percentage: (summary.totalCost / config.dailyLimit) * 100,
    });
  }

  // Agent daily budget check
  if (config.agentDailyLimit) {
    for (const agent of summary.agents) {
      if (agent.totalCost > config.agentDailyLimit) {
        alerts.push({
          type: "agent_daily",
          threshold: config.agentDailyLimit,
          currentSpend: agent.totalCost,
          percentage: (agent.totalCost / config.agentDailyLimit) * 100,
          agentId: agent.agentId,
        });
      }
    }
  }

  return alerts;
}

/**
 * Write cost summary to JSONL file.
 */
export async function writeCostSummaryJsonl(
  summary: DailyCostSummary,
  outputPath: string,
): Promise<void> {
  const line = JSON.stringify(summary);
  await fs.appendFile(outputPath, line + "\n");
}
