import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawPluginCliContext } from "../../../../src/plugins/types.js";
import type { OrchestratorSessionState } from "../types.js";
import { registerAgentCommands } from "./agents.js";
import { buildTree } from "./hierarchy.js";
import { clearSessions, formatRelativeTime, readAllSessions, writeSession } from "./shared.js";

// ── fixtures ────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<OrchestratorSessionState> = {}): OrchestratorSessionState {
  return {
    role: "builder",
    depth: 2,
    status: "active",
    lastActivity: Date.now(),
    taskDescription: "implement feature",
    ...overrides,
  };
}

function makeCtx(stateDir: string): OpenClawPluginCliContext {
  return {
    program: new Command(),
    config: {
      agents: { defaults: { workspace: stateDir } },
    } as OpenClawPluginCliContext["config"],
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  };
}

function writeFixture(stateDir: string, key: string, state: OrchestratorSessionState): void {
  const dir = path.join(stateDir, "agent-orchestrator");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(state));
}

// ── test setup ──────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = mkdtempSync(path.join(os.tmpdir(), "orch-cli-test-"));
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── shared helpers ──────────────────────────────────────────────────────────

describe("formatRelativeTime", () => {
  it("returns 'just now' for < 1s", () => {
    expect(formatRelativeTime(500)).toBe("just now");
    expect(formatRelativeTime(0)).toBe("just now");
  });

  it("returns seconds for < 60s", () => {
    expect(formatRelativeTime(5_000)).toBe("5s ago");
    expect(formatRelativeTime(59_000)).toBe("59s ago");
  });

  it("returns minutes for < 60m", () => {
    expect(formatRelativeTime(120_000)).toBe("2m ago");
    expect(formatRelativeTime(3_540_000)).toBe("59m ago");
  });

  it("returns hours + minutes", () => {
    expect(formatRelativeTime(3_600_000)).toBe("1h 0m ago");
    expect(formatRelativeTime(7_260_000)).toBe("2h 1m ago");
  });

  it("returns days + hours for >= 24h", () => {
    expect(formatRelativeTime(86_400_000)).toBe("1d 0h ago");
    expect(formatRelativeTime(90_000_000)).toBe("1d 1h ago");
  });
});

describe("readAllSessions", () => {
  it("returns empty map when dir does not exist", () => {
    const sessions = readAllSessions(path.join(tmpDir, "nonexistent"));
    expect(sessions.size).toBe(0);
  });

  it("reads session files from disk", () => {
    writeFixture(tmpDir, "session-a", makeSession({ role: "orchestrator" }));
    writeFixture(tmpDir, "session-b", makeSession({ role: "scout" }));

    const sessions = readAllSessions(tmpDir);
    expect(sessions.size).toBe(2);
    expect(sessions.get("session-a")?.role).toBe("orchestrator");
    expect(sessions.get("session-b")?.role).toBe("scout");
  });

  it("skips non-json files", () => {
    const dir = path.join(tmpDir, "agent-orchestrator");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "notes.txt"), "not a session");
    writeFixture(tmpDir, "real-session", makeSession());

    const sessions = readAllSessions(tmpDir);
    expect(sessions.size).toBe(1);
    expect(sessions.has("real-session")).toBe(true);
  });

  it("skips corrupt JSON files", () => {
    const dir = path.join(tmpDir, "agent-orchestrator");
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "corrupt.json"), "{bad json!!!");
    writeFixture(tmpDir, "good", makeSession());

    const sessions = readAllSessions(tmpDir);
    expect(sessions.size).toBe(1);
    expect(sessions.has("good")).toBe(true);
  });
});

describe("writeSession", () => {
  it("creates dir and writes session file", () => {
    const state = makeSession({ role: "lead" });
    writeSession(tmpDir, "new-session", state);

    const raw = readFileSync(path.join(tmpDir, "agent-orchestrator", "new-session.json"), "utf-8");
    const parsed = JSON.parse(raw);
    expect(parsed.role).toBe("lead");
  });

  it("overwrites existing session", () => {
    writeFixture(tmpDir, "existing", makeSession({ status: "active" }));
    writeSession(tmpDir, "existing", makeSession({ status: "stale" }));

    const sessions = readAllSessions(tmpDir);
    expect(sessions.get("existing")?.status).toBe("stale");
  });
});

