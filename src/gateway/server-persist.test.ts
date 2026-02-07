import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  collectChatRunState,
  persistChatRunState,
  loadPersistedChatRunState,
  clearPersistedChatRunState,
  CHAT_RUNS_STATE_PATH,
  MAX_RUN_AGE_MS,
  type PersistedChatRun,
} from "./server-persist.js";

describe("collectChatRunState", () => {
  it("collects state from abort controllers", () => {
    const chatAbortControllers = new Map<
      string,
      {
        sessionId: string;
        sessionKey: string;
        startedAtMs: number;
        expiresAtMs: number;
      }
    >();

    chatAbortControllers.set("run-1", {
      sessionId: "session-1",
      sessionKey: "test-session",
      startedAtMs: Date.now() - 1000,
      expiresAtMs: Date.now() + 300000,
    });

    const chatRunBuffers = new Map<string, string>();
    chatRunBuffers.set("run-1", "Hello, this is a test response");

    const chatDeltaSentAt = new Map<string, number>();
    chatDeltaSentAt.set("run-1", Date.now() - 100);

    const agentRunSeq = new Map<string, number>();
    // agentRunSeq uses the runId (abort controller key) as the key
    agentRunSeq.set("run-1", 10);

    const runs = collectChatRunState({
      chatRunRegistry: {
        peek: (sessionId) =>
          sessionId === "session-1"
            ? { sessionKey: "test-session", clientRunId: "run-1" }
            : undefined,
      },
      getActiveSessions: () => ["session-1"],
      chatAbortControllers,
      chatRunBuffers,
      chatDeltaSentAt,
      agentRunSeq,
      getAgentRunContext: (runId) =>
        runId === "run-1" ? { sessionKey: "test-session" } : undefined,
    });

    expect(runs).toHaveLength(1);
    expect(runs[0].sessionId).toBe("session-1");
    expect(runs[0].clientRunId).toBe("run-1");
    expect(runs[0].sessionKey).toBe("test-session");
    expect(runs[0].textBuffer).toBe("Hello, this is a test response");
    expect(runs[0].lastSeq).toBe(10);
  });

  it("returns empty array when no active runs", () => {
    const runs = collectChatRunState({
      chatRunRegistry: { peek: () => undefined },
      getActiveSessions: () => [],
      chatAbortControllers: new Map(),
      chatRunBuffers: new Map(),
      chatDeltaSentAt: new Map(),
      agentRunSeq: new Map(),
      getAgentRunContext: () => undefined,
    });

    expect(runs).toHaveLength(0);
  });
});

describe("persistChatRunState and loadPersistedChatRunState", () => {
  const testDir = path.dirname(CHAT_RUNS_STATE_PATH);

  beforeEach(async () => {
    // Ensure test directory exists
    await fs.promises.mkdir(testDir, { recursive: true });
    // Clean up any existing state
    await clearPersistedChatRunState();
  });

  afterEach(async () => {
    await clearPersistedChatRunState();
  });

  it("persists and loads chat run state", async () => {
    const now = Date.now();
    const runs: PersistedChatRun[] = [
      {
        sessionId: "session-1",
        clientRunId: "run-1",
        sessionKey: "test-session",
        startedAtMs: now - 1000,
        expiresAtMs: now + 300000,
        lastSeq: 5,
        textBuffer: "Test response",
        lastDeltaSentAtMs: now - 50,
        agentContext: { sessionKey: "test-session" },
        lastActivityMs: now,
      },
    ];

    await persistChatRunState(runs);

    const loaded = await loadPersistedChatRunState();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].sessionId).toBe("session-1");
    expect(loaded[0].textBuffer).toBe("Test response");
  });

  it("filters out stale runs on load", async () => {
    const now = Date.now();
    const runs: PersistedChatRun[] = [
      {
        sessionId: "session-fresh",
        clientRunId: "run-fresh",
        sessionKey: "test-session",
        startedAtMs: now - 1000,
        expiresAtMs: now + 300000,
        lastSeq: 5,
        textBuffer: "Fresh",
        lastDeltaSentAtMs: now - 50,
        agentContext: {},
        lastActivityMs: now,
      },
      {
        sessionId: "session-stale",
        clientRunId: "run-stale",
        sessionKey: "test-session-stale",
        startedAtMs: now - MAX_RUN_AGE_MS - 60000,
        expiresAtMs: now - 60000,
        lastSeq: 3,
        textBuffer: "Stale",
        lastDeltaSentAtMs: now - MAX_RUN_AGE_MS - 30000,
        agentContext: {},
        lastActivityMs: now - MAX_RUN_AGE_MS - 1000,
      },
    ];

    await persistChatRunState(runs);

    const loaded = await loadPersistedChatRunState();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].sessionId).toBe("session-fresh");
  });

  it("returns empty array when no state file exists", async () => {
    await clearPersistedChatRunState();
    const loaded = await loadPersistedChatRunState();
    expect(loaded).toHaveLength(0);
  });
});

describe("clearPersistedChatRunState", () => {
  it("removes state file", async () => {
    const testDir = path.dirname(CHAT_RUNS_STATE_PATH);
    await fs.promises.mkdir(testDir, { recursive: true });

    const runs: PersistedChatRun[] = [
      {
        sessionId: "session-1",
        clientRunId: "run-1",
        sessionKey: "test-session",
        startedAtMs: Date.now(),
        expiresAtMs: Date.now() + 300000,
        lastSeq: 1,
        textBuffer: "",
        lastDeltaSentAtMs: 0,
        agentContext: {},
        lastActivityMs: Date.now(),
      },
    ];

    await persistChatRunState(runs);

    // Verify file exists
    const existsBefore = await fs.promises
      .access(CHAT_RUNS_STATE_PATH)
      .then(() => true)
      .catch(() => false);
    expect(existsBefore).toBe(true);

    await clearPersistedChatRunState();

    // Verify file is removed
    const existsAfter = await fs.promises
      .access(CHAT_RUNS_STATE_PATH)
      .then(() => true)
      .catch(() => false);
    expect(existsAfter).toBe(false);
  });

  it("does not throw when file does not exist", async () => {
    await clearPersistedChatRunState();
    await expect(clearPersistedChatRunState()).resolves.not.toThrow();
  });
});
