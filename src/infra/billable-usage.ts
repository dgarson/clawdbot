import type { DiagnosticEventPayload } from "./diagnostic-events.js";

export type BillableWindow = "week" | "month";

export type BillableUnit = "usd" | "tokens" | "characters" | "requests" | "seconds" | "images";

export type BillableUsageRecord = {
  ts: number;
  source: string;
  category: "llm" | "tts" | "stt" | "embeddings" | "image" | "video" | "speech" | "other";
  provider: string;
  product?: string;
  model?: string;
  operation: string;
  requestCount?: number;
  usage?: {
    tokens?: number;
    inputTokens?: number;
    outputTokens?: number;
    characters?: number;
    seconds?: number;
    images?: number;
  };
  cost?: {
    usd?: number;
  };
  metadata?: Record<string, string | number | boolean>;
};

export type BillableLimit = {
  id: string;
  window: BillableWindow;
  unit: BillableUnit;
  max: number;
  scope?: {
    provider?: string;
    category?: BillableUsageRecord["category"];
    source?: string;
    operation?: string;
  };
};

export type BillableLimitStatus = {
  limit: BillableLimit;
  used: number;
  remaining: number;
  ratio: number;
  exceeded: boolean;
};

export type BillableUsageSummary = {
  count: number;
  requestCount: number;
  usd: number;
  tokens: number;
  characters: number;
  seconds: number;
  images: number;
};

const emptySummary = (): BillableUsageSummary => ({
  count: 0,
  requestCount: 0,
  usd: 0,
  tokens: 0,
  characters: 0,
  seconds: 0,
  images: 0,
});

const startOfWindowMs = (window: BillableWindow, nowMs: number): number => {
  const now = new Date(nowMs);
  if (window === "week") {
    // Week starts Monday in UTC so limits are deterministic across hosts.
    const day = now.getUTCDay();
    const diff = (day + 6) % 7;
    now.setUTCDate(now.getUTCDate() - diff);
  } else {
    now.setUTCDate(1);
  }
  now.setUTCHours(0, 0, 0, 0);
  return now.getTime();
};

const recordMatchesScope = (record: BillableUsageRecord, limit: BillableLimit): boolean => {
  const scope = limit.scope;
  if (!scope) {
    return true;
  }
  if (scope.provider && scope.provider !== record.provider) {
    return false;
  }
  if (scope.category && scope.category !== record.category) {
    return false;
  }
  if (scope.source && scope.source !== record.source) {
    return false;
  }
  if (scope.operation && scope.operation !== record.operation) {
    return false;
  }
  return true;
};

const measureForUnit = (record: BillableUsageRecord, unit: BillableUnit): number => {
  switch (unit) {
    case "usd":
      return record.cost?.usd ?? 0;
    case "tokens":
      return record.usage?.tokens ?? 0;
    case "characters":
      return record.usage?.characters ?? 0;
    case "requests":
      return record.requestCount ?? 1;
    case "seconds":
      return record.usage?.seconds ?? 0;
    case "images":
      return record.usage?.images ?? 0;
    default:
      return 0;
  }
};

export function summarizeBillableUsage(records: BillableUsageRecord[]): BillableUsageSummary {
  const summary = emptySummary();
  for (const record of records) {
    summary.count += 1;
    summary.requestCount += record.requestCount ?? 1;
    summary.usd += record.cost?.usd ?? 0;
    summary.tokens += record.usage?.tokens ?? 0;
    summary.characters += record.usage?.characters ?? 0;
    summary.seconds += record.usage?.seconds ?? 0;
    summary.images += record.usage?.images ?? 0;
  }
  return summary;
}

export function evaluateBillableLimits(params: {
  records: BillableUsageRecord[];
  limits: BillableLimit[];
  nowMs?: number;
}): BillableLimitStatus[] {
  const nowMs = params.nowMs ?? Date.now();
  return params.limits.map((limit) => {
    const cutoff = startOfWindowMs(limit.window, nowMs);
    let used = 0;
    for (const record of params.records) {
      if (record.ts < cutoff || record.ts > nowMs) {
        continue;
      }
      if (!recordMatchesScope(record, limit)) {
        continue;
      }
      used += measureForUnit(record, limit.unit);
    }
    const remaining = Math.max(0, limit.max - used);
    const ratio = limit.max > 0 ? used / limit.max : 0;
    return {
      limit,
      used,
      remaining,
      ratio,
      exceeded: used > limit.max,
    };
  });
}

export function diagnosticEventToBillableUsage(
  event: DiagnosticEventPayload,
): BillableUsageRecord | null {
  if (event.type === "model.usage") {
    const totalTokens = event.usage.total ?? 0;
    return {
      ts: event.ts,
      source: "runtime.model",
      category: "llm",
      provider: event.provider ?? "unknown",
      model: event.model,
      operation: "completion",
      usage: {
        tokens: totalTokens,
        inputTokens: event.usage.input,
        outputTokens: event.usage.output,
      },
      cost: { usd: event.costUsd },
    };
  }

  if (event.type === "api.usage") {
    const inferredCategory =
      event.apiKind === "tts" || event.apiKind === "tts.summary" ? "tts" : "other";
    return {
      ts: event.ts,
      source: event.source,
      category: inferredCategory,
      provider: event.provider,
      model: event.model,
      operation: event.apiKind,
      requestCount: event.requestCount,
      usage: {
        tokens: event.usage?.total,
        inputTokens: event.usage?.input,
        outputTokens: event.usage?.output,
        characters: event.inputChars,
      },
      metadata: {
        success: event.success,
      },
    };
  }

  if (event.type === "tts.usage") {
    return {
      ts: event.ts,
      source: event.source,
      category: "tts",
      provider: event.provider ?? "unknown",
      model: event.model,
      operation: "tts.speak",
      usage: {
        characters: event.textLength,
      },
      metadata: {
        success: event.success,
      },
    };
  }

  return null;
}
