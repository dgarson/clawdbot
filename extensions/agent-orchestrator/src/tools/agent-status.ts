/**
 * agent_status tool — fleet inspection for orchestrator/lead roles.
 *
 * Returns a summary of all agents (or a specific one), with optional
 * stale-detection annotation.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../../../src/agents/tools/common.js";
import { jsonResult } from "../../../../src/agents/tools/common.js";
import { ROLE_MODEL_OVERRIDES } from "../orchestration/roles.js";
import { detectStaleAgents } from "../orchestration/watchdog.js";
import type { OrchestratorStore } from "../store.js";
import type { AgentRole, OrchestratorConfig, OrchestratorSessionState } from "../types.js";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const STATUS_FILTER_VALUES = ["active", "completed", "stale", "all"] as const;
type StatusFilter = (typeof STATUS_FILTER_VALUES)[number];

const AgentStatusSchema = Type.Object({
  session_key: Type.Optional(
    Type.String({
      description: "Specific session key to inspect. If omitted, returns all agents.",
    }),
  ),
  filter_status: Type.Optional(
    Type.Unsafe<StatusFilter>({
      type: "string",
      enum: [...STATUS_FILTER_VALUES],
      description: "Filter by status. Default: 'all'",
    }),
  ),
  include_stale_check: Type.Optional(
    Type.Boolean({
      description: "Run watchdog stale detection and include results. Default: true",
    }),
  ),
});

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

type AgentEntry = {
  sessionKey: string;
  role?: string;
  depth?: number;
  status?: string;
  parentSessionKey?: string;
  taskDescription?: string;
  fileScope?: string[];
  lastActivity?: string;
  lastActivityAgo?: string;
  isStale?: boolean;
  modelOverride?: string;
};

type StaleEntry = {
  sessionKey: string;
  role: string;
  elapsedMs: number;
  elapsedHuman: string;
};

type AgentStatusResult = {
  fleet: {
    total: number;
    active: number;
    completed: number;
    stale: number;
  };
  agents: AgentEntry[];
  staleAgents?: StaleEntry[];
};

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export type AgentStatusDeps = {
  store: OrchestratorStore;
  config: OrchestratorConfig;
};

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createAgentStatusTool(deps: AgentStatusDeps): AnyAgentTool {
  return {
    label: "Orchestration",
    name: "agent_status",
    description:
      "Inspect the agent fleet. Returns all agents or a specific one, " +
      "with optional stale detection. Only orchestrator and lead roles may call this tool.",
    parameters: AgentStatusSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const sessionKeyFilter =
        typeof params.session_key === "string" ? params.session_key : undefined;
      const filterStatus: StatusFilter =
        typeof params.filter_status === "string" ? (params.filter_status as StatusFilter) : "all";
      const includeStaleCheck =
        typeof params.include_stale_check === "boolean" ? params.include_stale_check : true;

      const now = Date.now();

      // If a specific session_key is requested, return just that one
      if (sessionKeyFilter) {
        const state = deps.store.get(sessionKeyFilter);
        if (!state) {
          return jsonResult({
            error: `No agent found with session key '${sessionKeyFilter}'`,
          });
        }

        const entry = buildAgentEntry(sessionKeyFilter, state, now);
        const result: AgentStatusResult = {
          fleet: { total: 1, active: 0, completed: 0, stale: 0 },
          agents: [entry],
        };
        // Tally the single agent
        if (state.status === "active") result.fleet.active = 1;
        else if (state.status === "completed") result.fleet.completed = 1;
        else if (state.status === "stale") result.fleet.stale = 1;

        return jsonResult(result);
      }

      // Gather all sessions
      const allKeys = deps.store.keys();
      const sessionsMap = new Map<string, OrchestratorSessionState>();
      for (const key of allKeys) {
        const s = deps.store.get(key);
        if (s) sessionsMap.set(key, s);
      }

      // Optional stale detection
      let staleSet = new Set<string>();
      let staleEntries: StaleEntry[] | undefined;
      if (includeStaleCheck) {
        const staleAgents = detectStaleAgents(
          sessionsMap,
          deps.config.orchestration.staleThresholdMs,
          now,
        );
        staleSet = new Set(staleAgents.map((a) => a.sessionKey));
        staleEntries = staleAgents.map((a) => ({
          sessionKey: a.sessionKey,
          role: a.role,
          elapsedMs: a.elapsedMs,
          elapsedHuman: formatElapsed(a.elapsedMs),
        }));
      }

      // Build agent entries
      let agents: AgentEntry[] = [];
      const fleet = { total: 0, active: 0, completed: 0, stale: 0 };

      for (const [key, state] of sessionsMap) {
        const entry = buildAgentEntry(key, state, now);
        if (staleSet.has(key)) {
          entry.isStale = true;
        }

        // Tally
        fleet.total++;
        if (state.status === "active") fleet.active++;
        else if (state.status === "completed") fleet.completed++;
        if (state.status === "stale" || staleSet.has(key)) fleet.stale++;

        agents.push(entry);
      }

      // Apply filter
      if (filterStatus !== "all") {
        agents = agents.filter((a) => {
          if (filterStatus === "stale") return a.isStale === true || a.status === "stale";
          return a.status === filterStatus;
        });
      }

      const result: AgentStatusResult = {
        fleet,
        agents,
      };
      if (staleEntries && staleEntries.length > 0) {
        result.staleAgents = staleEntries;
      }

      return jsonResult(result);
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildAgentEntry(
  sessionKey: string,
  state: OrchestratorSessionState,
  now: number,
): AgentEntry {
  const entry: AgentEntry = {
    sessionKey,
    role: state.role,
    depth: state.depth,
    status: state.status,
    parentSessionKey: state.parentSessionKey,
    taskDescription: state.taskDescription,
    fileScope: state.fileScope,
  };

  if (state.lastActivity) {
    entry.lastActivity = new Date(state.lastActivity).toISOString();
    entry.lastActivityAgo = formatElapsed(now - state.lastActivity);
  }

  // Prefer explicit per-session override, then role default override.
  const explicitModel = state.modelOverride?.trim();
  if (explicitModel) {
    entry.modelOverride = explicitModel;
  } else if (state.role) {
    const roleOverride = ROLE_MODEL_OVERRIDES[state.role];
    if (roleOverride) entry.modelOverride = roleOverride;
  }

  return entry;
}

/** Format a duration in ms to a human-readable "Xs ago" / "Xm ago" / "Xh Ym ago" string. */
export function formatElapsed(ms: number): string {
  if (ms < 0) return "0s ago";
  const totalSeconds = Math.floor(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s ago`;
  const totalMinutes = Math.floor(totalSeconds / 60);
  if (totalMinutes < 60) return `${totalMinutes}m ago`;
  const hours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;
  if (remainingMinutes === 0) return `${hours}h ago`;
  return `${hours}h ${remainingMinutes}m ago`;
}
