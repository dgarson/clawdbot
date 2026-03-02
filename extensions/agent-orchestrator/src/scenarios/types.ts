/**
 * Scenario schema types for the agent-orchestrator scenario runner.
 *
 * Each scenario is a sequence of steps that simulate a full lifecycle
 * of agents interacting through the plugin's hook chain.
 */

export type ScenarioStep =
  | {
      type: "spawn";
      session: string;
      role: string;
      parent?: string;
      label?: string;
      expect?: "ok" | "error";
      expectError?: string;
    }
  | {
      type: "tool_call";
      session: string;
      tool: string;
      params?: Record<string, unknown>;
      expect: "allow" | "block";
      expectReason?: string;
    }
  | { type: "stop"; session: string; outcome?: "ok" | "error" | "timeout" }
  | { type: "end"; session: string; reason?: string }
  | {
      type: "prompt_build";
      session: string;
      prompt?: string;
      expectContext?: string;
      expectNoContext?: boolean;
    }
  | {
      type: "model_resolve";
      session: string;
      prompt?: string;
      expectModel?: string;
      expectNoOverride?: boolean;
    }
  | { type: "after_tool"; session: string; tool: string }
  | {
      type: "health_check";
      expectStale?: string[];
      expectNotStale?: string[];
      threshold?: number;
    }
  | { type: "assert_active_count"; count: number }
  | {
      type: "assert_session_state";
      session: string;
      role?: string;
      depth?: number;
      status?: string;
      hasParent?: string;
    }
  | { type: "wait_ms"; ms: number }
  | { type: "comment"; text: string };

export type Scenario = {
  name: string;
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
  steps: ScenarioStep[];
};
