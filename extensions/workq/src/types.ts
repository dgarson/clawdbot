export const WORK_ITEM_STATUSES = [
  "claimed",
  "in-progress",
  "blocked",
  "in-review",
  "done",
  "dropped",
] as const;

export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

export const WORK_ITEM_ACTIVE_STATUSES = [
  "claimed",
  "in-progress",
  "blocked",
  "in-review",
] as const;

export type WorkItemActiveStatus = (typeof WORK_ITEM_ACTIVE_STATUSES)[number];

export const WORK_ITEM_PRIORITIES = ["critical", "high", "medium", "low"] as const;

export type WorkItemPriority = (typeof WORK_ITEM_PRIORITIES)[number];

export const WORK_LOG_ACTIONS = [
  "claimed",
  "status_change",
  "file_update",
  "note",
  "pr_linked",
  "completed",
  "dropped",
  "reassigned",
] as const;

export type WorkLogAction = (typeof WORK_LOG_ACTIONS)[number];

export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };

export interface WorkItemRow {
  id: number;
  issue_ref: string;
  title: string | null;
  agent_id: string;
  squad: string | null;
  status: WorkItemStatus;
  branch: string | null;
  worktree_path: string | null;
  pr_url: string | null;
  blocked_reason: string | null;
  priority: WorkItemPriority;
  scope_json: string;
  tags_json: string;
  claimed_at: string;
  updated_at: string;
  claimed_session_key: string | null;
}

export interface WorkItem {
  id: number;
  issueRef: string;
  title: string | null;
  agentId: string;
  squad: string | null;
  status: WorkItemStatus;
  branch: string | null;
  worktreePath: string | null;
  prUrl: string | null;
  blockedReason: string | null;
  priority: WorkItemPriority;
  scope: string[];
  tags: string[];
  files: string[];
  claimedAt: string;
  updatedAt: string;
  claimedSessionKey: string | null;
  isStale: boolean;
}

export interface WorkLogEntry {
  id: number;
  issueRef: string;
  agentId: string;
  action: WorkLogAction;
  detail: string | null;
  createdAt: string;
}

export interface ClaimInput {
  issueRef: string;
  agentId: string;
  title?: string;
  squad?: string;
  files?: string[];
  branch?: string;
  worktreePath?: string;
  priority?: WorkItemPriority;
  scope?: string[];
  tags?: string[];
  reopen?: boolean;
  sessionKey?: string;
}

export type ClaimResult =
  | { status: "claimed"; item: WorkItem }
  | { status: "already_yours"; item: WorkItem }
  | {
      status: "conflict";
      issueRef: string;
      claimedBy: string;
      claimedAt: string;
      currentStatus: WorkItemStatus;
    };

export interface ReleaseInput {
  issueRef: string;
  agentId: string;
  reason?: string;
}

export interface StatusInput {
  issueRef: string;
  agentId: string;
  status: WorkItemStatus;
  reason?: string;
  prUrl?: string;
}

export interface DoneInput {
  issueRef: string;
  agentId: string;
  prUrl: string;
  summary?: string;
}

export interface LogInput {
  issueRef: string;
  agentId: string;
  note: string;
}

export type FilesMode = "check" | "set" | "add" | "remove";

export interface FilesInput {
  mode?: FilesMode;
  issueRef?: string;
  path?: string;
  paths?: string[];
  agentId?: string;
  excludeAgentId?: string;
}

export interface FileConflict {
  issueRef: string;
  agentId: string;
  status: WorkItemStatus;
  matchingFiles: string[];
}

export interface FilesResult {
  mode: FilesMode;
  conflicts: FileConflict[];
  hasConflicts: boolean;
  added?: string[];
  removed?: string[];
  files?: string[];
}

export interface QueryFilters {
  squad?: string;
  agentId?: string;
  status?: WorkItemStatus | WorkItemStatus[];
  priority?: WorkItemPriority | WorkItemPriority[];
  scope?: string;
  issueRef?: string;
  activeOnly?: boolean;
  updatedAfter?: string;
  updatedBefore?: string;
  limit?: number;
  offset?: number;
  staleThresholdHours?: number;
}

export interface QueryResult {
  items: WorkItem[];
  total: number;
}

export interface SweepCandidate extends WorkItem {
  staleMinutes: number;
}

export interface SweepTransitionResult {
  issueRef: string;
  from: WorkItemStatus;
  to: WorkItemStatus;
}

export interface WorkqDatabaseApi {
  claim(input: ClaimInput): ClaimResult;
  release(input: ReleaseInput): { status: "dropped"; issueRef: string };
  status(input: StatusInput): {
    status: "updated";
    issueRef: string;
    from: WorkItemStatus;
    to: WorkItemStatus;
  };
  query(filters?: QueryFilters): QueryResult;
  files(input: FilesInput): FilesResult;
  log(input: LogInput): { status: "logged"; issueRef: string; logId: number };
  done(input: DoneInput): { status: "done"; issueRef: string; prUrl: string };
  get(issueRef: string, staleThresholdHours?: number): WorkItem | null;
  getLog(issueRef: string, limit?: number): WorkLogEntry[];
  findStaleActiveItems(staleAfterMinutes: number): SweepCandidate[];
  autoReleaseBySession(input: { sessionKey: string; actorId: string; reason: string }): {
    releasedIssueRefs: string[];
  };
  systemMoveToInReview(input: {
    issueRef: string;
    actorId: string;
    reason: string;
  }): SweepTransitionResult;
  systemMarkDone(input: {
    issueRef: string;
    actorId: string;
    summary: string;
    prUrl?: string;
  }): SweepTransitionResult;
  systemReleaseToUnclaimed(input: {
    issueRef: string;
    actorId: string;
    reason: string;
  }): SweepTransitionResult;
  systemAnnotate(input: { issueRef: string; actorId: string; note: string }): {
    issueRef: string;
    annotated: true;
  };
  getById(id: number, staleThresholdHours?: number): WorkItem | null;
}
