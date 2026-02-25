// ---------------------------------------------------------------------------
// Domain types for Orchestration plugin
// Mirrors the domain model from agent-platform-04 plan document.
// ---------------------------------------------------------------------------

export type Organization = {
  id: string;
  name: string;
  /** Team IDs belonging to this organization */
  teams: string[];
};

export type AgentRole =
  | "coordinator" // Assigns work, reviews outcomes, runs retrospectives
  | "spec" // Drafts specifications and requirements
  | "planner" // Creates implementation plans from specs
  | "worker" // Executes implementation tasks
  | "reviewer" // Reviews work products (code, docs, etc.)
  | "router"; // Routes messages to appropriate agents (see 02)

export const AGENT_ROLES = [
  "coordinator",
  "spec",
  "planner",
  "worker",
  "reviewer",
  "router",
] as const satisfies readonly AgentRole[];

export type TeamMember = {
  agentId: string;
  role: AgentRole;
};

export type EscalationTarget =
  | { kind: "agent"; agentId: string }
  | { kind: "team"; teamId: string }
  | { kind: "webhook"; url: string };

export type Team = {
  id: string;
  name: string;
  organizationId: string;
  members: TeamMember[];
  /** Default escalation target for this team */
  escalationTarget?: EscalationTarget;
};

export type SprintState =
  | "planning" // Work items being defined and estimated
  | "active" // Work in progress
  | "review" // All items done, sprint under review
  | "retrospective" // Analyzing what worked and what didn't
  | "closed"; // Finalized

export const SPRINT_STATES = [
  "planning",
  "active",
  "review",
  "retrospective",
  "closed",
] as const satisfies readonly SprintState[];

export type Sprint = {
  id: string;
  teamId: string;
  name: string;
  state: SprintState;
  /** Budget allocation for this sprint (references 03 budgets) */
  budgetScopeId?: string;
  workItems: string[]; // WorkItem IDs
  createdAt: string;
  updatedAt: string;
};

export type WorkItemState =
  | "backlog"
  | "ready" // Spec'd and estimated, ready for assignment
  | "in_progress"
  | "in_review"
  | "done"
  | "blocked";

export const WORK_ITEM_STATES = [
  "backlog",
  "ready",
  "in_progress",
  "in_review",
  "done",
  "blocked",
] as const satisfies readonly WorkItemState[];

export type DelegationStatus = "active" | "completed" | "failed" | "cancelled";

export type Delegation = {
  fromAgentId: string;
  toAgentId: string;
  delegatedAt: string;
  sessionKey: string; // The session where the work is happening
  isolated: boolean; // Whether the session is decoupled
  status: DelegationStatus;
  completedAt?: string;
  outcome?: string; // Brief result summary
};

export type ReviewVerdict = "approved" | "changes_requested" | "rejected";

export type ReviewRecord = {
  workItemId: string;
  reviewerAgentId: string;
  requestedAt: string;
  completedAt?: string;
  verdict: ReviewVerdict | null;
  feedback?: string;
};

export type WorkItem = {
  id: string;
  sprintId: string;
  title: string;
  description: string;
  state: WorkItemState;
  assigneeAgentId?: string;
  /** Which role should handle this item */
  requiredRole?: AgentRole;
  /** Acceptance criteria (checked by reviewer) */
  acceptanceCriteria: string[];
  /** Delegation chain -- who delegated to whom */
  delegations: Delegation[];
  /** Review requests */
  reviews: ReviewRecord[];
  /** External references (PR URLs, issue links, etc.) */
  externalRefs: string[];
};

// ---------------------------------------------------------------------------
// Escalation types
// ---------------------------------------------------------------------------

export type EscalationTrigger =
  | "blocked"
  | "budget_risk"
  | "quality_risk"
  | "timeout"
  | "repeated_failures";

export const ESCALATION_TRIGGERS = [
  "blocked",
  "budget_risk",
  "quality_risk",
  "timeout",
  "repeated_failures",
] as const satisfies readonly EscalationTrigger[];

export type EscalationRecord = {
  id: string;
  trigger: EscalationTrigger;
  target: EscalationTarget;
  workItemId?: string;
  sprintId?: string;
  teamId?: string;
  agentId?: string;
  message: string;
  createdAt: string;
  resolvedAt?: string;
  resolution?: string;
};
