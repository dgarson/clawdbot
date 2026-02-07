import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitAgentEvent } from "../agent-events.js";
import {
  startJournalSubscriber,
  stopJournalSubscriber,
  getJournalFilePath,
} from "./journal-subscriber.js";

const TEST_DIR = path.join("/tmp", "openclaw-journal-sub-test-" + process.pid);

beforeEach(() => {
  stopJournalSubscriber();
  fs.mkdirSync(TEST_DIR, { recursive: true });
});

afterEach(() => {
  stopJournalSubscriber();
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

function readJournalLines(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}

describe("startJournalSubscriber", () => {
  it("writes tool start events to the journal file", () => {
    const filePath = path.join(TEST_DIR, "sub-start.log");
    startJournalSubscriber({ file: filePath });

    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: { name: "exec", callId: "call-1", phase: "start", input: { command: "ls -la" } },
    });

    const lines = readJournalLines(filePath);
    expect(lines).toHaveLength(1);
    expect(lines[0].phase).toBe("start");
    expect(lines[0].toolName).toBe("exec");
    expect(lines[0].args).toEqual({ command: "ls -la" });
  });

  it("writes result events with duration", () => {
    const filePath = path.join(TEST_DIR, "sub-result.log");
    startJournalSubscriber({ file: filePath });

    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: { name: "exec", callId: "call-2", phase: "start", input: { command: "echo hi" } },
    });
    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: { name: "exec", callId: "call-2", phase: "end", output: "hi\n" },
    });

    const lines = readJournalLines(filePath);
    expect(lines).toHaveLength(2);
    expect(lines[1].phase).toBe("result");
    expect(lines[1].result).toBe("hi\n");
    expect(typeof lines[1].durationMs).toBe("number");
  });

  it("filters by default tool list", () => {
    const filePath = path.join(TEST_DIR, "sub-filter.log");
    startJournalSubscriber({ file: filePath });

    // "exec" is in default list
    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: { name: "exec", callId: "c1", phase: "start", input: {} },
    });
    // "web_search" is NOT in default list
    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: { name: "web_search", callId: "c2", phase: "start", input: {} },
    });

    const lines = readJournalLines(filePath);
    expect(lines).toHaveLength(1);
    expect(lines[0].toolName).toBe("exec");
  });

  it("captures all tools with wildcard filter", () => {
    const filePath = path.join(TEST_DIR, "sub-wildcard.log");
    startJournalSubscriber({ file: filePath, toolFilter: ["*"] });

    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: { name: "web_search", callId: "c1", phase: "start", input: {} },
    });

    const lines = readJournalLines(filePath);
    expect(lines).toHaveLength(1);
    expect(lines[0].toolName).toBe("web_search");
  });

  it("ignores non-tool events", () => {
    const filePath = path.join(TEST_DIR, "sub-ignore.log");
    startJournalSubscriber({ file: filePath, toolFilter: ["*"] });

    emitAgentEvent({
      runId: "run-1",
      stream: "lifecycle",
      data: { phase: "start" },
    });

    const lines = readJournalLines(filePath);
    expect(lines).toHaveLength(0);
  });

  it("truncates results when maxResultChars is set", () => {
    const filePath = path.join(TEST_DIR, "sub-truncate.log");
    startJournalSubscriber({ file: filePath, maxResultChars: 10 });

    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: { name: "exec", callId: "c1", phase: "end", output: "a".repeat(100) },
    });

    const lines = readJournalLines(filePath);
    expect(lines).toHaveLength(1);
    expect(lines[0].result).toBe("a".repeat(10) + "... [truncated]");
  });

  it("marks error results with isError", () => {
    const filePath = path.join(TEST_DIR, "sub-error.log");
    startJournalSubscriber({ file: filePath });

    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: { name: "exec", callId: "c1", phase: "end", error: "command failed" },
    });

    const lines = readJournalLines(filePath);
    expect(lines).toHaveLength(1);
    expect(lines[0].isError).toBe(true);
    expect(lines[0].result).toBe("command failed");
  });

  it("redacts sensitive args when redactSensitive is true", () => {
    const filePath = path.join(TEST_DIR, "sub-redact.log");
    startJournalSubscriber({ file: filePath, redactSensitive: true });

    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: {
        name: "exec",
        callId: "c1",
        phase: "start",
        input: { command: "curl", apiKey: "sk-secret-123" },
      },
    });

    const lines = readJournalLines(filePath);
    expect(lines).toHaveLength(1);
    expect(lines[0].args.command).toBe("curl");
    expect(lines[0].args.apiKey).toBe("[REDACTED]");
  });

  it("does not start when enabled is false", () => {
    const filePath = path.join(TEST_DIR, "sub-disabled.log");
    startJournalSubscriber({ file: filePath, enabled: false });

    expect(getJournalFilePath()).toBeNull();
  });
});

describe("stopJournalSubscriber", () => {
  it("stops receiving events after stop", () => {
    const filePath = path.join(TEST_DIR, "sub-stop.log");
    startJournalSubscriber({ file: filePath });

    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: { name: "exec", callId: "c1", phase: "start", input: {} },
    });
    expect(readJournalLines(filePath)).toHaveLength(1);

    stopJournalSubscriber();

    emitAgentEvent({
      runId: "run-1",
      stream: "tool",
      data: { name: "exec", callId: "c2", phase: "start", input: {} },
    });
    // File still has just 1 line
    expect(readJournalLines(filePath)).toHaveLength(1);
    expect(getJournalFilePath()).toBeNull();
  });
});
