import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAsyncWriteQueue, AsyncWriteQueue } from "./async-write-queue.js";

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "async-queue-test-"));
}

function cleanup(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("AsyncWriteQueue", () => {
  let dir: string;
  let queue: AsyncWriteQueue<{ ts: number; data: string }>;

  beforeEach(() => {
    dir = makeTempDir();
  });

  afterEach(async () => {
    await queue?.close();
    cleanup(dir);
  });

  it("enqueue is synchronous and non-blocking", () => {
    const filePath = path.join(dir, "events.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 0 });

    queue.enqueue({ ts: 1, data: "hello" });
    expect(queue.pending()).toBe(1);
  });

  it("drain flushes entries to JSONL file", () => {
    const filePath = path.join(dir, "events.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 0 });

    queue.enqueue({ ts: 1, data: "a" });
    queue.enqueue({ ts: 2, data: "b" });

    const written = queue.drain();
    expect(written).toBe(2);
    expect(queue.pending()).toBe(0);

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual({ ts: 1, data: "a" });
    expect(JSON.parse(lines[1])).toEqual({ ts: 2, data: "b" });
  });

  it("appends to existing file on subsequent flushes", () => {
    const filePath = path.join(dir, "events.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 0 });

    queue.enqueue({ ts: 1, data: "first" });
    queue.drain();

    queue.enqueue({ ts: 2, data: "second" });
    queue.drain();

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(2);
  });

  it("close drains all remaining entries", async () => {
    const filePath = path.join(dir, "events.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 60_000 });

    queue.enqueue({ ts: 1, data: "pending" });
    await queue.close();

    const raw = fs.readFileSync(filePath, "utf-8");
    expect(raw.trim()).not.toBe("");
    expect(JSON.parse(raw.trim())).toEqual({ ts: 1, data: "pending" });
  });

  it("periodic flush writes entries automatically", async () => {
    const filePath = path.join(dir, "events.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 50 });

    queue.enqueue({ ts: 1, data: "auto" });

    await new Promise((r) => setTimeout(r, 150));

    const raw = fs.readFileSync(filePath, "utf-8");
    expect(raw.trim()).not.toBe("");
  });

  it("force-flushes when maxBufferSize exceeded", () => {
    const filePath = path.join(dir, "events.jsonl");
    queue = createAsyncWriteQueue({
      filePath,
      flushIntervalMs: 60_000,
      maxBufferSize: 3,
    });

    queue.enqueue({ ts: 1, data: "a" });
    queue.enqueue({ ts: 2, data: "b" });
    // This third enqueue should trigger an immediate flush
    queue.enqueue({ ts: 3, data: "c" });

    expect(queue.pending()).toBe(0);
    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(3);
  });

  it("ignores enqueue after close", async () => {
    const filePath = path.join(dir, "events.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 0 });

    await queue.close();
    queue.enqueue({ ts: 1, data: "ignored" });
    expect(queue.pending()).toBe(0);
  });

  it("creates parent directories if needed", () => {
    const filePath = path.join(dir, "nested", "deep", "events.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 0 });

    queue.enqueue({ ts: 1, data: "nested" });
    queue.drain();

    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("calls onFlushError on write failure", async () => {
    // Use a path that will fail (directory as file)
    const dirAsFile = path.join(dir, "cantwrite");
    fs.mkdirSync(dirAsFile, { recursive: true });

    const errors: unknown[] = [];
    queue = createAsyncWriteQueue({
      filePath: dirAsFile, // directory, not a file — will fail
      flushIntervalMs: 0,
      onFlushError: (e) => errors.push(e),
    });

    queue.enqueue({ ts: 1, data: "fail" });
    queue.drain();

    expect(errors.length).toBe(1);
    // Entries should be kept in buffer for retry
    expect(queue.pending()).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Edge cases & contract hardening
  // ---------------------------------------------------------------------------

  it("drain on empty buffer returns 0", () => {
    const filePath = path.join(dir, "events.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 0 });

    expect(queue.drain()).toBe(0);
    // File should not be created for empty drain
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("multiple sequential drains accumulate in the file", () => {
    const filePath = path.join(dir, "events.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 0 });

    queue.enqueue({ ts: 1, data: "batch1-a" });
    queue.enqueue({ ts: 2, data: "batch1-b" });
    expect(queue.drain()).toBe(2);

    queue.enqueue({ ts: 3, data: "batch2-a" });
    expect(queue.drain()).toBe(1);

    queue.enqueue({ ts: 4, data: "batch3-a" });
    queue.enqueue({ ts: 5, data: "batch3-b" });
    queue.enqueue({ ts: 6, data: "batch3-c" });
    expect(queue.drain()).toBe(3);

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(6);
    expect(JSON.parse(lines[0])).toEqual({ ts: 1, data: "batch1-a" });
    expect(JSON.parse(lines[5])).toEqual({ ts: 6, data: "batch3-c" });
  });

  it("close is idempotent — second close does not throw", async () => {
    const filePath = path.join(dir, "events.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 0 });

    queue.enqueue({ ts: 1, data: "once" });
    await queue.close();
    await queue.close(); // should not throw or double-write

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(1);
  });

  it("flush error recovery: entries are retained and flushed on retry", () => {
    const dirAsFile = path.join(dir, "cantwrite");
    fs.mkdirSync(dirAsFile, { recursive: true });

    const errors: unknown[] = [];
    queue = createAsyncWriteQueue({
      filePath: dirAsFile,
      flushIntervalMs: 0,
      onFlushError: (e) => errors.push(e),
    });

    queue.enqueue({ ts: 1, data: "retry-me" });
    queue.drain(); // fails
    expect(queue.pending()).toBe(1);
    expect(errors).toHaveLength(1);

    // Fix the path by removing directory and allowing a file write
    fs.rmdirSync(dirAsFile);
    // On next drain, entries should be successfully written
    expect(queue.drain()).toBe(1);
    expect(queue.pending()).toBe(0);

    const raw = fs.readFileSync(dirAsFile, "utf-8");
    expect(JSON.parse(raw.trim())).toEqual({ ts: 1, data: "retry-me" });
  });

  it("handles entries with special characters in JSONL", () => {
    const filePath = path.join(dir, "special.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 0 });

    queue.enqueue({ ts: 1, data: 'quotes"and\\backslash' });
    queue.enqueue({ ts: 2, data: "unicode: \u00e9\u00e0\u00fc\u{1f600}" });
    queue.enqueue({ ts: 3, data: "tab\there" });
    queue.drain();

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(3);

    const parsed0 = JSON.parse(lines[0]);
    expect(parsed0.data).toBe('quotes"and\\backslash');

    const parsed1 = JSON.parse(lines[1]);
    expect(parsed1.data).toContain("\u00e9");

    const parsed2 = JSON.parse(lines[2]);
    expect(parsed2.data).toBe("tab\there");
  });

  it("flushes large batches correctly", () => {
    const filePath = path.join(dir, "large.jsonl");
    queue = createAsyncWriteQueue({
      filePath,
      flushIntervalMs: 0,
      maxBufferSize: 2000,
    });

    for (let i = 0; i < 1000; i++) {
      queue.enqueue({ ts: i, data: `entry-${i}` });
    }
    expect(queue.drain()).toBe(1000);

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(1000);

    // Verify first and last
    expect(JSON.parse(lines[0])).toEqual({ ts: 0, data: "entry-0" });
    expect(JSON.parse(lines[999])).toEqual({ ts: 999, data: "entry-999" });
  });

  it("each JSONL line is terminated with newline", () => {
    const filePath = path.join(dir, "newlines.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 0 });

    queue.enqueue({ ts: 1, data: "a" });
    queue.drain();

    const raw = fs.readFileSync(filePath, "utf-8");
    // Should end with exactly one newline
    expect(raw.endsWith("\n")).toBe(true);
    expect(raw.endsWith("\n\n")).toBe(false);
  });

  it("pending() reflects accurate count through enqueue/drain cycles", () => {
    const filePath = path.join(dir, "pending.jsonl");
    queue = createAsyncWriteQueue({ filePath, flushIntervalMs: 0 });

    expect(queue.pending()).toBe(0);

    queue.enqueue({ ts: 1, data: "a" });
    expect(queue.pending()).toBe(1);

    queue.enqueue({ ts: 2, data: "b" });
    expect(queue.pending()).toBe(2);

    queue.drain();
    expect(queue.pending()).toBe(0);

    queue.enqueue({ ts: 3, data: "c" });
    expect(queue.pending()).toBe(1);
  });

  it("maxBufferSize of 1 flushes on every enqueue", () => {
    const filePath = path.join(dir, "max1.jsonl");
    queue = createAsyncWriteQueue({
      filePath,
      flushIntervalMs: 60_000,
      maxBufferSize: 1,
    });

    queue.enqueue({ ts: 1, data: "a" });
    expect(queue.pending()).toBe(0); // should have flushed immediately

    queue.enqueue({ ts: 2, data: "b" });
    expect(queue.pending()).toBe(0);

    const raw = fs.readFileSync(filePath, "utf-8");
    const lines = raw.trim().split("\n");
    expect(lines).toHaveLength(2);
  });
});
