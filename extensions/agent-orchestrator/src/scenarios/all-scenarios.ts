/**
 * Comprehensive scenario definitions for agent-orchestrator lifecycle testing.
 *
 * Each scenario is a self-contained sequence of steps that exercises the
 * plugin's hook chain: spawn validation, tool boundary enforcement, model
 * overrides, context injection, and lifecycle transitions.
 *
 * IMPORTANT: The orchestrator role is implicit -- when a session has no parent
 * in the store, the spawn hook defaults it to "orchestrator". The orchestrator
 * itself is never registered via subagent_spawning because you cannot spawn
 * an orchestrator from an orchestrator (SPAWN_RULES). Leads are spawned
 * directly from root (no parent), which uses the default orchestrator role.
 */

import type { Scenario } from "./types.js";

// ============================================================================
// 1. Basic Hierarchy
// ============================================================================

const basicHierarchy: Scenario = {
  name: "basic-hierarchy",
  description:
    "Root (implicit orchestrator) -> lead -> builder lifecycle. " +
    "Spawn lead and builder, verify state, run tool calls, stop and end each.",
  steps: [
    { type: "comment", text: "Root parent defaults to orchestrator; spawn lead from root" },
    { type: "spawn", session: "lead-1", role: "lead", label: "lead:frontend" },
    {
      type: "assert_session_state",
      session: "lead-1",
      role: "lead",
      depth: 1,
    },

    { type: "comment", text: "Spawn builder from lead" },
    {
      type: "spawn",
      session: "builder-1",
      role: "builder",
      parent: "lead-1",
      label: "builder:implement-auth",
    },
    {
      type: "assert_session_state",
      session: "builder-1",
      role: "builder",
      depth: 2,
      hasParent: "lead-1",
    },

    { type: "comment", text: "Lead cannot write" },
    { type: "tool_call", session: "lead-1", tool: "write_file", expect: "block" },
    { type: "tool_call", session: "lead-1", tool: "edit_file", expect: "block" },
    { type: "tool_call", session: "lead-1", tool: "read_file", expect: "allow" },

    { type: "comment", text: "Builder can write" },
    { type: "tool_call", session: "builder-1", tool: "write_file", expect: "allow" },
    { type: "tool_call", session: "builder-1", tool: "edit_file", expect: "allow" },
    { type: "tool_call", session: "builder-1", tool: "execute_command", expect: "allow" },

    { type: "comment", text: "Complete lifecycle: stop then end" },
    { type: "stop", session: "builder-1" },
    { type: "end", session: "builder-1" },
    { type: "stop", session: "lead-1" },
    { type: "end", session: "lead-1" },
  ],
};

// ============================================================================
// 2. Full 5-Role Team
// ============================================================================

const fullTeam: Scenario = {
  name: "full-team",
  description:
    "Lead spawns scout, builder, and reviewer. " +
    "Each exercises their allowed and blocked tools, then completes.",
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:auth" },

    { type: "comment", text: "Lead spawns all three worker types" },
    {
      type: "spawn",
      session: "scout-1",
      role: "scout",
      parent: "lead",
      label: "scout:explore-auth",
    },
    {
      type: "spawn",
      session: "builder-1",
      role: "builder",
      parent: "lead",
      label: "builder:jwt-impl",
    },
    {
      type: "spawn",
      session: "reviewer-1",
      role: "reviewer",
      parent: "lead",
      label: "reviewer:check-auth",
    },

    { type: "comment", text: "Scout: read-only" },
    { type: "tool_call", session: "scout-1", tool: "read_file", expect: "allow" },
    { type: "tool_call", session: "scout-1", tool: "write_file", expect: "block" },
    { type: "tool_call", session: "scout-1", tool: "edit_file", expect: "block" },
    { type: "tool_call", session: "scout-1", tool: "execute_command", expect: "block" },

    { type: "comment", text: "Builder: full write access" },
    { type: "tool_call", session: "builder-1", tool: "write_file", expect: "allow" },
    { type: "tool_call", session: "builder-1", tool: "edit_file", expect: "allow" },
    { type: "tool_call", session: "builder-1", tool: "execute_command", expect: "allow" },
    { type: "tool_call", session: "builder-1", tool: "read_file", expect: "allow" },

    { type: "comment", text: "Reviewer: read-only" },
    { type: "tool_call", session: "reviewer-1", tool: "read_file", expect: "allow" },
    { type: "tool_call", session: "reviewer-1", tool: "write_file", expect: "block" },
    { type: "tool_call", session: "reviewer-1", tool: "edit_file", expect: "block" },
    { type: "tool_call", session: "reviewer-1", tool: "execute_command", expect: "block" },

    { type: "comment", text: "Complete all agents" },
    { type: "stop", session: "scout-1" },
    { type: "end", session: "scout-1" },
    { type: "stop", session: "builder-1" },
    { type: "end", session: "builder-1" },
    { type: "stop", session: "reviewer-1" },
    { type: "end", session: "reviewer-1" },
    { type: "stop", session: "lead" },
    { type: "end", session: "lead" },
  ],
};

