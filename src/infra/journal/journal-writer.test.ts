import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolJournalEntry } from "./types.js";
import {
  initJournalPath,
  writeJournalEntry,
  pruneOldJournalFiles,
  getJournalFilePath,
  resetJournalWriter,
} from "./journal-writer.js";

const TEST_DIR = path.join("/tmp", "openclaw-journal-test-" + process.pid);

beforeEach(() => {
  resetJournalWriter();
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  resetJournalWriter();
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

describe("initJournalPath", () => {
  it("returns default path when no override", () => {
    const result = initJournalPath();
    expect(result).toMatch(/^\/tmp\/openclaw\/journal-\d{4}-\d{2}-\d{2}\.log$/);
    expect(getJournalFilePath()).toBe(result);
  });

  it("uses override path when provided", () => {
    const custom = path.join(TEST_DIR, "custom.log");
    const result = initJournalPath(custom);
    expect(result).toBe(custom);
    expect(getJournalFilePath()).toBe(custom);
  });
});

describe("writeJournalEntry", () => {
  it("appends JSONL to the journal file", () => {
    const filePath = path.join(TEST_DIR, "test.log");
    initJournalPath(filePath);

    const entry: ToolJournalEntry = {
      ts: "2025-01-01T00:00:00.000Z",
      phase: "start",
      runId: "run-1",
      seq: 1,
      toolName: "exec",
      toolCallId: "call-1",
      args: { command: "ls" },
    };
    writeJournalEntry(entry);

    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.toolName).toBe("exec");
    expect(parsed.args).toEqual({ command: "ls" });
  });

  it("appends multiple entries as separate lines", () => {
    const filePath = path.join(TEST_DIR, "multi.log");
    initJournalPath(filePath);

    const base: ToolJournalEntry = {
      ts: "2025-01-01T00:00:00.000Z",
      phase: "start",
      runId: "run-1",
      seq: 1,
      toolName: "exec",
      toolCallId: "call-1",
    };
    writeJournalEntry(base);
    writeJournalEntry({ ...base, phase: "result", seq: 2 });

    const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).phase).toBe("start");
    expect(JSON.parse(lines[1]).phase).toBe("result");
  });

  it("does nothing when path not initialized", () => {
    resetJournalWriter();
    const entry: ToolJournalEntry = {
      ts: "2025-01-01T00:00:00.000Z",
      phase: "start",
      runId: "run-1",
      seq: 1,
      toolName: "exec",
      toolCallId: "call-1",
    };
    // Should not throw
    writeJournalEntry(entry);
  });
});

describe("pruneOldJournalFiles", () => {
  it("removes journal files older than retention period", () => {
    const oldFile = path.join(TEST_DIR, "journal-2020-01-01.log");
    const newFile = path.join(TEST_DIR, "journal-2025-01-01.log");
    const nonJournal = path.join(TEST_DIR, "other.log");

    fs.writeFileSync(oldFile, "old");
    fs.writeFileSync(newFile, "new");
    fs.writeFileSync(nonJournal, "keep");

    // Set old file mtime to the past
    const pastTime = new Date("2020-01-01");
    fs.utimesSync(oldFile, pastTime, pastTime);

    pruneOldJournalFiles(TEST_DIR, 1); // 1 hour retention

    expect(fs.existsSync(oldFile)).toBe(false);
    expect(fs.existsSync(newFile)).toBe(true);
    expect(fs.existsSync(nonJournal)).toBe(true);
  });

  it("does not throw on missing directory", () => {
    pruneOldJournalFiles("/nonexistent-dir-for-test", 72);
  });
});

describe("getJournalFilePath", () => {
  it("returns null before init", () => {
    expect(getJournalFilePath()).toBeNull();
  });

  it("returns path after init", () => {
    const filePath = path.join(TEST_DIR, "get-test.log");
    initJournalPath(filePath);
    expect(getJournalFilePath()).toBe(filePath);
  });
});
