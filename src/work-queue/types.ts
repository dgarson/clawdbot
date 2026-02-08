export const WORK_ITEM_STATUSES = [
  "pending",
  "in_progress",
  "blocked",
  "completed",
  "failed",
  "cancelled",
] as const;

export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

export const WORK_ITEM_PRIORITIES = ["critical", "high", "medium", "low"] as const;

export type WorkItemPriority = (typeof WORK_ITEM_PRIORITIES)[number];

export type WorkItemActor = {
  sessionKey?: string;
  agentId?: string;
};

export type WorkItemArtifact = {
  type: string;
  path?: string;
  url?: string;
};

// ---------------------------------------------------------------------------
// Well-known payload fields
// ---------------------------------------------------------------------------

/** A single phase in a multi-phase work item. */
export type WorkItemPhase = {
  /** Human-readable phase name (e.g. "Phase 1: Schema changes"). */
  name: string;
  /** What this phase should accomplish. */
  description: string;
  /** Suggested commit message for the end of this phase. */
  commitMessage?: string;
  /** Commands to run to verify this phase. */
  verifyCommands?: string[];
};

/**
 * Well-known typed fields that can appear inside `WorkItem.payload`.
 *
 * The `payload` bag remains `Record<string, unknown>` for extensibility,
 * but these fields are recognized by the worker and system prompt builder.
 */
export type WorkItemPayload = {
  // --- Agent session configuration ---
  /** Full replacement of the default worker system prompt. */
  systemPrompt?: string;
  /** Appended to the default worker system prompt (additive). */
  systemPromptAppend?: string;
  /** Task-specific instructions injected into the task message body. */
  instructions?: string;

  // --- Git / branch configuration ---
  /** Target repository (e.g. "dgarson/clawdbrain"). */
  repo?: string;
  /** Branch to create the worktree from (default: "main"). */
  baseBranch?: string;
  /** Prefix for auto-generated branch names (e.g. "feat/", "fix/"). */
  branchPrefix?: string;
  /** Explicit branch name override. */
  branchName?: string;

  // --- Per-item runtime overrides (override WorkerConfig values) ---
  /** Model override for this item's agent session. */
  model?: string;
  /** Thinking level override for this item's agent session. */
  thinking?: string;
  /** Session timeout override in seconds. */
  timeoutSeconds?: number;

  // --- Acceptance criteria ---
  /** Testable/verifiable criteria for completion. */
  acceptanceCriteria?: string[];
  /** Shell commands to run for verification. */
  verifyCommands?: string[];

  // --- Context hints ---
  /** Files the agent should examine first. */
  relevantFiles?: string[];
  /** URLs to fetch for background context. */
  contextUrls?: string[];

  // --- Multi-phase definition ---
  /** Ordered phases for a multi-phase task. */
  phases?: WorkItemPhase[];

  // --- Notification ---
  /** Channels/users to notify on completion. */
  notifyOnComplete?: {
    channels?: string[];
    users?: string[];
  };

  /** Arbitrary extension fields. */
  [key: string]: unknown;
};

export type WorkItemResult = {
  summary?: string;
  outputs?: Record<string, unknown>;
  artifacts?: WorkItemArtifact[];
};

export type WorkItemError = {
  message: string;
  code?: string;
  recoverable?: boolean;
};

export type WorkItemOutcome = "success" | "error" | "timeout" | "approval_timeout" | "cancelled";

export type WorkItemExecution = {
  id: string;
  itemId: string;
  attemptNumber: number;
  sessionKey: string;
  outcome: WorkItemOutcome;
  error?: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
};

export type WorkItem = {
  id: string;
  queueId: string;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
  status: WorkItemStatus;
  statusReason?: string;
  parentItemId?: string;
  dependsOn?: string[];
  blockedBy?: string[];
  createdBy?: WorkItemActor;
  assignedTo?: WorkItemActor;
  priority: WorkItemPriority;
  workstream?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  retryCount?: number;
  maxRetries?: number;
  deadline?: string;
  lastOutcome?: WorkItemOutcome;
  startedAt?: string;
  /** Timestamp for the last worker heartbeat while in_progress. */
  lastHeartbeatAt?: string;
  completedAt?: string;
  result?: WorkItemResult;
  error?: WorkItemError;
};

export type WorkQueue = {
  id: string;
  agentId: string;
  name: string;
  concurrencyLimit: number;
  defaultPriority: WorkItemPriority;
  createdAt: string;
  updatedAt: string;
};

export type WorkQueueStats = {
  pending: number;
  inProgress: number;
  blocked: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
};

export type WorkItemListOptions = {
  queueId?: string;
  status?: WorkItemStatus | WorkItemStatus[];
  priority?: WorkItemPriority | WorkItemPriority[];
  workstream?: string;
  tags?: string[];
  createdAfter?: string;
  createdBefore?: string;
  assignedTo?: string;
  createdBy?: string;
  parentItemId?: string;
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "updatedAt" | "priority";
  orderDir?: "asc" | "desc";
};

export type WorkItemPatch = Partial<
  Pick<
    WorkItem,
    | "queueId"
    | "title"
    | "description"
    | "payload"
    | "status"
    | "statusReason"
    | "parentItemId"
    | "dependsOn"
    | "blockedBy"
    | "assignedTo"
    | "priority"
    | "workstream"
    | "tags"
    | "retryCount"
    | "maxRetries"
    | "deadline"
    | "lastOutcome"
    | "startedAt"
    | "lastHeartbeatAt"
    | "completedAt"
    | "result"
    | "error"
  >
>;
