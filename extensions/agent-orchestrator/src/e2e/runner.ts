/**
 * E2E scenario execution engine for multi-agent workflow tests.
 *
 * Unlike the hook-level runner (src/scenarios/runner.ts), this engine:
 *   1. Registers the REAL plugin with all hooks
 *   2. Maintains actual JSONL-based mail stores for message delivery
 *   3. Implements compound "agent_turn" actions (read inbox, tool calls, send mail)
 *   4. Verifies fleet state by reading the orchestrator store files
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect } from "vitest";
import plugin from "../../index.js";
import {
  appendMessage,
  claimUnread,
  mailboxPath,
  newMessageId,
  readMailbox,
  type MailMessage as StoreMailMessage,
} from "../mail/store.js";
import { DEFAULT_ORCHESTRATOR_CONFIG } from "../types.js";
import type {
  AgentDef,
  E2EScenario,
  E2EStep,
  FleetExpectation,
  MailMessage as ScenarioMail,
  ToolCallSpec,
} from "./types.js";

// ---------------------------------------------------------------------------
// Mock Plugin API (same pattern as scenarios/runner.ts and integration.test.ts)
// ---------------------------------------------------------------------------

type CapturedHook = {
  name: string;
  handler: (...args: unknown[]) => unknown;
  opts?: { priority?: number };
};

type CapturedService = {
  id: string;
  start: (ctx: unknown) => void | Promise<void>;
  stop?: (ctx: unknown) => void | Promise<void>;
};

function createMockApi(pluginConfig: Record<string, unknown> = {}) {
  const hooks: CapturedHook[] = [];
  const tools: Array<{ factory: unknown; opts?: unknown }> = [];
  const services: CapturedService[] = [];

  const api = {
    id: "agent-orchestrator",
    name: "Agent Orchestrator",
    source: "test",
    config: {} as Record<string, unknown>,
    pluginConfig,
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    },
    runtime: {},
    on: (name: string, handler: (...args: unknown[]) => unknown, opts?: { priority?: number }) => {
      hooks.push({ name, handler, opts });
    },
    registerTool: (factory: unknown, opts?: unknown) => {
      tools.push({ factory, opts });
    },
    registerService: (service: CapturedService) => {
      services.push(service);
    },
    registerCli: () => {},
    registerHook: () => {},
    registerHttpHandler: () => {},
    registerHttpRoute: () => {},
    registerChannel: () => {},
    registerGatewayMethod: () => {},
    registerProvider: () => {},
    registerCommand: () => {},
    resolvePath: (p: string) => p,
    recordUsage: () => {},
    emitLlmApiCall: () => {},
  };

  return { api, hooks, tools, services };
}

// ---------------------------------------------------------------------------
// Hook lookup
// ---------------------------------------------------------------------------

function findHook(
  hooks: CapturedHook[],
  name: string,
  priority?: number,
): CapturedHook | undefined {
  if (priority !== undefined) {
    return hooks.find((h) => h.name === name && h.opts?.priority === priority);
  }
  return hooks.find((h) => h.name === name);
}

// ---------------------------------------------------------------------------
// Agent bookkeeping (tracks what we've spawned, separate from the store)
// ---------------------------------------------------------------------------

type AgentBookkeeping = {
  sessionKey: string;
  role: string;
  depth: number;
  parent?: string;
  status: "active" | "completed";
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type E2EStepResult = {
  step: number;
  action: string;
  passed: boolean;
  error?: string;
  detail?: string;
};

export async function runE2EScenario(
  scenario: E2EScenario,
): Promise<{ passed: boolean; results: E2EStepResult[] }> {
  const config = {
    mail: { ...DEFAULT_ORCHESTRATOR_CONFIG.mail, ...scenario.config?.mail },
    orchestration: {
      ...DEFAULT_ORCHESTRATOR_CONFIG.orchestration,
      ...scenario.config?.orchestration,
    },
  };

  const { api, hooks, services } = createMockApi(config as unknown as Record<string, unknown>);
  plugin.register(api as never);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-orch-"));

  // Start service to initialize the orchestrator store
  if (services.length > 0) {
    await services[0].start({
      stateDir: tmpDir,
      logger: api.logger,
      config: {},
      workspaceDir: tmpDir,
    });
  }

  const agents = new Map<string, AgentBookkeeping>();
  const results: E2EStepResult[] = [];

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    try {
      await executeE2EStep(step, hooks, tmpDir, config, agents);
      results.push({ step: i, action: step.action, passed: true });
    } catch (err) {
      results.push({
        step: i,
        action: step.action,
        passed: false,
        error: (err as Error).message,
      });
    }
  }

  // Cleanup
  if (services[0]?.stop) {
    await services[0].stop({
      stateDir: tmpDir,
      logger: api.logger,
      config: {},
      workspaceDir: tmpDir,
    });
  }
  fs.rmSync(tmpDir, { recursive: true, force: true });

  return { passed: results.every((r) => r.passed), results };
}

// ---------------------------------------------------------------------------
// Step execution
// ---------------------------------------------------------------------------

async function executeE2EStep(
  step: E2EStep,
  hooks: CapturedHook[],
  tmpDir: string,
  _config: Record<string, unknown>,
  agents: Map<string, AgentBookkeeping>,
): Promise<void> {
  switch (step.action) {
    case "comment":
      return;

    case "wait_ms":
      await new Promise((resolve) => setTimeout(resolve, step.ms));
      return;

    case "seed_fleet":
      await executeSeedFleet(step.agents, hooks, agents);
      return;

    case "agent_turn":
      await executeAgentTurn(step, hooks, tmpDir, agents);
      return;

    case "spawn_agent":
      await executeSpawnAgent(step, hooks, agents);
      return;

    case "end_agent":
      await executeEndAgent(step, hooks, agents);
      return;

    case "assert_fleet":
      assertFleet(step.expect, agents);
      return;

    case "assert_inbox":
      await assertInbox(step, tmpDir);
      return;

    case "assert_model":
      await assertModel(step, hooks);
      return;

    case "assert_context":
      await assertContext(step, hooks);
      return;
  }
}

// ---------------------------------------------------------------------------
// seed_fleet: spawn an ordered fleet, parents before children
// ---------------------------------------------------------------------------

async function executeSeedFleet(
  agentDefs: AgentDef[],
  hooks: CapturedHook[],
  agents: Map<string, AgentBookkeeping>,
): Promise<void> {
  for (const def of agentDefs) {
    await spawnSingleAgent(def, hooks, agents, "ok");
  }
}

// ---------------------------------------------------------------------------
// spawn_agent: spawn one agent, optionally expect failure
// ---------------------------------------------------------------------------

async function executeSpawnAgent(
  step: Extract<E2EStep, { action: "spawn_agent" }>,
  hooks: CapturedHook[],
  agents: Map<string, AgentBookkeeping>,
): Promise<void> {
  await spawnSingleAgent(step.agent, hooks, agents, step.expect ?? "ok", step.expectError);
}

// ---------------------------------------------------------------------------
// Shared spawn logic
// ---------------------------------------------------------------------------

async function spawnSingleAgent(
  def: AgentDef,
  hooks: CapturedHook[],
  agents: Map<string, AgentBookkeeping>,
  expectOutcome: "ok" | "error",
  expectError?: string,
): Promise<void> {
  const role = def.label.includes(":") ? def.label.split(":")[0] : def.label;
  const parentInfo = def.parent ? agents.get(def.parent) : undefined;
  const depth = parentInfo ? parentInfo.depth + 1 : role === "orchestrator" ? 0 : 1;

  // Root-level agents (no parent) bypass spawn validation — in production they
  // are the initial agent, not spawned by another agent. SPAWN_RULES doesn't
  // allow self-spawning, so we register them via subagent_spawned only (which
  // sets status=active in the store). The store entry won't have role/depth,
  // so model-override and context-injection hooks treat root agents as having
  // no role — matching production behavior where the root agent uses defaults.
  if (!def.parent) {
    if (expectOutcome === "error") {
      throw new Error(`Root agents (no parent) bypass spawn validation — cannot expect error`);
    }
    const spawnedHook = findHook(hooks, "subagent_spawned");
    if (spawnedHook) {
      await spawnedHook.handler(
        {
          runId: `run-${def.sessionKey}`,
          childSessionKey: def.sessionKey,
          agentId: "e2e-agent",
          label: def.label,
          mode: "run",
          threadRequested: false,
        },
        {
          runId: `run-${def.sessionKey}`,
          childSessionKey: def.sessionKey,
          requesterSessionKey: "root",
        },
      );
    }

    agents.set(def.sessionKey, {
      sessionKey: def.sessionKey,
      role,
      depth,
      parent: def.parent,
      status: "active",
    });
    return;
  }

  const spawningHook = findHook(hooks, "subagent_spawning");
  if (!spawningHook) throw new Error("subagent_spawning hook not registered");

  const result = (await spawningHook.handler(
    {
      childSessionKey: def.sessionKey,
      agentId: "e2e-agent",
      label: def.label,
      mode: "run",
      requester: def.parent,
      threadRequested: false,
      taskDescription: def.taskDescription,
      fileScope: def.fileScope,
    },
    {
      runId: `run-${def.sessionKey}`,
      childSessionKey: def.sessionKey,
      requesterSessionKey: def.parent,
    },
  )) as { status?: string; error?: string } | undefined;

  const status = result?.status ?? "ok";

  if (expectOutcome === "error") {
    if (status !== "error") {
      throw new Error(`Expected spawn of "${def.sessionKey}" to fail but got status="${status}"`);
    }
    if (expectError && !result?.error?.includes(expectError)) {
      throw new Error(`Expected error containing "${expectError}" but got "${result?.error}"`);
    }
    return;
  }

  if (status === "error") {
    throw new Error(
      `Expected spawn of "${def.sessionKey}" to succeed but got error: ${result?.error}`,
    );
  }

  // Fire subagent_spawned to confirm active status
  const spawnedHook = findHook(hooks, "subagent_spawned");
  if (spawnedHook) {
    await spawnedHook.handler(
      {
        runId: `run-${def.sessionKey}`,
        childSessionKey: def.sessionKey,
        agentId: "e2e-agent",
        label: def.label,
        mode: "run",
        threadRequested: false,
      },
      {
        runId: `run-${def.sessionKey}`,
        childSessionKey: def.sessionKey,
        requesterSessionKey: def.parent,
      },
    );
  }

  // Track in our bookkeeping
  agents.set(def.sessionKey, {
    sessionKey: def.sessionKey,
    role,
    depth,
    parent: def.parent,
    status: "active",
  });
}

// ---------------------------------------------------------------------------
// agent_turn: compound action (read mail, tool calls, send mail, optionally complete)
// ---------------------------------------------------------------------------

async function executeAgentTurn(
  step: Extract<E2EStep, { action: "agent_turn" }>,
  hooks: CapturedHook[],
  tmpDir: string,
  agents: Map<string, AgentBookkeeping>,
): Promise<void> {
  const actor = step.actor;
  const agent = agents.get(actor);
  if (!agent) throw new Error(`agent_turn: unknown actor "${actor}"`);

  // 1. Read mail if requested
  if (step.reads_mail) {
    const mbPath = mailboxPath(tmpDir, actor);
    try {
      await claimUnread(mbPath, { ttlMs: 300_000, now: Date.now() });
    } catch {
      // Mailbox might not exist yet — that's fine
    }
  }

  // 2. Execute tool calls
  if (step.tool_calls) {
    for (const tc of step.tool_calls) {
      await executeToolCall(tc, actor, hooks);
    }

    // Fire after_tool_call for activity tracking
    const afterToolHook = findHook(hooks, "after_tool_call");
    if (afterToolHook) {
      for (const tc of step.tool_calls) {
        await afterToolHook.handler(
          {
            toolName: tc.tool,
            toolCallId: `tc-${Date.now()}`,
            isError: false,
            params: tc.params ?? {},
            result: "ok",
            durationMs: 10,
          },
          {
            agentId: "e2e-agent",
            sessionKey: actor,
            runId: `run-${actor}`,
            toolName: tc.tool,
          },
        );
      }
    }
  }

  // 3. Send mail
  if (step.sends_mail) {
    for (const mail of step.sends_mail) {
      await sendMail(tmpDir, actor, mail);
    }
  }

  // 4. Optionally mark completed
  if (step.outcome === "completed") {
    await completeAgent(actor, hooks, agents);
  }
}

// ---------------------------------------------------------------------------
// Tool call execution via before_tool_call hook
// ---------------------------------------------------------------------------

async function executeToolCall(
  tc: ToolCallSpec,
  sessionKey: string,
  hooks: CapturedHook[],
): Promise<void> {
  const hook = findHook(hooks, "before_tool_call");
  if (!hook) {
    // No hook registered — treat as "allow"
    if (tc.expect === "block") {
      throw new Error(
        `Expected tool "${tc.tool}" to be blocked but no before_tool_call hook is registered`,
      );
    }
    return;
  }

  const result = (await hook.handler(
    {
      toolName: tc.tool,
      toolCallId: `tc-${Date.now()}`,
      params: tc.params ?? {},
    },
    {
      agentId: "e2e-agent",
      sessionKey,
      runId: `run-${sessionKey}`,
      toolName: tc.tool,
    },
  )) as { block?: boolean; blockReason?: string } | undefined;

  const blocked = result?.block === true;

  if (tc.expect === "block" && !blocked) {
    throw new Error(
      `Expected tool "${tc.tool}" to be blocked for "${sessionKey}" but it was allowed`,
    );
  }
  if (tc.expect === "allow" && blocked) {
    throw new Error(
      `Expected tool "${tc.tool}" to be allowed for "${sessionKey}" but it was blocked: ${result?.blockReason}`,
    );
  }
  if (tc.expectReason && result?.blockReason && !result.blockReason.includes(tc.expectReason)) {
    throw new Error(
      `Expected block reason containing "${tc.expectReason}" but got "${result?.blockReason}"`,
    );
  }
}

// ---------------------------------------------------------------------------
// Mail delivery via real JSONL store
// ---------------------------------------------------------------------------

async function sendMail(tmpDir: string, from: string, mail: ScenarioMail): Promise<void> {
  const mbPath = mailboxPath(tmpDir, mail.to);
  const msg: StoreMailMessage = {
    id: newMessageId(),
    from,
    to: mail.to,
    subject: mail.subject,
    body: mail.body,
    urgency: mail.urgency ?? "normal",
    tags: mail.tags ?? [],
    status: "unread",
    created_at: Date.now(),
    read_at: null,
    deleted_at: null,
    processing_at: null,
    processing_expires_at: null,
    forwarded_from: null,
    lineage: [],
  };
  await appendMessage(mbPath, msg);
}

// ---------------------------------------------------------------------------
// end_agent / complete agent
// ---------------------------------------------------------------------------

async function executeEndAgent(
  step: Extract<E2EStep, { action: "end_agent" }>,
  hooks: CapturedHook[],
  agents: Map<string, AgentBookkeeping>,
): Promise<void> {
  await completeAgent(step.session, hooks, agents, step.reason);
}

async function completeAgent(
  sessionKey: string,
  hooks: CapturedHook[],
  agents: Map<string, AgentBookkeeping>,
  reason?: string,
): Promise<void> {
  // Fire subagent_stopping
  const stoppingHook = findHook(hooks, "subagent_stopping");
  if (stoppingHook) {
    await stoppingHook.handler(
      {
        runId: `run-${sessionKey}`,
        childSessionKey: sessionKey,
        requesterSessionKey: "parent",
        agentId: "e2e-agent",
        outcome: "ok",
        reason: reason ?? "completed",
        steerCount: 0,
        maxSteers: 3,
      },
      {
        agentId: "e2e-agent",
        runId: `run-${sessionKey}`,
        childSessionKey: sessionKey,
        requesterSessionKey: "parent",
      },
    );
  }

  // Fire subagent_ended
  const endedHook = findHook(hooks, "subagent_ended");
  if (endedHook) {
    await endedHook.handler(
      {
        targetSessionKey: sessionKey,
        targetKind: "subagent",
        reason: reason ?? "completed",
      },
      {
        runId: `run-${sessionKey}`,
        childSessionKey: sessionKey,
        requesterSessionKey: "parent",
      },
    );
  }

  // Update bookkeeping
  const agent = agents.get(sessionKey);
  if (agent) {
    agent.status = "completed";
  }
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------

function assertFleet(expect_: FleetExpectation, agents: Map<string, AgentBookkeeping>): void {
  const allAgents = [...agents.values()];

  if (expect_.activeCount !== undefined) {
    const active = allAgents.filter((a) => a.status === "active").length;
    expect(active).toBe(expect_.activeCount);
  }

  if (expect_.completedCount !== undefined) {
    const completed = allAgents.filter((a) => a.status === "completed").length;
    expect(completed).toBe(expect_.completedCount);
  }

  if (expect_.agents) {
    for (const exp of expect_.agents) {
      const agent = agents.get(exp.sessionKey);
      if (!agent) {
        throw new Error(`assert_fleet: agent "${exp.sessionKey}" not found`);
      }
      if (exp.role !== undefined) {
        expect(agent.role).toBe(exp.role);
      }
      if (exp.status !== undefined) {
        expect(agent.status).toBe(exp.status);
      }
      if (exp.depth !== undefined) {
        expect(agent.depth).toBe(exp.depth);
      }
      if (exp.parent !== undefined) {
        expect(agent.parent).toBe(exp.parent);
      }
    }
  }
}

async function assertInbox(
  step: Extract<E2EStep, { action: "assert_inbox" }>,
  tmpDir: string,
): Promise<void> {
  const mbPath = mailboxPath(tmpDir, step.session);
  const messages = await readMailbox(mbPath);
  // Only count non-deleted messages
  const visible = messages.filter((m) => m.status !== "deleted");

  if (step.expectEmpty) {
    expect(visible.length).toBe(0);
  }

  if (step.expectCount !== undefined) {
    expect(visible.length).toBe(step.expectCount);
  }

  if (step.expectSubjects) {
    const subjects = visible.map((m) => m.subject);
    for (const expected of step.expectSubjects) {
      const found = subjects.some((s) => s.includes(expected));
      if (!found) {
        throw new Error(
          `assert_inbox: expected subject containing "${expected}" in [${subjects.join(", ")}]`,
        );
      }
    }
  }
}

async function assertModel(
  step: Extract<E2EStep, { action: "assert_model" }>,
  hooks: CapturedHook[],
): Promise<void> {
  const hook = findHook(hooks, "before_model_resolve");
  if (!hook) throw new Error("before_model_resolve hook not registered");

  const result = (await hook.handler(
    { prompt: "e2e-probe" },
    { agentId: "e2e-agent", sessionKey: step.session },
  )) as { modelOverride?: string } | undefined;

  if (step.expectModel) {
    if (result?.modelOverride !== step.expectModel) {
      throw new Error(
        `assert_model: expected "${step.expectModel}" but got "${result?.modelOverride ?? "(none)"}"`,
      );
    }
  }
  if (step.expectNoOverride) {
    if (result?.modelOverride) {
      throw new Error(`assert_model: expected no override but got "${result.modelOverride}"`);
    }
  }
}

async function assertContext(
  step: Extract<E2EStep, { action: "assert_context" }>,
  hooks: CapturedHook[],
): Promise<void> {
  const hook = findHook(hooks, "before_prompt_build", 90);
  if (!hook) throw new Error("before_prompt_build (priority 90) hook not registered");

  const result = (await hook.handler(
    { prompt: "e2e-probe", messages: [] },
    { agentId: "e2e-agent", sessionKey: step.session, sessionId: step.session },
  )) as { prependContext?: string } | undefined;

  const ctx = result?.prependContext ?? "";

  if (step.expectContains) {
    for (const expected of step.expectContains) {
      if (!ctx.includes(expected)) {
        throw new Error(
          `assert_context: expected context to contain "${expected}" but got: "${ctx.slice(0, 200)}..."`,
        );
      }
    }
  }
  if (step.expectNotContains) {
    for (const unexpected of step.expectNotContains) {
      if (ctx.includes(unexpected)) {
        throw new Error(
          `assert_context: expected context NOT to contain "${unexpected}" but it was found`,
        );
      }
    }
  }
}
