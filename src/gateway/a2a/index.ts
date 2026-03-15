/**
 * Agent-to-Agent (A2A) Communication Protocol — Module Barrel Export
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

// Types
export type {
  AgentRef,
  Priority,
  MessageType,
  TaskType,
  Complexity,
  TaskContext,
  TaskRequestPayload,
  TaskAction,
  TaskResult,
  TaskResponsePayload,
  ReviewRequestPayload,
  ReviewVerdict,
  ConcernSeverity,
  ReviewerFix,
  UnresolvedConcern,
  ReviewNextAction,
  NextTask,
  ReviewResponsePayload,
  TaskStatus,
  StatusUpdatePayload,
  KnowledgeSharePayload,
  BroadcastScope,
  BroadcastUrgency,
  BroadcastPayload,
  A2APayload,
  A2AMessageBase,
  TaskRequestMessage,
  TaskResponseMessage,
  ReviewRequestMessage,
  ReviewResponseMessage,
  StatusUpdateMessage,
  KnowledgeShareMessage,
  BroadcastMessage,
  A2AMessage,
} from "./types.js";

export { A2A_PROTOCOL_VERSION, MESSAGE_TYPES, PRIORITIES } from "./types.js";

// Schemas
export { payloadSchemas } from "./schema.js";

// Validator
export { validateA2AMessage } from "./validator.js";
export type { ValidationError, ValidationResult } from "./validator.js";
