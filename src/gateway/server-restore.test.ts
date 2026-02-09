import fs from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VerboseLevel } from "../auto-reply/thinking.js";
import type { ChatRunEntry, ChatRunRegistry } from "./server-chat.js";
import { type ChatAbortControllerEntry } from "./chat-abort.js";
import {
  CHAT_RUNS_STATE_PATH,
  persistChatRunState,
  clearPersistedChatRunState,
  type PersistedChatRun,
  GATEWAY_STATE_DIR,
} from "./server-persist.js";
import { restoreChatRunState, broadcastRecoveryEvents } from "./server-restore.js";

describe("restoreChatRunState", () => {
  beforeEach(async () => {
    await fs.promises.mkdir(GATEWAY_STATE_DIR, { recursive: true });
    await clearPersistedChatRunState();
  });

  afterEach(async () => {
    await clearPersistedChatRunState();
  });

  const createMockTarget = () => {
    const registryData = new Map<string, ChatRunEntry[]>();

    const registry: ChatRunRegistry = {
      add: (sessionId, entry) => {
        const queue = registryData.get(sessionId) ?? [];
        queue.push(entry);
        registryData.set(sessionId, queue);
      },
      peek: (sessionId) => registryData.get(sessionId)?.[0],
      shift: (sessionId) => {
        const queue = registryData.get(sessionId);
        return queue?.shift();
      },
      remove: (sessionId, clientRunId) => {
        const queue = registryData.get(sessionId);
        if (!queue) {
          return undefined;
        }
        const idx = queue.findIndex((e) => e.clientRunId === clientRunId);
        if (idx < 0) {
          return undefined;
        }
        const [entry] = queue.splice(idx, 1);
        return entry;
      },
      clear: () => registryData.clear(),
    };

    const chatAbortControllers = new Map<string, ChatAbortControllerEntry>();
    const chatRunBuffers = new Map<string, string>();
    const chatDeltaSentAt = new Map<string, number>();
    const agentRunSeq = new Map<string, number>();
    const agentContexts = new Map<
      string,
      { sessionKey?: string; verboseLevel?: VerboseLevel; isHeartbeat?: boolean }
    >();

    return {
      chatRunRegistry: registry,
      registryData,
      chatAbortControllers,
      chatRunBuffers,
      chatDeltaSentAt,
      agentRunSeq,
      registerAgentRunContext: (
        runId: string,
        context: { sessionKey?: string; verboseLevel?: VerboseLevel; isHeartbeat?: boolean },
      ) => {
        agentContexts.set(runId, context);
      },
      agentContexts,
    };
  };

  const createMockLog = () => ({
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  });

  it("restores persisted runs to target state", async () => {
    const now = Date.now();
    const runs: PersistedChatRun[] = [
      {
        sessionId: "session-1",
        clientRunId: "run-1",
        sessionKey: "test-session",
        startedAtMs: now - 1000,
        expiresAtMs: now + 300000,
        lastSeq: 5,
        textBuffer: "Hello world",
        lastDeltaSentAtMs: now - 50,
        agentContext: { sessionKey: "test-session" },
        lastActivityMs: now,
      },
    ];

    await persistChatRunState(runs);

    const target = createMockTarget();
    const log = createMockLog();

    const result = await restoreChatRunState(target, log);

    expect(result.restoredCount).toBe(1);
    expect(result.skippedCount).toBe(0);
    expect(result.affectedSessionKeys).toContain("test-session");

    // Check registry was populated
    expect(target.registryData.get("session-1")).toHaveLength(1);
    expect(target.registryData.get("session-1")?.[0].clientRunId).toBe("run-1");

    // Check buffers were restored
    expect(target.chatRunBuffers.get("run-1")).toBe("Hello world");

    // Check abort controller was created
    expect(target.chatAbortControllers.has("run-1")).toBe(true);
    expect(target.chatAbortControllers.get("run-1")?.sessionKey).toBe("test-session");

    // Check agent run seq was restored
    expect(target.agentRunSeq.get("session-1")).toBe(5);

    // Check agent context was registered
    expect(target.agentContexts.has("session-1")).toBe(true);
  });

  it("skips expired runs", async () => {
    const now = Date.now();
    const runs: PersistedChatRun[] = [
      {
        sessionId: "session-expired",
        clientRunId: "run-expired",
        sessionKey: "expired-session",
        startedAtMs: now - 60000,
        expiresAtMs: now - 1000, // Already expired (used by restore)
        lastSeq: 3,
        textBuffer: "Old content",
        lastDeltaSentAtMs: now - 30000,
        agentContext: {},
        // Recent activity so it passes loadPersistedChatRunState staleness check
        lastActivityMs: now - 1000,
      },
    ];

    await persistChatRunState(runs);

    const target = createMockTarget();
    const log = createMockLog();

    const result = await restoreChatRunState(target, log);

    expect(result.restoredCount).toBe(0);
    expect(result.skippedCount).toBe(1);
    expect(target.chatAbortControllers.size).toBe(0);
  });

  it("clears persisted state after restore", async () => {
    const now = Date.now();
    const runs: PersistedChatRun[] = [
      {
        sessionId: "session-1",
        clientRunId: "run-1",
        sessionKey: "test-session",
        startedAtMs: now,
        expiresAtMs: now + 300000,
        lastSeq: 1,
        textBuffer: "",
        lastDeltaSentAtMs: 0,
        agentContext: {},
        lastActivityMs: now,
      },
    ];

    await persistChatRunState(runs);

    const target = createMockTarget();
    const log = createMockLog();

    await restoreChatRunState(target, log);

    // State file should be cleared
    const existsAfter = await fs.promises
      .access(CHAT_RUNS_STATE_PATH)
      .then(() => true)
      .catch(() => false);
    expect(existsAfter).toBe(false);
  });

  it("handles missing state file gracefully", async () => {
    await clearPersistedChatRunState();

    const target = createMockTarget();
    const log = createMockLog();

    const result = await restoreChatRunState(target, log);

    expect(result.restoredCount).toBe(0);
    expect(result.skippedCount).toBe(0);
  });
});

describe("broadcastRecoveryEvents", () => {
  it("broadcasts to all clients and affected sessions", () => {
    const broadcast = vi.fn();
    const nodeSendToSession = vi.fn();

    broadcastRecoveryEvents({
      affectedSessionKeys: ["session-1", "session-2"],
      broadcast,
      nodeSendToSession,
    });

    expect(broadcast).toHaveBeenCalledOnce();
    expect(broadcast).toHaveBeenCalledWith(
      "system",
      expect.objectContaining({
        event: "gateway.recovered",
        sessionKeys: ["session-1", "session-2"],
      }),
    );

    expect(nodeSendToSession).toHaveBeenCalledTimes(2);
    expect(nodeSendToSession).toHaveBeenCalledWith("session-1", "system", expect.any(Object));
    expect(nodeSendToSession).toHaveBeenCalledWith("session-2", "system", expect.any(Object));
  });

  it("does nothing when no affected sessions", () => {
    const broadcast = vi.fn();
    const nodeSendToSession = vi.fn();

    broadcastRecoveryEvents({
      affectedSessionKeys: [],
      broadcast,
      nodeSendToSession,
    });

    expect(broadcast).not.toHaveBeenCalled();
    expect(nodeSendToSession).not.toHaveBeenCalled();
  });
});