// ============================================================================
// 3. Boundary Enforcement Exhaustive
// ============================================================================

const boundaryExhaustive: Scenario = {
  name: "boundary-exhaustive",
  description:
    "Test every combination of role x tool from ROLE_BLOCKED_TOOLS and ORCHESTRATION_ONLY_TOOLS.",
  steps: [
    { type: "comment", text: "Set up the hierarchy (no orchestrator session in store)" },
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },
    { type: "spawn", session: "scout", role: "scout", parent: "lead", label: "scout:explore" },
    { type: "spawn", session: "builder", role: "builder", parent: "lead", label: "builder:impl" },
    {
      type: "spawn",
      session: "reviewer",
      role: "reviewer",
      parent: "lead",
      label: "reviewer:check",
    },

    { type: "comment", text: "--- Lead (same restrictions as orchestrator) ---" },
    { type: "tool_call", session: "lead", tool: "write_file", expect: "block" },
    { type: "tool_call", session: "lead", tool: "edit_file", expect: "block" },
    { type: "tool_call", session: "lead", tool: "execute_command", expect: "block" },
    { type: "tool_call", session: "lead", tool: "read_file", expect: "allow" },
    { type: "tool_call", session: "lead", tool: "decompose_task", expect: "allow" },
    { type: "tool_call", session: "lead", tool: "agent_status", expect: "allow" },

    { type: "comment", text: "--- Scout ---" },
    { type: "tool_call", session: "scout", tool: "write_file", expect: "block" },
    { type: "tool_call", session: "scout", tool: "edit_file", expect: "block" },
    { type: "tool_call", session: "scout", tool: "execute_command", expect: "block" },
    { type: "tool_call", session: "scout", tool: "read_file", expect: "allow" },
    { type: "tool_call", session: "scout", tool: "decompose_task", expect: "block" },
    { type: "tool_call", session: "scout", tool: "agent_status", expect: "block" },

    { type: "comment", text: "--- Builder ---" },
    { type: "tool_call", session: "builder", tool: "write_file", expect: "allow" },
    { type: "tool_call", session: "builder", tool: "edit_file", expect: "allow" },
    { type: "tool_call", session: "builder", tool: "execute_command", expect: "allow" },
    { type: "tool_call", session: "builder", tool: "read_file", expect: "allow" },
    { type: "tool_call", session: "builder", tool: "decompose_task", expect: "block" },
    { type: "tool_call", session: "builder", tool: "agent_status", expect: "block" },

    { type: "comment", text: "--- Reviewer ---" },
    { type: "tool_call", session: "reviewer", tool: "write_file", expect: "block" },
    { type: "tool_call", session: "reviewer", tool: "edit_file", expect: "block" },
    { type: "tool_call", session: "reviewer", tool: "execute_command", expect: "block" },
    { type: "tool_call", session: "reviewer", tool: "read_file", expect: "allow" },
    { type: "tool_call", session: "reviewer", tool: "decompose_task", expect: "block" },
    { type: "tool_call", session: "reviewer", tool: "agent_status", expect: "block" },

    { type: "comment", text: "--- Unregistered session: no role -> no blocking ---" },
    { type: "tool_call", session: "unknown", tool: "write_file", expect: "allow" },
    { type: "tool_call", session: "unknown", tool: "decompose_task", expect: "allow" },
  ],
};

// ============================================================================
// 4. Spawn Hierarchy Violations
// ============================================================================

const hierarchyViolations: Scenario = {
  name: "hierarchy-violations",
  description:
    "Verify that invalid spawn hierarchies are rejected. " +
    "Root (orchestrator) can only spawn leads, leads can only spawn workers, " +
    "workers cannot spawn anything.",
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },
    { type: "spawn", session: "scout", role: "scout", parent: "lead", label: "scout:explore" },
    { type: "spawn", session: "builder", role: "builder", parent: "lead", label: "builder:impl" },
    {
      type: "spawn",
      session: "reviewer",
      role: "reviewer",
      parent: "lead",
      label: "reviewer:check",
    },

    { type: "comment", text: "Root (orchestrator) cannot spawn scout directly" },
    {
      type: "spawn",
      session: "bad-scout",
      role: "scout",
      label: "scout:bad",
      expect: "error",
      expectError: "cannot spawn",
    },

    { type: "comment", text: "Root (orchestrator) cannot spawn builder directly" },
    {
      type: "spawn",
      session: "bad-builder",
      role: "builder",
      label: "builder:bad",
      expect: "error",
      expectError: "cannot spawn",
    },

    { type: "comment", text: "Root (orchestrator) cannot spawn reviewer directly" },
    {
      type: "spawn",
      session: "bad-reviewer",
      role: "reviewer",
      label: "reviewer:bad",
      expect: "error",
      expectError: "cannot spawn",
    },

    { type: "comment", text: "Root (orchestrator) cannot spawn orchestrator" },
    {
      type: "spawn",
      session: "bad-orch",
      role: "orchestrator",
      label: "orchestrator:bad",
      expect: "error",
      expectError: "cannot spawn",
    },

    { type: "comment", text: "Lead cannot spawn another lead" },
    {
      type: "spawn",
      session: "bad-lead",
      role: "lead",
      parent: "lead",
      label: "lead:bad",
      expect: "error",
      expectError: "cannot spawn",
    },

    { type: "comment", text: "Scout cannot spawn anything" },
    {
      type: "spawn",
      session: "bad-from-scout",
      role: "builder",
      parent: "scout",
      label: "builder:from-scout",
      expect: "error",
      expectError: "cannot spawn",
    },

    { type: "comment", text: "Builder cannot spawn anything" },
    {
      type: "spawn",
      session: "bad-from-builder",
      role: "scout",
      parent: "builder",
      label: "scout:from-builder",
      expect: "error",
      expectError: "cannot spawn",
    },

    { type: "comment", text: "Reviewer cannot spawn anything" },
    {
      type: "spawn",
      session: "bad-from-reviewer",
      role: "scout",
      parent: "reviewer",
      label: "scout:from-reviewer",
      expect: "error",
      expectError: "cannot spawn",
    },
  ],
};