describe("clearSessions", () => {
  it("removes all sessions", () => {
    writeFixture(tmpDir, "a", makeSession({ status: "active" }));
    writeFixture(tmpDir, "b", makeSession({ status: "completed" }));
    writeFixture(tmpDir, "c", makeSession({ status: "stale" }));

    const removed = clearSessions(tmpDir, false);
    expect(removed).toBe(3);
    expect(readAllSessions(tmpDir).size).toBe(0);
  });

  it("keeps completed sessions when keepCompleted is true", () => {
    writeFixture(tmpDir, "active-one", makeSession({ status: "active" }));
    writeFixture(tmpDir, "done", makeSession({ status: "completed" }));
    writeFixture(tmpDir, "stale-one", makeSession({ status: "stale" }));

    const removed = clearSessions(tmpDir, true);
    expect(removed).toBe(2);
    const remaining = readAllSessions(tmpDir);
    expect(remaining.size).toBe(1);
    expect(remaining.has("done")).toBe(true);
  });

  it("returns 0 when dir does not exist", () => {
    const removed = clearSessions(path.join(tmpDir, "nope"), false);
    expect(removed).toBe(0);
  });
});

// ── buildTree ───────────────────────────────────────────────────────────────

describe("buildTree", () => {
  it("returns empty array for no sessions", () => {
    const roots = buildTree(new Map());
    expect(roots).toHaveLength(0);
  });

  it("builds a single root with no children", () => {
    const sessions = new Map<string, OrchestratorSessionState>([
      ["root", makeSession({ role: "orchestrator", depth: 0 })],
    ]);
    const roots = buildTree(sessions);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.sessionKey).toBe("root");
    expect(roots[0]!.children).toHaveLength(0);
  });

  it("links children to parents correctly", () => {
    const sessions = new Map<string, OrchestratorSessionState>([
      ["orch", makeSession({ role: "orchestrator", depth: 0 })],
      [
        "lead-1",
        makeSession({
          role: "lead",
          depth: 1,
          parentSessionKey: "orch",
        }),
      ],
      [
        "builder-1",
        makeSession({
          role: "builder",
          depth: 2,
          parentSessionKey: "lead-1",
        }),
      ],
      [
        "scout-1",
        makeSession({
          role: "scout",
          depth: 2,
          parentSessionKey: "lead-1",
        }),
      ],
    ]);

    const roots = buildTree(sessions);
    expect(roots).toHaveLength(1);
    expect(roots[0]!.sessionKey).toBe("orch");
    expect(roots[0]!.children).toHaveLength(1);

    const lead = roots[0]!.children[0]!;
    expect(lead.sessionKey).toBe("lead-1");
    expect(lead.children).toHaveLength(2);
  });

  it("treats orphans as roots", () => {
    const sessions = new Map<string, OrchestratorSessionState>([
      [
        "orphan",
        makeSession({
          role: "builder",
          parentSessionKey: "missing-parent",
        }),
      ],
      ["root", makeSession({ role: "orchestrator" })],
    ]);

    const roots = buildTree(sessions);
    expect(roots).toHaveLength(2);
    const keys = roots.map((r) => r.sessionKey).sort();
    expect(keys).toEqual(["orphan", "root"]);
  });
});

// ── agent commands (status, inspect, kill, reset) ───────────────────────────

