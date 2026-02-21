/**
 * Agent-to-Agent (A2A) Communication Protocol — Audit Tests
 *
 * Tests for logging, querying, rotation, and concurrent write safety.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import type { A2AMessageLike, AuditEntry } from "../../src/gateway/a2a/audit-types.js";
import { queryA2ALog, _queryInternals } from "../../src/gateway/a2a/audit-query.js";
import {
  logA2AMessage,
  readLogFile,
  listLogFiles,
  _internals,
} from "../../src/gateway/a2a/audit.js";

// ─── Test Helpers ────────────────────────────────────────────────────────────

let testDir: string;

beforeEach(async () => {
  testDir = path.join(
    os.tmpdir(),
    `a2a-audit-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );
  await fs.mkdir(testDir, { recursive: true });
});

afterEach(async () => {
  try {
    await fs.rm(testDir, { recursive: true, force: true });
  } catch {
    // best effort cleanup
  }
});

function makeMessage(overrides: Partial<A2AMessageLike> = {}): A2AMessageLike {
  return {
    protocol: "openclaw.a2a.v1",
    messageId: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: "2026-02-21T18:30:00.000Z",
    from: { agentId: "alice", role: "Engineer" },
    to: { agentId: "bob", role: "Reviewer" },
    type: "task_request",
    priority: "normal",
    payload: { taskId: "task-001", title: "Test task" },
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("A2A Audit Logger", () => {
  // ── Basic logging ──────────────────────────────────────────────────────

  describe("logA2AMessage", () => {
    it("writes a valid JSONL line to the log file", async () => {
      const msg = makeMessage();
      const now = new Date("2026-02-21T18:30:00.000Z");

      await logA2AMessage(msg, { logDir: testDir, now });

      const files = await fs.readdir(testDir);
      expect(files).toContain("a2a-2026-02-21.jsonl");

      const content = await fs.readFile(path.join(testDir, "a2a-2026-02-21.jsonl"), "utf-8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(1);

      const entry = JSON.parse(lines[0]) as AuditEntry;
      expect(entry.message.messageId).toBe(msg.messageId);
      expect(entry.meta.receivedAt).toBe(now.toISOString());
      expect(entry.meta.deliveryStatus).toBe("delivered");
    });

    it("creates the log directory if it doesn't exist", async () => {
      const deepDir = path.join(testDir, "nested", "deep", "dir");
      const msg = makeMessage();

      await logA2AMessage(msg, { logDir: deepDir, now: new Date("2026-02-21T10:00:00Z") });

      const files = await fs.readdir(deepDir);
      expect(files.length).toBeGreaterThan(0);
    });

    it("appends multiple messages to the same daily file", async () => {
      const now = new Date("2026-02-21T18:30:00.000Z");

      await logA2AMessage(makeMessage({ messageId: "msg-1" }), { logDir: testDir, now });
      await logA2AMessage(makeMessage({ messageId: "msg-2" }), { logDir: testDir, now });
      await logA2AMessage(makeMessage({ messageId: "msg-3" }), { logDir: testDir, now });

      const entries = await readLogFile(path.join(testDir, "a2a-2026-02-21.jsonl"));
      expect(entries).toHaveLength(3);
      expect(entries.map((e) => e.message.messageId)).toEqual(["msg-1", "msg-2", "msg-3"]);
    });

    it("uses separate files for different days", async () => {
      await logA2AMessage(makeMessage(), {
        logDir: testDir,
        now: new Date("2026-02-21T10:00:00Z"),
      });
      await logA2AMessage(makeMessage(), {
        logDir: testDir,
        now: new Date("2026-02-22T10:00:00Z"),
      });

      const files = await fs.readdir(testDir);
      expect(files).toContain("a2a-2026-02-21.jsonl");
      expect(files).toContain("a2a-2026-02-22.jsonl");
    });

    it("records custom delivery status", async () => {
      await logA2AMessage(makeMessage(), {
        logDir: testDir,
        now: new Date("2026-02-21T10:00:00Z"),
        deliveryStatus: "failed",
        processingTimeMs: 42,
        processedBy: "gateway-1",
      });

      const entries = await readLogFile(path.join(testDir, "a2a-2026-02-21.jsonl"));
      expect(entries[0].meta.deliveryStatus).toBe("failed");
      expect(entries[0].meta.processingTimeMs).toBe(42);
      expect(entries[0].meta.processedBy).toBe("gateway-1");
    });
  });

  // ── Size-based rotation ────────────────────────────────────────────────

  describe("size-based rotation", () => {
    it("rotates to .1.jsonl when file exceeds max size", async () => {
      const now = new Date("2026-02-21T10:00:00Z");
      const filePath = path.join(testDir, "a2a-2026-02-21.jsonl");

      // Create an oversized file (simulate > 50MB by writing a file with exact target size)
      // We'll use a smaller threshold by testing the internal logic
      const bigContent = "x".repeat(51 * 1024 * 1024) + "\n";
      await fs.writeFile(filePath, bigContent, "utf-8");

      // Now log a new message — should go to .1.jsonl
      await logA2AMessage(makeMessage({ messageId: "overflow-msg" }), {
        logDir: testDir,
        now,
      });

      const files = await fs.readdir(testDir);
      expect(files).toContain("a2a-2026-02-21.1.jsonl");

      const entries = await readLogFile(path.join(testDir, "a2a-2026-02-21.1.jsonl"));
      expect(entries).toHaveLength(1);
      expect(entries[0].message.messageId).toBe("overflow-msg");
    });
  });

  // ── Concurrent writes ──────────────────────────────────────────────────

  describe("concurrent write safety", () => {
    it("handles concurrent writes without data loss", async () => {
      const now = new Date("2026-02-21T10:00:00Z");
      const count = 20;

      // Fire off many writes concurrently
      const promises = Array.from({ length: count }, (_, i) =>
        logA2AMessage(makeMessage({ messageId: `concurrent-${i}` }), {
          logDir: testDir,
          now,
        }),
      );

      await Promise.all(promises);

      const entries = await readLogFile(path.join(testDir, "a2a-2026-02-21.jsonl"));
      expect(entries).toHaveLength(count);

      // All messages should be present (order may vary)
      const ids = new Set(entries.map((e) => e.message.messageId));
      for (let i = 0; i < count; i++) {
        expect(ids.has(`concurrent-${i}`)).toBe(true);
      }
    });

    it("each entry is a valid JSON line (no corruption from interleaving)", async () => {
      const now = new Date("2026-02-21T10:00:00Z");

      const promises = Array.from({ length: 10 }, (_, i) =>
        logA2AMessage(makeMessage({ messageId: `json-check-${i}` }), {
          logDir: testDir,
          now,
        }),
      );

      await Promise.all(promises);

      const content = await fs.readFile(path.join(testDir, "a2a-2026-02-21.jsonl"), "utf-8");
      const lines = content.trim().split("\n");
      expect(lines).toHaveLength(10);

      // Each line must be valid JSON
      for (const line of lines) {
        expect(() => JSON.parse(line)).not.toThrow();
      }
    });
  });

  // ── readLogFile ────────────────────────────────────────────────────────

  describe("readLogFile", () => {
    it("returns empty array for nonexistent file", async () => {
      const entries = await readLogFile(path.join(testDir, "nonexistent.jsonl"));
      expect(entries).toEqual([]);
    });

    it("returns empty array for empty file", async () => {
      const filePath = path.join(testDir, "empty.jsonl");
      await fs.writeFile(filePath, "", "utf-8");
      const entries = await readLogFile(filePath);
      expect(entries).toEqual([]);
    });
  });

  // ── listLogFiles ───────────────────────────────────────────────────────

  describe("listLogFiles", () => {
    it("returns empty array for nonexistent directory", async () => {
      const files = await listLogFiles(path.join(testDir, "nope"));
      expect(files).toEqual([]);
    });

    it("lists log files sorted chronologically", async () => {
      await fs.writeFile(path.join(testDir, "a2a-2026-02-22.jsonl"), "", "utf-8");
      await fs.writeFile(path.join(testDir, "a2a-2026-02-21.jsonl"), "", "utf-8");
      await fs.writeFile(path.join(testDir, "a2a-2026-02-21.1.jsonl"), "", "utf-8");
      await fs.writeFile(path.join(testDir, "not-a-log.txt"), "", "utf-8");

      const files = await listLogFiles(testDir);
      expect(files).toHaveLength(3);
      expect(files[0]).toContain("a2a-2026-02-21.jsonl");
      expect(files[1]).toContain("a2a-2026-02-21.1.jsonl");
      expect(files[2]).toContain("a2a-2026-02-22.jsonl");
    });
  });
});

// ─── Query Tests ─────────────────────────────────────────────────────────────

describe("A2A Audit Query", () => {
  // ── Helper: seed some log data ─────────────────────────────────────────

  async function seedTestData() {
    const messages: Array<{ msg: A2AMessageLike; now: Date }> = [
      {
        msg: makeMessage({
          messageId: "q1",
          type: "task_request",
          priority: "high",
          from: { agentId: "alice", role: "Engineer" },
          to: { agentId: "bob", role: "Reviewer" },
          timestamp: "2026-02-21T10:00:00Z",
          correlationId: "corr-001",
        }),
        now: new Date("2026-02-21T10:00:00Z"),
      },
      {
        msg: makeMessage({
          messageId: "q2",
          type: "task_response",
          priority: "normal",
          from: { agentId: "bob", role: "Reviewer" },
          to: { agentId: "alice", role: "Engineer" },
          timestamp: "2026-02-21T14:00:00Z",
          correlationId: "corr-001",
        }),
        now: new Date("2026-02-21T14:00:00Z"),
      },
      {
        msg: makeMessage({
          messageId: "q3",
          type: "status_update",
          priority: "normal",
          from: { agentId: "charlie", role: "Staff" },
          to: { agentId: "alice", role: "Engineer" },
          timestamp: "2026-02-22T09:00:00Z",
        }),
        now: new Date("2026-02-22T09:00:00Z"),
      },
      {
        msg: makeMessage({
          messageId: "q4",
          type: "broadcast",
          priority: "high",
          from: { agentId: "alice", role: "Engineer" },
          to: { agentId: "*", role: "*" },
          timestamp: "2026-02-22T18:00:00Z",
        }),
        now: new Date("2026-02-22T18:00:00Z"),
      },
    ];

    for (const { msg, now } of messages) {
      await logA2AMessage(msg, { logDir: testDir, now });
    }
  }

  describe("queryA2ALog", () => {
    it("returns all entries with no filters", async () => {
      await seedTestData();
      const result = await queryA2ALog({}, { logDir: testDir });
      expect(result.totalCount).toBe(4);
      expect(result.entries).toHaveLength(4);
    });

    it("filters by agentId (matches from.agentId)", async () => {
      await seedTestData();
      const result = await queryA2ALog({ agentId: "charlie" }, { logDir: testDir });
      expect(result.totalCount).toBe(1);
      expect(result.entries[0].message.messageId).toBe("q3");
    });

    it("filters by agentId (matches to.agentId)", async () => {
      await seedTestData();
      const result = await queryA2ALog({ agentId: "bob" }, { logDir: testDir });
      expect(result.totalCount).toBe(2); // q1 (to bob) and q2 (from bob)
    });

    it("filters by message type", async () => {
      await seedTestData();
      const result = await queryA2ALog({ type: "broadcast" }, { logDir: testDir });
      expect(result.totalCount).toBe(1);
      expect(result.entries[0].message.messageId).toBe("q4");
    });

    it("filters by since timestamp", async () => {
      await seedTestData();
      const result = await queryA2ALog({ since: "2026-02-22T00:00:00Z" }, { logDir: testDir });
      expect(result.totalCount).toBe(2); // q3 and q4
    });

    it("filters by until timestamp", async () => {
      await seedTestData();
      const result = await queryA2ALog({ until: "2026-02-21T12:00:00Z" }, { logDir: testDir });
      expect(result.totalCount).toBe(1); // only q1
    });

    it("filters by date range (since + until)", async () => {
      await seedTestData();
      const result = await queryA2ALog(
        { since: "2026-02-21T12:00:00Z", until: "2026-02-22T10:00:00Z" },
        { logDir: testDir },
      );
      expect(result.totalCount).toBe(2); // q2 and q3
    });

    it("filters by correlationId", async () => {
      await seedTestData();
      const result = await queryA2ALog({ correlationId: "corr-001" }, { logDir: testDir });
      expect(result.totalCount).toBe(2); // q1 and q2
    });

    it("filters by priority", async () => {
      await seedTestData();
      const result = await queryA2ALog({ priority: "high" }, { logDir: testDir });
      expect(result.totalCount).toBe(2); // q1 and q4
    });

    it("combines multiple filters", async () => {
      await seedTestData();
      const result = await queryA2ALog(
        { agentId: "alice", type: "task_request" },
        { logDir: testDir },
      );
      expect(result.totalCount).toBe(1);
      expect(result.entries[0].message.messageId).toBe("q1");
    });

    it("applies limit", async () => {
      await seedTestData();
      const result = await queryA2ALog({ limit: 2 }, { logDir: testDir });
      expect(result.entries).toHaveLength(2);
      expect(result.totalCount).toBe(4); // total matches all 4
    });

    it("applies offset", async () => {
      await seedTestData();
      const result = await queryA2ALog({ offset: 2, limit: 10 }, { logDir: testDir });
      expect(result.entries).toHaveLength(2);
      expect(result.totalCount).toBe(4);
    });

    it("returns empty when no entries match", async () => {
      await seedTestData();
      const result = await queryA2ALog({ agentId: "nonexistent" }, { logDir: testDir });
      expect(result.totalCount).toBe(0);
      expect(result.entries).toEqual([]);
    });

    it("returns empty for empty log directory", async () => {
      const result = await queryA2ALog({}, { logDir: testDir });
      expect(result.totalCount).toBe(0);
      expect(result.entries).toEqual([]);
    });

    it("returns empty for nonexistent directory", async () => {
      const result = await queryA2ALog({}, { logDir: path.join(testDir, "nope") });
      expect(result.totalCount).toBe(0);
      expect(result.entries).toEqual([]);
    });

    it("echoes filters in result", async () => {
      const filters = { agentId: "alice", type: "task_request", limit: 5, offset: 0 };
      const result = await queryA2ALog(filters, { logDir: testDir });
      expect(result.filters).toEqual(filters);
    });
  });

  // ── Internal helpers ───────────────────────────────────────────────────

  describe("query internals", () => {
    it("extractDateFromFilename parses standard filenames", () => {
      expect(_queryInternals.extractDateFromFilename("a2a-2026-02-21.jsonl")).toBe("2026-02-21");
      expect(_queryInternals.extractDateFromFilename("a2a-2026-02-21.1.jsonl")).toBe("2026-02-21");
      expect(_queryInternals.extractDateFromFilename("a2a-2026-12-31.99.jsonl")).toBe("2026-12-31");
    });

    it("extractDateFromFilename returns null for invalid filenames", () => {
      expect(_queryInternals.extractDateFromFilename("not-a-log.txt")).toBeNull();
      expect(_queryInternals.extractDateFromFilename("")).toBeNull();
    });

    it("isFileInDateRange filters correctly", () => {
      const fn = _queryInternals.isFileInDateRange;
      expect(fn("a2a-2026-02-21.jsonl", "2026-02-20", "2026-02-22")).toBe(true);
      expect(fn("a2a-2026-02-21.jsonl", "2026-02-22", undefined)).toBe(false);
      expect(fn("a2a-2026-02-21.jsonl", undefined, "2026-02-20")).toBe(false);
      expect(fn("a2a-2026-02-21.jsonl", undefined, undefined)).toBe(true);
    });
  });
});
