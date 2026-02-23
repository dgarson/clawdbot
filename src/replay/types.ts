export const REPLAY_SCHEMA_VERSION = 1;

export type ReplayEventCategory = "llm" | "tool" | "message" | "file" | "state" | "system" | "user";

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