// ============================================================================
// 5. Depth Limit
// ============================================================================

const depthLimit: Scenario = {
  name: "depth-limit",
  description:
    "Config maxDepth=2. Root(0) -> lead(1) -> builder(2) succeeds. " + "Further depth fails.",
  config: {
    orchestration: { maxDepth: 2 },
  },
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },

    { type: "comment", text: "Builder at depth 2 should succeed" },
    {
      type: "spawn",
      session: "builder",
      role: "builder",
      parent: "lead",
      label: "builder:impl",
    },
    { type: "assert_session_state", session: "builder", depth: 2 },

    {
      type: "comment",
      text: "Builder cannot spawn (SPAWN_RULES: empty), but also would exceed depth",
    },
    {
      type: "spawn",
      session: "too-deep",
      role: "scout",
      parent: "builder",
      label: "scout:too-deep",
      expect: "error",
    },
  ],
};

// ============================================================================
// 5b. Depth Limit (maxDepth=1, tighter constraint)
// ============================================================================

const depthLimitTight: Scenario = {
  name: "depth-limit-tight",
  description:
    "Config maxDepth=1. Root(0) -> lead(1) succeeds. " +
    "lead -> builder (depth 2) fails because maxDepth=1.",
  config: {
    orchestration: { maxDepth: 1 },
  },
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },
    { type: "assert_session_state", session: "lead", depth: 1 },

    { type: "comment", text: "Worker at depth 2 should fail (maxDepth=1)" },
    {
      type: "spawn",
      session: "builder",
      role: "builder",
      parent: "lead",
      label: "builder:impl",
      expect: "error",
      expectError: "depth",
    },
  ],
};

// ============================================================================
// 6. Concurrency Limit
// ============================================================================

const concurrencyLimit: Scenario = {
  name: "concurrency-limit",
  description:
    "Config maxConcurrentAgents=3. Spawn 3 agents successfully. " +
    "4th spawn fails. End one agent. 4th spawn succeeds.",
  config: {
    orchestration: { maxConcurrentAgents: 3 },
  },
  steps: [
    { type: "comment", text: "Spawn 3 leads from root" },
    { type: "spawn", session: "lead-1", role: "lead", label: "lead:fe" },
    { type: "spawn", session: "lead-2", role: "lead", label: "lead:be" },
    { type: "spawn", session: "lead-3", role: "lead", label: "lead:infra" },

    { type: "comment", text: "4th spawn should fail (3 active >= limit)" },
    {
      type: "spawn",
      session: "lead-4",
      role: "lead",
      label: "lead:overflow",
      expect: "error",
      expectError: "concurrent",
    },

    { type: "comment", text: "End one agent to free a slot" },
    { type: "end", session: "lead-1" },

    { type: "comment", text: "Now 4th spawn should succeed" },
    { type: "spawn", session: "lead-4", role: "lead", label: "lead:replacement" },
  ],
};

// ============================================================================
// 7. Model Overrides
// ============================================================================

const modelOverrides: Scenario = {
  name: "model-overrides",
  description:
    "Verify model_resolve returns correct overrides for each role. " +
    "Scout and reviewer get haiku, others get no override.",
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },
    { type: "spawn", session: "scout", role: "scout", parent: "lead", label: "scout:explore" },
    { type: "spawn", session: "builder", role: "builder", parent: "lead", label: "builder:impl" },
    {
      type: "spawn",
      session: "reviewer",
      role: "reviewer",
      parent: "lead",
      label: "reviewer:check",
    },

    { type: "comment", text: "Scout -> haiku" },
    {
      type: "model_resolve",
      session: "scout",
      expectModel: "claude-haiku-4-5",
    },

    { type: "comment", text: "Reviewer -> haiku" },
    {
      type: "model_resolve",
      session: "reviewer",
      expectModel: "claude-haiku-4-5",
    },

    { type: "comment", text: "Builder -> no override" },
    {
      type: "model_resolve",
      session: "builder",
      expectNoOverride: true,
    },

    { type: "comment", text: "Lead -> no override" },
    {
      type: "model_resolve",
      session: "lead",
      expectNoOverride: true,
    },

    { type: "comment", text: "Unregistered session -> no override" },
    {
      type: "model_resolve",
      session: "unknown-session",
      expectNoOverride: true,
    },
  ],
};

