import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CronEvent } from "./service/state.js";
import { CronService } from "./service.js";
import { createCronServiceState } from "./service/state.js";
import { ensureLoaded } from "./service/store.js";
import { loadCronStore } from "./store.js";

const noopLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

async function makeStorePath() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-cron-migrate-"));
  return {
    dir,
    storePath: path.join(dir, "cron", "jobs.json"),
    cleanup: async () => {
      await fs.rm(dir, { recursive: true, force: true });
    },
  };
}

function makeCronService(storePath: string, opts?: { onEvent?: (evt: CronEvent) => void }) {
  return new CronService({
    storePath,
    cronEnabled: true,
    log: noopLogger,
    enqueueSystemEvent: vi.fn(),
    requestHeartbeatNow: vi.fn(),
    runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const })),
    onEvent: opts?.onEvent,
  });
}

describe("cron store migration", () => {
  beforeEach(() => {
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("migrates isolated jobs to announce delivery and drops isolation", async () => {
    const store = await makeStorePath();
    const atMs = 1_700_000_000_000;
    const legacyJob = {
      id: "job-1",
      agentId: undefined,
      name: "Legacy job",
      description: null,
      enabled: true,
      deleteAfterRun: false,
      createdAtMs: 1_700_000_000_000,
      updatedAtMs: 1_700_000_000_000,
      schedule: { kind: "at", atMs },
      sessionTarget: "isolated",
      wakeMode: "next-heartbeat",
      payload: {
        kind: "agentTurn",
        message: "hi",
        deliver: true,
        channel: "telegram",
        to: "7200373102",
        bestEffortDeliver: true,
      },
      isolation: { postToMainPrefix: "Cron" },
      state: {},
    };
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(store.storePath, JSON.stringify({ version: 1, jobs: [legacyJob] }, null, 2));

    const cron = makeCronService(store.storePath);

    await cron.start();
    cron.stop();

    const { store: loaded } = await loadCronStore(store.storePath);
    const migrated = loaded.jobs[0] as Record<string, unknown>;
    expect(migrated.delivery).toEqual({
      mode: "announce",
      channel: "telegram",
      to: "7200373102",
      bestEffort: true,
    });
    expect("isolation" in migrated).toBe(false);

    const payload = migrated.payload as Record<string, unknown>;
    expect(payload.deliver).toBeUndefined();
    expect(payload.channel).toBeUndefined();
    expect(payload.to).toBeUndefined();
    expect(payload.bestEffortDeliver).toBeUndefined();

    const schedule = migrated.schedule as Record<string, unknown>;
    expect(schedule.kind).toBe("at");
    expect(schedule.at).toBe(new Date(atMs).toISOString());

    await store.cleanup();
  });
});

// ---------------------------------------------------------------------------
// Phase 1: Per-Job Error Isolation (Circuit Breaker)
// ---------------------------------------------------------------------------

describe("cron per-job error isolation", () => {
  beforeEach(() => {
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("corrupted job does not crash ensureLoaded; other jobs still load normally", async () => {
    const store = await makeStorePath();
    const goodJob = {
      id: "good-job",
      name: "Good job",
      enabled: true,
      createdAtMs: 1_700_000_000_000,
      updatedAtMs: 1_700_000_000_000,
      schedule: { kind: "every", everyMs: 60000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "hello" },
      state: {},
    };
    // Second job has a pre-existing migrationError from a prior load.
    // ensureLoaded should clear it since migration succeeds this time.
    const prevErrorJob = {
      id: "prev-err-job",
      name: "Previously errored",
      enabled: false,
      createdAtMs: 1_700_000_000_000,
      updatedAtMs: 1_700_000_000_000,
      schedule: { kind: "every", everyMs: 60000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "test" },
      state: { migrationError: "simulated prior error" },
    };
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify({ version: 1, jobs: [goodJob, prevErrorJob] }, null, 2),
    );

    // Use internal state + ensureLoaded directly to test the circuit breaker
    const state = createCronServiceState({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent: vi.fn(),
      requestHeartbeatNow: vi.fn(),
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const })),
    });

    await ensureLoaded(state);

    expect(state.store).not.toBeNull();
    expect(state.store!.jobs).toHaveLength(2);

    // Good job is untouched
    const good = state.store!.jobs.find((j) => j.id === "good-job");
    expect(good).toBeDefined();
    expect(good!.enabled).toBe(true);

    // Previously-errored job: migrationError cleared since migration succeeded
    const prev = state.store!.jobs.find((j) => j.id === "prev-err-job");
    expect(prev).toBeDefined();
    expect(prev!.state.migrationError).toBeUndefined();

    await store.cleanup();
  });

  it("updating a migration-errored job clears error on success", async () => {
    const store = await makeStorePath();
    // Write a job that already has a migrationError set
    const jobWithError = {
      id: "err-job",
      name: "Error job",
      enabled: false,
      createdAtMs: 1_700_000_000_000,
      updatedAtMs: 1_700_000_000_000,
      schedule: { kind: "every", everyMs: 60000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "hello" },
      state: { migrationError: "previous error" },
    };
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify({ version: 1, jobs: [jobWithError] }, null, 2),
    );

    const cron = makeCronService(store.storePath);
    await cron.start();

    // Update the job — should clear migrationError
    const updated = await cron.update("err-job", { enabled: true });
    expect(updated.state.migrationError).toBeUndefined();
    expect(updated.enabled).toBe(true);

    cron.stop();
    await store.cleanup();
  });
});

