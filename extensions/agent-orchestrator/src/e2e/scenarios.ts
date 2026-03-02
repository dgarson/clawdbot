/**
 * E2E scenario definitions for multi-agent workflow tests.
 *
 * Each scenario simulates a realistic multi-agent coding project:
 * agents spawn, exchange mail, perform tool calls within role boundaries,
 * and complete their tasks.
 */

import type { E2EScenario } from "./types.js";

// ---------------------------------------------------------------------------
// 1. builder-reviewer-cycle — full review loop with rejection and re-review
// ---------------------------------------------------------------------------

const builderReviewerCycle: E2EScenario = {
  id: "builder-reviewer-cycle",
  description:
    "Full review loop: builder implements, reviewer rejects, builder fixes, reviewer approves",
  steps: [
    { action: "comment", text: "Seed the fleet: orchestrator → lead → builder + reviewer" },
    {
      action: "seed_fleet",
      agents: [
        { sessionKey: "orch-1", label: "orchestrator" },
        {
          sessionKey: "lead-1",
          label: "lead:auth-feature",
          parent: "orch-1",
          taskDescription: "Implement JWT auth",
        },
        {
          sessionKey: "builder-1",
          label: "builder:jwt-impl",
          parent: "lead-1",
          taskDescription: "Implement JWT middleware",
          fileScope: ["src/auth/"],
        },
        {
          sessionKey: "reviewer-1",
          label: "reviewer:jwt-review",
          parent: "lead-1",
          taskDescription: "Review JWT implementation",
        },
      ],
    },

    { action: "comment", text: "Builder implements — write_file is allowed" },
    {
      action: "agent_turn",
      actor: "builder-1",
      tool_calls: [
        { tool: "write_file", params: { file_path: "src/auth/jwt.ts" }, expect: "allow" },
        { tool: "execute_command", params: { command: "npm test" }, expect: "allow" },
      ],
      sends_mail: [
        {
          to: "reviewer-1",
          subject: "Ready for review",
          body: "JWT middleware implemented in src/auth/jwt.ts. Tests pass.",
        },
      ],
    },

    { action: "comment", text: "Reviewer reads mail and reviews — write_file is blocked" },
    {
      action: "agent_turn",
      actor: "reviewer-1",
      reads_mail: true,
      tool_calls: [
        { tool: "read_file", expect: "allow" },
        { tool: "write_file", expect: "block", expectReason: "reviewer" },
      ],
      sends_mail: [
        {
          to: "builder-1",
          subject: "Review: FAIL",
          body: "Missing null check on token parameter. Fix and re-submit.",
          tags: ["review-result"],
        },
      ],
    },

    {
      action: "assert_inbox",
      session: "reviewer-1",
      expectCount: 1,
      expectSubjects: ["Ready for review"],
    },
    {
      action: "assert_inbox",
      session: "builder-1",
      expectCount: 1,
      expectSubjects: ["Review: FAIL"],
    },

    { action: "comment", text: "Builder reads rejection, fixes, and re-submits" },
    {
      action: "agent_turn",
      actor: "builder-1",
      reads_mail: true,
      tool_calls: [
        { tool: "edit_file", params: { file_path: "src/auth/jwt.ts" }, expect: "allow" },
      ],
      sends_mail: [
        {
          to: "reviewer-1",
          subject: "Fixed: null check added",
          body: "Added null check on token parameter per review feedback.",
        },
      ],
    },

    { action: "comment", text: "Reviewer re-reviews and approves, reports to lead" },
    {
      action: "agent_turn",
      actor: "reviewer-1",
      reads_mail: true,
      tool_calls: [{ tool: "read_file", expect: "allow" }],
      sends_mail: [
        {
          to: "lead-1",
          subject: "Review: PASS",
          body: "JWT implementation approved. All issues resolved.",
          tags: ["review-result"],
        },
      ],
    },

    { action: "comment", text: "Lead reads approval and marks complete" },
    {
      action: "agent_turn",
      actor: "lead-1",
      reads_mail: true,
      outcome: "completed",
    },

    {
      action: "assert_fleet",
      expect: {
        activeCount: 3,
        completedCount: 1,
        agents: [
          { sessionKey: "lead-1", role: "lead", status: "completed" },
          { sessionKey: "builder-1", role: "builder", status: "active" },
          { sessionKey: "reviewer-1", role: "reviewer", status: "active" },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 2. scout-report-to-lead — scout explores, lead spawns builder from findings
// ---------------------------------------------------------------------------

const scoutReportToLead: E2EScenario = {
  id: "scout-report-to-lead",
  description: "Scout explores codebase, reports to lead, lead spawns builder",
  steps: [
    {
      action: "seed_fleet",
      agents: [
        { sessionKey: "orch-1", label: "orchestrator" },
        {
          sessionKey: "lead-1",
          label: "lead:refactor",
          parent: "orch-1",
          taskDescription: "Refactor auth module",
        },
        {
          sessionKey: "scout-1",
          label: "scout:explore-auth",
          parent: "lead-1",
          taskDescription: "Explore auth module structure",
        },
      ],
    },

    { action: "comment", text: "Scout explores — read_file allowed, write_file blocked" },
    {
      action: "agent_turn",
      actor: "scout-1",
      tool_calls: [
        { tool: "read_file", expect: "allow" },
        { tool: "write_file", expect: "block", expectReason: "scout" },
        { tool: "execute_command", expect: "block", expectReason: "scout" },
      ],
      sends_mail: [
        {
          to: "lead-1",
          subject: "Exploration complete",
          body: "Found 3 files needing refactor: auth.ts, session.ts, tokens.ts. Recommend splitting into separate modules.",
          tags: ["scout-report"],
        },
      ],
    },

    { action: "comment", text: "Scout completes its task" },
    { action: "end_agent", session: "scout-1", reason: "exploration complete" },

    { action: "comment", text: "Lead reads findings and spawns a builder" },
    {
      action: "agent_turn",
      actor: "lead-1",
      reads_mail: true,
    },

    {
      action: "spawn_agent",
      agent: {
        sessionKey: "builder-1",
        label: "builder:auth-refactor",
        parent: "lead-1",
        taskDescription: "Refactor auth module into separate files",
        fileScope: ["src/auth/"],
      },
    },

    { action: "comment", text: "Builder implements the refactor" },
    {
      action: "agent_turn",
      actor: "builder-1",
      tool_calls: [
        { tool: "write_file", params: { file_path: "src/auth/session.ts" }, expect: "allow" },
        { tool: "edit_file", params: { file_path: "src/auth/auth.ts" }, expect: "allow" },
      ],
      sends_mail: [
        {
          to: "lead-1",
          subject: "Implementation complete",
          body: "Auth module refactored into 3 files.",
        },
      ],
    },

    {
      action: "assert_fleet",
      expect: {
        activeCount: 3,
        completedCount: 1,
        agents: [
          { sessionKey: "scout-1", status: "completed" },
          { sessionKey: "builder-1", status: "active", role: "builder" },
          { sessionKey: "lead-1", status: "active", role: "lead" },
        ],
      },
    },

    {
      action: "assert_inbox",
      session: "lead-1",
      expectCount: 2,
      expectSubjects: ["Exploration complete", "Implementation complete"],
    },
  ],
};

// ---------------------------------------------------------------------------
// 3. multi-team-isolation — two teams work independently under one orchestrator
// ---------------------------------------------------------------------------

const multiTeamIsolation: E2EScenario = {
  id: "multi-team-isolation",
  description: "Two teams (frontend + backend) work independently with correct parent chains",
  config: { orchestration: { maxDepth: 3, maxConcurrentAgents: 12 } },
  steps: [
    {
      action: "seed_fleet",
      agents: [
        { sessionKey: "orch-1", label: "orchestrator" },
        {
          sessionKey: "lead-fe",
          label: "lead:frontend",
          parent: "orch-1",
          taskDescription: "Frontend work",
        },
        {
          sessionKey: "lead-be",
          label: "lead:backend",
          parent: "orch-1",
          taskDescription: "Backend work",
        },
      ],
    },

    { action: "comment", text: "Frontend team spawns workers" },
    {
      action: "spawn_agent",
      agent: {
        sessionKey: "scout-fe",
        label: "scout:fe-explore",
        parent: "lead-fe",
        taskDescription: "Explore frontend",
      },
    },
    {
      action: "spawn_agent",
      agent: {
        sessionKey: "builder-fe",
        label: "builder:fe-impl",
        parent: "lead-fe",
        taskDescription: "Build frontend",
        fileScope: ["src/ui/"],
      },
    },

    { action: "comment", text: "Backend team spawns workers" },
    {
      action: "spawn_agent",
      agent: {
        sessionKey: "scout-be",
        label: "scout:be-explore",
        parent: "lead-be",
        taskDescription: "Explore backend",
      },
    },
    {
      action: "spawn_agent",
      agent: {
        sessionKey: "builder-be",
        label: "builder:be-impl",
        parent: "lead-be",
        taskDescription: "Build backend",
        fileScope: ["src/api/"],
      },
    },

    { action: "comment", text: "Each team's workers report to their own lead" },
    {
      action: "agent_turn",
      actor: "scout-fe",
      tool_calls: [{ tool: "read_file", expect: "allow" }],
      sends_mail: [
        { to: "lead-fe", subject: "FE findings", body: "Frontend components identified." },
      ],
    },
    {
      action: "agent_turn",
      actor: "scout-be",
      tool_calls: [{ tool: "read_file", expect: "allow" }],
      sends_mail: [{ to: "lead-be", subject: "BE findings", body: "Backend routes identified." }],
    },
    {
      action: "agent_turn",
      actor: "builder-fe",
      tool_calls: [
        { tool: "write_file", params: { file_path: "src/ui/app.tsx" }, expect: "allow" },
      ],
      sends_mail: [{ to: "lead-fe", subject: "FE done", body: "Frontend built." }],
    },
    {
      action: "agent_turn",
      actor: "builder-be",
      tool_calls: [
        { tool: "write_file", params: { file_path: "src/api/routes.ts" }, expect: "allow" },
      ],
      sends_mail: [{ to: "lead-be", subject: "BE done", body: "Backend built." }],
    },

    { action: "comment", text: "Assert correct parent chains and team isolation" },
    {
      action: "assert_fleet",
      expect: {
        activeCount: 7,
        agents: [
          { sessionKey: "scout-fe", parent: "lead-fe", depth: 2 },
          { sessionKey: "builder-fe", parent: "lead-fe", depth: 2 },
          { sessionKey: "scout-be", parent: "lead-be", depth: 2 },
          { sessionKey: "builder-be", parent: "lead-be", depth: 2 },
          { sessionKey: "lead-fe", parent: "orch-1", depth: 1 },
          { sessionKey: "lead-be", parent: "orch-1", depth: 1 },
        ],
      },
    },

    { action: "comment", text: "Frontend lead's inbox has only FE mail" },
    {
      action: "assert_inbox",
      session: "lead-fe",
      expectCount: 2,
      expectSubjects: ["FE findings", "FE done"],
    },
    {
      action: "assert_inbox",
      session: "lead-be",
      expectCount: 2,
      expectSubjects: ["BE findings", "BE done"],
    },
  ],
};

// ---------------------------------------------------------------------------
// 4. escalation-chain — urgent mail flows up the hierarchy
// ---------------------------------------------------------------------------

const escalationChain: E2EScenario = {
  id: "escalation-chain",
  description: "Builder encounters error, escalates via lead to orchestrator",
  steps: [
    {
      action: "seed_fleet",
      agents: [
        { sessionKey: "orch-1", label: "orchestrator" },
        {
          sessionKey: "lead-1",
          label: "lead:deploy",
          parent: "orch-1",
          taskDescription: "Deploy to prod",
        },
        {
          sessionKey: "builder-1",
          label: "builder:deploy-script",
          parent: "lead-1",
          taskDescription: "Write deploy scripts",
        },
      ],
    },

    { action: "comment", text: "Builder encounters an error and sends urgent mail to lead" },
    {
      action: "agent_turn",
      actor: "builder-1",
      sends_mail: [
        {
          to: "lead-1",
          subject: "ERROR: deploy failed",
          body: "Database migration failed — schema conflict detected. Cannot proceed.",
          urgency: "urgent",
          tags: ["escalation", "deploy-error"],
        },
      ],
    },

    { action: "comment", text: "Lead reads urgent mail and escalates to orchestrator" },
    {
      action: "agent_turn",
      actor: "lead-1",
      reads_mail: true,
      sends_mail: [
        {
          to: "orch-1",
          subject: "ESCALATION: deploy blocked",
          body: "Builder reports database migration failure. Deploy is blocked. Need decision on rollback vs. manual fix.",
          urgency: "urgent",
          tags: ["escalation"],
        },
      ],
    },

    { action: "comment", text: "Orchestrator reads escalation" },
    {
      action: "agent_turn",
      actor: "orch-1",
      reads_mail: true,
    },

    {
      action: "assert_inbox",
      session: "lead-1",
      expectCount: 1,
      expectSubjects: ["ERROR: deploy failed"],
    },
    {
      action: "assert_inbox",
      session: "orch-1",
      expectCount: 1,
      expectSubjects: ["ESCALATION: deploy blocked"],
    },
  ],
};

// ---------------------------------------------------------------------------
// 5. full-project-lifecycle — complete project from exploration to approval
// ---------------------------------------------------------------------------

const fullProjectLifecycle: E2EScenario = {
  id: "full-project-lifecycle",
  description: "Complete project: orchestrator → lead → scout → builder → reviewer → approval",
  steps: [
    { action: "comment", text: "Phase 1: Orchestrator spawns lead" },
    {
      action: "seed_fleet",
      agents: [
        { sessionKey: "orch-1", label: "orchestrator" },
        {
          sessionKey: "lead-1",
          label: "lead:api-redesign",
          parent: "orch-1",
          taskDescription: "Redesign REST API",
        },
      ],
    },

    { action: "comment", text: "Phase 2: Lead spawns scout for exploration" },
    {
      action: "spawn_agent",
      agent: {
        sessionKey: "scout-1",
        label: "scout:api-explore",
        parent: "lead-1",
        taskDescription: "Explore current API surface",
      },
    },

    { action: "comment", text: "Phase 3: Scout explores (read-only)" },
    {
      action: "agent_turn",
      actor: "scout-1",
      tool_calls: [
        { tool: "read_file", expect: "allow" },
        { tool: "write_file", expect: "block" },
      ],
      sends_mail: [
        {
          to: "lead-1",
          subject: "API exploration done",
          body: "Found 12 endpoints, 3 deprecated. Recommend consolidating auth endpoints.",
        },
      ],
    },

    { action: "comment", text: "Scout completes" },
    { action: "end_agent", session: "scout-1" },

    { action: "comment", text: "Phase 4: Lead reads findings, spawns builder + reviewer" },
    { action: "agent_turn", actor: "lead-1", reads_mail: true },
    {
      action: "spawn_agent",
      agent: {
        sessionKey: "builder-1",
        label: "builder:api-impl",
        parent: "lead-1",
        taskDescription: "Implement API redesign",
        fileScope: ["src/api/"],
      },
    },
    {
      action: "spawn_agent",
      agent: {
        sessionKey: "reviewer-1",
        label: "reviewer:api-review",
        parent: "lead-1",
        taskDescription: "Review API redesign",
      },
    },

    { action: "comment", text: "Phase 5: Builder implements" },
    {
      action: "agent_turn",
      actor: "builder-1",
      tool_calls: [
        { tool: "write_file", params: { file_path: "src/api/routes.ts" }, expect: "allow" },
        { tool: "edit_file", params: { file_path: "src/api/auth.ts" }, expect: "allow" },
        { tool: "execute_command", params: { command: "npm test" }, expect: "allow" },
      ],
      sends_mail: [
        {
          to: "reviewer-1",
          subject: "Ready for review",
          body: "API redesign complete. 12 endpoints consolidated to 8.",
        },
      ],
    },

    { action: "comment", text: "Phase 6: Reviewer rejects" },
    {
      action: "agent_turn",
      actor: "reviewer-1",
      reads_mail: true,
      tool_calls: [
        { tool: "read_file", expect: "allow" },
        { tool: "write_file", expect: "block" },
      ],
      sends_mail: [
        {
          to: "builder-1",
          subject: "Review: FAIL",
          body: "Missing pagination on list endpoints. Add offset/limit params.",
        },
      ],
    },

    { action: "comment", text: "Phase 7: Builder fixes and re-submits" },
    {
      action: "agent_turn",
      actor: "builder-1",
      reads_mail: true,
      tool_calls: [
        { tool: "edit_file", params: { file_path: "src/api/routes.ts" }, expect: "allow" },
      ],
      sends_mail: [
        {
          to: "reviewer-1",
          subject: "Fixed: pagination added",
          body: "Added offset/limit to all list endpoints.",
        },
      ],
    },

    { action: "comment", text: "Phase 8: Reviewer approves and reports to lead" },
    {
      action: "agent_turn",
      actor: "reviewer-1",
      reads_mail: true,
      tool_calls: [{ tool: "read_file", expect: "allow" }],
      sends_mail: [
        {
          to: "lead-1",
          subject: "Review: PASS",
          body: "API redesign approved. All issues resolved.",
        },
      ],
    },

    { action: "comment", text: "Phase 9: Lead reads approval and completes" },
    {
      action: "agent_turn",
      actor: "lead-1",
      reads_mail: true,
      outcome: "completed",
    },

    { action: "comment", text: "Final assertions" },
    {
      action: "assert_fleet",
      expect: {
        completedCount: 2,
        agents: [
          { sessionKey: "scout-1", status: "completed" },
          { sessionKey: "lead-1", status: "completed" },
          { sessionKey: "builder-1", status: "active", role: "builder" },
          { sessionKey: "reviewer-1", status: "active", role: "reviewer" },
        ],
      },
    },

    {
      action: "assert_inbox",
      session: "lead-1",
      expectCount: 2,
      expectSubjects: ["API exploration done", "Review: PASS"],
    },
  ],
};

// ---------------------------------------------------------------------------
// 6. concurrent-builders — multiple builders with non-overlapping file scopes
// ---------------------------------------------------------------------------

const concurrentBuilders: E2EScenario = {
  id: "concurrent-builders",
  description: "Three builders with different file scopes all report to one lead",
  steps: [
    {
      action: "seed_fleet",
      agents: [
        { sessionKey: "orch-1", label: "orchestrator" },
        {
          sessionKey: "lead-1",
          label: "lead:full-stack",
          parent: "orch-1",
          taskDescription: "Full stack feature",
        },
        {
          sessionKey: "builder-ui",
          label: "builder:ui",
          parent: "lead-1",
          taskDescription: "Build UI components",
          fileScope: ["src/ui/"],
        },
        {
          sessionKey: "builder-api",
          label: "builder:api",
          parent: "lead-1",
          taskDescription: "Build API routes",
          fileScope: ["src/api/"],
        },
        {
          sessionKey: "builder-db",
          label: "builder:db",
          parent: "lead-1",
          taskDescription: "Build DB migrations",
          fileScope: ["src/db/"],
        },
      ],
    },

    { action: "comment", text: "Each builder works within their scope" },
    {
      action: "agent_turn",
      actor: "builder-ui",
      tool_calls: [
        { tool: "write_file", params: { file_path: "src/ui/form.tsx" }, expect: "allow" },
      ],
      sends_mail: [{ to: "lead-1", subject: "UI done", body: "Form components built." }],
      outcome: "completed",
    },
    {
      action: "agent_turn",
      actor: "builder-api",
      tool_calls: [
        { tool: "write_file", params: { file_path: "src/api/handler.ts" }, expect: "allow" },
      ],
      sends_mail: [{ to: "lead-1", subject: "API done", body: "API routes built." }],
      outcome: "completed",
    },
    {
      action: "agent_turn",
      actor: "builder-db",
      tool_calls: [
        { tool: "write_file", params: { file_path: "src/db/migrate.ts" }, expect: "allow" },
      ],
      sends_mail: [{ to: "lead-1", subject: "DB done", body: "Migrations built." }],
      outcome: "completed",
    },

    {
      action: "assert_fleet",
      expect: {
        activeCount: 2,
        completedCount: 3,
        agents: [
          { sessionKey: "builder-ui", status: "completed" },
          { sessionKey: "builder-api", status: "completed" },
          { sessionKey: "builder-db", status: "completed" },
          { sessionKey: "lead-1", status: "active" },
        ],
      },
    },

    {
      action: "assert_inbox",
      session: "lead-1",
      expectCount: 3,
      expectSubjects: ["UI done", "API done", "DB done"],
    },
  ],
};

// ---------------------------------------------------------------------------
// 7. watchdog-stale-recovery — agent goes stale and gets cleaned up
// ---------------------------------------------------------------------------

const watchdogStaleRecovery: E2EScenario = {
  id: "watchdog-stale-recovery",
  description: "Agent becomes stale; watchdog scenario detects and cleans up",
  config: { orchestration: { staleThresholdMs: 50 } },
  steps: [
    {
      action: "seed_fleet",
      agents: [
        { sessionKey: "orch-1", label: "orchestrator" },
        { sessionKey: "lead-1", label: "lead:work", parent: "orch-1" },
        { sessionKey: "builder-1", label: "builder:task", parent: "lead-1" },
      ],
    },

    { action: "comment", text: "Builder does initial work" },
    {
      action: "agent_turn",
      actor: "builder-1",
      tool_calls: [{ tool: "read_file", expect: "allow" }],
    },

    { action: "comment", text: "Wait for builder to become stale" },
    { action: "wait_ms", ms: 100 },

    { action: "comment", text: "End the stale agent" },
    { action: "end_agent", session: "builder-1", reason: "stale timeout" },

    {
      action: "assert_fleet",
      expect: {
        activeCount: 2,
        completedCount: 1,
        agents: [
          { sessionKey: "builder-1", status: "completed" },
          { sessionKey: "lead-1", status: "active" },
        ],
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// 8. model-override-verification — verify role-based model overrides
// ---------------------------------------------------------------------------

const modelOverrideVerification: E2EScenario = {
  id: "model-override-verification",
  description: "Verify scouts and reviewers get haiku, builders and leads get default",
  steps: [
    {
      action: "seed_fleet",
      agents: [
        { sessionKey: "orch-1", label: "orchestrator" },
        { sessionKey: "lead-1", label: "lead:test", parent: "orch-1" },
        { sessionKey: "scout-1", label: "scout:test", parent: "lead-1" },
        { sessionKey: "builder-1", label: "builder:test", parent: "lead-1" },
        { sessionKey: "reviewer-1", label: "reviewer:test", parent: "lead-1" },
      ],
    },

    { action: "comment", text: "Scouts get claude-haiku-4-5" },
    { action: "assert_model", session: "scout-1", expectModel: "claude-haiku-4-5" },

    { action: "comment", text: "Reviewers get claude-haiku-4-5" },
    { action: "assert_model", session: "reviewer-1", expectModel: "claude-haiku-4-5" },

    { action: "comment", text: "Builders use default (no override)" },
    { action: "assert_model", session: "builder-1", expectNoOverride: true },

    { action: "comment", text: "Leads use default (no override)" },
    { action: "assert_model", session: "lead-1", expectNoOverride: true },

    {
      action: "comment",
      text: "Orchestrator (root agent, not spawned) uses default — store has no role",
    },
    { action: "assert_model", session: "orch-1", expectNoOverride: true },

    {
      action: "comment",
      text: "Verify context injection includes role instructions for spawned agents",
    },
    { action: "assert_context", session: "scout-1", expectContains: ["[Agent Scout]"] },
    { action: "assert_context", session: "builder-1", expectContains: ["[Agent Builder]"] },
    { action: "assert_context", session: "reviewer-1", expectContains: ["[Agent Reviewer]"] },
    { action: "assert_context", session: "lead-1", expectContains: ["[Agent Lead]"] },
    {
      action: "comment",
      text: "Root orchestrator has no role in store — context hook returns nothing",
    },
    { action: "assert_context", session: "orch-1", expectNotContains: ["[Agent Orchestrator]"] },
  ],
};

// ---------------------------------------------------------------------------
// Export all scenarios
// ---------------------------------------------------------------------------

export const allE2EScenarios: E2EScenario[] = [
  builderReviewerCycle,
  scoutReportToLead,
  multiTeamIsolation,
  escalationChain,
  fullProjectLifecycle,
  concurrentBuilders,
  watchdogStaleRecovery,
  modelOverrideVerification,
];