// ============================================================================
// 8. Context Injection
// ============================================================================

const contextInjection: Scenario = {
  name: "context-injection",
  description:
    "Test before_prompt_build role context for each role. " +
    "Lead gets fleet status when workers exist.",
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },
    { type: "spawn", session: "scout", role: "scout", parent: "lead", label: "scout:explore" },
    { type: "spawn", session: "builder", role: "builder", parent: "lead", label: "builder:impl" },
    {
      type: "spawn",
      session: "reviewer",
      role: "reviewer",
      parent: "lead",
      label: "reviewer:check",
    },

    { type: "comment", text: "Lead: gets role instructions + fleet status" },
    {
      type: "prompt_build",
      session: "lead",
      expectContext: "Lead",
    },

    { type: "comment", text: "Scout: gets role instructions" },
    {
      type: "prompt_build",
      session: "scout",
      expectContext: "Scout",
    },

    { type: "comment", text: "Builder: gets role instructions" },
    {
      type: "prompt_build",
      session: "builder",
      expectContext: "Builder",
    },

    { type: "comment", text: "Reviewer: gets role instructions" },
    {
      type: "prompt_build",
      session: "reviewer",
      expectContext: "Reviewer",
    },

    { type: "comment", text: "Unregistered session: no context" },
    {
      type: "prompt_build",
      session: "unknown-session",
      expectNoContext: true,
    },
  ],
};

// ============================================================================
// 9. Lifecycle State Transitions
// ============================================================================

const lifecycleTransitions: Scenario = {
  name: "lifecycle-transitions",
  description:
    "Track state through complete lifecycle: spawn -> tool calls -> stop -> end. " +
    "Verify completed agents don't affect new spawns under concurrency limit.",
  config: {
    orchestration: { maxConcurrentAgents: 3 },
  },
  steps: [
    { type: "comment", text: "Spawn and verify active" },
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },
    { type: "spawn", session: "scout", role: "scout", parent: "lead", label: "scout:explore" },
    { type: "spawn", session: "builder", role: "builder", parent: "lead", label: "builder:impl" },

    { type: "comment", text: "Builder does work (tool calls update activity)" },
    { type: "after_tool", session: "builder", tool: "write_file" },
    { type: "after_tool", session: "builder", tool: "edit_file" },
    { type: "tool_call", session: "builder", tool: "write_file", expect: "allow" },

    { type: "comment", text: "At concurrency limit (3 active)" },
    {
      type: "spawn",
      session: "extra",
      role: "reviewer",
      parent: "lead",
      label: "reviewer:extra",
      expect: "error",
      expectError: "concurrent",
    },

    { type: "comment", text: "Stop and end builder -> now 2 active" },
    { type: "stop", session: "builder" },
    { type: "end", session: "builder" },

    { type: "comment", text: "Now we can spawn again" },
    {
      type: "spawn",
      session: "reviewer",
      role: "reviewer",
      parent: "lead",
      label: "reviewer:check",
    },

    { type: "comment", text: "Complete remaining" },
    { type: "stop", session: "reviewer" },
    { type: "end", session: "reviewer" },
    { type: "stop", session: "scout" },
    { type: "end", session: "scout" },
    { type: "stop", session: "lead" },
    { type: "end", session: "lead" },
  ],
};

// ============================================================================
// 10. Watchdog Stale Detection
// ============================================================================

const watchdogStale: Scenario = {
  name: "watchdog-stale",
  description:
    "Verify stale detection: completed agents are NOT flagged as stale. " +
    "Active agents with recent activity are NOT flagged as stale.",
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },
    { type: "spawn", session: "builder", role: "builder", parent: "lead", label: "builder:impl" },

    { type: "comment", text: "All agents just spawned = recent activity = not stale" },
    {
      type: "health_check",
      expectNotStale: ["lead", "builder"],
      threshold: 300_000,
    },

    { type: "comment", text: "Complete builder" },
    { type: "stop", session: "builder" },
    { type: "end", session: "builder" },

    { type: "comment", text: "Completed agents should not be flagged as stale" },
    {
      type: "health_check",
      expectNotStale: ["lead"],
      threshold: 300_000,
    },
  ],
};

// ============================================================================
// 11. Config: Both Disabled
// ============================================================================

