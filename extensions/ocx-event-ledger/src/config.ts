/**
 * Plugin configuration type and defaults for the Event Ledger.
 */

import type { EventFamily } from "./types.js";

export type EventLedgerConfig = {
  /** Flush interval for buffered writes (ms) */
  flushIntervalMs: number;
  /** Maximum buffer size before forced flush */
  maxBufferSize: number;
  /** Hours to keep events in hot tier (in-memory index) */
  hotRetentionHours: number;
  /** Days to keep events in warm tier (on-disk JSONL) */
  warmRetentionDays: number;
  /** Days to keep events in cold tier (compressed archives) */
  coldRetentionDays: number;
  /** Families to capture (empty = all) */
  families: EventFamily[];
  /** Families to exclude from capture */
  excludeFamilies: EventFamily[];
  /** Maximum payload size before truncation (bytes) */
  maxPayloadSize: number;
};

export const DEFAULT_CONFIG: EventLedgerConfig = {
  flushIntervalMs: 1000,
  maxBufferSize: 100,
  hotRetentionHours: 24,
  warmRetentionDays: 30,
  coldRetentionDays: 365,
  families: [],
  excludeFamilies: [],
  maxPayloadSize: 8192,
};

/**
 * Parse raw plugin config into a typed EventLedgerConfig, falling back to
 * defaults for any missing or invalid fields.
 */
export function parseConfig(raw: Record<string, unknown> | undefined): EventLedgerConfig {
  if (!raw) return { ...DEFAULT_CONFIG };

  const num = (key: string, fallback: number): number => {
    const v = raw[key];
    return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : fallback;
  };

  const strArray = (key: string, fallback: EventFamily[]): EventFamily[] => {
    const v = raw[key];
    if (!Array.isArray(v)) return fallback;
    return v.filter((item): item is EventFamily => typeof item === "string") as EventFamily[];
  };

  return {
    flushIntervalMs: num("flushIntervalMs", DEFAULT_CONFIG.flushIntervalMs),
    maxBufferSize: num("maxBufferSize", DEFAULT_CONFIG.maxBufferSize),
    hotRetentionHours: num("hotRetentionHours", DEFAULT_CONFIG.hotRetentionHours),
    warmRetentionDays: num("warmRetentionDays", DEFAULT_CONFIG.warmRetentionDays),
    coldRetentionDays: num("coldRetentionDays", DEFAULT_CONFIG.coldRetentionDays),
    families: strArray("families", DEFAULT_CONFIG.families),
    excludeFamilies: strArray("excludeFamilies", DEFAULT_CONFIG.excludeFamilies),
    maxPayloadSize: num("maxPayloadSize", DEFAULT_CONFIG.maxPayloadSize),
  };
}
