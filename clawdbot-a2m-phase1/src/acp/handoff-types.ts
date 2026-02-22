/**
 * ACP Handoff Types — Phase 1
 * 
 * Based on: /Users/openclaw/.openclaw/workspace/_shared/specs/p1-design/p1-acp-handoff-plan-barry.md
 * Canonical spec: /Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md §7
 */

export type HandoffStatus =
  | "draft"
  | "proposed"
  | "validating"
  | "accepted"
  | "rejected"
  | "activated"
  | "completed"
  | "closed";

export type ACPPriority = "P0" | "P1" | "P2" | "P3";

export type ACPArtifactRef = {
  artifact_id: string;
  type: "file" | "directory" | "commit" | "pr" | "issue" | "url";
  path?: string;
  url?: string;
  commit_sha?: string;
  pr_number?: number;
  issue_number?: number;
};

export type ACPExternalRef = {
  system: "workq" | "github" | "linear" | "notion" | string;
  ref_id: string;
  ref_type: string;
  url?: string;
};

export type ACPHandoffPackage = {
  handoff_id: string;
  thread_id: string;
  
  task: {
    task_id: string;
    title: string;
    objective: string;
    success_criteria: string[];
    deadline?: string;
    priority: ACPPriority;
    external_refs?: ACPExternalRef[];
  };
  
  context: {
    summary: string;
    constraints?: string[];
    assumptions?: string[];
    open_questions?: string[];
    known_risks?: string[];
  };
  
  work_state: {
    status: "not_started" | "in_progress" | "blocked" | "review";
    percent_complete?: number;
    completed_steps?: string[];
    next_step: string;
    branch?: string;
    worktree_path?: string;
    test_status?: "passing" | "failing" | "untested";
  };
  
  artifacts: Array<{
    artifact_id: string;
    ref: ACPArtifactRef;
  }>;
  
  provenance: {
    origin_session: string;
    related_sessions?: string[];
    decision_refs?: string[];
    message_thread_refs?: string[];
    handoff_chain?: string[];
  };
  
  policy: {
    classification: "internal" | "restricted";
    requires_human_approval: boolean;
    export_restrictions?: string[];
  };
  
  verification: {
    schema_version: "1.0.0";
    package_hash: string;
  };
};

export type HandoffRejectionCode =
  | "recipient_unavailable"
  | "recipient_overloaded"
  | "skill_mismatch"
  | "deadline_conflict"
  | "policy_violation"
  | "invalid_package"
  | "validation_failed"
  | "cycle_detected"
  | "unauthorized"
  | "resource_conflict"
  | "cancelled_by_sender"
  | "other";

export type HandoffRejection = {
  code: HandoffRejectionCode;
  reason: string;
  suggested_alternative?: string;
  retry_after?: number;
};

export type HandoffTransition = {
  from_status: HandoffStatus;
  to_status: HandoffStatus;
  agent: string;
  timestamp: string;
  notes?: string;
  rejection?: HandoffRejection;
};

export type HandoffRecord = {
  id: string;
  thread_id: string;
  task_id: string;
  from_agent: string;
  to_agent: string;
  title: string;
  reason: string;
  package_json: string; // JSON-serialized ACPHandoffPackage
  status: HandoffStatus;
  provenance_json: string; // JSON-serialized provenance
  verification_json: string; // JSON-serialized verification
  initiated_at: string;
  resolved_at?: string;
  resolution_notes?: string;
  transitions: HandoffTransition[];
};

// ACL Types

export type ACLPermission = 
  | "handoff:initiate"
  | "handoff:accept"
  | "handoff:reject"
  | "handoff:cancel"
  | "handoff:escalate"
  | "message:send"
  | "message:broadcast"
  | "artifact:register"
  | "artifact:read"
  | "artifact:update"
  | "team:create"
  | "team:join"
  | "team:manage"
  | "admin:configure";

export type ACLRole = 
  | "owner"
  | "coordinator"
  | "executor"
  | "reviewer"
  | "observer";

export type ACLPolicy = {
  agent_id: string;
  role: ACLRole;
  permissions: ACLPermission[];
  resource_patterns?: string[]; // glob patterns for resource access
  constraints?: {
    max_handoffs_per_day?: number;
    max_broadcasts_per_hour?: number;
    allowed_recipients?: string[]; // agent IDs or patterns
    restricted_until?: string;
  };
};

export type ACLDecision = {
  allowed: boolean;
  permission: ACLPermission;
  agent_id: string;
  resource?: string;
  reason?: string;
  policy_id?: string;
};
