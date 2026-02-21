/**
 * Agent-to-Agent (A2A) Communication Protocol — Type Definitions
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 * NOTE: Copy from Workstream A for SDK development. Will be consolidated on merge.
 */

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
export type TaskType = "implementation" | "review" | "research" | "analysis" | "design";
export type Complexity = "trivial" | "low" | "medium" | "high" | "expert";
export type TaskAction = "accepted" | "declined" | "completed" | "failed" | "blocked";
export type ReviewVerdict = "approved" | "changes_requested" | "escalated";
export type ConcernSeverity = "must_fix" | "should_fix" | "suggestion";
export type ReviewNextAction = "send_back_to_worker" | "push_and_close" | "escalate_to_senior";
export type TaskStatus = "in_progress" | "blocked" | "completed" | "paused";
export type BroadcastScope = "squad" | "org" | "c-suite";
export type BroadcastUrgency = "fyi" | "attention_needed" | "action_required";

export interface AgentRef {
  agentId: string;
  role: string;
  sessionKey?: string;
}
export interface TaskContext {
  branch: string;
  worktree: string;
  relatedFiles?: string[];
}
export interface TaskResult {
  branch: string;
  worktree: string;
  filesChanged?: string[];
  summary: string;
  nextSteps?: string[];
}
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
export interface NextTask {
  title: string;
  assignTo: string;
  dependencies?: string[];
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
export interface TaskResponsePayload {
  taskId: string;
  action: TaskAction;
  reason?: string | null;
  result?: TaskResult | null;
}
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
export interface StatusUpdatePayload {
  taskId?: string | null;
  status: TaskStatus;
  progress: string;
  blockedBy?: string | null;
  estimatedCompletion?: string | null;
}
export interface KnowledgeSharePayload {
  topic: string;
  discovery: string;
  relevantTo?: string[];
  source: string;
  actionable: boolean;
  suggestedAction?: string | null;
}
export interface BroadcastPayload {
  scope: BroadcastScope;
  topic: string;
  message: string;
  urgency: BroadcastUrgency;
}

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

export type A2AMessage =
  | TaskRequestMessage
  | TaskResponseMessage
  | ReviewRequestMessage
  | ReviewResponseMessage
  | StatusUpdateMessage
  | KnowledgeShareMessage
  | BroadcastMessage;
