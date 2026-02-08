import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isNodeSqliteAvailable } from "../../memory/sqlite.js";
import { SqliteWorkQueueBackend } from "./sqlite-backend.js";

const describeSqlite = isNodeSqliteAvailable() ? describe : describe.skip;

describeSqlite("SqliteWorkQueueBackend", () => {
  it("persists queue updates and claims work items", async () => {
    const dbPath = path.join(os.tmpdir(), `work-queue-${Date.now()}.sqlite`);
    const backend = new SqliteWorkQueueBackend(dbPath);
    await backend.initialize();

    const queue = await backend.createQueue({
      id: "agent",
      agentId: "agent",
      name: "Agent queue",
      concurrencyLimit: 2,
      defaultPriority: "medium",
    });

    const first = await backend.createItem({
      queueId: queue.id,
      title: "First",
      status: "pending",
      priority: "medium",
      createdBy: { agentId: "agent" },
    });

    await backend.updateQueue(queue.id, { concurrencyLimit: 1 });
    await backend.updateItem(first.id, { status: "blocked", statusReason: "waiting" });

    const claimed = await backend.claimNextItem(queue.id, { agentId: "agent" });
    expect(claimed).toBeNull();

    await backend.updateItem(first.id, { status: "pending" });
    const claimedAgain = await backend.claimNextItem(queue.id, { agentId: "agent" });
    expect(claimedAgain?.id).toBe(first.id);

    const items = await backend.listItems({ queueId: queue.id, assignedTo: "agent" });
    expect(items.length).toBe(1);

    await backend.close();
    fs.rmSync(dbPath, { force: true });
  });

  it("clears fields when patch sets them to undefined", async () => {
    const dbPath = path.join(os.tmpdir(), `work-queue-clear-${Date.now()}.sqlite`);
    const backend = new SqliteWorkQueueBackend(dbPath);
    await backend.initialize();

    const queue = await backend.createQueue({
      id: "clear-test",
      agentId: "clear-test",
      name: "Clear test queue",
      concurrencyLimit: 1,
      defaultPriority: "medium",
    });

    const item = await backend.createItem({
      queueId: queue.id,
      title: "In progress task",
      status: "in_progress",
      priority: "medium",
      assignedTo: { sessionKey: "agent:test:subagent:abc", agentId: "test" },
      startedAt: new Date().toISOString(),
    });

    expect(item.assignedTo).toBeDefined();
    expect(item.startedAt).toBeDefined();

    // Explicitly set to undefined to clear the fields (recovery scenario).
    const updated = await backend.updateItem(item.id, {
      status: "pending",
      assignedTo: undefined,
      startedAt: undefined,
    });

    expect(updated.status).toBe("pending");
    expect(updated.assignedTo).toBeUndefined();
    expect(updated.startedAt).toBeUndefined();

    // Verify persistence by re-reading.
    const reloaded = await backend.getItem(item.id);
    expect(reloaded?.assignedTo).toBeUndefined();
    expect(reloaded?.startedAt).toBeUndefined();

    await backend.close();
    fs.rmSync(dbPath, { force: true });
  });

  it("ignores undefined values for required patch fields", async () => {
    const dbPath = path.join(os.tmpdir(), `work-queue-required-${Date.now()}.sqlite`);
    const backend = new SqliteWorkQueueBackend(dbPath);
    await backend.initialize();

    const queue = await backend.createQueue({
      id: "required-test",
      agentId: "required-test",
      name: "Required test queue",
      concurrencyLimit: 1,
      defaultPriority: "medium",
    });

    const item = await backend.createItem({
      queueId: queue.id,
      title: "Original title",
      description: "Original description",
      status: "pending",
      priority: "medium",
    });

    const updated = await backend.updateItem(item.id, {
      title: undefined,
      status: "blocked",
      statusReason: "blocked for review",
    });

    expect(updated.title).toBe("Original title");
    expect(updated.status).toBe("blocked");
    expect(updated.statusReason).toBe("blocked for review");

    const reloaded = await backend.getItem(item.id);
    expect(reloaded?.title).toBe("Original title");
    expect(reloaded?.status).toBe("blocked");

    await backend.close();
    fs.rmSync(dbPath, { force: true });
  });

  describe("schema migrations", () => {
    it("runs all migrations on a fresh database", async () => {
      const dbPath = path.join(os.tmpdir(), `work-queue-fresh-${Date.now()}.sqlite`);
      const backend = new SqliteWorkQueueBackend(dbPath);

      await backend.initialize();

      // Verify Umzug tracking table exists
      const db = backend.getDb();
      expect(db).not.toBeNull();
      if (!db) return;

      const migrations = db
        .prepare("SELECT name FROM umzug_migrations ORDER BY name")
        .all() as Array<{
        name: string;
      }>;
      expect(migrations).toHaveLength(3);
      expect(migrations[0]?.name).toBe("001_baseline.ts");
      expect(migrations[1]?.name).toBe("002_workstream_and_tracking.ts");

      // Verify all tables exist
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{
        name: string;
      }>;
      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain("work_queues");
      expect(tableNames).toContain("work_items");
      expect(tableNames).toContain("workstream_notes");
      expect(tableNames).toContain("work_item_executions");
      expect(tableNames).toContain("work_item_transcripts");

      // Verify workstream column exists
      const cols = db.prepare("PRAGMA table_info(work_items)").all() as Array<{ name: string }>;
      const colNames = cols.map((c) => c.name);
      expect(colNames).toContain("workstream");
      expect(colNames).toContain("retry_count");
      expect(colNames).toContain("max_retries");
      expect(colNames).toContain("deadline");
      expect(colNames).toContain("last_outcome");

      await backend.close();
      fs.rmSync(dbPath, { force: true });
    });

    it("handles running migrations multiple times safely (idempotency)", async () => {
      const dbPath = path.join(os.tmpdir(), `work-queue-idempotent-${Date.now()}.sqlite`);
      const backend1 = new SqliteWorkQueueBackend(dbPath);
      await backend1.initialize();

      // Re-initialize (should be no-op since migrations already ran)
      const backend2 = new SqliteWorkQueueBackend(dbPath);
      await backend2.initialize();

      // Verify schema is still correct and no errors occurred
      const db = backend2.getDb();
      expect(db).not.toBeNull();
      if (!db) return;

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all() as Array<{
        name: string;
      }>;
      expect(tables.length).toBeGreaterThan(0);

      // Verify migrations are still tracked correctly
      const migrations = db
        .prepare("SELECT name FROM umzug_migrations ORDER BY name")
        .all() as Array<{
        name: string;
      }>;
      expect(migrations).toHaveLength(3);

      await backend1.close();
      await backend2.close();
      fs.rmSync(dbPath, { force: true });
    });

    it("creates a queue and work item with all new fields", async () => {
      const dbPath = path.join(os.tmpdir(), `work-queue-new-fields-${Date.now()}.sqlite`);
      const backend = new SqliteWorkQueueBackend(dbPath);
      await backend.initialize();

      const queue = await backend.createQueue({
        id: "test-queue",
        agentId: "test-agent",
        name: "Test Queue",
        concurrencyLimit: 1,
        defaultPriority: "medium",
      });

      // Create an item with workstream and retry fields
      const item = await backend.createItem({
        queueId: queue.id,
        title: "Test item",
        status: "pending",
        priority: "medium",
        workstream: "test-workstream",
        retryCount: 0,
        maxRetries: 3,
        deadline: new Date(Date.now() + 3600000).toISOString(),
      });

      expect(item.workstream).toBe("test-workstream");
      expect(item.retryCount).toBe(0);
      expect(item.maxRetries).toBe(3);
      expect(item.deadline).toBeDefined();

      // Verify item can be queried by workstream
      const itemsByWorkstream = await backend.listItems({
        queueId: queue.id,
        workstream: "test-workstream",
      });
      expect(itemsByWorkstream).toHaveLength(1);
      expect(itemsByWorkstream[0]?.id).toBe(item.id);

      await backend.close();
      fs.rmSync(dbPath, { force: true });
    });

    it("indexes work item refs for lookups", async () => {
      const dbPath = path.join(os.tmpdir(), `work-queue-refs-${Date.now()}.sqlite`);
      const backend = new SqliteWorkQueueBackend(dbPath);
      await backend.initialize();

      const queue = await backend.createQueue({
        id: "refs-queue",
        agentId: "refs-queue",
        name: "Refs Queue",
        concurrencyLimit: 1,
        defaultPriority: "medium",
      });

      const item = await backend.createItem({
        queueId: queue.id,
        title: "Item with refs",
        status: "pending",
        priority: "medium",
        payload: {
          refs: [{ kind: "memory:entry", id: "mem-123", label: "Memory entry" }],
        },
      });

      const matches = await backend.listItemsByRef({ kind: "memory:entry", id: "mem-123" });
      expect(matches.map((match) => match.id)).toEqual([item.id]);

      const updated = await backend.updateItem(item.id, {
        payload: {
          refs: [{ kind: "work:item", id: "item-456", label: "Related item" }],
        },
      });
      expect(updated.id).toBe(item.id);

      const oldMatches = await backend.listItemsByRef({ kind: "memory:entry", id: "mem-123" });
      expect(oldMatches).toHaveLength(0);

      const newMatches = await backend.listItemsByRef({ kind: "work:item", id: "item-456" });
      expect(newMatches).toHaveLength(1);

      await backend.close();
      fs.rmSync(dbPath, { force: true });
    });

    it("records and retrieves work item executions", async () => {
      const dbPath = path.join(os.tmpdir(), `work-queue-executions-${Date.now()}.sqlite`);
      const backend = new SqliteWorkQueueBackend(dbPath);
      await backend.initialize();

      const queue = await backend.createQueue({
        id: "exec-test",
        agentId: "exec-test",
        name: "Execution test",
        concurrencyLimit: 1,
        defaultPriority: "medium",
      });

      const item = await backend.createItem({
        queueId: queue.id,
        title: "Task with executions",
        status: "pending",
        priority: "medium",
      });

      // Record an execution
      const startedAt = new Date().toISOString();
      const completedAt = new Date(Date.now() + 1000).toISOString();
      const execution = await backend.recordExecution({
        itemId: item.id,
        attemptNumber: 1,
        sessionKey: "test-session",
        outcome: "success",
        startedAt,
        completedAt,
        durationMs: 1000,
      });

      expect(execution.id).toBeDefined();
      expect(execution.outcome).toBe("success");

      // List executions
      const executions = await backend.listExecutions(item.id);
      expect(executions).toHaveLength(1);
      expect(executions[0]?.id).toBe(execution.id);

      await backend.close();
      fs.rmSync(dbPath, { force: true });
    });

    it("stores and retrieves work item transcripts", async () => {
      const dbPath = path.join(os.tmpdir(), `work-queue-transcripts-${Date.now()}.sqlite`);
      const backend = new SqliteWorkQueueBackend(dbPath);
      await backend.initialize();

      const queue = await backend.createQueue({
        id: "transcript-test",
        agentId: "transcript-test",
        name: "Transcript test",
        concurrencyLimit: 1,
        defaultPriority: "medium",
      });

      const item = await backend.createItem({
        queueId: queue.id,
        title: "Task with transcript",
        status: "pending",
        priority: "medium",
      });

      // Store a transcript
      const transcript = [{ role: "user", content: "Hello" }];
      const transcriptId = await backend.storeTranscript({
        itemId: item.id,
        sessionKey: "test-session",
        transcript,
      });

      expect(transcriptId).toBeDefined();

      // Retrieve the transcript
      const retrieved = await backend.getTranscript(transcriptId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.transcript).toEqual(transcript);

      // List transcripts
      const transcripts = await backend.listTranscripts(item.id);
      expect(transcripts).toHaveLength(1);
      expect(transcripts[0]?.id).toBe(transcriptId);

      await backend.close();
      fs.rmSync(dbPath, { force: true });
    });
  });
});
