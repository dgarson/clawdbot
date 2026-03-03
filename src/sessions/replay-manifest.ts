/**
 * Session-level replay manifest types and serialization helpers.
 *
 * This module provides types and utilities for managing replay sessions at the session level,
 * distinct from the replay bundle format defined in `src/replay/types.ts`.
 *
 * Key differences from `src/replay/types.ts`:
 * - Focuses on session metadata and lifecycle (not the replay bundle format)
 * - Provides session-level tracking and identification for replay-capable sessions
 * - Includes stub for exporting session manifests to storage
 */

import { z } from "zod";

/** Session lifecycle states for replay-capable sessions. */
export const REPLAY_SESSION_STATES = [
  "recording",
  "recorded",
  "replaying",
  "completed",
  "failed",
] as const;

export const ReplaySessionStateSchema = z.enum(REPLAY_SESSION_STATES);
export type ReplaySessionState = z.infer<typeof ReplaySessionStateSchema>;

/** Unique identifier for a replay session. */
export interface ReplaySessionId {
  sessionKey: string;
  replayId: string;
}

export const ReplaySessionIdSchema = z.object({
  sessionKey: z.string().min(1),
  replayId: z.string().min(1),
});

/** Session-level metadata for a replay-capable session. */
export interface ReplaySessionManifest {
  /** Unique session identifier. */
  id: ReplaySessionId;

  /** Current lifecycle state of the session. */
  state: ReplaySessionState;

  /** When the session started recording. */
  recordedAt: string;

  /** When the session ended (optional, if still active). */
  endedAt?: string;

  /** Associated agent ID. */
  agentId: string;

  /** Number of events recorded in this session. */
  eventCount: number;

  /** Categories of events recorded. */
  categories: readonly string[];

  /** Whether the recording was redacted (sensitive data removed). */
  redacted: boolean;

  /** Optional human-readable label for the session. */
  label?: string;

  /** Optional notes about the session. */
  notes?: string;
}

export const ReplaySessionManifestSchema = z.object({
  id: ReplaySessionIdSchema,
  state: ReplaySessionStateSchema,
  recordedAt: z.string().min(1),
  endedAt: z.string().min(1).optional(),
  agentId: z.string().min(1),
  eventCount: z.number().int().nonnegative(),
  categories: z.array(z.string()).readonly(),
  redacted: z.boolean(),
  label: z.string().optional(),
  notes: z.string().optional(),
});

/** Event types that can occur at the session level. */
export const REPLAY_SESSION_EVENT_TYPES = [
  "session_started",
  "session_ended",
  "recording_started",
  "recording_paused",
  "recording_resumed",
  "recording_stopped",
  "replay_started",
  "replay_paused",
  "replay_resumed",
  "replay_completed",
  "replay_failed",
  "constraint_violation",
  "export_requested",
  "export_completed",
  "export_failed",
] as const;

export const ReplaySessionEventTypeSchema = z.enum(REPLAY_SESSION_EVENT_TYPES);
export type ReplaySessionEventType = z.infer<typeof ReplaySessionEventTypeSchema>;

/** A session-level event in the replay lifecycle. */
export interface ReplaySessionEvent {
  /** Unique event identifier within the session. */
  eventId: string;

  /** Type of session event. */
  type: ReplaySessionEventType;

  /** When this event occurred. */
  timestamp: string;

  /** Session this event belongs to. */
  sessionKey: string;

  /** Optional payload with event-specific data. */
  payload?: Record<string, unknown>;
}

export const ReplaySessionEventSchema = z.object({
  eventId: z.string().min(1),
  type: ReplaySessionEventTypeSchema,
  timestamp: z.string().min(1),
  sessionKey: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).optional(),
});

/** Collection of session events. */
export interface ReplaySessionEventLog {
  sessionKey: string;
  events: readonly ReplaySessionEvent[];
}

export const ReplaySessionEventLogSchema = z.object({
  sessionKey: z.string().min(1),
  events: z.array(ReplaySessionEventSchema).readonly(),
});

/** Summary statistics for a replay session. */
export interface ReplaySessionStats {
  totalEvents: number;
  durationMs?: number;
  replayCount: number;
  lastReplayAt?: string;
}

export const ReplaySessionStatsSchema = z.object({
  totalEvents: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative().optional(),
  replayCount: z.number().int().nonnegative(),
  lastReplayAt: z.string().min(1).optional(),
});

// Validation helpers

