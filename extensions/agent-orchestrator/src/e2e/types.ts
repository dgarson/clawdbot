/**
 * E2E scenario schema for multi-agent workflow tests.
 *
 * Unlike the hook-level scenario runner (src/scenarios/), these scenarios
 * test compound workflows: agents spawn, exchange mail, make tool calls,
 * and complete — simulating real multi-agent project execution.
 */

export type AgentDef = {
  sessionKey: string;
  label: string; // e.g. "builder:jwt-impl"
  parent?: string; // parent sessionKey
  taskDescription?: string;
  fileScope?: string[]; // builder only
};

export type MailMessage = {
  to: string; // recipient sessionKey
  subject: string;
  body: string;
  urgency?: "low" | "normal" | "high" | "urgent";
  tags?: string[];
};

export type ToolCallSpec = {
  tool: string;
  params?: Record<string, unknown>;
  expect: "allow" | "block";
  expectReason?: string;
};

export type FleetExpectation = {
  activeCount?: number;
  completedCount?: number;
  agents?: Array<{
    sessionKey: string;
    role?: string;
    status?: string;
    depth?: number;
    parent?: string;
  }>;
};

export type E2EStep =
  // Seed the full agent fleet in one step
  | { action: "seed_fleet"; agents: AgentDef[] }

  // Simulate an agent taking a turn: optionally reads mail, does tool calls, sends mail
  | {
      action: "agent_turn";
      actor: string;
      reads_mail?: boolean;
      tool_calls?: ToolCallSpec[];
      sends_mail?: MailMessage[];
      outcome?: "active" | "completed";
    }

  // Spawn a single agent mid-scenario
  | { action: "spawn_agent"; agent: AgentDef; expect?: "ok" | "error"; expectError?: string }

  // End an agent
  | { action: "end_agent"; session: string; reason?: string }

  // Assert fleet state
  | { action: "assert_fleet"; expect: FleetExpectation }

  // Assert specific agent's mail inbox
  | {
      action: "assert_inbox";
      session: string;
      expectCount?: number;
      expectSubjects?: string[];
      expectEmpty?: boolean;
    }

  // Assert model override for an agent
  | { action: "assert_model"; session: string; expectModel?: string; expectNoOverride?: boolean }

  // Assert context injection
  | {
      action: "assert_context";
      session: string;
      expectContains?: string[];
      expectNotContains?: string[];
    }

  // Simulate time passing (for watchdog tests)
  | { action: "wait_ms"; ms: number }

  // Documentation comment
  | { action: "comment"; text: string };

export type E2EScenario = {
  id: string;
  description: string;
  config?: {
    mail?: { enabled: boolean };
    orchestration?: {
      enabled?: boolean;
      maxDepth?: number;
      maxConcurrentAgents?: number;
      staleThresholdMs?: number;
    };
  };
  steps: E2EStep[];
};
