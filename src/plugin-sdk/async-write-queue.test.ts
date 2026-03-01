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
});
