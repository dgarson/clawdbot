import { describe, it, expect } from "vitest";
import type { OrchestratorSessionState, OrchestratorConfig } from "../types.js";
import { DEFAULT_ORCHESTRATOR_CONFIG } from "../types.js";
import { createAgentStatusTool, formatElapsed } from "./agent-status.js";
import { createDecomposeTaskTool } from "./decompose-task.js";

// ---------------------------------------------------------------------------
// Mock store
// ---------------------------------------------------------------------------

function createMockStore(sessions: Map<string, OrchestratorSessionState> = new Map()) {
  return {
    get: (key: string) => sessions.get(key),
    update: (key: string, fn: (s: OrchestratorSessionState) => void) => {
      let s = sessions.get(key);
      if (!s) {
        s = {};
        sessions.set(key, s);
      }
      fn(s);
    },
    keys: () => [...sessions.keys()],
    flushAll: async () => {},
  };
}

function defaultConfig(
  overrides?: Partial<OrchestratorConfig["orchestration"]>,
): OrchestratorConfig {
  return {
    ...DEFAULT_ORCHESTRATOR_CONFIG,
    orchestration: {
      ...DEFAULT_ORCHESTRATOR_CONFIG.orchestration,
      ...overrides,
    },
  };
}

/** Extract the parsed JSON from a tool result. */
// oxlint-disable-next-line typescript/no-explicit-any
function parseResult(result: any): unknown {
  return JSON.parse(result.content[0].text);
}

// ===========================================================================
// decompose_task
// ===========================================================================