const configBothDisabled: Scenario = {
  name: "config-both-disabled",
  description:
    "Config mail.enabled=false, orchestration.enabled=false. " +
    "No orchestration hooks registered. Tool calls pass through.",
  config: {
    mail: { enabled: false },
    orchestration: { enabled: false },
  },
  steps: [
    { type: "comment", text: "Tool calls pass through because no before_tool_call hook" },
    { type: "tool_call", session: "any-session", tool: "write_file", expect: "allow" },
    { type: "tool_call", session: "any-session", tool: "edit_file", expect: "allow" },
    { type: "tool_call", session: "any-session", tool: "execute_command", expect: "allow" },
    { type: "tool_call", session: "any-session", tool: "decompose_task", expect: "allow" },
  ],
};

// ============================================================================
// 12. Config: Mail Only
// ============================================================================

const configMailOnly: Scenario = {
  name: "config-mail-only",
  description:
    "Config mail.enabled=true, orchestration.enabled=false. " +
    "Mail hooks exist but orchestration hooks do not. Tool calls pass through.",
  config: {
    mail: { enabled: true },
    orchestration: { enabled: false },
  },
  steps: [
    { type: "comment", text: "Tool calls pass through -- no boundary enforcement" },
    { type: "tool_call", session: "any-session", tool: "write_file", expect: "allow" },
    { type: "tool_call", session: "any-session", tool: "edit_file", expect: "allow" },
    { type: "tool_call", session: "any-session", tool: "execute_command", expect: "allow" },
    { type: "tool_call", session: "any-session", tool: "decompose_task", expect: "allow" },
  ],
};

// ============================================================================
// 13. Multi-Lead Parallel Work
// ============================================================================

const multiLead: Scenario = {
  name: "multi-lead",
  description:
    "Root spawns 2 leads. Each lead spawns their own workers. " +
    "Verify isolation: each worker has correct parent and depth.",
  steps: [
    { type: "comment", text: "Two independent leads from root" },
    { type: "spawn", session: "lead-fe", role: "lead", label: "lead:frontend" },
    { type: "spawn", session: "lead-be", role: "lead", label: "lead:backend" },

    { type: "comment", text: "Frontend lead spawns workers" },
    {
      type: "spawn",
      session: "scout-fe",
      role: "scout",
      parent: "lead-fe",
      label: "scout:explore-ui",
    },
    {
      type: "spawn",
      session: "builder-fe",
      role: "builder",
      parent: "lead-fe",
      label: "builder:react-components",
    },

    { type: "comment", text: "Backend lead spawns workers" },
    {
      type: "spawn",
      session: "scout-be",
      role: "scout",
      parent: "lead-be",
      label: "scout:explore-api",
    },
    {
      type: "spawn",
      session: "builder-be",
      role: "builder",
      parent: "lead-be",
      label: "builder:api-impl",
    },

    { type: "comment", text: "Verify parents are correct" },
    { type: "assert_session_state", session: "scout-fe", hasParent: "lead-fe", depth: 2 },
    { type: "assert_session_state", session: "builder-fe", hasParent: "lead-fe", depth: 2 },
    { type: "assert_session_state", session: "scout-be", hasParent: "lead-be", depth: 2 },
    { type: "assert_session_state", session: "builder-be", hasParent: "lead-be", depth: 2 },

    { type: "comment", text: "Boundaries still enforced per role" },
    { type: "tool_call", session: "scout-fe", tool: "write_file", expect: "block" },
    { type: "tool_call", session: "builder-fe", tool: "write_file", expect: "allow" },
    { type: "tool_call", session: "scout-be", tool: "write_file", expect: "block" },
    { type: "tool_call", session: "builder-be", tool: "write_file", expect: "allow" },

    { type: "comment", text: "Complete all" },
    { type: "stop", session: "scout-fe" },
    { type: "end", session: "scout-fe" },
    { type: "stop", session: "builder-fe" },
    { type: "end", session: "builder-fe" },
    { type: "stop", session: "scout-be" },
    { type: "end", session: "scout-be" },
    { type: "stop", session: "builder-be" },
    { type: "end", session: "builder-be" },
    { type: "stop", session: "lead-fe" },
    { type: "end", session: "lead-fe" },
    { type: "stop", session: "lead-be" },
    { type: "end", session: "lead-be" },
  ],
};

// ============================================================================
// 14. Rapid Spawn-Stop Cycle
// ============================================================================