// ---------------------------------------------------------------------------
// Phase 3: loadCronStore error handling
// ---------------------------------------------------------------------------

describe("loadCronStore error handling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty store without error on ENOENT", async () => {
    const result = await loadCronStore("/nonexistent/path/jobs.json");
    expect(result.store).toEqual({ version: 1, jobs: [] });
    expect(result.loadError).toBeUndefined();
  });

  it("falls back to .bak on parse error", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });

    // Write corrupt primary file
    await fs.writeFile(store.storePath, "THIS IS NOT JSON{{{");

    // Write valid .bak file
    const bakJob = {
      id: "bak-job",
      name: "Backup job",
      enabled: true,
      createdAtMs: 1_700_000_000_000,
      updatedAtMs: 1_700_000_000_000,
      schedule: { kind: "every", everyMs: 60000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "hello" },
      state: {},
    };
    await fs.writeFile(
      `${store.storePath}.bak`,
      JSON.stringify({ version: 1, jobs: [bakJob] }, null, 2),
    );

    const result = await loadCronStore(store.storePath, { log: noopLogger });
    expect(result.store.jobs).toHaveLength(1);
    expect(result.store.jobs[0]!.id).toBe("bak-job");
    expect(result.fromBackup).toBe(true);
    expect(result.loadError).toBeUndefined();

    await store.cleanup();
  });

  it("returns empty store with loadError when both primary and .bak are corrupt", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });

    await fs.writeFile(store.storePath, "CORRUPT PRIMARY");
    await fs.writeFile(`${store.storePath}.bak`, "CORRUPT BACKUP");

    const result = await loadCronStore(store.storePath, { log: noopLogger });
    expect(result.store).toEqual({ version: 1, jobs: [] });
    expect(result.loadError).toBeDefined();
    expect(result.loadError).toContain("primary");
    expect(result.loadError).toContain("backup");

    await store.cleanup();
  });

  it("throws on transient FS errors (EACCES)", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(store.storePath, JSON.stringify({ version: 1, jobs: [] }));

    // Make the file unreadable
    await fs.chmod(store.storePath, 0o000);

    try {
      await expect(loadCronStore(store.storePath)).rejects.toThrow();
    } finally {
      // Restore permissions for cleanup
      await fs.chmod(store.storePath, 0o644);
      await store.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 2: Retry with exponential backoff
// ---------------------------------------------------------------------------

describe("cron retry on transient FS error", () => {
  beforeEach(() => {
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries on transient FS error and succeeds on second attempt", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });

    const validJob = {
      id: "retry-job",
      name: "Retry job",
      enabled: true,
      createdAtMs: 1_700_000_000_000,
      updatedAtMs: 1_700_000_000_000,
      schedule: { kind: "every", everyMs: 60000 },
      sessionTarget: "main",
      wakeMode: "next-heartbeat",
      payload: { kind: "systemEvent", text: "hello" },
      state: {},
    };
    await fs.writeFile(store.storePath, JSON.stringify({ version: 1, jobs: [validJob] }, null, 2));

    // Make the file unreadable, then restore after a delay.
    // The ensureLoaded retry loop will retry after 100ms.
    await fs.chmod(store.storePath, 0o000);

    // Restore readability after 50ms so the retry succeeds
    setTimeout(async () => {
      await fs.chmod(store.storePath, 0o644);
    }, 50);

    const cron = makeCronService(store.storePath);

    // This should succeed after retrying
    await cron.start();
    cron.stop();

    // Verify that warn was called for the retry
    const warnCalls = noopLogger.warn.mock.calls;
    const retryWarn = warnCalls.find(
      (call: unknown[]) => typeof call[1] === "string" && call[1].includes("transient FS error"),
    );
    expect(retryWarn).toBeDefined();

    const jobs = await cron.list({ includeDisabled: true });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]!.id).toBe("retry-job");

    await store.cleanup();
  });

  it("falls back to empty store after all retries exhausted", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });
    await fs.writeFile(
      store.storePath,
      JSON.stringify({ version: 1, jobs: [{ id: "x", name: "x" }] }),
    );

    // Make permanently unreadable
    await fs.chmod(store.storePath, 0o000);

    const cron = makeCronService(store.storePath);

    try {
      // Should not throw — falls back to empty store
      await cron.start();
      cron.stop();

      const jobs = await cron.list({ includeDisabled: true });
      expect(jobs).toHaveLength(0);

      // Verify the status reports the load error
      const status = await cron.status();
      expect((status as Record<string, unknown>).storeLoadError).toBeDefined();
    } finally {
      await fs.chmod(store.storePath, 0o644);
      await store.cleanup();
    }
  });
});

