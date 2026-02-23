import { z } from "zod";

export const REPLAY_SCHEMA_VERSION = 1;

export const REPLAY_EVENT_CATEGORIES = [
  "llm",
  "tool",
  "message",
  "file",
  "state",
  "system",
  "user",
] as const;

export const ReplayEventCategorySchema = z.enum(REPLAY_EVENT_CATEGORIES);
export type ReplayEventCategory = z.infer<typeof ReplayEventCategorySchema>;

export interface ReplayEventKey {
  category: ReplayEventCategory;
  type: string;
}

export interface ReplayEventInput extends ReplayEventKey {
  /** Optional correlation id linking request/response pairs. */
  correlationId?: string;

  /** Optional latency for request/response style events, in ms. */
  durationMs?: number;

  /** Opaque event payload. */
  data: Record<string, unknown>;
}

export interface ReplayEvent extends ReplayEventInput {
  /** In-session sequence number. */
  seq: number;

  /** ISO timestamp string generated when the event is recorded. */
  ts: string;
}

export interface ReplaySessionMetadata {
  sessionId: string;
  agentId: string;
  startedAt: string;
  endedAt?: string;
  replayId: string;
}

export interface ReplayManifestStats {
  totalEvents: number;
  eventsByCategory: Record<ReplayEventCategory, number>;
}

export interface ReplayManifest {
  schemaVersion: number;
  replayId: string;
  session: Omit<ReplaySessionMetadata, "replayId">;
  environment: {
    nodeVersion: string;
    platform: string;
    architecture: string;
  };
  recording: {
    categories: readonly ReplayEventCategory[];
    redacted: boolean;
  };
  stats: ReplayManifestStats;
  eventFingerprint: string;
}

const isoDate = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    const parsed = Date.parse(value);
    return !Number.isNaN(parsed);
  }, "must be ISO-like date string");

export const ReplayManifestStatsSchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  eventsByCategory: z.record(ReplayEventCategorySchema, z.number().nonnegative().int()),
});

export const ReplayManifestSchema = z.object({
  schemaVersion: z.literal(REPLAY_SCHEMA_VERSION),
  replayId: z.string().min(1),
  session: z.object({
    sessionId: z.string().min(1),
    agentId: z.string().min(1),
    startedAt: isoDate,
    endedAt: isoDate.optional(),
  }),
  environment: z.object({
    nodeVersion: z.string().min(1),
    platform: z.string().min(1),
    architecture: z.string().min(1),
  }),
  recording: z.object({
    categories: z
      .array(ReplayEventCategorySchema)
      .min(1)
      .transform((categories) => [...new Set(categories)] as ReplayEventCategory[])
      .readonly(),
    redacted: z.boolean(),
  }),
  stats: ReplayManifestStatsSchema,
  eventFingerprint: z
    .string()
    .trim()
    .regex(/^[0-9a-f]{64}$/i, "must be a 64 character SHA-256 fingerprint"),
});

export interface ReplayConstraintViolation {
  readonly index: number;
  readonly expected: ReplayEventKey;
  readonly actual: ReplayEventKey;
  readonly reason: string;
}

export interface ReplayConstraintCheck {
  readonly ok: boolean;
  readonly violations: readonly ReplayConstraintViolation[];
}

function formatValidationIssues(issues: z.ZodIssue[]): string {
  return issues
    .map((issue) => {
      const at = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${at}: ${issue.message}`;
    })
    .join("; ");
}

export function parseReplayManifest(raw: unknown): ReplayManifest {
  const result = ReplayManifestSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid replay manifest: ${formatValidationIssues(result.error.issues)}`);
  }
  return result.data;
}

export function parseReplayManifestJSON(raw: string): ReplayManifest {
  try {
    return parseReplayManifest(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid replay manifest JSON: ${error.message}`, { cause: error });
    }
    throw error;
  }
}

export function serializeReplayManifest(manifest: ReplayManifest): string {
  return JSON.stringify(manifest);
}
