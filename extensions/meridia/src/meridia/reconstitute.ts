import type { OpenClawConfig } from "openclaw/plugin-sdk";
import type { MeridiaExperienceRecord } from "./types.js";
import { createBackend } from "./db/index.js";

export interface ReconstitutionOptions {
  maxTokens?: number;
  lookbackHours?: number;
  minScore?: number;
  maxRecords?: number;
  config?: OpenClawConfig;
}

export interface ReconstitutionResult {
  text: string;
  estimatedTokens: number;
  recordCount: number;
  sessionCount: number;
  timeRange: { from: string; to: string } | null;
  truncated: boolean;
}

const DEFAULT_MAX_TOKENS = 2000;
const DEFAULT_LOOKBACK_HOURS = 48;
const DEFAULT_MIN_SCORE = 0.6;
const DEFAULT_MAX_RECORDS = 50;
const CHARS_PER_TOKEN = 4;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function formatTimestamp(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return isoStr.slice(0, 16);
  }
}

function recordTopic(record: MeridiaExperienceRecord): string {
  if (record.content?.topic) {
    return record.content.topic;
  }
  if (record.content?.summary) {
    return record.content.summary.length > 140
      ? `${record.content.summary.slice(0, 137)}...`
      : record.content.summary;
  }
  const reason = record.capture.evaluation.reason;
  if (reason) {
    return reason.length > 140 ? `${reason.slice(0, 137)}...` : reason;
  }
  const tool = record.tool?.name ? `tool:${record.tool.name}` : record.kind;
  return `${tool}${record.tool?.isError ? " (error)" : ""}`;
}

export async function generateReconstitution(
  opts: ReconstitutionOptions = {},
): Promise<ReconstitutionResult | null> {
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const lookbackHours = opts.lookbackHours ?? DEFAULT_LOOKBACK_HOURS;
  const minScore = opts.minScore ?? DEFAULT_MIN_SCORE;
  const maxRecords = opts.maxRecords ?? DEFAULT_MAX_RECORDS;
  const maxChars = maxTokens * CHARS_PER_TOKEN;

  const backend = createBackend({ cfg: opts.config });

  const now = new Date();
  const fromDate = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const fromIso = fromDate.toISOString();
  const toIso = now.toISOString();

  const dateRangeResults = backend.getRecordsByDateRange(fromIso, toIso, {
    minScore,
    limit: maxRecords,
  });

  const records =
    dateRangeResults.length > 0
      ? dateRangeResults.map((r) => r.record)
      : backend.getRecentRecords(Math.min(maxRecords, 10), { minScore }).map((r) => r.record);

  if (records.length === 0) {
    return null;
  }

  const sorted = [...records].sort((a, b) => {
    const scoreDiff = b.capture.score - a.capture.score;
    if (Math.abs(scoreDiff) > 0.1) {
      return scoreDiff;
    }
    return b.ts.localeCompare(a.ts);
  });

  const sections: string[] = [];
  let currentChars = 0;
  let truncated = false;
  const sessionKeys = new Set<string>();

  const header =
    `## 🧠 Experiential Continuity — Recent Context\n` +
    `_${records.length} significant experiences from the last ${lookbackHours}h_\n`;
  sections.push(header);
  currentChars += header.length;

  const expHeader = "\n### Key Experiences\n";
  sections.push(expHeader);
  currentChars += expHeader.length;

  for (const record of sorted) {
    const topic = recordTopic(record);
    const time = formatTimestamp(record.ts);
    const score = record.capture.score.toFixed(1);
    const errorTag = record.tool?.isError ? " ⚠️" : "";
    const line = `- **[${score}]** ${topic}${errorTag} _(${time})_\n`;
    if (currentChars + line.length > maxChars * 0.9) {
      truncated = true;
      break;
    }
    sections.push(line);
    currentChars += line.length;
    if (record.session?.key) {
      sessionKeys.add(record.session.key);
    }
  }

  const text = sections.join("").trim() + "\n";
  return {
    text,
    estimatedTokens: estimateTokens(text),
    recordCount: records.length,
    sessionCount: sessionKeys.size,
    timeRange: { from: fromIso, to: toIso },
    truncated,
  };
}