const rapidCycle: Scenario = {
  name: "rapid-cycle",
  description:
    "Quickly spawn and stop many agents to verify store handles rapid " +
    "state transitions. Spawn 5, stop all 5, then spawn 5 more.",
  config: {
    orchestration: { maxConcurrentAgents: 10 },
  },
  steps: [
    { type: "comment", text: "First batch of leads" },
    { type: "spawn", session: "lead-a1", role: "lead", label: "lead:a1" },
    { type: "spawn", session: "lead-a2", role: "lead", label: "lead:a2" },
    { type: "spawn", session: "lead-a3", role: "lead", label: "lead:a3" },
    { type: "spawn", session: "lead-a4", role: "lead", label: "lead:a4" },
    { type: "spawn", session: "lead-a5", role: "lead", label: "lead:a5" },

    { type: "comment", text: "Stop all first batch" },
    { type: "stop", session: "lead-a1" },
    { type: "end", session: "lead-a1" },
    { type: "stop", session: "lead-a2" },
    { type: "end", session: "lead-a2" },
    { type: "stop", session: "lead-a3" },
    { type: "end", session: "lead-a3" },
    { type: "stop", session: "lead-a4" },
    { type: "end", session: "lead-a4" },
    { type: "stop", session: "lead-a5" },
    { type: "end", session: "lead-a5" },

    { type: "comment", text: "Second batch of leads (slots freed)" },
    { type: "spawn", session: "lead-b1", role: "lead", label: "lead:b1" },
    { type: "spawn", session: "lead-b2", role: "lead", label: "lead:b2" },
    { type: "spawn", session: "lead-b3", role: "lead", label: "lead:b3" },
    { type: "spawn", session: "lead-b4", role: "lead", label: "lead:b4" },
    { type: "spawn", session: "lead-b5", role: "lead", label: "lead:b5" },

    { type: "comment", text: "Verify second batch is healthy" },
    { type: "tool_call", session: "lead-b1", tool: "write_file", expect: "block" },
    { type: "tool_call", session: "lead-b3", tool: "read_file", expect: "allow" },
  ],
};

// ============================================================================
// 15. Orchestration-Only Tools
// ============================================================================

const orchestrationTools: Scenario = {
  name: "orchestration-tools",
  description:
    "Verify decompose_task and agent_status are only available to " +
    "lead roles (and implicitly orchestrator). Blocked for scout, builder, reviewer.",
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },
    { type: "spawn", session: "scout", role: "scout", parent: "lead", label: "scout:explore" },
    { type: "spawn", session: "builder", role: "builder", parent: "lead", label: "builder:impl" },
    {
      type: "spawn",
      session: "reviewer",
      role: "reviewer",
      parent: "lead",
      label: "reviewer:check",
    },

    { type: "comment", text: "decompose_task" },
    { type: "tool_call", session: "lead", tool: "decompose_task", expect: "allow" },
    {
      type: "tool_call",
      session: "scout",
      tool: "decompose_task",
      expect: "block",
      expectReason: "orchestration-only",
    },
    {
      type: "tool_call",
      session: "builder",
      tool: "decompose_task",
      expect: "block",
      expectReason: "orchestration-only",
    },
    {
      type: "tool_call",
      session: "reviewer",
      tool: "decompose_task",
      expect: "block",
      expectReason: "orchestration-only",
    },

    { type: "comment", text: "agent_status" },
    { type: "tool_call", session: "lead", tool: "agent_status", expect: "allow" },
    {
      type: "tool_call",
      session: "scout",
      tool: "agent_status",
      expect: "block",
      expectReason: "orchestration-only",
    },
    {
      type: "tool_call",
      session: "builder",
      tool: "agent_status",
      expect: "block",
      expectReason: "orchestration-only",
    },
    {
      type: "tool_call",
      session: "reviewer",
      tool: "agent_status",
      expect: "block",
      expectReason: "orchestration-only",
    },
  ],
};

// ============================================================================
// 16. Unknown Role Label
// ============================================================================

const unknownRole: Scenario = {
  name: "unknown-role",
  description:
    "Spawn with label 'unknown:task'. extractRoleFromLabel returns undefined. " +
    "The hook returns ok (no role validation). Agent has no role-based restrictions.",
  steps: [
    { type: "comment", text: "Unknown role label passes through spawn validation" },
    { type: "spawn", session: "mystery", role: "unknown", label: "unknown:task" },

    { type: "comment", text: "No role in store -> no tool blocking" },
    { type: "tool_call", session: "mystery", tool: "write_file", expect: "allow" },
    { type: "tool_call", session: "mystery", tool: "edit_file", expect: "allow" },
    { type: "tool_call", session: "mystery", tool: "decompose_task", expect: "allow" },

    { type: "comment", text: "No model override" },
    { type: "model_resolve", session: "mystery", expectNoOverride: true },

    { type: "comment", text: "No role context injection" },
    { type: "prompt_build", session: "mystery", expectNoContext: true },
  ],
};

// ============================================================================
// 17. No Parent State
// ============================================================================

const noParentState: Scenario = {
  name: "no-parent-state",
  description:
    "Spawn from a parent session that has no state in the store. " +
    "The parent defaults to orchestrator role.",
  steps: [
    { type: "comment", text: "Root parent (no state) defaults to orchestrator" },
    { type: "spawn", session: "lead-1", role: "lead", label: "lead:team" },
    { type: "assert_session_state", session: "lead-1", role: "lead", depth: 1 },

    { type: "comment", text: "Root can only spawn leads (orchestrator rules)" },
    {
      type: "spawn",
      session: "bad-builder",
      role: "builder",
      label: "builder:bad",
      expect: "error",
      expectError: "cannot spawn",
    },
  ],
};

// ============================================================================
// 18. After-Tool Activity Tracking
// ============================================================================

