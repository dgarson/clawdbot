/**
 * Agent-to-Agent (A2A) Communication Protocol — Type Definitions
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 * Protocol version: openclaw.a2a.v1
 */

// ─── Primitives ──────────────────────────────────────────────────────────────

export const A2A_PROTOCOL_VERSION = "openclaw.a2a.v1" as const;

export type Priority = "low" | "normal" | "high" | "urgent";

export type MessageType =
  | "task_request"
  | "task_response"
  | "review_request"
  | "review_response"
  | "status_update"
  | "knowledge_share"
  | "broadcast";

export const MESSAGE_TYPES: readonly MessageType[] = [
  "task_request",
  "task_response",
  "review_request",
  "review_response",
  "status_update",
  "knowledge_share",
  "broadcast",
] as const;

export const PRIORITIES: readonly Priority[] = ["low", "normal", "high", "urgent"] as const;

// ─── Agent Reference ─────────────────────────────────────────────────────────

export interface AgentRef {
  agentId: string;
  role: string;
  sessionKey?: string;
}

// ─── Task Request ────────────────────────────────────────────────────────────

export type TaskType = "implementation" | "review" | "research" | "analysis" | "design";

export type Complexity = "trivial" | "low" | "medium" | "high" | "expert";

export interface TaskContext {
  branch: string;
  worktree: string;
  relatedFiles?: string[];
}

export interface TaskRequestPayload {
  taskId: string;
  title: string;
  description: string;
  taskType: TaskType;
  complexity: Complexity;
  deadline?: string;
  context?: TaskContext;
  acceptanceCriteria?: string[];
}

// ─── Task Response ───────────────────────────────────────────────────────────

export type TaskAction = "accepted" | "declined" | "completed" | "failed" | "blocked";

export interface TaskResult {
  branch: string;
  worktree: string;
  filesChanged?: string[];
  summary: string;
  nextSteps?: string[];
}

export interface TaskResponsePayload {
  taskId: string;
  action: TaskAction;
  /** Required when action is "declined", "failed", or "blocked" */
  reason?: string | null;
  result?: TaskResult | null;
}

// ─── Review Request ──────────────────────────────────────────────────────────

export interface ReviewRequestPayload {
  taskId: string;
  title: string;
  branch: string;
  worktree: string;
  filesForReview: string[];
  authorAgent: string;
  authorTier: string;
  reviewLevel: string;
  priorReviewNotes?: string | null;
}

// ─── Review Response ─────────────────────────────────────────────────────────

export type ReviewVerdict = "approved" | "changes_requested" | "escalated";

export type ConcernSeverity = "must_fix" | "should_fix" | "suggestion";

export interface ReviewerFix {
  file: string;
  description: string;
}

export interface UnresolvedConcern {
  file: string;
  line?: number | null;
  severity: ConcernSeverity;
  description: string;
}

export type ReviewNextAction = "send_back_to_worker" | "push_and_close" | "escalate_to_senior";

export interface NextTask {
  title: string;
  assignTo: string;
  dependencies?: string[];
}

export interface ReviewResponsePayload {
  taskId: string;
  verdict: ReviewVerdict;
  branch: string;
  worktree: string;
  reviewerFixes?: ReviewerFix[];
  unresolvedConcerns?: UnresolvedConcern[];
  nextAction: ReviewNextAction;
  nextTasks?: NextTask[];
}

// ─── Status Update ───────────────────────────────────────────────────────────

export type TaskStatus = "in_progress" | "blocked" | "completed" | "paused";

export interface StatusUpdatePayload {
  taskId?: string | null;
  status: TaskStatus;
  progress: string;
  blockedBy?: string | null;
  estimatedCompletion?: string | null;
}

// ─── Knowledge Share ─────────────────────────────────────────────────────────

export interface KnowledgeSharePayload {
  topic: string;
  discovery: string;
  relevantTo?: string[];
  source: string;
  actionable: boolean;
  suggestedAction?: string | null;
}

// ─── Broadcast ───────────────────────────────────────────────────────────────

export type BroadcastScope = "squad" | "org" | "c-suite";

export type BroadcastUrgency = "fyi" | "attention_needed" | "action_required";

export interface BroadcastPayload {
  scope: BroadcastScope;
  topic: string;
  message: string;
  urgency: BroadcastUrgency;
}

// ─── Payload Union ───────────────────────────────────────────────────────────

export type A2APayload =
  | TaskRequestPayload
  | TaskResponsePayload
  | ReviewRequestPayload
  | ReviewResponsePayload
  | StatusUpdatePayload
  | KnowledgeSharePayload
  | BroadcastPayload;

// ─── Message Envelope ────────────────────────────────────────────────────────

export interface A2AMessageBase {
  protocol: typeof A2A_PROTOCOL_VERSION;
  messageId: string;
  timestamp: string;
  from: AgentRef;
  to: AgentRef;
  priority: Priority;
  correlationId?: string | null;
}

export interface TaskRequestMessage extends A2AMessageBase {
  type: "task_request";
  payload: TaskRequestPayload;
}

export interface TaskResponseMessage extends A2AMessageBase {
  type: "task_response";
  payload: TaskResponsePayload;
}

export interface ReviewRequestMessage extends A2AMessageBase {
  type: "review_request";
  payload: ReviewRequestPayload;
}

export interface ReviewResponseMessage extends A2AMessageBase {
  type: "review_response";
  payload: ReviewResponsePayload;
}

export interface StatusUpdateMessage extends A2AMessageBase {
  type: "status_update";
  payload: StatusUpdatePayload;
}

export interface KnowledgeShareMessage extends A2AMessageBase {
  type: "knowledge_share";
  payload: KnowledgeSharePayload;
}

export interface BroadcastMessage extends A2AMessageBase {
  type: "broadcast";
  payload: BroadcastPayload;
}

/** Union of all valid A2A message types. */
export type A2AMessage =
  | TaskRequestMessage
  | TaskResponseMessage
  | ReviewRequestMessage
  | ReviewResponseMessage
  | StatusUpdateMessage
  | KnowledgeShareMessage
  | BroadcastMessage;