function formatValidationIssues(issues: z.ZodIssue[]): string {
  return issues
    .map((issue) => {
      const at = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${at}: ${issue.message}`;
    })
    .join("; ");
}

export function parseReplaySessionManifest(raw: unknown): ReplaySessionManifest {
  const result = ReplaySessionManifestSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid replay session manifest: ${formatValidationIssues(result.error.issues)}`,
    );
  }
  return result.data;
}

export function parseReplaySessionManifestJSON(raw: string): ReplaySessionManifest {
  try {
    return parseReplaySessionManifest(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid replay session manifest JSON: ${error.message}`, { cause: error });
    }
    throw error;
  }
}

export function serializeReplaySessionManifest(manifest: ReplaySessionManifest): string {
  return JSON.stringify(manifest);
}

export function parseReplaySessionEvent(raw: unknown): ReplaySessionEvent {
  const result = ReplaySessionEventSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid replay session event: ${formatValidationIssues(result.error.issues)}`);
  }
  return result.data;
}

export function parseReplaySessionEventJSON(raw: string): ReplaySessionEvent {
  try {
    return parseReplaySessionEvent(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid replay session event JSON: ${error.message}`, { cause: error });
    }
    throw error;
  }
}

export function serializeReplaySessionEvent(event: ReplaySessionEvent): string {
  return JSON.stringify(event);
}

export function parseReplaySessionEventLog(raw: unknown): ReplaySessionEventLog {
  const result = ReplaySessionEventLogSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(
      `Invalid replay session event log: ${formatValidationIssues(result.error.issues)}`,
    );
  }
  return result.data;
}

export function parseReplaySessionEventLogJSON(raw: string): ReplaySessionEventLog {
  try {
    return parseReplaySessionEventLog(JSON.parse(raw));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Invalid replay session event log JSON: ${error.message}`, { cause: error });
    }
    throw error;
  }
}

export function serializeReplaySessionEventLog(log: ReplaySessionEventLog): string {
  return JSON.stringify(log);
}

// Factory functions

export function createReplaySessionId(sessionKey: string, replayId: string): ReplaySessionId {
  return { sessionKey, replayId };
}

export function createReplaySessionManifest(
  id: ReplaySessionId,
  agentId: string,
  categories: readonly string[],
  eventCount: number,
  redacted: boolean,
  label?: string,
): ReplaySessionManifest {
  const result: ReplaySessionManifest = {
    id,
    state: "recorded",
    recordedAt: new Date().toISOString(),
    agentId,
    eventCount,
    categories: [...categories],
    redacted,
  };
  if (label !== undefined) {
    result.label = label;
  }
  return result;
}

export function createReplaySessionEvent(
  type: ReplaySessionEventType,
  sessionKey: string,
  payload?: Record<string, unknown>,
): ReplaySessionEvent {
  const result: ReplaySessionEvent = {
    eventId: `${sessionKey}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    timestamp: new Date().toISOString(),
    sessionKey,
  };
  if (payload !== undefined) {
    result.payload = payload;
  }
  return result;
}

// Stub for exporting session manifest
// Note: This is a placeholder for future integration with storage/export functionality.
// Actual implementation should coordinate with the replay bundle format in src/replay/types.ts.

/** Options for exporting a session manifest. */
export interface ExportSessionManifestOptions {
  /** Target output path or storage URI. */
  outputPath: string;

  /** Whether to include the event log. */
  includeEventLog: boolean;

  /** Whether to compress the output. */
  compress: boolean;
}

/**
 * Stub for exporting a session manifest to storage.
 *
 * This function is a placeholder and does not perform any actual export.
 * Future implementation should:
 * 1. Coordinate with the replay bundle format in src/replay/types.ts
 * 2. Integrate with the storage layer (file system, cloud storage, etc.)
 * 3. Handle authentication and authorization
 * 4. Support incremental/atomic writes
 *
 * @param manifest The session manifest to export
 * @param _options Export options (currently unused, placeholder for future implementation)
 * @returns Promise that resolves when export is complete
 */
export async function exportSessionManifest(
  manifest: ReplaySessionManifest,
  _options?: Partial<ExportSessionManifestOptions>,
): Promise<string> {
  // Stub implementation - does not perform any actual export
  // TODO: Implement actual export logic
  // - Coordinate with src/replay/types.ts ReplayManifest format
  // - Add storage backend integration (fs, s3, etc.)
  // - Add proper error handling and retry logic
  // - Add progress reporting
  // - Add compression support

  // For now, just return the serialized manifest as a demonstration
  return serializeReplaySessionManifest(manifest);
}