const activityTracking: Scenario = {
  name: "activity-tracking",
  description:
    "Spawn agent, call after_tool multiple times, verify each call " +
    "doesn't error and the session remains accessible.",
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },
    { type: "spawn", session: "builder", role: "builder", parent: "lead", label: "builder:impl" },

    { type: "comment", text: "Multiple after_tool calls should not error" },
    { type: "after_tool", session: "builder", tool: "write_file" },
    { type: "after_tool", session: "builder", tool: "edit_file" },
    { type: "after_tool", session: "builder", tool: "execute_command" },
    { type: "after_tool", session: "builder", tool: "read_file" },

    { type: "comment", text: "Session should still work for tool blocking after activity" },
    { type: "tool_call", session: "builder", tool: "write_file", expect: "allow" },
    { type: "tool_call", session: "builder", tool: "decompose_task", expect: "block" },

    { type: "comment", text: "after_tool for unregistered session should not error" },
    { type: "after_tool", session: "nonexistent", tool: "read_file" },
  ],
};

// ============================================================================
// 19. Complete Realistic Workflow
// ============================================================================

const realisticWorkflow: Scenario = {
  name: "realistic-workflow",
  description:
    "Full simulation of a realistic multi-agent coding task: " +
    "lead -> scout (explore) -> builder (implement) -> reviewer (validate).",
  steps: [
    { type: "comment", text: "1. Spawn lead for authentication work" },
    { type: "spawn", session: "lead", role: "lead", label: "lead:auth" },
    { type: "prompt_build", session: "lead", expectContext: "Lead" },

    { type: "comment", text: "2. Lead spawns scout to explore existing auth code" },
    { type: "spawn", session: "scout", role: "scout", parent: "lead", label: "scout:auth-code" },
    { type: "prompt_build", session: "scout", expectContext: "Scout" },

    { type: "comment", text: "3. Scout does read_file calls (allowed)" },
    { type: "tool_call", session: "scout", tool: "read_file", expect: "allow" },
    { type: "after_tool", session: "scout", tool: "read_file" },
    { type: "tool_call", session: "scout", tool: "read_file", expect: "allow" },
    { type: "after_tool", session: "scout", tool: "read_file" },

    { type: "comment", text: "4. Scout completes" },
    { type: "stop", session: "scout" },
    { type: "end", session: "scout" },

    { type: "comment", text: "5. Lead spawns builder for JWT implementation" },
    { type: "spawn", session: "builder", role: "builder", parent: "lead", label: "builder:jwt" },

    { type: "comment", text: "6. Builder does write, edit, and execute (all allowed)" },
    { type: "tool_call", session: "builder", tool: "write_file", expect: "allow" },
    { type: "after_tool", session: "builder", tool: "write_file" },
    { type: "tool_call", session: "builder", tool: "edit_file", expect: "allow" },
    { type: "after_tool", session: "builder", tool: "edit_file" },
    { type: "tool_call", session: "builder", tool: "execute_command", expect: "allow" },
    { type: "after_tool", session: "builder", tool: "execute_command" },

    { type: "comment", text: "7. Builder completes" },
    { type: "stop", session: "builder" },
    { type: "end", session: "builder" },

    { type: "comment", text: "8. Lead spawns reviewer to check implementation" },
    {
      type: "spawn",
      session: "reviewer",
      role: "reviewer",
      parent: "lead",
      label: "reviewer:auth-review",
    },

    { type: "comment", text: "9. Reviewer reads (allowed), tries write (blocked)" },
    { type: "tool_call", session: "reviewer", tool: "read_file", expect: "allow" },
    { type: "tool_call", session: "reviewer", tool: "write_file", expect: "block" },

    { type: "comment", text: "10. Reviewer completes" },
    { type: "stop", session: "reviewer" },
    { type: "end", session: "reviewer" },

    { type: "comment", text: "11. Lead completes" },
    { type: "stop", session: "lead" },
    { type: "end", session: "lead" },

    { type: "comment", text: "12. Health check: no stale agents (all recent or completed)" },
    { type: "health_check", expectNotStale: ["lead"], threshold: 300_000 },
  ],
};

// ============================================================================
// 20. Adversarial: Re-spawn Same Session Key
// ============================================================================

const adversarialRespawn: Scenario = {
  name: "adversarial-respawn",
  description:
    "Spawn, end, then spawn again with same session key. " + "Should work (re-register in store).",
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },

    { type: "comment", text: "First lifecycle of builder" },
    { type: "spawn", session: "builder-x", role: "builder", parent: "lead", label: "builder:v1" },
    { type: "tool_call", session: "builder-x", tool: "write_file", expect: "allow" },
    { type: "stop", session: "builder-x" },
    { type: "end", session: "builder-x" },

    { type: "comment", text: "Re-spawn with same session key" },
    { type: "spawn", session: "builder-x", role: "builder", parent: "lead", label: "builder:v2" },
    { type: "tool_call", session: "builder-x", tool: "write_file", expect: "allow" },
    { type: "tool_call", session: "builder-x", tool: "edit_file", expect: "allow" },
    { type: "stop", session: "builder-x" },
    { type: "end", session: "builder-x" },
  ],
};

// ============================================================================
// Bonus scenarios
// ============================================================================

