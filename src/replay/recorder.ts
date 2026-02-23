import { createHash } from "node:crypto";
import {
  REPLAY_SCHEMA_VERSION,
  type ReplayConstraintCheck,
  type ReplayConstraintViolation,
  type ReplayEvent,
  type ReplayEventCategory,
  type ReplayEventInput,
  type ReplayManifest,
  type ReplayManifestStats,
} from "./types.js";

const DEFAULT_REPLAY_CATEGORIES: ReplayEventCategory[] = [
  "llm",
  "tool",
  "message",
  "file",
  "state",
  "system",
  "user",
];

type ReplayEmitter = (event: ReplayEventInput) => void;

export interface ReplayRecorderOptions {
  /** Replay id and session id are intentionally distinct for flexibility. */
  replayId: string;
  sessionId: string;
  agentId: string;
  categories?: readonly ReplayEventCategory[];
  redacted?: boolean;
  now?: () => string;
  startedAt?: string;
  enabled?: boolean;
}

export interface ReplayRecorder {
  emit(event: ReplayEventInput): ReplayEvent;
  attach(sink: ReplayEmitter): () => void;
  finalize(): ReplayManifest;
  toJSONL(): string;
  getEvents(): readonly ReplayEvent[];
  isActive(): boolean;
}

function initStats(): ReplayManifestStats {
  return {
    totalEvents: 0,
    eventsByCategory: {
      llm: 0,
      tool: 0,
      message: 0,
      file: 0,
      state: 0,
      system: 0,
      user: 0,
    },
  };
}

function normalizeForHash(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeForHash);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .toSorted(([left], [right]) => left.localeCompare(right))
      .map(([key, val]) => [key, normalizeForHash(val)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

function buildEventFingerprint(events: readonly ReplayEvent[]): string {
  const normalized = normalizeForHash(events);
  const serialized = JSON.stringify(normalized);
  return createHash("sha256").update(serialized).digest("hex");
}

export class InMemoryReplayRecorder implements ReplayRecorder {
  #active: boolean;
  #options: Required<Pick<ReplayRecorderOptions, "redacted" | "enabled">> &
    Omit<ReplayRecorderOptions, "redacted" | "enabled">;
  #events: ReplayEvent[] = [];
  #nextSeq = 0;
  #sinks = new Set<ReplayEmitter>();
  #startedAt: string;

  constructor(options: ReplayRecorderOptions) {
    this.#options = {
      redacted: options.redacted ?? false,
      enabled: options.enabled ?? true,
      ...options,
    };
    this.#active = this.#options.enabled;
    this.#startedAt = this.#options.startedAt ?? new Date().toISOString();
  }

  emit(event: ReplayEventInput): ReplayEvent {
    if (!this.#active) {
      return {
        seq: this.#nextSeq,
        ts: this.#options.now ? this.#options.now() : new Date().toISOString(),
        ...event,
      };
    }

    const emitted: ReplayEvent = {
      seq: this.#nextSeq,
      ts: this.#options.now ? this.#options.now() : new Date().toISOString(),
      ...event,
    };
    this.#nextSeq += 1;
    this.#events.push(emitted);
    for (const sink of this.#sinks) {
      sink(emitted);
    }
    return emitted;
  }

  attach(sink: ReplayEmitter): () => void {
    this.#sinks.add(sink);
    return () => {
      this.#sinks.delete(sink);
    };
  }

  isActive() {
    return this.#active;
  }

  toJSONL() {
    return this.#events.map((event) => JSON.stringify(event)).join("\n");
  }

  getEvents() {
    return this.#events;
  }

  finalize(): ReplayManifest {
    const stats = initStats();
    for (const event of this.#events) {
      stats.totalEvents += 1;
      stats.eventsByCategory[event.category] += 1;
    }

    return {
      schemaVersion: REPLAY_SCHEMA_VERSION,
      replayId: this.#options.replayId,
      session: {
        sessionId: this.#options.sessionId,
        agentId: this.#options.agentId,
        startedAt: this.#startedAt,
        endedAt: this.#options.now ? this.#options.now() : new Date().toISOString(),
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
      },
      recording: {
        categories: [...new Set(this.#options.categories ?? DEFAULT_REPLAY_CATEGORIES)].toSorted(),
        redacted: this.#options.redacted,
      },
      stats,
      eventFingerprint: buildEventFingerprint(this.#events),
    };
  }
}

export function validateReplayConstraints(params: {
  actual: readonly ReplayEvent[];
  expected: readonly { category: ReplayEventCategory; type: string }[];
}): ReplayConstraintCheck {
  const violations: ReplayConstraintViolation[] = [];

  const actualLength = params.actual.length;
  if (actualLength < params.expected.length) {
    for (let i = actualLength; i < params.expected.length; i++) {
      violations.push({
        index: i,
        expected: params.expected[i],
        actual: { category: "system", type: "missing" },
        reason: "missing event in actual stream",
      });
    }
  }

  for (let i = 0; i < actualLength; i++) {
    const expected = params.expected[i];
    if (!expected) {
      violations.push({
        index: i,
        expected: { category: "system", type: "unexpected" },
        actual: {
          category: params.actual[i].category,
          type: params.actual[i].type,
        },
        reason: "unexpected extra event",
      });
      continue;
    }

    const actual = params.actual[i];
    if (actual.category !== expected.category || actual.type !== expected.type) {
      violations.push({
        index: i,
        expected,
        actual: { category: actual.category, type: actual.type },
        reason: "event mismatch",
      });
    }
  }

  return { ok: violations.length === 0, violations };
}