describe("decompose_task", () => {
  it("validates valid orchestrator -> lead decomposition", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("parent-1", { role: "orchestrator", depth: 0, status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "parent-1",
    });

    const result = await tool.execute("tc-1", {
      tasks: [{ role: "lead", task: "Handle auth module" }],
    });
    const data = parseResult(result) as any;

    expect(data.parentRole).toBe("orchestrator");
    expect(data.parentDepth).toBe(0);
    expect(data.tasks).toHaveLength(1);
    expect(data.tasks[0].valid).toBe(true);
    expect(data.tasks[0].role).toBe("lead");
  });

  it("validates valid lead -> scout/builder/reviewer decomposition", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("lead-1", { role: "lead", depth: 1, status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "lead-1",
    });

    const result = await tool.execute("tc-1", {
      tasks: [
        { role: "scout", task: "Explore auth patterns" },
        { role: "builder", task: "Implement login flow" },
        { role: "reviewer", task: "Review login flow" },
      ],
    });
    const data = parseResult(result) as any;

    expect(data.tasks).toHaveLength(3);
    expect(data.tasks.every((t: any) => t.valid)).toBe(true);
    expect(data.tasks.map((t: any) => t.role)).toEqual(["scout", "builder", "reviewer"]);
  });

  it("rejects orchestrator -> builder (hierarchy violation)", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("orch-1", { role: "orchestrator", depth: 0, status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "orch-1",
    });

    const result = await tool.execute("tc-1", {
      tasks: [{ role: "builder", task: "Build something" }],
    });
    const data = parseResult(result) as any;

    expect(data.tasks[0].valid).toBe(false);
    expect(data.tasks[0].reason).toContain("cannot spawn");
  });

  it("rejects lead -> lead (hierarchy violation)", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("lead-1", { role: "lead", depth: 1, status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "lead-1",
    });

    const result = await tool.execute("tc-1", {
      tasks: [{ role: "lead", task: "Another lead" }],
    });
    const data = parseResult(result) as any;

    expect(data.tasks[0].valid).toBe(false);
    expect(data.tasks[0].reason).toContain("cannot spawn");
  });

  it("rejects when max depth would be exceeded", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    // Lead at depth 2 with maxDepth=2 means child would be depth 3
    sessions.set("lead-deep", { role: "lead", depth: 2, status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig({ maxDepth: 2 }),
      sessionKey: "lead-deep",
    });

    const result = await tool.execute("tc-1", {
      tasks: [{ role: "scout", task: "Explore something" }],
    });
    const data = parseResult(result) as any;

    expect(data.tasks[0].valid).toBe(false);
    expect(data.tasks[0].reason).toContain("depth");
  });

  it("rejects when max concurrent agents would be exceeded", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("orch-1", { role: "orchestrator", depth: 0, status: "active" });
    // Fill up to maxConcurrentAgents
    sessions.set("agent-1", { status: "active" });
    sessions.set("agent-2", { status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig({ maxConcurrentAgents: 3 }),
      sessionKey: "orch-1",
    });

    const result = await tool.execute("tc-1", {
      tasks: [{ role: "lead", task: "New lead" }],
    });
    const data = parseResult(result) as any;

    expect(data.tasks[0].valid).toBe(false);
    expect(data.tasks[0].reason).toContain("concurrent");
  });

  it("handles mixed valid/invalid tasks in one call", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("orch-1", { role: "orchestrator", depth: 0, status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "orch-1",
    });

    const result = await tool.execute("tc-1", {
      tasks: [
        { role: "lead", task: "Valid lead task" },
        { role: "builder", task: "Invalid: orchestrator cannot spawn builder" },
      ],
    });
    const data = parseResult(result) as any;

    expect(data.tasks).toHaveLength(2);
    expect(data.tasks[0].valid).toBe(true);
    expect(data.tasks[1].valid).toBe(false);
    expect(data.summary).toContain("1 valid");
    expect(data.summary).toContain("1 invalid");
  });

  it("generates correct spawn commands", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("lead-1", { role: "lead", depth: 1, status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "lead-1",
    });

    const result = await tool.execute("tc-1", {
      tasks: [
        {
          role: "scout",
          task: "Explore auth patterns",
          label: "scout:auth-explore",
          model: "claude-haiku-4-5",
        },
      ],
    });
    const data = parseResult(result) as any;

    expect(data.tasks[0].spawnCommand).toContain("sessions_spawn");
    expect(data.tasks[0].spawnCommand).toContain("scout:auth-explore");
    expect(data.tasks[0].spawnCommand).toContain("claude-haiku-4-5");
  });

  it("includes file_scope in validated output", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("lead-1", { role: "lead", depth: 1, status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "lead-1",
    });

    const result = await tool.execute("tc-1", {
      tasks: [
        {
          role: "builder",
          task: "Implement login",
          file_scope: ["src/auth/login.ts", "src/auth/session.ts"],
        },
      ],
    });
    const data = parseResult(result) as any;

    expect(data.tasks[0].fileScope).toEqual(["src/auth/login.ts", "src/auth/session.ts"]);
  });

  it("returns error for empty tasks array", async () => {
    const store = createMockStore();
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "parent-1",
    });

    const result = await tool.execute("tc-1", { tasks: [] });
    const data = parseResult(result) as any;

    expect(data.error).toBeDefined();
  });

  it("works with no session state (defaults to orchestrator)", async () => {
    const store = createMockStore();
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "unknown-session",
    });

    const result = await tool.execute("tc-1", {
      tasks: [{ role: "lead", task: "Plan something" }],
    });
    const data = parseResult(result) as any;

    expect(data.parentRole).toBe("orchestrator");
    expect(data.parentDepth).toBe(0);
    expect(data.tasks[0].valid).toBe(true);
  });

  it("auto-generates label from role and task when label omitted", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("lead-1", { role: "lead", depth: 1, status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "lead-1",
    });

    const result = await tool.execute("tc-1", {
      tasks: [{ role: "scout", task: "Explore auth patterns in the codebase" }],
    });
    const data = parseResult(result) as any;

    expect(data.tasks[0].label).toBe("scout:Explore auth patterns in the c");
  });

  it("applies role model overrides when no explicit model", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("lead-1", { role: "lead", depth: 1, status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "lead-1",
    });

    const result = await tool.execute("tc-1", {
      tasks: [{ role: "scout", task: "Explore something" }],
    });
    const data = parseResult(result) as any;

    // Scout gets claude-haiku-4-5 from ROLE_MODEL_OVERRIDES
    expect(data.tasks[0].model).toBe("claude-haiku-4-5");
  });

  it("stores valid decomposition metadata on parent session for spawn hydration", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("lead-1", { role: "lead", depth: 1, status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "lead-1",
    });

    await tool.execute("tc-1", {
      tasks: [
        {
          role: "builder",
          task: "Implement login flow",
          label: "builder:login",
          file_scope: ["src/auth/login.ts"],
          model: "openai/gpt-5-mini",
        },
        {
          role: "scout",
          task: "Explore current auth flows",
          label: "scout:auth",
        },
      ],
    });

    const parent = sessions.get("lead-1");
    expect(parent?.pendingSpawnIntents).toEqual([
      {
        role: "builder",
        label: "builder:login",
        taskDescription: "Implement login flow",
        fileScope: ["src/auth/login.ts"],
        modelOverride: "openai/gpt-5-mini",
      },
      {
        role: "scout",
        label: "scout:auth",
        taskDescription: "Explore current auth flows",
        fileScope: undefined,
        modelOverride: "claude-haiku-4-5",
      },
    ]);
  });

  it("invalid tasks have empty spawnCommand", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("orch-1", { role: "orchestrator", depth: 0, status: "active" });
    const store = createMockStore(sessions);
    const tool = createDecomposeTaskTool({
      store: store as any,
      config: defaultConfig(),
      sessionKey: "orch-1",
    });

    const result = await tool.execute("tc-1", {
      tasks: [{ role: "builder", task: "Not allowed" }],
    });
    const data = parseResult(result) as any;

    expect(data.tasks[0].spawnCommand).toBe("");
  });
});

