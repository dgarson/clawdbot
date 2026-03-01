export type JournalSeverity = "trace" | "debug" | "info" | "warn" | "error";

export type ActivityBucket = "runs" | "errors" | "messages" | "usage" | "cache";

export type JournalEntry = {
  ts: number;
  type: string;
  severity: JournalSeverity;
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  runId?: string;
  summary: string;
  data?: Record<string, unknown>;
};

export type JournalConfig = {
  enabled: boolean;
  maxFileMb: number;
  retentionDays: number;
  activityBuckets: boolean;
  consoleSummary: boolean;
};

export const DEFAULT_JOURNAL_CONFIG: JournalConfig = {
  enabled: true,
  maxFileMb: 100,
  retentionDays: 30,
  activityBuckets: true,
  consoleSummary: true,
};

export function resolveJournalConfig(raw: Partial<JournalConfig> | undefined): JournalConfig {
  if (!raw) {
    return { ...DEFAULT_JOURNAL_CONFIG };
  }
  return {
    enabled: raw.enabled ?? DEFAULT_JOURNAL_CONFIG.enabled,
    maxFileMb: raw.maxFileMb ?? DEFAULT_JOURNAL_CONFIG.maxFileMb,
    retentionDays: raw.retentionDays ?? DEFAULT_JOURNAL_CONFIG.retentionDays,
    activityBuckets: raw.activityBuckets ?? DEFAULT_JOURNAL_CONFIG.activityBuckets,
    consoleSummary: raw.consoleSummary ?? DEFAULT_JOURNAL_CONFIG.consoleSummary,
  };
}

/** Maps a journal event type to the activity bucket(s) it belongs to. */
export function resolveActivityBuckets(entry: JournalEntry): ActivityBucket[] {
  const buckets: ActivityBucket[] = [];
  const t = entry.type;

  if (t === "run.start" || t === "run.end" || t === "run.attempt") {
    buckets.push("runs");
  }
  if (t === "message.queued" || t === "message.processed") {
    buckets.push("messages");
  }
  if (t === "model.usage") {
    buckets.push("usage");
  }
  if (t.startsWith("cache.")) {
    buckets.push("cache");
  }
  if (entry.severity === "error" || entry.severity === "warn") {
    buckets.push("errors");
  }

  return buckets;
}
