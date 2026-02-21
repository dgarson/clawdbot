/**
 * Agent-to-Agent (A2A) Communication Protocol — Agent-Side SDK
 *
 * Convenience functions for agents to construct, send, and parse A2A messages.
 * Enforces the schema, auto-populates envelope fields, generates UUIDs.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

import { randomUUID } from "node:crypto";
import {
  A2A_PROTOCOL_VERSION,
  type A2AMessage,
  type AgentRef,
  type Priority,
  type TaskRequestPayload,
  type TaskResponsePayload,
  type ReviewRequestPayload,
  type ReviewResponsePayload,
  type StatusUpdatePayload,
  type KnowledgeSharePayload,
  type BroadcastPayload,
  type TaskRequestMessage,
  type TaskResponseMessage,
  type ReviewRequestMessage,
  type ReviewResponseMessage,
  type StatusUpdateMessage,
  type KnowledgeShareMessage,
  type BroadcastMessage,
} from "./types.js";

// ─── SDK Context ─────────────────────────────────────────────────────────────

/**
 * Agent identity context. Set once at agent startup so all messages
 * auto-populate the `from` field.
 */
export interface AgentContext {
  agentId: string;
  role: string;
  sessionKey?: string;
}

let currentContext: AgentContext | null = null;

/**
 * Initialize the SDK with the current agent's identity.
 * Must be called before using any send* functions.
 */
export function initA2ASDK(context: AgentContext): void {
  currentContext = { ...context };
}

/**
 * Get the current agent context, or throw if not initialized.
 */
export function getContext(): AgentContext {
  if (!currentContext) {
    throw new Error("A2A SDK not initialized. Call initA2ASDK() first.");
  }
  return { ...currentContext };
}

/**
 * Clear the SDK context (for testing).
 */
export function resetA2ASDK(): void {
  currentContext = null;
}

// ─── Send Function Type ──────────────────────────────────────────────────────

/**
 * Pluggable send function. The SDK calls this to deliver messages.
 * In production, this would call the A2A router.
 */
export type SendFn = (message: A2AMessage) => Promise<void>;

let sendFn: SendFn | null = null;

/**
 * Register the send function for message delivery.
 */
export function setSendFunction(fn: SendFn): void {
  sendFn = fn;
}

async function send(message: A2AMessage): Promise<A2AMessage> {
  if (sendFn) {
    await sendFn(message);
  }
  return message;
}

// ─── Envelope Builder ────────────────────────────────────────────────────────

function buildEnvelope(
  to: AgentRef,
  priority: Priority = "normal",
  correlationId?: string | null,
): Omit<A2AMessage, "type" | "payload"> {
  const ctx = getContext();
  return {
    protocol: A2A_PROTOCOL_VERSION,
    messageId: randomUUID(),
    timestamp: new Date().toISOString(),
    from: {
      agentId: ctx.agentId,
      role: ctx.role,
      ...(ctx.sessionKey ? { sessionKey: ctx.sessionKey } : {}),
    },
    to,
    priority,
    ...(correlationId !== undefined ? { correlationId } : {}),
  };
}

// ─── Message Builders ────────────────────────────────────────────────────────

export interface SendOptions {
  to: AgentRef;
  priority?: Priority;
  correlationId?: string | null;
}

/**
 * Build and send a task_request message.
 */
export async function sendTaskRequest(
  options: SendOptions & { payload: TaskRequestPayload },
): Promise<TaskRequestMessage> {
  const message: TaskRequestMessage = {
    ...buildEnvelope(options.to, options.priority ?? "normal", options.correlationId),
    type: "task_request",
    payload: options.payload,
  };
  return (await send(message)) as TaskRequestMessage;
}

/**
 * Build and send a task_response message.
 */
export async function sendTaskResponse(
  options: SendOptions & { payload: TaskResponsePayload },
): Promise<TaskResponseMessage> {
  const message: TaskResponseMessage = {
    ...buildEnvelope(options.to, options.priority ?? "normal", options.correlationId),
    type: "task_response",
    payload: options.payload,
  };
  return (await send(message)) as TaskResponseMessage;
}

/**
 * Build and send a review_request message.
 */
export async function sendReviewRequest(
  options: SendOptions & { payload: ReviewRequestPayload },
): Promise<ReviewRequestMessage> {
  const message: ReviewRequestMessage = {
    ...buildEnvelope(options.to, options.priority ?? "high", options.correlationId),
    type: "review_request",
    payload: options.payload,
  };
  return (await send(message)) as ReviewRequestMessage;
}

/**
 * Build and send a review_response message.
 */
export async function sendReviewResponse(
  options: SendOptions & { payload: ReviewResponsePayload },
): Promise<ReviewResponseMessage> {
  const message: ReviewResponseMessage = {
    ...buildEnvelope(options.to, options.priority ?? "normal", options.correlationId),
    type: "review_response",
    payload: options.payload,
  };
  return (await send(message)) as ReviewResponseMessage;
}

/**
 * Build and send a status_update message.
 */
export async function sendStatusUpdate(
  options: SendOptions & { payload: StatusUpdatePayload },
): Promise<StatusUpdateMessage> {
  const message: StatusUpdateMessage = {
    ...buildEnvelope(options.to, options.priority ?? "normal", options.correlationId),
    type: "status_update",
    payload: options.payload,
  };
  return (await send(message)) as StatusUpdateMessage;
}

/**
 * Build and send a knowledge_share message.
 */
export async function sendKnowledgeShare(
  options: SendOptions & { payload: KnowledgeSharePayload },
): Promise<KnowledgeShareMessage> {
  const message: KnowledgeShareMessage = {
    ...buildEnvelope(options.to, options.priority ?? "normal", options.correlationId),
    type: "knowledge_share",
    payload: options.payload,
  };
  return (await send(message)) as KnowledgeShareMessage;
}

/**
 * Build and send a broadcast message.
 */
export async function sendBroadcast(
  options: Omit<SendOptions, "to"> & { payload: BroadcastPayload; priority?: Priority },
): Promise<BroadcastMessage> {
  const to: AgentRef = { agentId: "*", role: "*" };
  const message: BroadcastMessage = {
    ...buildEnvelope(to, options.priority ?? "normal", options.correlationId),
    type: "broadcast",
    payload: options.payload,
  };
  return (await send(message)) as BroadcastMessage;
}

// ─── Message Parsing ─────────────────────────────────────────────────────────

/**
 * Parse a raw object into a typed A2A message.
 * This is a lightweight check — for full validation, use the validator from Workstream A.
 */
export function parseA2AMessage(input: unknown): A2AMessage | null {
  if (typeof input !== "object" || input === null) {
    return null;
  }
  const obj = input as Record<string, unknown>;
  if (obj.protocol !== A2A_PROTOCOL_VERSION) {
    return null;
  }
  if (typeof obj.type !== "string") {
    return null;
  }
  if (typeof obj.payload !== "object" || obj.payload === null) {
    return null;
  }
  return input as A2AMessage;
}

/**
 * Check if an input looks like an A2A message (quick duck-type check).
 */
export function isA2AMessage(input: unknown): input is A2AMessage {
  return parseA2AMessage(input) !== null;
}

/**
 * Extract the message type from an A2A message for dispatch/routing.
 */
export function getMessageType(message: A2AMessage): A2AMessage["type"] {
  return message.type;
}

/**
 * Create a response correlationId chain — uses the original message's
 * correlationId if present, otherwise the messageId.
 */
export function deriveCorrelationId(originalMessage: A2AMessage): string {
  return (originalMessage.correlationId as string) ?? originalMessage.messageId;
}
