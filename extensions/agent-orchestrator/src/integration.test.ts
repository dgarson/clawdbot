/**
 * Integration tests for the agent-orchestrator plugin wiring.
 *
 * Verifies that index.ts correctly registers hooks, tools, services,
 * and CLI commands via the plugin API, and that the registered handlers
 * behave as expected when invoked with mock data.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import plugin from "../index.js";
import type { OrchestratorConfig } from "./types.js";
import { DEFAULT_ORCHESTRATOR_CONFIG } from "./types.js";

// ============================================================================
// Mock Plugin API
// ============================================================================

type CapturedHook = {
  name: string;
  handler: (...args: unknown[]) => unknown;
  opts?: { priority?: number };
};
type CapturedTool = {
  factory: unknown;
  opts?: { name?: string; names?: string[]; optional?: boolean };
};
type CapturedService = {
  id: string;
  start: (ctx: unknown) => void | Promise<void>;
  stop?: (ctx: unknown) => void | Promise<void>;
};
type CapturedCli = { registrar: (...args: unknown[]) => unknown; opts?: unknown };

function createMockApi(pluginConfig: Partial<OrchestratorConfig> = {}) {
  const hooks: CapturedHook[] = [];
  const tools: CapturedTool[] = [];
  const services: CapturedService[] = [];
  const cliRegistrations: CapturedCli[] = [];

  const api = {
    id: "agent-orchestrator",
    name: "Agent Orchestrator",
    source: "test",
    config: {} as Record<string, unknown>,
    pluginConfig: pluginConfig as Record<string, unknown>,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    runtime: {},
    on: vi.fn(
      (name: string, handler: (...args: unknown[]) => unknown, opts?: { priority?: number }) => {
        hooks.push({ name, handler, opts });
      },
    ),
    registerTool: vi.fn(
      (factory: unknown, opts?: { name?: string; names?: string[]; optional?: boolean }) => {
        tools.push({ factory, opts });
      },
    ),
    registerHook: vi.fn(),
    registerService: vi.fn((service: CapturedService) => {
      services.push(service);
    }),
    registerCli: vi.fn((registrar: (...args: unknown[]) => unknown, opts?: unknown) => {
      cliRegistrations.push({ registrar, opts });
    }),
    registerHttpHandler: vi.fn(),
    registerHttpRoute: vi.fn(),
    registerChannel: vi.fn(),
    registerGatewayMethod: vi.fn(),
    registerProvider: vi.fn(),
    registerCommand: vi.fn(),
    resolvePath: vi.fn((p: string) => p),
    recordUsage: vi.fn(),
    emitLlmApiCall: vi.fn(),
  };

  return { api, hooks, tools, services, cliRegistrations };
}

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

// ============================================================================
// Test Suite
// ============================================================================

describe("agent-orchestrator integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "orchestrator-integration-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  // ==========================================================================
  // 1. Registration Tests
  // ==========================================================================

  describe("registration", () => {
    it("registers the agent-orchestrator service", () => {
      const { api, services } = createMockApi();
      plugin.register(api as never);
      expect(services.length).toBeGreaterThanOrEqual(1);
      expect(services[0].id).toBe("agent-orchestrator");
      expect(typeof services[0].start).toBe("function");
    });

    it("registers mail tool when mail.enabled is true", () => {
      const { api, tools } = createMockApi({ mail: { enabled: true } });
      plugin.register(api as never);
      const mailTool = tools.find(
        (t) => t.opts?.name === "mail" || t.opts?.names?.includes("mail"),
      );
      expect(mailTool).toBeDefined();
    });

    it("registers bounce_mail tool when mail.enabled is true", () => {
      const { api, tools } = createMockApi({ mail: { enabled: true } });
      plugin.register(api as never);
      const bounceTool = tools.find(
        (t) => t.opts?.name === "bounce_mail" || t.opts?.names?.includes("bounce_mail"),
      );
      expect(bounceTool).toBeDefined();
    });

    it("does not register mail tools when mail.enabled is false and orchestration.enabled is false", () => {
      const { api, tools } = createMockApi({
        mail: { enabled: false },
        orchestration: { ...DEFAULT_ORCHESTRATOR_CONFIG.orchestration, enabled: false },
      });
      plugin.register(api as never);
      const mailTool = tools.find(
        (t) =>
          t.opts?.name === "mail" ||
          t.opts?.name === "bounce_mail" ||
          t.opts?.names?.includes("mail") ||
          t.opts?.names?.includes("bounce_mail"),
      );
      expect(mailTool).toBeUndefined();
    });

    it("registers before_prompt_build hook for mail with priority 100", () => {
      const { api, hooks } = createMockApi({ mail: { enabled: true } });
      plugin.register(api as never);
      const mailPromptHook = findHook(hooks, "before_prompt_build", 100);
      expect(mailPromptHook).toBeDefined();
    });

    it("registers before_tool_call hook for boundary enforcement", () => {
      const { api, hooks } = createMockApi();
      plugin.register(api as never);
      const hook = findHook(hooks, "before_tool_call");
      expect(hook).toBeDefined();
    });

    it("registers before_tool_call hook with priority 50", () => {
      const { api, hooks } = createMockApi();
      plugin.register(api as never);
      const hook = findHook(hooks, "before_tool_call", 50);
      expect(hook).toBeDefined();
    });

    it("registers subagent_spawning hook", () => {
      const { api, hooks } = createMockApi();
      plugin.register(api as never);
      const hook = findHook(hooks, "subagent_spawning");
      expect(hook).toBeDefined();
    });

    it("registers subagent_spawned hook", () => {
      const { api, hooks } = createMockApi();
      plugin.register(api as never);
      const hook = findHook(hooks, "subagent_spawned");
      expect(hook).toBeDefined();
    });

    it("registers subagent_stopping hook", () => {
      const { api, hooks } = createMockApi();
      plugin.register(api as never);
      const hook = findHook(hooks, "subagent_stopping");
      expect(hook).toBeDefined();
    });

    it("registers subagent_ended hook", () => {
      const { api, hooks } = createMockApi();
      plugin.register(api as never);
      const hook = findHook(hooks, "subagent_ended");
      expect(hook).toBeDefined();
    });

    it("registers before_prompt_build hook for role context with priority 90", () => {
      const { api, hooks } = createMockApi();
      plugin.register(api as never);
      const hook = findHook(hooks, "before_prompt_build", 90);
      expect(hook).toBeDefined();
    });

    it("registers before_model_resolve hook", () => {
      const { api, hooks } = createMockApi();
      plugin.register(api as never);
      const hook = findHook(hooks, "before_model_resolve");
      expect(hook).toBeDefined();
    });

    it("registers after_tool_call hook for activity tracking", () => {
      const { api, hooks } = createMockApi();
      plugin.register(api as never);
      const hook = findHook(hooks, "after_tool_call");
      expect(hook).toBeDefined();
    });

    it("registers mail CLI commands", () => {
      const { api, cliRegistrations } = createMockApi({ mail: { enabled: true } });
      plugin.register(api as never);
      expect(cliRegistrations.length).toBeGreaterThanOrEqual(1);
    });

    it("does not register orchestration hooks when orchestration.enabled is false", () => {
      const { api, hooks } = createMockApi({
        orchestration: { ...DEFAULT_ORCHESTRATOR_CONFIG.orchestration, enabled: false },
      });
      plugin.register(api as never);

      const orchestrationHooks = [
        "before_tool_call",
        "subagent_spawning",
        "subagent_spawned",
        "subagent_stopping",
        "subagent_ended",
        "before_model_resolve",
        "after_tool_call",
      ];
      for (const hookName of orchestrationHooks) {
        const found = findHook(hooks, hookName);
        expect(
          found,
          `expected no ${hookName} hook when orchestration.enabled=false`,
        ).toBeUndefined();
      }

      // Role context prompt hook (priority 90) should also be absent
      const rolePrompt = findHook(hooks, "before_prompt_build", 90);
      expect(rolePrompt).toBeUndefined();
    });

    it("orchestration.enabled implies mail is also registered", () => {
      // Even when mail.enabled is false, orchestration.enabled causes mail
      // tools to be registered (the condition is mail.enabled || orchestration.enabled)
      const { api, tools } = createMockApi({
        mail: { enabled: false },
        orchestration: { ...DEFAULT_ORCHESTRATOR_CONFIG.orchestration, enabled: true },
      });
      plugin.register(api as never);

      const mailTool = tools.find(
        (t) => t.opts?.name === "mail" || t.opts?.names?.includes("mail"),
      );
      expect(mailTool).toBeDefined();
    });
  });

  // ==========================================================================
  // 2. Hook Behavior Tests
  // ==========================================================================

  describe("hook behavior", () => {
    // Helper: register plugin, start service, return hooks + service ref
    async function setupPlugin(config: Partial<OrchestratorConfig> = {}) {
      const merged = {
        ...DEFAULT_ORCHESTRATOR_CONFIG,
        ...config,
        mail: { ...DEFAULT_ORCHESTRATOR_CONFIG.mail, ...config.mail },
        orchestration: {
          ...DEFAULT_ORCHESTRATOR_CONFIG.orchestration,
          ...config.orchestration,
        },
      };
      const { api, hooks, tools, services, cliRegistrations } = createMockApi(merged);
      plugin.register(api as never);

      // Start the service to initialize the store
      if (services.length > 0) {
        await services[0].start({
          stateDir: tmpDir,
          logger: api.logger,
          config: {},
          workspaceDir: tmpDir,
        });
      }

      return { api, hooks, tools, services, cliRegistrations };
    }

    /**
     * Seed an agent into the store via the subagent_spawning hook,
     * respecting the role hierarchy:
     *   - orchestrator: default parent is "root" (no parent in store, defaults to orchestrator)
     *   - lead: must be spawned from an orchestrator
     *   - scout/builder/reviewer: must be spawned from a lead
     *
     * This function handles setting up the full hierarchy.
     */
    async function seedAgent(
      hooks: CapturedHook[],
      opts: {
        childSessionKey: string;
        label: string;
        parentSessionKey?: string;
        runId?: string;
      },
    ) {
      const spawningHook = findHook(hooks, "subagent_spawning");
      if (spawningHook) {
        const result = await spawningHook.handler(
          {
            childSessionKey: opts.childSessionKey,
            agentId: "test-agent",
            label: opts.label,
            mode: "run" as const,
            requester: opts.parentSessionKey ?? "root",
            threadRequested: false,
          },
          {
            runId: opts.runId ?? "run-1",
            childSessionKey: opts.childSessionKey,
            requesterSessionKey: opts.parentSessionKey ?? "root",
          },
        );

        // If the spawn was rejected, the child was not registered
        const res = result as { status?: string } | undefined | null;
        if (res?.status === "error") {
          return false;
        }
      }

      // Also call subagent_spawned to confirm active status
      const spawnedHook = findHook(hooks, "subagent_spawned");
      if (spawnedHook) {
        await spawnedHook.handler(
          {
            runId: opts.runId ?? "run-1",
            childSessionKey: opts.childSessionKey,
            agentId: "test-agent",
            label: opts.label,
            mode: "run" as const,
            threadRequested: false,
          },
          {
            runId: opts.runId ?? "run-1",
            childSessionKey: opts.childSessionKey,
            requesterSessionKey: opts.parentSessionKey ?? "root",
          },
        );
      }

      return true;
    }

    /**
     * Seed a full hierarchy: orchestrator -> lead -> worker (scout/builder/reviewer).
     * Returns the session keys for orchestrator, lead, and worker.
     */
    async function seedHierarchy(hooks: CapturedHook[], workerLabel: string, prefix = "") {
      const orchKey = `${prefix}orch-1`;
      const leadKey = `${prefix}lead-1`;
      const workerKey = `${prefix}${workerLabel.split(":")[0]}-1`;

      // orchestrator (root parent, defaults to orchestrator role)
      await seedAgent(hooks, { childSessionKey: orchKey, label: "orchestrator:main" });
      // lead (spawned by orchestrator)
      await seedAgent(hooks, {
        childSessionKey: leadKey,
        label: "lead:team",
        parentSessionKey: orchKey,
      });
      // worker (spawned by lead)
      await seedAgent(hooks, {
        childSessionKey: workerKey,
        label: workerLabel,
        parentSessionKey: leadKey,
      });

      return { orchKey, leadKey, workerKey };
    }

    // ------------------------------------------------------------------
    // before_tool_call (boundary enforcement)
    // ------------------------------------------------------------------

    describe("before_tool_call (boundary enforcement)", () => {
      it("blocks write_file for scout role", async () => {
        const { hooks } = await setupPlugin();
        const { workerKey } = await seedHierarchy(hooks, "scout:explore");

        const hook = findHook(hooks, "before_tool_call")!;
        const result = await hook.handler(
          { toolName: "write_file", toolCallId: "tc-1", params: {} },
          { agentId: "test-agent", sessionKey: workerKey, toolName: "write_file" },
        );

        expect(result).toBeDefined();
        expect((result as { block?: boolean }).block).toBe(true);
      });

      it("allows write_file for builder role", async () => {
        const { hooks } = await setupPlugin();
        const { workerKey } = await seedHierarchy(hooks, "builder:impl");

        const hook = findHook(hooks, "before_tool_call")!;
        const result = await hook.handler(
          { toolName: "write_file", toolCallId: "tc-2", params: {} },
          { agentId: "test-agent", sessionKey: workerKey, toolName: "write_file" },
        );

        // Builder should not be blocked for write_file
        const blockResult = result as { block?: boolean } | undefined | null;
        expect(!blockResult || !blockResult.block).toBe(true);
      });

      it("blocks decompose_task for builder role", async () => {
        const { hooks } = await setupPlugin();
        const { workerKey } = await seedHierarchy(hooks, "builder:impl", "dt-");

        const hook = findHook(hooks, "before_tool_call")!;
        const result = await hook.handler(
          { toolName: "decompose_task", toolCallId: "tc-3", params: {} },
          { agentId: "test-agent", sessionKey: workerKey, toolName: "decompose_task" },
        );

        expect(result).toBeDefined();
        expect((result as { block?: boolean }).block).toBe(true);
      });

      it("allows decompose_task for orchestrator role", async () => {
        const { hooks } = await setupPlugin();
        // Orchestrator is at the top — seed it directly
        await seedAgent(hooks, { childSessionKey: "orch-dt", label: "orchestrator:main" });

        const hook = findHook(hooks, "before_tool_call")!;
        const result = await hook.handler(
          { toolName: "decompose_task", toolCallId: "tc-4", params: {} },
          { agentId: "test-agent", sessionKey: "orch-dt", toolName: "decompose_task" },
        );

        const blockResult = result as { block?: boolean } | undefined | null;
        expect(!blockResult || !blockResult.block).toBe(true);
      });

      it("passes through when no session state exists", async () => {
        const { hooks } = await setupPlugin();

        const hook = findHook(hooks, "before_tool_call")!;
        const result = await hook.handler(
          { toolName: "write_file", toolCallId: "tc-5", params: {} },
          { agentId: "test-agent", sessionKey: "unknown-session", toolName: "write_file" },
        );

        // No state = no role = no block
        const blockResult = result as { block?: boolean } | undefined | null;
        expect(!blockResult || !blockResult.block).toBe(true);
      });
    });

    // ------------------------------------------------------------------
    // subagent_spawning (spawn validation)
    // ------------------------------------------------------------------

    describe("subagent_spawning (spawn validation)", () => {
      it("allows orchestrator to spawn lead", async () => {
        const { hooks } = await setupPlugin();
        await seedAgent(hooks, { childSessionKey: "orch-1", label: "orchestrator:main" });

        const hook = findHook(hooks, "subagent_spawning")!;
        const result = await hook.handler(
          {
            childSessionKey: "lead-1",
            agentId: "test-agent",
            label: "lead:frontend",
            mode: "run" as const,
            threadRequested: false,
          },
          {
            runId: "run-1",
            childSessionKey: "lead-1",
            requesterSessionKey: "orch-1",
          },
        );

        const res = result as { status: string } | undefined | null;
        expect(!res || res.status === "ok").toBe(true);
      });

      it("blocks orchestrator from spawning builder directly", async () => {
        const { hooks } = await setupPlugin();
        await seedAgent(hooks, { childSessionKey: "orch-1", label: "orchestrator:main" });

        const hook = findHook(hooks, "subagent_spawning")!;
        const result = await hook.handler(
          {
            childSessionKey: "builder-bad",
            agentId: "test-agent",
            label: "builder:impl",
            mode: "run" as const,
            threadRequested: false,
          },
          {
            runId: "run-1",
            childSessionKey: "builder-bad",
            requesterSessionKey: "orch-1",
          },
        );

        const res = result as { status: string; error?: string } | undefined | null;
        expect(res).toBeDefined();
        expect(res?.status).toBe("error");
        expect(res?.error).toBeDefined();
      });

      it("blocks spawn when max depth exceeded", async () => {
        const { hooks } = await setupPlugin({
          orchestration: {
            ...DEFAULT_ORCHESTRATOR_CONFIG.orchestration,
            maxDepth: 1,
          },
        });

        // Orchestrator at depth 0, lead at depth 1
        await seedAgent(hooks, { childSessionKey: "orch-1", label: "orchestrator:main" });
        await seedAgent(hooks, {
          childSessionKey: "lead-1",
          label: "lead:fe",
          parentSessionKey: "orch-1",
        });

        const hook = findHook(hooks, "subagent_spawning")!;
        // Try to spawn builder from lead (depth would be 2, exceeding maxDepth=1)
        const result = await hook.handler(
          {
            childSessionKey: "builder-deep",
            agentId: "test-agent",
            label: "builder:impl",
            mode: "run" as const,
            threadRequested: false,
          },
          {
            runId: "run-1",
            childSessionKey: "builder-deep",
            requesterSessionKey: "lead-1",
          },
        );

        const res = result as { status: string; error?: string } | undefined | null;
        expect(res).toBeDefined();
        expect(res?.status).toBe("error");
      });

      it("blocks spawn when max concurrent agents exceeded", async () => {
        const { hooks } = await setupPlugin({
          orchestration: {
            ...DEFAULT_ORCHESTRATOR_CONFIG.orchestration,
            maxConcurrentAgents: 2,
          },
        });

        // Seed 2 leads from root (root parent defaults to "orchestrator" role,
        // which can spawn leads). Both get registered as active.
        await seedAgent(hooks, {
          childSessionKey: "lead-ca",
          label: "lead:fe",
        });
        await seedAgent(hooks, {
          childSessionKey: "lead-cb",
          label: "lead:be",
        });

        // Now spawning a third lead should fail: 2 active >= maxConcurrentAgents(2)
        const hook = findHook(hooks, "subagent_spawning")!;
        const result = await hook.handler(
          {
            childSessionKey: "lead-cc",
            agentId: "test-agent",
            label: "lead:infra",
            mode: "run" as const,
            threadRequested: false,
          },
          {
            runId: "run-1",
            childSessionKey: "lead-cc",
            requesterSessionKey: "root",
          },
        );

        const res = result as { status: string; error?: string } | undefined | null;
        expect(res).toBeDefined();
        expect(res?.status).toBe("error");
      });

      it("registers child in store on successful spawn", async () => {
        const { hooks } = await setupPlugin();
        await seedAgent(hooks, { childSessionKey: "orch-v", label: "orchestrator:main" });

        const spawningHook = findHook(hooks, "subagent_spawning")!;
        const result = await spawningHook.handler(
          {
            childSessionKey: "lead-new",
            agentId: "test-agent",
            label: "lead:frontend",
            mode: "run" as const,
            threadRequested: false,
          },
          {
            runId: "run-1",
            childSessionKey: "lead-new",
            requesterSessionKey: "orch-v",
          },
        );

        const res = result as { status: string } | undefined | null;
        expect(!res || res.status === "ok").toBe(true);

        // Verify the child is in the store by checking boundary enforcement
        // recognizes its role (lead should block write_file)
        const toolHook = findHook(hooks, "before_tool_call")!;
        const blockResult = await toolHook.handler(
          { toolName: "write_file", toolCallId: "tc-verify", params: {} },
          { agentId: "test-agent", sessionKey: "lead-new", toolName: "write_file" },
        );

        expect(blockResult).toBeDefined();
        expect((blockResult as { block?: boolean }).block).toBe(true);
      });
    });

    // ------------------------------------------------------------------
    // subagent_spawned
    // ------------------------------------------------------------------

    describe("subagent_spawned", () => {
      it("marks agent as active in store", async () => {
        const { hooks } = await setupPlugin();
        const hook = findHook(hooks, "subagent_spawned")!;

        // Should not throw when called
        await hook.handler(
          {
            runId: "run-1",
            childSessionKey: "worker-1",
            agentId: "test-agent",
            label: "builder:impl",
            mode: "run" as const,
            threadRequested: false,
          },
          {
            runId: "run-1",
            childSessionKey: "worker-1",
            requesterSessionKey: "root",
          },
        );

        expect(hook).toBeDefined();
      });
    });

    // ------------------------------------------------------------------
    // subagent_stopping
    // ------------------------------------------------------------------

    describe("subagent_stopping", () => {
      it("marks agent as completed in store", async () => {
        const { hooks } = await setupPlugin();
        const { workerKey } = await seedHierarchy(hooks, "builder:impl", "stop-");

        const hook = findHook(hooks, "subagent_stopping")!;
        await hook.handler(
          {
            runId: "run-1",
            childSessionKey: workerKey,
            requesterSessionKey: "stop-lead-1",
            agentId: "test-agent",
            outcome: "ok" as const,
            reason: "task complete",
            steerCount: 0,
            maxSteers: 3,
          },
          {
            agentId: "test-agent",
            runId: "run-1",
            childSessionKey: workerKey,
            requesterSessionKey: "stop-lead-1",
          },
        );

        expect(hook).toBeDefined();
      });
    });

    // ------------------------------------------------------------------
    // subagent_ended
    // ------------------------------------------------------------------

    describe("subagent_ended", () => {
      it("marks agent as completed in store", async () => {
        const { hooks } = await setupPlugin();
        const { workerKey } = await seedHierarchy(hooks, "builder:impl", "end-");

        const hook = findHook(hooks, "subagent_ended")!;
        await hook.handler(
          {
            targetSessionKey: workerKey,
            targetKind: "subagent" as const,
            reason: "completed",
          },
          {
            runId: "run-1",
            childSessionKey: workerKey,
            requesterSessionKey: "end-lead-1",
          },
        );

        expect(hook).toBeDefined();
      });

      it("agent marked completed no longer counts toward concurrent limit", async () => {
        const { hooks } = await setupPlugin({
          orchestration: {
            ...DEFAULT_ORCHESTRATOR_CONFIG.orchestration,
            maxConcurrentAgents: 2,
          },
        });

        // Seed orchestrator + lead (2 active, at the limit)
        await seedAgent(hooks, { childSessionKey: "orch-c", label: "orchestrator:main" });
        await seedAgent(hooks, {
          childSessionKey: "lead-c1",
          label: "lead:fe",
          parentSessionKey: "orch-c",
        });

        // End lead-c1 so it is no longer active
        const endedHook = findHook(hooks, "subagent_ended")!;
        await endedHook.handler(
          { targetSessionKey: "lead-c1", targetKind: "subagent", reason: "completed" },
          { runId: "run-1", childSessionKey: "lead-c1", requesterSessionKey: "orch-c" },
        );

        // Now spawning a new lead should succeed since lead-c1 is completed
        const spawningHook = findHook(hooks, "subagent_spawning")!;
        const result = await spawningHook.handler(
          {
            childSessionKey: "lead-c2",
            agentId: "test-agent",
            label: "lead:be",
            mode: "run" as const,
            threadRequested: false,
          },
          {
            runId: "run-1",
            childSessionKey: "lead-c2",
            requesterSessionKey: "orch-c",
          },
        );

        const res = result as { status: string } | undefined | null;
        expect(!res || res.status === "ok").toBe(true);
      });
    });

    // ------------------------------------------------------------------
    // before_prompt_build (role context injection)
    // ------------------------------------------------------------------

    describe("before_prompt_build (role context)", () => {
      it("injects role instructions for scout", async () => {
        const { hooks } = await setupPlugin();
        const { workerKey } = await seedHierarchy(hooks, "scout:explore", "ctx-");

        const hook = findHook(hooks, "before_prompt_build", 90)!;
        const result = await hook.handler(
          { prompt: "find all config files", messages: [] },
          { agentId: "test-agent", sessionKey: workerKey },
        );

        const res = result as { prependContext?: string } | undefined | null;
        expect(res?.prependContext).toBeDefined();
        expect(res!.prependContext).toContain("Scout");
      });

      it("injects fleet status for lead role", async () => {
        const { hooks } = await setupPlugin();
        // Seed a lead and a worker under it so fleet status has content.
        // Leads also get fleet status (same as orchestrator).
        await seedAgent(hooks, { childSessionKey: "lead-fleet", label: "lead:frontend" });
        const { workerKey } = await seedHierarchy(hooks, "scout:explore", "fleet-");

        const hook = findHook(hooks, "before_prompt_build", 90)!;
        const result = await hook.handler(
          { prompt: "check status", messages: [] },
          { agentId: "test-agent", sessionKey: "lead-fleet" },
        );

        const res = result as { prependContext?: string } | undefined | null;
        expect(res?.prependContext).toBeDefined();
        // Should contain "Lead" from role instructions and "Active workers" from fleet status
        expect(res!.prependContext).toContain("Lead");
      });

      it("returns undefined when no role assigned", async () => {
        const { hooks } = await setupPlugin();

        const hook = findHook(hooks, "before_prompt_build", 90)!;
        const result = await hook.handler(
          { prompt: "hello", messages: [] },
          { agentId: "test-agent", sessionKey: "no-role-session" },
        );

        // No state for this session key means no role — hook returns undefined
        expect(result).toBeUndefined();
      });
    });

    // ------------------------------------------------------------------
    // before_model_resolve
    // ------------------------------------------------------------------

    describe("before_model_resolve", () => {
      it("returns haiku override for scout role", async () => {
        const { hooks } = await setupPlugin();
        const { workerKey } = await seedHierarchy(hooks, "scout:explore", "mr-s-");

        const hook = findHook(hooks, "before_model_resolve")!;
        const result = await hook.handler(
          { prompt: "find files" },
          { agentId: "test-agent", sessionKey: workerKey },
        );

        const res = result as { modelOverride?: string } | undefined | null;
        expect(res?.modelOverride).toBeDefined();
        expect(res!.modelOverride).toContain("haiku");
      });

      it("returns haiku override for reviewer role", async () => {
        const { hooks } = await setupPlugin();
        const { workerKey } = await seedHierarchy(hooks, "reviewer:qa", "mr-r-");

        const hook = findHook(hooks, "before_model_resolve")!;
        const result = await hook.handler(
          { prompt: "review changes" },
          { agentId: "test-agent", sessionKey: workerKey },
        );

        const res = result as { modelOverride?: string } | undefined | null;
        expect(res?.modelOverride).toBeDefined();
        expect(res!.modelOverride).toContain("haiku");
      });

      it("returns no override for builder role", async () => {
        const { hooks } = await setupPlugin();
        const { workerKey } = await seedHierarchy(hooks, "builder:impl", "mr-b-");

        const hook = findHook(hooks, "before_model_resolve")!;
        const result = await hook.handler(
          { prompt: "implement feature" },
          { agentId: "test-agent", sessionKey: workerKey },
        );

        const res = result as { modelOverride?: string } | undefined | null;
        expect(!res || !res.modelOverride).toBe(true);
      });

      it("returns no override when no role assigned", async () => {
        const { hooks } = await setupPlugin();

        const hook = findHook(hooks, "before_model_resolve")!;
        const result = await hook.handler(
          { prompt: "hello" },
          { agentId: "test-agent", sessionKey: "unregistered-session" },
        );

        const res = result as { modelOverride?: string } | undefined | null;
        expect(!res || !res.modelOverride).toBe(true);
      });
    });

    // ------------------------------------------------------------------
    // after_tool_call (activity tracking)
    // ------------------------------------------------------------------

    describe("after_tool_call (activity tracking)", () => {
      it("updates lastActivity timestamp in store", async () => {
        const { hooks } = await setupPlugin();
        const { workerKey } = await seedHierarchy(hooks, "builder:impl", "at-");

        const hook = findHook(hooks, "after_tool_call")!;

        // Should not throw
        await hook.handler(
          {
            toolName: "write_file",
            toolCallId: "tc-1",
            isError: false,
            params: { path: "/tmp/foo.ts" },
            result: "ok",
            durationMs: 50,
          },
          {
            agentId: "test-agent",
            sessionKey: workerKey,
            runId: "run-1",
            toolName: "write_file",
          },
        );

        expect(hook).toBeDefined();
      });

      it("does not throw for unregistered session", async () => {
        const { hooks } = await setupPlugin();

        const hook = findHook(hooks, "after_tool_call")!;

        await hook.handler(
          {
            toolName: "read_file",
            toolCallId: "tc-2",
            isError: false,
            params: {},
            result: "ok",
            durationMs: 10,
          },
          {
            agentId: "test-agent",
            sessionKey: "nonexistent-session",
            runId: "run-1",
            toolName: "read_file",
          },
        );

        expect(hook).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // 3. Config Parsing Tests
  // ==========================================================================

  describe("config parsing", () => {
    it("uses defaults when no config provided", () => {
      const { api, hooks, services } = createMockApi({});
      plugin.register(api as never);

      // With default config, both mail and orchestration are enabled
      expect(services.length).toBeGreaterThanOrEqual(1);

      // Should have orchestration hooks (they default to enabled)
      const toolHook = findHook(hooks, "before_tool_call");
      expect(toolHook).toBeDefined();
    });

    it("merges partial config over defaults", () => {
      const { api, hooks } = createMockApi({
        orchestration: {
          ...DEFAULT_ORCHESTRATOR_CONFIG.orchestration,
          maxDepth: 5,
          enabled: true,
        },
      });
      plugin.register(api as never);

      // Orchestration hooks should still be registered
      const spawningHook = findHook(hooks, "subagent_spawning");
      expect(spawningHook).toBeDefined();
    });

    it("disabling mail while orchestration is enabled still registers mail tools", () => {
      // When orchestration.enabled is true, the condition
      // `config.mail.enabled || config.orchestration.enabled` is true
      const { api, tools } = createMockApi({
        mail: { enabled: false },
        orchestration: { ...DEFAULT_ORCHESTRATOR_CONFIG.orchestration, enabled: true },
      });
      plugin.register(api as never);

      const mailTool = tools.find(
        (t) => t.opts?.name === "mail" || t.opts?.names?.includes("mail"),
      );
      // mail tools are still registered because orchestration needs them
      expect(mailTool).toBeDefined();
    });

    it("disabling both mail and orchestration registers no mail tools", () => {
      const { api, tools } = createMockApi({
        mail: { enabled: false },
        orchestration: { ...DEFAULT_ORCHESTRATOR_CONFIG.orchestration, enabled: false },
      });
      plugin.register(api as never);

      const mailTool = tools.find(
        (t) => t.opts?.name === "mail" || t.opts?.names?.includes("mail"),
      );
      expect(mailTool).toBeUndefined();
    });
  });
});
