export type ExecApprovalForwardingMode = "session" | "targets" | "both";

export type ExecApprovalForwardTarget = {
  /** Channel id (e.g. "discord", "slack", or plugin channel id). */
  channel: string;
  /** Destination id (channel id, user id, etc. depending on channel). */
  to: string;
  /** Optional account id for multi-account channels. */
  accountId?: string;
  /** Optional thread id to reply inside a thread. */
  threadId?: string | number;
};

export type ExecApprovalForwardingConfig = {
  /** Enable forwarding exec approvals to chat channels. Default: false. */
  enabled?: boolean;
  /** Delivery mode (session=origin chat, targets=config targets, both=both). Default: session. */
  mode?: ExecApprovalForwardingMode;
  /** Only forward approvals for these agent IDs. Omit = all agents. */
  agentFilter?: string[];
  /** Only forward approvals matching these session key patterns (substring or regex). */
  sessionFilter?: string[];
  /** Explicit delivery targets (used when mode includes targets). */
  targets?: ExecApprovalForwardTarget[];
};

export type HitlApprovalsPolicyConfig = {
  /** Stable policy identifier for request records and audit trails. */
  id: string;
  /** Optional exact tool match (e.g. "nodes.run"). */
  tool?: string;
  /** Optional category fallback match (e.g. "node"). */
  category?: string;
  /** Optional wildcard pattern match (supports `*` and `?`). */
  pattern?: string;
  /** Minimum role required to approve requests for this policy. */
  minApproverRole?: string;
  /** Require approver and requester to be different actors. */
  requireDifferentActor?: boolean;
};

export type HitlApprovalsConfig = {
  /** Optional fallback policy id used when no tool/category match exists. */
  defaultPolicyId?: string;
  /** Role ordering from low→high used for authorization checks. */
  approverRoleOrder?: string[];
  /** Policy list evaluated in declaration order. */
  policies?: HitlApprovalsPolicyConfig[];
};

export type ApprovalsConfig = {
  exec?: ExecApprovalForwardingConfig;
  hitl?: HitlApprovalsConfig;
};
