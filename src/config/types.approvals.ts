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
  /**
   * Skip forwarding to Discord when Discord exec approvals are enabled, to avoid duplicate
   * approval prompts (plain text + button UI). Default: true.
   */
  skipDiscordWhenExecApprovalsEnabled?: boolean;
  /** Only forward approvals for these agent IDs. Omit = all agents. */
  agentFilter?: string[];
  /** Only forward approvals matching these session key patterns (substring or regex). */
  sessionFilter?: string[];
  /** Explicit delivery targets (used when mode includes targets). */
  targets?: ExecApprovalForwardTarget[];
};

// ---------------------------------------------------------------------------
// Tool Approval Policy
// ---------------------------------------------------------------------------

import type { RiskClass } from "../agents/tool-risk/types.js";

export type ToolApprovalMode = "off" | "adaptive" | "always";

export type ToolApprovalPolicyConfig = {
  /** Require human approval for tools at or above this risk class. Default: R3. */
  requireApprovalAtOrAbove?: RiskClass;
  /** Deny tool calls at or above this risk class outright. Default: none. */
  denyAtOrAbove?: RiskClass;
  /** Require approval for any tool that writes externally. */
  requireApprovalForExternalWrite?: boolean;
  /** Require approval for any tool that sends a message. */
  requireApprovalForMessagingSend?: boolean;
};

export type ToolApprovalRoutingConfig = {
  /** How to route approval requests. Default: session. */
  mode?: ExecApprovalForwardingMode;
  /** Explicit delivery targets (used when mode includes targets). */
  targets?: ExecApprovalForwardTarget[];
  /** Only route approvals for these agent IDs. Omit = all agents. */
  agentFilter?: string[];
  /** Only route approvals matching these session key patterns. */
  sessionFilter?: string[];
};

export type ToolApprovalClassifierConfig = {
  /** Enable the fast safety classifier. Default: false. */
  enabled?: boolean;
  /** Classifier timeout in ms. */
  timeoutMs?: number;
  /** Minimum confidence to accept classifier output. */
  minConfidence?: number;
  /** Action on low confidence. */
  onLowConfidence?: "require_approval" | "deny" | "allow";
  /** Provider for the classifier model. */
  provider?: string;
  /** Model id for the classifier. */
  model?: string;
  /** Max input chars sent to classifier. */
  maxInputChars?: number;
};

export type ToolApprovalsConfig = {
  /** Enable tool approval gating. Default: false. */
  enabled?: boolean;
  /** Approval mode. Default: off. */
  mode?: ToolApprovalMode;
  /** Timeout for waiting on approval decisions (ms). Default: 120000. */
  timeoutMs?: number;
  /** Policy thresholds for risk-based decisions. */
  policy?: ToolApprovalPolicyConfig;
  /** Routing config for approval requests. */
  routing?: ToolApprovalRoutingConfig;
  /** Classifier config (reserved for later phases). */
  classifier?: ToolApprovalClassifierConfig;
};

export type ApprovalsConfig = {
  exec?: ExecApprovalForwardingConfig;
  tools?: ToolApprovalsConfig;
};
