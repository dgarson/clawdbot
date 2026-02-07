import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMemorySearchManager } from "./index.js";

vi.mock("./embeddings.js", () => ({
  createEmbeddingProvider: async () => ({
    requestedProvider: "openai",
    provider: {
      id: "openai",
      model: "text-embedding-3-small",
      embedQuery: async () => [0.1, 0.2, 0.3],
      embedBatch: async () => [],
    },
    openAi: {
      baseUrl: "https://api.openai.com/v1",
      headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
      model: "text-embedding-3-small",
    },
  }),
}));

describe("MemoryIndexManager session delta counting", () => {
  const previousStateDir = process.env.OPENCLAW_STATE_DIR;
  let tmpRoot: string;
  let workspaceDir: string;
  let stateDir: string;

  beforeEach(async () => {
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), "openclaw-mem-delta-"));
    workspaceDir = path.join(tmpRoot, "workspace");
    stateDir = path.join(tmpRoot, "state");
    await fs.mkdir(path.join(workspaceDir, "memory"), { recursive: true });
    await fs.mkdir(path.join(stateDir, "agents", "main", "sessions"), { recursive: true });
    process.env.OPENCLAW_STATE_DIR = stateDir;
  });

  afterEach(async () => {
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    await fs.rm(tmpRoot, { recursive: true, force: true });
  });

  it("counts only message records (not log lines) when tracking session deltas", async () => {
    const indexPath = path.join(workspaceDir, "index.sqlite");
    const cfg = {
      agents: {
        defaults: {
          workspace: workspaceDir,
          memorySearch: {
            provider: "openai",
            model: "text-embedding-3-small",
            experimental: { sessionMemory: true },
            sources: ["sessions"],
            store: { path: indexPath },
            sync: {
              watch: false,
              onSessionStart: false,
              onSearch: false,
              sessions: { deltaBytes: 0, deltaMessages: 1 },
            },
            query: { minScore: 0 },
          },
        },
        list: [{ id: "main", default: true }],
      },
    };

    const result = await getMemorySearchManager({ cfg, agentId: "main" });
    expect(result.manager).not.toBeNull();
    if (!result.manager) {
      throw new Error("manager missing");
    }
    const manager = result.manager as unknown as {
      close: () => Promise<void>;
      updateSessionDelta: (sessionFile: string) => Promise<{
        pendingMessages: number;
        pendingBytes: number;
      } | null>;
    };

    const sessionFile = path.join(stateDir, "agents", "main", "sessions", "session.jsonl");
    const logLine = JSON.stringify({
      time: "2026-02-04T20:19:44.295Z",
      level: "trace",
      subsystem: "memory",
      message: "shouldRunMemoryFlush: no tokens, skip",
    });

    await fs.writeFile(sessionFile, Array.from({ length: 250 }, () => logLine).join("\n") + "\n");
    const first = await manager.updateSessionDelta(sessionFile);
    expect(first).not.toBeNull();
    expect(first?.pendingMessages).toBe(0);

    const messageLine = JSON.stringify({
      type: "message",
      message: {
        role: "user",
        content: [{ type: "text", text: "hello" }],
      },
    });
    await fs.appendFile(
      sessionFile,
      Array.from({ length: 200 }, () => logLine).join("\n") + `\n${messageLine}\n`,
    );

    const second = await manager.updateSessionDelta(sessionFile);
    expect(second).not.toBeNull();
    expect(second?.pendingMessages).toBe(1);

    await manager.close();
  });
});
