/**
 * Cost Report CLI Script
 *
 * Prints a cost summary for the last 24 hours (or specified time window)
 * from telemetry JSONL files.
 *
 * Usage:
 *   npx tsx scripts/cost-report.ts --telemetryPath /path/to/telemetry
 *   npx tsx scripts/cost-report.ts --telemetryPath /path/to/telemetry --hours 48
 *   npx tsx scripts/cost-report.ts --telemetryPath /path/to/telemetry --json
 */

import fs from "node:fs/promises";
import path from "node:path";
import { getModelPricing, calculateTokenCost } from "../extensions/cost-tracker/src/pricing.js";

interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
}

interface TelemetryEntry {
  ts: number;
  jobId: string;
  action: "finished";
  status?: "ok" | "error" | "skipped";
  model?: string;
  provider?: string;
  agentId?: string;
  wave?: string;
  usage?: TokenUsage;
}

interface ModelCost {
  model: string;
  provider: string;
  runs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalCost: number;
}

interface AgentCost {
  agentId: string;
  runs: number;
  models: ModelCost[];
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
}

function parseArgs(argv: string[]) {
  const args: Record<string, string | boolean | number> = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (!a.startsWith("--")) {
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      args[key] = next;
      i++;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function usageAndExit(code: number): never {
  console.error(
    [
      "cost-report.ts",
      "",
      "Required:",
      "  --telemetryPath <path>   Path to telemetry JSONL directory",
      "",
      "Options:",
      "  --hours <n>               Hours to look back (default 24)",
      "  --from <iso>              Start time (ISO string, overrides --hours)",
      "  --to <iso>                End time (ISO string, default now)",
      "  --json                    Output JSON instead of human-readable",
      "",
      "Examples:",
      "  npx tsx scripts/cost-report.ts --telemetryPath ./telemetry",
      "  npx tsx scripts/cost-report.ts --telemetryPath ./telemetry --hours 48 --json",
    ].join("\n"),
  );
  process.exit(code);
}

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

function parseLine(line: string): TelemetryEntry | null {
  try {
    const obj = JSON.parse(line) as Partial<TelemetryEntry>;
    if (!obj || typeof obj !== "object") {
      return null;
    }
    if (obj.action !== "finished") {
      return null;
    }
    if (typeof obj.ts !== "number" || !Number.isFinite(obj.ts)) {
      return null;
    }
    if (typeof obj.jobId !== "string") {
      return null;
    }
    return obj as TelemetryEntry;
  } catch {
    return null;
  }
}

async function readTelemetryEntries(
  telemetryPath: string,
  fromMs: number,
  toMs: number,
): Promise<TelemetryEntry[]> {
  const files = await listJsonlFiles(telemetryPath);
  const entries: TelemetryEntry[] = [];

  for (const file of files) {
    try {
      const raw = await fs.readFile(file, "utf-8");
      if (!raw.trim()) {
        continue;
      }

      const lines = raw.split("\n");
      for (const line of lines) {
        const entry = parseLine(line.trim());
        if (!entry) {
          continue;
        }
        if (entry.ts < fromMs || entry.ts > toMs) {
          continue;
        }
        entries.push(entry);
      }
    } catch {
      continue;
    }
  }

  return entries;
}

function aggregateCostsByAgent(entries: TelemetryEntry[]): AgentCost[] {
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

    const pricing = getModelPricing(model);
    if (pricing) {
      const cost = calculateTokenCost(usage, pricing);
      modelCost.totalCost += cost;
      agentCost.totalCost += cost;
    }

    agentCost.totalInputTokens += inputTokens;
    agentCost.totalOutputTokens += outputTokens;
    agentCost.totalTokens += totalTokens;
  }

  for (const agentCost of agentMap.values()) {
    agentCost.models.sort((a, b) => b.totalCost - a.totalCost);
  }

  return Array.from(agentMap.values()).toSorted((a, b) => b.totalCost - a.totalCost);
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n);
}

function fmtCost(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export async function main() {
  const args = parseArgs(process.argv);

  const telemetryPath = args.telemetryPath as string | undefined;
  if (!telemetryPath) {
    console.error("Error: --telemetryPath is required");
    usageAndExit(2);
  }

  const hours = typeof args.hours === "string" ? Number(args.hours) : 24;
  const toMs = typeof args.to === "string" ? Date.parse(args.to) : Date.now();
  const fromMs =
    typeof args.from === "string"
      ? Date.parse(args.from)
      : toMs - Math.max(1, Number.isFinite(hours) ? hours : 24) * 60 * 60 * 1000;

  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs)) {
    console.error("Invalid --from/--to timestamp");
    process.exit(2);
  }

  const asJson = args.json === true;

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

  const result = {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    totalRuns: agents.reduce((sum, a) => sum + a.runs, 0),
    totalInputTokens,
    totalOutputTokens,
    totalTokens,
    totalCost,
    agents,
  };

  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }

  console.log(`\n📊 Cost Report`);
  console.log(`  telemetry: ${telemetryPath}`);
  console.log(
    `  window: ${new Date(fromMs).toLocaleString()} → ${new Date(toMs).toLocaleString()}`,
  );
  console.log("");

  if (agents.length === 0) {
    console.log("No matching entries found.");
    return;
  }

  console.log(
    `📈 Total: ${fmtCost(totalCost)} (${fmtInt(result.totalRuns)} runs, ${fmtInt(totalTokens)} tokens)`,
  );
  console.log(`   Input:  ${fmtInt(totalInputTokens)} tokens`);
  console.log(`   Output: ${fmtInt(totalOutputTokens)} tokens`);
  console.log("");

  console.log("🏷️  By Agent:");
  for (const agent of agents) {
    console.log(
      `   ${agent.agentId}: ${fmtCost(agent.totalCost)} (${agent.runs} runs, ${fmtInt(agent.totalTokens)} tokens)`,
    );
    for (const model of agent.models.slice(0, 3)) {
      console.log(`      └─ ${model.model}: ${fmtCost(model.totalCost)} (${model.runs} runs)`);
    }
    if (agent.models.length > 3) {
      console.log(`      └─ ... and ${agent.models.length - 3} more models`);
    }
  }
  console.log("");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