// ===========================================================================
// agent_status
// ===========================================================================

describe("agent_status", () => {
  it("returns empty fleet when no agents registered", async () => {
    const store = createMockStore();
    const tool = createAgentStatusTool({
      store: store as any,
      config: defaultConfig(),
    });

    const result = await tool.execute("tc-1", {});
    const data = parseResult(result) as any;

    expect(data.fleet.total).toBe(0);
    expect(data.fleet.active).toBe(0);
    expect(data.agents).toHaveLength(0);
  });

  it("returns all agents with correct fields", async () => {
    const now = Date.now();
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("agent-1", {
      role: "scout",
      depth: 2,
      status: "active",
      parentSessionKey: "lead-1",
      taskDescription: "Explore auth",
      fileScope: undefined,
      lastActivity: now - 30_000,
    });
    sessions.set("agent-2", {
      role: "builder",
      depth: 2,
      status: "completed",
      parentSessionKey: "lead-1",
      taskDescription: "Build login",
      fileScope: ["src/auth/"],
      lastActivity: now - 120_000,
    });
    const store = createMockStore(sessions);
    const tool = createAgentStatusTool({
      store: store as any,
      config: defaultConfig(),
    });

    const result = await tool.execute("tc-1", { include_stale_check: false });
    const data = parseResult(result) as any;

    expect(data.fleet.total).toBe(2);
    expect(data.fleet.active).toBe(1);
    expect(data.fleet.completed).toBe(1);
    expect(data.agents).toHaveLength(2);

    const scout = data.agents.find((a: any) => a.role === "scout");
    expect(scout.sessionKey).toBe("agent-1");
    expect(scout.depth).toBe(2);
    expect(scout.parentSessionKey).toBe("lead-1");
    expect(scout.taskDescription).toBe("Explore auth");
    expect(scout.lastActivity).toBeDefined();
    expect(scout.lastActivityAgo).toBeDefined();
    // Scout gets model override
    expect(scout.modelOverride).toBe("claude-haiku-4-5");

    const builder = data.agents.find((a: any) => a.role === "builder");
    expect(builder.sessionKey).toBe("agent-2");
    expect(builder.fileScope).toEqual(["src/auth/"]);
    // Builder has no model override
    expect(builder.modelOverride).toBeUndefined();
  });

  it("filters by status=active", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("a1", { role: "scout", status: "active", lastActivity: Date.now() });
    sessions.set("a2", { role: "builder", status: "completed", lastActivity: Date.now() });
    const store = createMockStore(sessions);
    const tool = createAgentStatusTool({
      store: store as any,
      config: defaultConfig(),
    });

    const result = await tool.execute("tc-1", {
      filter_status: "active",
      include_stale_check: false,
    });
    const data = parseResult(result) as any;

    expect(data.agents).toHaveLength(1);
    expect(data.agents[0].status).toBe("active");
  });

  it("filters by status=completed", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("a1", { role: "scout", status: "active" });
    sessions.set("a2", { role: "builder", status: "completed" });
    const store = createMockStore(sessions);
    const tool = createAgentStatusTool({
      store: store as any,
      config: defaultConfig(),
    });

    const result = await tool.execute("tc-1", {
      filter_status: "completed",
      include_stale_check: false,
    });
    const data = parseResult(result) as any;

    expect(data.agents).toHaveLength(1);
    expect(data.agents[0].status).toBe("completed");
  });

  it("returns specific session when session_key provided", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("target", {
      role: "lead",
      depth: 1,
      status: "active",
      taskDescription: "Lead auth work",
    });
    sessions.set("other", { role: "scout", depth: 2, status: "active" });
    const store = createMockStore(sessions);
    const tool = createAgentStatusTool({
      store: store as any,
      config: defaultConfig(),
    });

    const result = await tool.execute("tc-1", { session_key: "target" });
    const data = parseResult(result) as any;

    expect(data.fleet.total).toBe(1);
    expect(data.agents).toHaveLength(1);
    expect(data.agents[0].sessionKey).toBe("target");
    expect(data.agents[0].taskDescription).toBe("Lead auth work");
  });

  it("includes stale detection when include_stale_check=true", async () => {
    const now = Date.now();
    const sessions = new Map<string, OrchestratorSessionState>();
    // This agent's lastActivity is well beyond the stale threshold (default 300s)
    sessions.set("stale-agent", {
      role: "scout",
      depth: 2,
      status: "active",
      lastActivity: now - 600_000, // 10 minutes ago
    });
    sessions.set("fresh-agent", {
      role: "builder",
      depth: 2,
      status: "active",
      lastActivity: now - 10_000, // 10 seconds ago
    });
    const store = createMockStore(sessions);
    const tool = createAgentStatusTool({
      store: store as any,
      config: defaultConfig({ staleThresholdMs: 300_000 }),
    });

    const result = await tool.execute("tc-1", { include_stale_check: true });
    const data = parseResult(result) as any;

    expect(data.staleAgents).toBeDefined();
    expect(data.staleAgents.length).toBeGreaterThanOrEqual(1);
    const staleEntry = data.staleAgents.find((a: any) => a.sessionKey === "stale-agent");
    expect(staleEntry).toBeDefined();
    expect(staleEntry.elapsedHuman).toContain("m ago");

    // The stale agent should be annotated in the agents array
    const staleAgent = data.agents.find((a: any) => a.sessionKey === "stale-agent");
    expect(staleAgent.isStale).toBe(true);

    // Fresh agent should not be stale
    const freshAgent = data.agents.find((a: any) => a.sessionKey === "fresh-agent");
    expect(freshAgent.isStale).toBeUndefined();
  });

  it("skips stale detection when include_stale_check=false", async () => {
    const now = Date.now();
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("stale-agent", {
      role: "scout",
      status: "active",
      lastActivity: now - 600_000,
    });
    const store = createMockStore(sessions);
    const tool = createAgentStatusTool({
      store: store as any,
      config: defaultConfig(),
    });

    const result = await tool.execute("tc-1", { include_stale_check: false });
    const data = parseResult(result) as any;

    expect(data.staleAgents).toBeUndefined();
    // isStale should not be set since we skipped the check
    expect(data.agents[0].isStale).toBeUndefined();
  });

  it("includes model overrides in output", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("s1", { role: "scout", status: "active" });
    sessions.set("s2", { role: "reviewer", status: "active" });
    sessions.set("s3", { role: "builder", status: "active" });
    sessions.set("s4", { role: "orchestrator", status: "active" });
    const store = createMockStore(sessions);
    const tool = createAgentStatusTool({
      store: store as any,
      config: defaultConfig(),
    });

    const result = await tool.execute("tc-1", { include_stale_check: false });
    const data = parseResult(result) as any;

    const scout = data.agents.find((a: any) => a.sessionKey === "s1");
    expect(scout.modelOverride).toBe("claude-haiku-4-5");

    const reviewer = data.agents.find((a: any) => a.sessionKey === "s2");
    expect(reviewer.modelOverride).toBe("claude-haiku-4-5");

    const builder = data.agents.find((a: any) => a.sessionKey === "s3");
    expect(builder.modelOverride).toBeUndefined();

    const orchestrator = data.agents.find((a: any) => a.sessionKey === "s4");
    expect(orchestrator.modelOverride).toBeUndefined();
  });

  it("prefers explicit per-session model override over role default", async () => {
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("s1", {
      role: "scout",
      status: "active",
      modelOverride: "openai/gpt-5-mini",
    });
    const store = createMockStore(sessions);
    const tool = createAgentStatusTool({
      store: store as any,
      config: defaultConfig(),
    });

    const result = await tool.execute("tc-1", { include_stale_check: false });
    const data = parseResult(result) as any;

    expect(data.agents[0].modelOverride).toBe("openai/gpt-5-mini");
  });

  it("returns error for unknown session_key", async () => {
    const store = createMockStore();
    const tool = createAgentStatusTool({
      store: store as any,
      config: defaultConfig(),
    });

    const result = await tool.execute("tc-1", { session_key: "nonexistent" });
    const data = parseResult(result) as any;

    expect(data.error).toContain("nonexistent");
  });

  it("filters by status=stale", async () => {
    const now = Date.now();
    const sessions = new Map<string, OrchestratorSessionState>();
    sessions.set("stale-1", {
      role: "scout",
      status: "active",
      lastActivity: now - 600_000,
    });
    sessions.set("ok-1", {
      role: "builder",
      status: "active",
      lastActivity: now - 10_000,
    });
    const store = createMockStore(sessions);
    const tool = createAgentStatusTool({
      store: store as any,
      config: defaultConfig({ staleThresholdMs: 300_000 }),
    });

    const result = await tool.execute("tc-1", {
      filter_status: "stale",
      include_stale_check: true,
    });
    const data = parseResult(result) as any;

    expect(data.agents).toHaveLength(1);
    expect(data.agents[0].sessionKey).toBe("stale-1");
  });
});

// ===========================================================================
// formatElapsed
// ===========================================================================

describe("formatElapsed", () => {
  it("formats seconds", () => {
    expect(formatElapsed(5_000)).toBe("5s ago");
    expect(formatElapsed(59_000)).toBe("59s ago");
  });

  it("formats minutes", () => {
    expect(formatElapsed(60_000)).toBe("1m ago");
    expect(formatElapsed(120_000)).toBe("2m ago");
  });

  it("formats hours and minutes", () => {
    expect(formatElapsed(3_660_000)).toBe("1h 1m ago");
    expect(formatElapsed(7_200_000)).toBe("2h ago");
  });

  it("handles zero and negative", () => {
    expect(formatElapsed(0)).toBe("0s ago");
    expect(formatElapsed(-100)).toBe("0s ago");
  });
});
