import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import {
  evaluateBillableLimits,
  summarizeBillableUsage,
  type BillableLimit,
  type BillableLimitStatus,
  type BillableUsageRecord,
  type BillableUsageSummary,
  diagnosticEventToBillableUsage,
} from "./billable-usage.js";
import { onDiagnosticEvent } from "./diagnostic-events.js";

const BILLABLE_USAGE_FILENAME = "billable-usage.jsonl";

export function resolveBillableUsageLogPath(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  return path.join(resolveStateDir(env, homedir), "logs", BILLABLE_USAGE_FILENAME);
}

export async function appendBillableUsageRecord(
  record: BillableUsageRecord,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const filePath = resolveBillableUsageLogPath(env);
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
    await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch {
    // Best-effort telemetry sink.
  }
}

export async function readBillableUsageRecords(params?: {
  env?: NodeJS.ProcessEnv;
  startMs?: number;
  endMs?: number;
  maxRecords?: number;
}): Promise<BillableUsageRecord[]> {
  const filePath = resolveBillableUsageLogPath(params?.env ?? process.env);
  let content = "";
  try {
    content = await fs.readFile(filePath, "utf-8");
  } catch {
    return [];
  }

  const startMs = params?.startMs ?? Number.NEGATIVE_INFINITY;
  const endMs = params?.endMs ?? Number.POSITIVE_INFINITY;
  const maxRecords = params?.maxRecords;
  const lines = content.split("\n");
  const records: BillableUsageRecord[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      continue;
    }
    try {
      const parsed = JSON.parse(line) as BillableUsageRecord;
      if (typeof parsed?.ts !== "number") {
        continue;
      }
      if (parsed.ts < startMs || parsed.ts > endMs) {
        continue;
      }
      records.push(parsed);
      if (typeof maxRecords === "number" && maxRecords > 0 && records.length >= maxRecords) {
        break;
      }
    } catch {
      // Skip malformed lines to keep reading resilient.
    }
  }

  return records;
}

export async function loadBillableUsageSummary(params?: {
  env?: NodeJS.ProcessEnv;
  startMs?: number;
  endMs?: number;
  limits?: BillableLimit[];
}): Promise<{
  summary: BillableUsageSummary;
  limitStatuses: BillableLimitStatus[];
  recordCount: number;
}> {
  const records = await readBillableUsageRecords({
    env: params?.env,
    startMs: params?.startMs,
    endMs: params?.endMs,
  });
  return {
    summary: summarizeBillableUsage(records),
    limitStatuses:
      params?.limits && params.limits.length > 0
        ? evaluateBillableLimits({
            records,
            limits: params.limits,
            nowMs: params.endMs ?? Date.now(),
          })
        : [],
    recordCount: records.length,
  };
}

export function startBillableUsageMonitor(params?: {
  env?: NodeJS.ProcessEnv;
  onRecord?: (record: BillableUsageRecord) => void;
}): () => void {
  let writeQueue = Promise.resolve();
  const stop = onDiagnosticEvent((event) => {
    const record = diagnosticEventToBillableUsage(event);
    if (!record) {
      return;
    }
    params?.onRecord?.(record);
    writeQueue = writeQueue.then(async () => {
      await appendBillableUsageRecord(record, params?.env ?? process.env);
    });
  });

  return () => {
    stop();
  };
}

export type {
  BillableLimit,
  BillableLimitStatus,
  BillableUsageRecord,
  BillableUsageSummary,
} from "./billable-usage.js";
