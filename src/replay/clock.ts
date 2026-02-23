/**
 * Deterministic clock helpers for replay sessions and tests.
 */

export type ReplayClock = () => string;

export interface DeterministicClockOptions {
  start?: string;
  stepMs?: number;
}

export function createDeterministicClock(options: DeterministicClockOptions = {}): ReplayClock {
  let cursor = Date.parse(options.start ?? new Date(0).toISOString());
  const stepMs = Math.max(0, options.stepMs ?? 0);

  return () => {
    const now = new Date(cursor).toISOString();
    cursor += stepMs;
    return now;
  };
}

export function createRealtimeClock(): ReplayClock {
  return () => new Date().toISOString();
}
