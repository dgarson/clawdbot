import { createRealtimeClock, type ReplayClock, createDeterministicClock } from "./clock.js";
import {
  InMemoryReplayRecorder,
  validateReplayConstraints,
  type ReplayRecorder,
  type ReplayRecorderOptions,
} from "./recorder.js";
import {
  type ReplayConstraintCheck,
  type ReplayEvent,
  type ReplayEventCategory,
  type ReplayEventInput,
  type ReplayManifest,
} from "./types.js";

export type DeterministicReplayStep = ReplayEventInput;

export interface ReplayScenarioInput {
  replayId: string;
  sessionId: string;
  agentId: string;
  steps: readonly DeterministicReplayStep[];
  categories?: readonly ReplayEventCategory[];
  now?: ReplayClock;
  startedAt?: string;
}

export interface ReplayScenarioResult {
  manifest: ReplayManifest;
  events: readonly ReplayEvent[];
  jsonl: string;
  fingerprint: string;
}

export interface ReplaySequenceCheckInput {
  actual: readonly ReplayEvent[];
  expected: ReadonlyArray<{ category: ReplayEventCategory; type: string }>;
}

export interface ReplaySequenceCheckResult extends ReplayConstraintCheck {
  actualLength: number;
  expectedLength: number;
}

export function createReplayRecorderForSession(opts: ReplayRecorderOptions): ReplayRecorder {
  return new InMemoryReplayRecorder(opts);
}

export function runReplayScenario(input: ReplayScenarioInput): ReplayScenarioResult {
  const clock = input.now ?? createRealtimeClock();
  const recorder = createReplayRecorderForSession({
    replayId: input.replayId,
    sessionId: input.sessionId,
    agentId: input.agentId,
    categories: input.categories,
    startedAt: input.startedAt ?? new Date().toISOString(),
    now: clock,
    redacted: false,
    enabled: true,
  });

  for (const step of input.steps) {
    recorder.emit(step);
  }

  const manifest = recorder.finalize();
  return {
    manifest,
    events: recorder.getEvents(),
    jsonl: recorder.toJSONL(),
    fingerprint: manifest.eventFingerprint,
  };
}

export function checkReplaySequence(input: ReplaySequenceCheckInput): ReplaySequenceCheckResult {
  const constraint = validateReplayConstraints({ actual: input.actual, expected: input.expected });
  return {
    ...constraint,
    actualLength: input.actual.length,
    expectedLength: input.expected.length,
  };
}

export function createDeterministicReplayClock(start: string, stepMs = 0) {
  return createDeterministicClock({ start, stepMs });
}
