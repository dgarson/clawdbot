import type { InterAgentMailPluginConfig } from "./mail/config.js";

// Agent roles in the orchestration hierarchy
export type AgentRole = "orchestrator" | "lead" | "scout" | "builder" | "reviewer";

export type PendingSpawnIntent = {
  role: AgentRole;
  label: string;
  taskDescription: string;
  fileScope?: string[];
  modelOverride?: string;
};

// Which roles each role can spawn
export const SPAWN_RULES: Record<AgentRole, AgentRole[]> = {
  orchestrator: ["lead"],
  lead: ["scout", "builder", "reviewer"],
  scout: [],
  builder: [],
  reviewer: [],
};

// Tools blocked per role (tool names from Pi agent tool registry)
export const ROLE_BLOCKED_TOOLS: Record<AgentRole, string[]> = {
  orchestrator: ["write", "edit", "exec", "apply_patch"],
  lead: ["write", "edit", "exec", "apply_patch"],
  scout: ["write", "edit", "exec", "apply_patch"],
  builder: [], // full access
  reviewer: ["write", "edit", "exec", "apply_patch"],
};

// Tools only available to orchestrator/lead
export const ORCHESTRATION_ONLY_TOOLS = ["decompose_task", "agent_status"];

// Per-session state managed by the orchestrator plugin
export type OrchestratorSessionState = {
  role?: AgentRole;
  depth?: number;
  parentSessionKey?: string;
  status?: "active" | "completed" | "stale";
  lastActivity?: number;
  taskDescription?: string;
  fileScope?: string[]; // builder only: which files this agent owns
  modelOverride?: string; // explicit per-agent override (from decomposition plan)
  pendingSpawnIntents?: PendingSpawnIntent[]; // queued child metadata from decompose_task
};

// Orchestration plugin config (parsed from openclaw.plugin.json)
export type OrchestratorMailLoggingConfig = {
  enabled: boolean;
  includeBodyPreview: boolean;
  bodyPreviewChars: number;
  events: {
    send: boolean;
    receipt: boolean;
    forward: boolean;
    ack: boolean;
    bounce: boolean;
  };
};

export type OrchestratorMailConfig = InterAgentMailPluginConfig & {
  enabled: boolean;
  logging: OrchestratorMailLoggingConfig;
};

export type OrchestratorConfig = {
  mail: OrchestratorMailConfig;
  orchestration: {
    enabled: boolean;
    maxDepth: number;
    maxConcurrentAgents: number;
    watchdogIntervalMs: number;
    staleThresholdMs: number;
  };
};

// Default config values
export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  mail: {
    enabled: true,
    logging: {
      enabled: false,
      includeBodyPreview: false,
      bodyPreviewChars: 160,
      events: {
        send: true,
        receipt: true,
        forward: true,
        ack: true,
        bounce: true,
      },
    },
  },
  orchestration: {
    enabled: true,
    maxDepth: 2,
    maxConcurrentAgents: 8,
    watchdogIntervalMs: 60_000,
    staleThresholdMs: 300_000,
  },
};

// Protocol message payload types (structured mail payloads)
export type WorkerDonePayload = {
  filesModified?: string[];
  qualityGates?: Record<string, "pass" | "fail" | "skipped">;
};

export type ReviewResultPayload = {
  verdict: "pass" | "fail";
  issues?: string[];
};

export type EscalationPayload = {
  severity: "warning" | "error" | "critical";
  context: string;
};

export type ScoutResultPayload = {
  findings: string[];
  filesMentioned?: string[];
};

// Role-specific context injection templates
export const ROLE_INSTRUCTIONS: Record<AgentRole, string> = {
  orchestrator:
    "[Agent Orchestrator] You are the team orchestrator. " +
    "Decompose objectives into work streams, spawn leads via decompose_task, " +
    "monitor progress via agent_status and mail. Never write code directly.",
  lead:
    "[Agent Lead] You are a work stream lead. " +
    "Spawn scouts to explore, builders to implement, and reviewers to validate. " +
    "Use decompose_task to create workers. Coordinate via mail. Never write code directly.",
  scout:
    "[Agent Scout] You are a read-only exploration agent. " +
    "Gather information, analyze code, and report findings via mail. " +
    "You CANNOT modify files. Send results to your lead when done.",
  builder:
    "[Agent Builder] You are an implementation agent. " +
    "Build to spec, run quality gates (tests, lint, typecheck), and report completion via mail. " +
    "Only modify files in your assigned scope.",
  reviewer:
    "[Agent Reviewer] You are a validation agent. " +
    "Review changes, run quality gates, and report a clear PASS or FAIL verdict via mail. " +
    "You CANNOT modify files. Be thorough and specific about any issues.",
};
