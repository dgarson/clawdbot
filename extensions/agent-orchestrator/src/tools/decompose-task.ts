/**
 * decompose_task tool — validates a task decomposition plan for the orchestrator/lead.
 *
 * The tool does NOT directly spawn agents. Instead it validates hierarchy rules,
 * depth limits, and concurrency caps, then returns a validated plan the LLM uses
 * to call `sessions_spawn` for each sub-task.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import { jsonResult } from "../../../../src/agents/tools/common.js";
import { validateSpawn } from "../orchestration/lifecycle.js";
import { ROLE_MODEL_OVERRIDES } from "../orchestration/roles.js";
import type { OrchestratorStore } from "../store.js";
import type { AgentRole, OrchestratorConfig, PendingSpawnIntent } from "../types.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const AGENT_ROLES = ["orchestrator", "lead", "scout", "builder", "reviewer"] as const;

const DecomposeTaskSchema = Type.Object({
  tasks: Type.Array(
    Type.Object({
      role: Type.Unsafe<AgentRole>({
        type: "string",
        enum: [...AGENT_ROLES],
        description: "Role for the sub-agent",
      }),
      task: Type.String({ description: "Task description for the sub-agent" }),
      label: Type.Optional(Type.String({ description: "Short label like 'scout:auth-explore'" })),
      file_scope: Type.Optional(
        Type.Array(Type.String(), {
          description: "Files/dirs this agent owns (builder only)",
        }),
      ),
      model: Type.Optional(Type.String({ description: "Model override (e.g. claude-haiku-4-5)" })),
    }),
    {
      description: "Array of sub-tasks to decompose into. Each becomes a spawned agent.",
      minItems: 1,
      maxItems: 10,
    },
  ),
});

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

type DecomposeTaskEntry = {
  role: string;
  label: string;
  task: string;
  fileScope?: string[];
  model?: string;
  valid: boolean;
  reason?: string;
  spawnCommand: string;
};

type DecomposeResult = {
  parentRole: string;
  parentDepth: number;
  tasks: DecomposeTaskEntry[];
  summary: string;
};

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export type DecomposeTaskDeps = {
  store: OrchestratorStore;
  config: OrchestratorConfig;
  sessionKey: string;
};

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createDecomposeTaskTool(deps: DecomposeTaskDeps): AnyAgentTool {
  return {
    label: "Orchestration",
    name: "decompose_task",
    description:
      "Validate a task decomposition plan. Returns per-task validation results " +
      "and spawn commands for use with sessions_spawn. " +
      "Only orchestrator and lead roles may call this tool.",
    parameters: DecomposeTaskSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const tasksRaw = params.tasks;
      if (!Array.isArray(tasksRaw) || tasksRaw.length === 0) {
        return jsonResult({ error: "tasks array is required and must not be empty" });
      }

      // Resolve parent state
      const parentState = deps.store.get(deps.sessionKey);
      const parentRole: AgentRole = parentState?.role ?? "orchestrator";
      const parentDepth = parentState?.depth ?? 0;

      // Count currently active agents for concurrency check
      const allKeys = deps.store.keys();
      let activeCount = 0;
      for (const key of allKeys) {
        const s = deps.store.get(key);
        if (s?.status === "active") activeCount++;
      }

      const { maxDepth, maxConcurrentAgents } = deps.config.orchestration;

      const validated: DecomposeTaskEntry[] = [];
      const pendingSpawnIntents: PendingSpawnIntent[] = [];
      let validCount = 0;
      let invalidCount = 0;

      for (const step of tasksRaw) {
        const s = step as Record<string, unknown>;
        const childRole = s.role as AgentRole;
        const taskDesc = s.task as string;
        const label = (s.label as string | undefined) ?? `${childRole}:${taskDesc.slice(0, 30)}`;
        const fileScope = Array.isArray(s.file_scope) ? (s.file_scope as string[]) : undefined;
        const model = (s.model as string | undefined) ?? ROLE_MODEL_OVERRIDES[childRole];

        // Validate spawn rules
        const validation = validateSpawn(
          parentRole,
          childRole,
          parentDepth,
          maxDepth,
          activeCount + validCount, // account for already-validated tasks in this batch
          maxConcurrentAgents,
        );

        if (validation.allowed) {
          validCount++;
          pendingSpawnIntents.push({
            role: childRole,
            label,
            taskDescription: taskDesc,
            fileScope,
            modelOverride: model,
          });
          validated.push({
            role: childRole,
            label,
            task: taskDesc,
            fileScope,
            model,
            valid: true,
            spawnCommand: buildSpawnCommand(label, taskDesc, model),
          });
        } else {
          invalidCount++;
          validated.push({
            role: childRole,
            label,
            task: taskDesc,
            fileScope,
            model,
            valid: false,
            reason: validation.reason,
            spawnCommand: "",
          });
        }
      }

      // Persist a queue of planned child metadata so the spawn hook can
      // deterministically hydrate child session state (task + model override).
      deps.store.update(deps.sessionKey, (s) => {
        if (pendingSpawnIntents.length > 0) {
          s.pendingSpawnIntents = pendingSpawnIntents;
        } else {
          delete s.pendingSpawnIntents;
        }
        s.lastActivity = Date.now();
      });

      const result: DecomposeResult = {
        parentRole,
        parentDepth,
        tasks: validated,
        summary: `${validCount} valid, ${invalidCount} invalid out of ${tasksRaw.length} tasks`,
      };

      return jsonResult(result);
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildSpawnCommand(label: string, task: string, model?: string): string {
  const parts = [`Use sessions_spawn with label='${label}'`];
  parts.push(`task='${task.slice(0, 120)}${task.length > 120 ? "..." : ""}'`);
  if (model) {
    parts.push(`model='${model}'`);
  }
  return parts.join(", ");
}
