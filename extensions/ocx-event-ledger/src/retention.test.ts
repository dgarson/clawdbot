import { mkdtempSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { DEFAULT_CONFIG, type EventLedgerConfig } from "./config.js";
import { RetentionService } from "./retention.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noopLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

function daysBefore(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}

// Minimal mock storage that exposes baseDir pointing to a real temp directory
function createStorageWithBaseDir(baseDir: string) {
  return { baseDir };
}

/**
 * Access the private cleanup() method for direct testing.
 * This avoids timer-related flakiness from async I/O inside deferred callbacks.
 */
async function runCleanup(retention: RetentionService): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (retention as any).cleanup();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("RetentionService", () => {
  let tempDir: string;
  let baseLedgerDir: string;
  let config: EventLedgerConfig;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "retention-test-"));
    baseLedgerDir = join(tempDir, "event-ledger");
    mkdirSync(baseLedgerDir, { recursive: true });
    config = { ...DEFAULT_CONFIG, coldRetentionDays: 30 };
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  test("deletes event files older than retention period", async () => {
    const agentDir = join(baseLedgerDir, "agent-1");
    mkdirSync(agentDir, { recursive: true });

    // Create a file far beyond retention (60 days old, retention is 30)
    const oldDay = daysBefore(60);
    writeFileSync(join(agentDir, `${oldDay}.jsonl`), '{"test":true}\n');

    // Create a recent file (5 days old)
    const recentDay = daysBefore(5);
    writeFileSync(join(agentDir, `${recentDay}.jsonl`), '{"test":true}\n');

    const storage = createStorageWithBaseDir(baseLedgerDir);
    const retention = new RetentionService(storage as never, config, noopLogger);

    await runCleanup(retention);

    // Old file should be deleted, recent file preserved
    expect(existsSync(join(agentDir, `${oldDay}.jsonl`))).toBe(false);
    expect(existsSync(join(agentDir, `${recentDay}.jsonl`))).toBe(true);
  });

  test("preserves files within retention period", async () => {
    const agentDir = join(baseLedgerDir, "agent-1");
    mkdirSync(agentDir, { recursive: true });

    // File at exactly 10 days old (within 30-day retention)
    const withinRetention = daysBefore(10);
    writeFileSync(join(agentDir, `${withinRetention}.jsonl`), '{"test":true}\n');

    // File at 1 day old
    const veryRecent = daysBefore(1);
    writeFileSync(join(agentDir, `${veryRecent}.jsonl`), '{"test":true}\n');

    const storage = createStorageWithBaseDir(baseLedgerDir);
    const retention = new RetentionService(storage as never, config, noopLogger);

    await runCleanup(retention);

    expect(existsSync(join(agentDir, `${withinRetention}.jsonl`))).toBe(true);
    expect(existsSync(join(agentDir, `${veryRecent}.jsonl`))).toBe(true);
  });

  test("deletes summary files older than retention period", async () => {
    const summaryDir = join(baseLedgerDir, "summaries");
    mkdirSync(summaryDir, { recursive: true });

    const oldDay = daysBefore(60);
    writeFileSync(join(summaryDir, `${oldDay}.jsonl`), '{"runId":"old"}\n');

    const recentDay = daysBefore(5);
    writeFileSync(join(summaryDir, `${recentDay}.jsonl`), '{"runId":"new"}\n');

    const storage = createStorageWithBaseDir(baseLedgerDir);
    const retention = new RetentionService(storage as never, config, noopLogger);

    await runCleanup(retention);

    expect(existsSync(join(summaryDir, `${oldDay}.jsonl`))).toBe(false);
    expect(existsSync(join(summaryDir, `${recentDay}.jsonl`))).toBe(true);
  });

  test("removes empty agent directories after cleanup", async () => {
    const agentDir = join(baseLedgerDir, "empty-agent");
    mkdirSync(agentDir, { recursive: true });

    // Only create an old file that will be deleted
    const oldDay = daysBefore(60);
    writeFileSync(join(agentDir, `${oldDay}.jsonl`), '{"test":true}\n');

    const storage = createStorageWithBaseDir(baseLedgerDir);
    const retention = new RetentionService(storage as never, config, noopLogger);

    await runCleanup(retention);

    // The agent directory itself should be removed since it's now empty
    expect(existsSync(agentDir)).toBe(false);
  });

  test("handles missing base directory gracefully", async () => {
    const missingDir = join(tempDir, "nonexistent", "event-ledger");
    const storage = createStorageWithBaseDir(missingDir);
    const retention = new RetentionService(storage as never, config, noopLogger);

    // Should not throw
    await runCleanup(retention);
  });

  test("start and stop control the timer lifecycle", () => {
    const storage = createStorageWithBaseDir(baseLedgerDir);
    const retention = new RetentionService(storage as never, config, noopLogger);

    retention.start();
    // Multiple starts should be safe
    retention.start();

    retention.stop();
    // Multiple stops should be safe
    retention.stop();
  });

  test("ignores non-jsonl files during cleanup", async () => {
    const agentDir = join(baseLedgerDir, "agent-1");
    mkdirSync(agentDir, { recursive: true });

    // Create a non-jsonl file with an old-looking name
    const oldDay = daysBefore(60);
    writeFileSync(join(agentDir, `${oldDay}.txt`), "some data");
    // Also create an old jsonl that should be deleted
    writeFileSync(join(agentDir, `${oldDay}.jsonl`), '{"test":true}\n');

    const storage = createStorageWithBaseDir(baseLedgerDir);
    const retention = new RetentionService(storage as never, config, noopLogger);

    await runCleanup(retention);

    // Non-jsonl file should remain, jsonl should be deleted
    expect(existsSync(join(agentDir, `${oldDay}.txt`))).toBe(true);
    expect(existsSync(join(agentDir, `${oldDay}.jsonl`))).toBe(false);
  });

  test("respects coldRetentionDays config value", async () => {
    const agentDir = join(baseLedgerDir, "agent-1");
    mkdirSync(agentDir, { recursive: true });

    // With short retention (5 days), a 10-day-old file should be deleted
    config.coldRetentionDays = 5;
    const tenDaysOld = daysBefore(10);
    writeFileSync(join(agentDir, `${tenDaysOld}.jsonl`), '{"test":true}\n');

    // A 3-day-old file should be preserved
    const threeDaysOld = daysBefore(3);
    writeFileSync(join(agentDir, `${threeDaysOld}.jsonl`), '{"test":true}\n');

    const storage = createStorageWithBaseDir(baseLedgerDir);
    const retention = new RetentionService(storage as never, config, noopLogger);

    await runCleanup(retention);

    expect(existsSync(join(agentDir, `${tenDaysOld}.jsonl`))).toBe(false);
    expect(existsSync(join(agentDir, `${threeDaysOld}.jsonl`))).toBe(true);
  });

  test("cleans up across multiple agent directories", async () => {
    const agent1Dir = join(baseLedgerDir, "agent-1");
    const agent2Dir = join(baseLedgerDir, "agent-2");
    mkdirSync(agent1Dir, { recursive: true });
    mkdirSync(agent2Dir, { recursive: true });

    const oldDay = daysBefore(60);
    writeFileSync(join(agent1Dir, `${oldDay}.jsonl`), '{"test":true}\n');
    writeFileSync(join(agent2Dir, `${oldDay}.jsonl`), '{"test":true}\n');

    const storage = createStorageWithBaseDir(baseLedgerDir);
    const retention = new RetentionService(storage as never, config, noopLogger);

    await runCleanup(retention);

    expect(existsSync(join(agent1Dir, `${oldDay}.jsonl`))).toBe(false);
    expect(existsSync(join(agent2Dir, `${oldDay}.jsonl`))).toBe(false);
  });
});
