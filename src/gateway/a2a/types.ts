/**
 * Agent-to-Agent (A2A) Communication Protocol — Type Definitions
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 * NOTE: This is a copy from Workstream A for use in Router development.
 * Will be consolidated when branches merge.
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

export interface AgentRef {
  agentId: string;
  role: string;
  sessionKey?: string;
}

export interface A2AMessageBase {
  protocol: typeof A2A_PROTOCOL_VERSION;
  messageId: string;
  timestamp: string;
  from: AgentRef;
  to: AgentRef;
  type: MessageType;
  priority: Priority;
  correlationId?: string | null;
  payload: Record<string, unknown>;
}

/** Generic A2A message type used by the router (payload is opaque at routing layer). */
export type A2AMessage = A2AMessageBase;