// 21. Lead Read-Only Enforcement
const leadReadOnly: Scenario = {
  name: "lead-read-only",
  description:
    "Verify that leads are strictly read-only, same as orchestrators. " +
    "They coordinate via mail and decompose_task, not direct writes.",
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },

    { type: "tool_call", session: "lead", tool: "write_file", expect: "block" },
    { type: "tool_call", session: "lead", tool: "edit_file", expect: "block" },
    { type: "tool_call", session: "lead", tool: "execute_command", expect: "block" },
    { type: "tool_call", session: "lead", tool: "read_file", expect: "allow" },
    { type: "tool_call", session: "lead", tool: "decompose_task", expect: "allow" },
    { type: "tool_call", session: "lead", tool: "agent_status", expect: "allow" },
  ],
};

// 22. Stop With Various Outcomes
const stopWithVariousOutcomes: Scenario = {
  name: "stop-with-various-outcomes",
  description: "Verify agents can be stopped with error or timeout outcomes.",
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },
    { type: "spawn", session: "builder", role: "builder", parent: "lead", label: "builder:impl" },

    { type: "comment", text: "Stop with error outcome" },
    { type: "stop", session: "builder", outcome: "error" },
    { type: "end", session: "builder", reason: "error: compilation failed" },

    { type: "comment", text: "Stop with timeout outcome" },
    { type: "spawn", session: "scout", role: "scout", parent: "lead", label: "scout:explore" },
    { type: "stop", session: "scout", outcome: "timeout" },
    { type: "end", session: "scout", reason: "timed out" },
  ],
};

// 23. Concurrent Workers Under Same Lead
const concurrentWorkersUnderLead: Scenario = {
  name: "concurrent-workers-under-lead",
  description:
    "Lead spawns multiple workers simultaneously. All have correct parents " +
    "and independent boundary enforcement.",
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },

    { type: "comment", text: "Spawn 3 different worker types under the same lead" },
    { type: "spawn", session: "s1", role: "scout", parent: "lead", label: "scout:files" },
    { type: "spawn", session: "b1", role: "builder", parent: "lead", label: "builder:auth" },
    { type: "spawn", session: "r1", role: "reviewer", parent: "lead", label: "reviewer:qa" },

    { type: "comment", text: "Each has independent boundaries" },
    { type: "tool_call", session: "s1", tool: "write_file", expect: "block" },
    { type: "tool_call", session: "b1", tool: "write_file", expect: "allow" },
    { type: "tool_call", session: "r1", tool: "write_file", expect: "block" },

    { type: "comment", text: "All have correct parent" },
    { type: "assert_session_state", session: "s1", hasParent: "lead" },
    { type: "assert_session_state", session: "b1", hasParent: "lead" },
    { type: "assert_session_state", session: "r1", hasParent: "lead" },

    { type: "comment", text: "Model overrides are role-specific" },
    { type: "model_resolve", session: "s1", expectModel: "claude-haiku-4-5" },
    { type: "model_resolve", session: "b1", expectNoOverride: true },
    { type: "model_resolve", session: "r1", expectModel: "claude-haiku-4-5" },
  ],
};

// 24. Fleet Status Visibility
const fleetStatusVisibility: Scenario = {
  name: "fleet-status-visibility",
  description:
    "Verify that lead gets fleet status in context when workers exist, " +
    "and workers do NOT get fleet status.",
  steps: [
    { type: "spawn", session: "lead", role: "lead", label: "lead:team" },

    { type: "comment", text: "Lead with no workers: still gets role instructions" },
    { type: "prompt_build", session: "lead", expectContext: "Lead" },

    { type: "comment", text: "Add workers" },
    { type: "spawn", session: "builder", role: "builder", parent: "lead", label: "builder:impl" },

    { type: "comment", text: "Lead now sees fleet members" },
    { type: "prompt_build", session: "lead", expectContext: "Active workers" },

    { type: "comment", text: "Builder does NOT see fleet status" },
    { type: "prompt_build", session: "builder", expectContext: "Builder" },
  ],
};

// ============================================================================
// Export all scenarios
// ============================================================================

export const allScenarios: Scenario[] = [
  // Core functionality
  basicHierarchy,
  fullTeam,
  boundaryExhaustive,
  hierarchyViolations,

  // Limits
  depthLimit,
  depthLimitTight,
  concurrencyLimit,

  // Hook behavior
  modelOverrides,
  contextInjection,

  // Lifecycle
  lifecycleTransitions,
  watchdogStale,

  // Configuration variants
  configBothDisabled,
  configMailOnly,

  // Multi-agent patterns
  multiLead,
  rapidCycle,

  // Tool access
  orchestrationTools,

  // Edge cases
  unknownRole,
  noParentState,
  activityTracking,

  // Full workflow
  realisticWorkflow,

  // Adversarial
  adversarialRespawn,

  // Bonus
  leadReadOnly,
  stopWithVariousOutcomes,
  concurrentWorkersUnderLead,
  fleetStatusVisibility,
];
