import {
  diagnosticEventToBillableUsage,
  evaluateBillableLimits,
  summarizeBillableUsage,
  type BillableLimit,
  type BillableLimitStatus,
  type BillableUsageRecord,
  type BillableUsageSummary,
} from "./billable-usage.js";
import type { DiagnosticEventPayload } from "./diagnostic-events.js";

export type BillableUsageCollector = {
  ingestDiagnosticEvent: (event: DiagnosticEventPayload) => BillableUsageRecord | null;
  ingestRecord: (record: BillableUsageRecord) => void;
  getRecords: () => BillableUsageRecord[];
  summarize: () => BillableUsageSummary;
  evaluateLimits: () => BillableLimitStatus[];
  clear: () => void;
};

export function createBillableUsageCollector(params?: {
  limits?: BillableLimit[];
  nowMs?: () => number;
  onRecord?: (record: BillableUsageRecord) => void;
  onLimitStatus?: (statuses: BillableLimitStatus[]) => void;
}): BillableUsageCollector {
  const records: BillableUsageRecord[] = [];
  const limits = params?.limits ?? [];
  const resolveNowMs = params?.nowMs ?? (() => Date.now());

  const evaluateAndNotify = (): BillableLimitStatus[] => {
    const statuses =
      limits.length > 0 ? evaluateBillableLimits({ records, limits, nowMs: resolveNowMs() }) : [];
    if (statuses.length > 0) {
      params?.onLimitStatus?.(statuses);
    }
    return statuses;
  };

  const ingestRecord = (record: BillableUsageRecord) => {
    records.push(record);
    params?.onRecord?.(record);
    evaluateAndNotify();
  };

  return {
    ingestDiagnosticEvent: (event) => {
      const record = diagnosticEventToBillableUsage(event);
      if (!record) {
        return null;
      }
      ingestRecord(record);
      return record;
    },
    ingestRecord,
    getRecords: () => [...records],
    summarize: () => summarizeBillableUsage(records),
    evaluateLimits: () => evaluateBillableLimits({ records, limits, nowMs: resolveNowMs() }),
    clear: () => {
      records.length = 0;
    },
  };
}