describe("agent commands", () => {
  function createTestProgram(stateDir: string) {
    const ctx = makeCtx(stateDir);
    const program = new Command();
    program.exitOverride();

    const captured: string[] = [];
    const errCaptured: string[] = [];

    // Capture stdout/stderr writes
    const stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        captured.push(String(chunk));
        return true;
      });
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: string | Uint8Array) => {
        errCaptured.push(String(chunk));
        return true;
      });

    const parent = program.command("orchestrator");
    registerAgentCommands(parent, ctx);

    return {
      program,
      captured,
      errCaptured,
      cleanup: () => {
        stdoutSpy.mockRestore();
        stderrSpy.mockRestore();
      },
    };
  }

  it("status shows 'no sessions' when empty", async () => {
    const { program, captured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync(["node", "test", "orchestrator", "status"]);
      expect(captured.join("")).toContain("No agent sessions found");
    } finally {
      cleanup();
    }
  });

  it("status lists sessions in table format", async () => {
    writeFixture(
      tmpDir,
      "sess-1",
      makeSession({ role: "orchestrator", depth: 0, status: "active" }),
    );
    writeFixture(tmpDir, "sess-2", makeSession({ role: "builder", depth: 2, status: "completed" }));

    const { program, captured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync(["node", "test", "orchestrator", "status"]);
      const output = captured.join("");
      expect(output).toContain("sess-1");
      expect(output).toContain("sess-2");
      expect(output).toContain("orchestrator");
      expect(output).toContain("builder");
      expect(output).toContain("Total: 2 session(s)");
    } finally {
      cleanup();
    }
  });

  it("status --active-only filters completed sessions", async () => {
    writeFixture(tmpDir, "active-1", makeSession({ status: "active" }));
    writeFixture(tmpDir, "done-1", makeSession({ status: "completed" }));

    const { program, captured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync(["node", "test", "orchestrator", "status", "--active-only"]);
      const output = captured.join("");
      expect(output).toContain("active-1");
      expect(output).not.toContain("done-1");
      expect(output).toContain("Total: 1 session(s)");
    } finally {
      cleanup();
    }
  });

  it("status --json outputs valid JSON", async () => {
    writeFixture(tmpDir, "json-sess", makeSession({ role: "scout", status: "active" }));

    const { program, captured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync(["node", "test", "orchestrator", "status", "--json"]);
      const parsed = JSON.parse(captured.join(""));
      expect(parsed["json-sess"]).toBeDefined();
      expect(parsed["json-sess"].role).toBe("scout");
    } finally {
      cleanup();
    }
  });

  it("inspect shows detail for a valid session", async () => {
    writeFixture(
      tmpDir,
      "detail-sess",
      makeSession({
        role: "builder",
        depth: 2,
        status: "active",
        parentSessionKey: "parent-key",
        taskDescription: "build the thing",
        fileScope: ["src/foo.ts", "src/bar.ts"],
      }),
    );

    const { program, captured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync(["node", "test", "orchestrator", "inspect", "detail-sess"]);
      const output = captured.join("");
      expect(output).toContain("detail-sess");
      expect(output).toContain("builder");
      expect(output).toContain("parent-key");
      expect(output).toContain("build the thing");
      expect(output).toContain("src/foo.ts");
    } finally {
      cleanup();
    }
  });

  it("inspect errors for unknown session", async () => {
    const { program, errCaptured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync(["node", "test", "orchestrator", "inspect", "nonexistent"]);
      expect(errCaptured.join("")).toContain("not found");
    } finally {
      cleanup();
    }
  });

  it("inspect --json outputs valid JSON", async () => {
    writeFixture(tmpDir, "json-detail", makeSession({ role: "reviewer", status: "active" }));

    const { program, captured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync([
        "node",
        "test",
        "orchestrator",
        "inspect",
        "json-detail",
        "--json",
      ]);
      const parsed = JSON.parse(captured.join(""));
      expect(parsed.sessionKey).toBe("json-detail");
      expect(parsed.role).toBe("reviewer");
    } finally {
      cleanup();
    }
  });

  it("kill marks a session as stale", async () => {
    writeFixture(tmpDir, "kill-target", makeSession({ status: "active" }));

    const { program, captured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync(["node", "test", "orchestrator", "kill", "kill-target"]);
      expect(captured.join("")).toContain("Marked session");
      expect(captured.join("")).toContain("stale");

      // Verify on disk
      const sessions = readAllSessions(tmpDir);
      expect(sessions.get("kill-target")?.status).toBe("stale");
    } finally {
      cleanup();
    }
  });

  it("kill with --reason includes reason in output", async () => {
    writeFixture(tmpDir, "kill-reason", makeSession({ status: "active" }));

    const { program, captured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync([
        "node",
        "test",
        "orchestrator",
        "kill",
        "kill-reason",
        "--reason",
        "timed out",
      ]);
      expect(captured.join("")).toContain("timed out");
    } finally {
      cleanup();
    }
  });

  it("kill errors for unknown session", async () => {
    const { program, errCaptured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync(["node", "test", "orchestrator", "kill", "ghost"]);
      expect(errCaptured.join("")).toContain("not found");
    } finally {
      cleanup();
    }
  });

  it("reset requires --confirm", async () => {
    writeFixture(tmpDir, "sess", makeSession());

    const { program, errCaptured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync(["node", "test", "orchestrator", "reset"]);
      expect(errCaptured.join("")).toContain("--confirm");

      // Session should still exist
      expect(readAllSessions(tmpDir).size).toBe(1);
    } finally {
      cleanup();
    }
  });

  it("reset --confirm clears all sessions", async () => {
    writeFixture(tmpDir, "a", makeSession({ status: "active" }));
    writeFixture(tmpDir, "b", makeSession({ status: "completed" }));

    const { program, captured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync(["node", "test", "orchestrator", "reset", "--confirm"]);
      expect(captured.join("")).toContain("Cleared 2 session(s)");
      expect(readAllSessions(tmpDir).size).toBe(0);
    } finally {
      cleanup();
    }
  });

  it("reset --confirm --keep-completed preserves completed", async () => {
    writeFixture(tmpDir, "active", makeSession({ status: "active" }));
    writeFixture(tmpDir, "done", makeSession({ status: "completed" }));

    const { program, captured, cleanup } = createTestProgram(tmpDir);
    try {
      await program.parseAsync([
        "node",
        "test",
        "orchestrator",
        "reset",
        "--confirm",
        "--keep-completed",
      ]);
      expect(captured.join("")).toContain("Cleared 1 session(s)");
      expect(captured.join("")).toContain("kept completed");

      const remaining = readAllSessions(tmpDir);
      expect(remaining.size).toBe(1);
      expect(remaining.has("done")).toBe(true);
    } finally {
      cleanup();
    }
  });
});