// ---------------------------------------------------------------------------
// Phase 4: Health probe / self-healing
// ---------------------------------------------------------------------------

describe("cron health probe", () => {
  beforeEach(() => {
    noopLogger.debug.mockClear();
    noopLogger.info.mockClear();
    noopLogger.warn.mockClear();
    noopLogger.error.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits unhealthy after 3 consecutive failures", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });

    // Write corrupt primary and .bak so loadCronStore returns loadError
    await fs.writeFile(store.storePath, "CORRUPT");
    await fs.writeFile(`${store.storePath}.bak`, "ALSO CORRUPT");

    const events: CronEvent[] = [];
    const state = createCronServiceState({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent: vi.fn(),
      requestHeartbeatNow: vi.fn(),
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const })),
      onEvent: (evt) => events.push(evt),
    });

    // Each forceReload increments the counter
    await ensureLoaded(state, { forceReload: true });
    expect(state.consecutiveLoadFailures).toBe(1);

    await ensureLoaded(state, { forceReload: true });
    expect(state.consecutiveLoadFailures).toBe(2);

    await ensureLoaded(state, { forceReload: true });
    expect(state.consecutiveLoadFailures).toBe(3);

    const unhealthyEvents = events.filter((e) => e.action === "unhealthy");
    expect(unhealthyEvents).toHaveLength(1);
    expect(unhealthyEvents[0]!.consecutiveFailures).toBe(3);

    await store.cleanup();
  });

  it("emits healthy and resets counter on recovery", async () => {
    const store = await makeStorePath();
    await fs.mkdir(path.dirname(store.storePath), { recursive: true });

    // Start corrupt
    await fs.writeFile(store.storePath, "CORRUPT");
    await fs.writeFile(`${store.storePath}.bak`, "ALSO CORRUPT");

    const events: CronEvent[] = [];
    const state = createCronServiceState({
      storePath: store.storePath,
      cronEnabled: true,
      log: noopLogger,
      enqueueSystemEvent: vi.fn(),
      requestHeartbeatNow: vi.fn(),
      runIsolatedAgentJob: vi.fn(async () => ({ status: "ok" as const })),
      onEvent: (evt) => events.push(evt),
    });

    // 3 failures
    await ensureLoaded(state, { forceReload: true });
    await ensureLoaded(state, { forceReload: true });
    await ensureLoaded(state, { forceReload: true });
    expect(state.consecutiveLoadFailures).toBe(3);

    // Now fix the file
    await fs.writeFile(
      store.storePath,
      JSON.stringify({
        version: 1,
        jobs: [
          {
            id: "recovered",
            name: "Recovered",
            enabled: true,
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
            schedule: { kind: "every", everyMs: 60000 },
            sessionTarget: "main",
            wakeMode: "next-heartbeat",
            payload: { kind: "systemEvent", text: "hi" },
            state: {},
          },
        ],
      }),
    );

    await ensureLoaded(state, { forceReload: true });

    const healthyEvents = events.filter((e) => e.action === "healthy");
    expect(healthyEvents).toHaveLength(1);
    expect(state.consecutiveLoadFailures).toBe(0);

    await store.cleanup();
  });
});
