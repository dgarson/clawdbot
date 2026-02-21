/**
 * Agent-to-Agent (A2A) Communication Protocol — JSON Schema Definitions
 *
 * These schemas are used by the validator for runtime message validation.
 * Each message type has its own payload schema, and a master schema
 * dispatches validation based on the `type` field.
 *
 * Spec: /Users/openclaw/.openclaw/workspace/_shared/specs/a2a-communication-protocol.md
 */

import type { JSONSchemaType } from "ajv";
import type {
  TaskRequestPayload,
  TaskResponsePayload,
  ReviewRequestPayload,
  ReviewResponsePayload,
  StatusUpdatePayload,
  KnowledgeSharePayload,
  BroadcastPayload,
} from "./types.js";

// ─── Shared Sub-Schemas ──────────────────────────────────────────────────────

export const agentRefSchema = {
  type: "object" as const,
  properties: {
    agentId: { type: "string" as const, minLength: 1 },
    role: { type: "string" as const, minLength: 1 },
    sessionKey: { type: "string" as const, nullable: true },
  },
  required: ["agentId", "role"] as const,
  additionalProperties: false,
};

export const taskContextSchema = {
  type: "object" as const,
  properties: {
    branch: { type: "string" as const, minLength: 1 },
    worktree: { type: "string" as const, minLength: 1 },
    relatedFiles: {
      type: "array" as const,
      items: { type: "string" as const },
      nullable: true,
    },
  },
  required: ["branch", "worktree"] as const,
  additionalProperties: false,
};

// ─── Payload Schemas ─────────────────────────────────────────────────────────

export const taskRequestPayloadSchema: JSONSchemaType<TaskRequestPayload> = {
  type: "object",
  properties: {
    taskId: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    description: { type: "string", minLength: 1 },
    taskType: {
      type: "string",
      enum: ["implementation", "review", "research", "analysis", "design"],
    },
    complexity: { type: "string", enum: ["trivial", "low", "medium", "high", "expert"] },
    deadline: { type: "string", nullable: true },
    context: { ...taskContextSchema, nullable: true } as JSONSchemaType<
      TaskRequestPayload["context"]
    >,
    acceptanceCriteria: {
      type: "array",
      items: { type: "string" },
      nullable: true,
    },
  },
  required: ["taskId", "title", "description", "taskType", "complexity"],
  additionalProperties: false,
};

export const taskResultSchema = {
  type: "object" as const,
  properties: {
    branch: { type: "string" as const, minLength: 1 },
    worktree: { type: "string" as const, minLength: 1 },
    filesChanged: {
      type: "array" as const,
      items: { type: "string" as const },
      nullable: true,
    },
    summary: { type: "string" as const, minLength: 1 },
    nextSteps: {
      type: "array" as const,
      items: { type: "string" as const },
      nullable: true,
    },
  },
  required: ["branch", "worktree", "summary"] as const,
  additionalProperties: false,
};

export const taskResponsePayloadSchema: JSONSchemaType<TaskResponsePayload> = {
  type: "object",
  properties: {
    taskId: { type: "string", minLength: 1 },
    action: { type: "string", enum: ["accepted", "declined", "completed", "failed", "blocked"] },
    reason: { type: "string", nullable: true },
    result: { ...taskResultSchema, nullable: true } as JSONSchemaType<
      TaskResponsePayload["result"]
    >,
  },
  required: ["taskId", "action"],
  additionalProperties: false,
};

export const reviewRequestPayloadSchema: JSONSchemaType<ReviewRequestPayload> = {
  type: "object",
  properties: {
    taskId: { type: "string", minLength: 1 },
    title: { type: "string", minLength: 1 },
    branch: { type: "string", minLength: 1 },
    worktree: { type: "string", minLength: 1 },
    filesForReview: { type: "array", items: { type: "string" }, minItems: 1 },
    authorAgent: { type: "string", minLength: 1 },
    authorTier: { type: "string", minLength: 1 },
    reviewLevel: { type: "string", minLength: 1 },
    priorReviewNotes: { type: "string", nullable: true },
  },
  required: [
    "taskId",
    "title",
    "branch",
    "worktree",
    "filesForReview",
    "authorAgent",
    "authorTier",
    "reviewLevel",
  ],
  additionalProperties: false,
};

export const reviewerFixSchema = {
  type: "object" as const,
  properties: {
    file: { type: "string" as const, minLength: 1 },
    description: { type: "string" as const, minLength: 1 },
  },
  required: ["file", "description"] as const,
  additionalProperties: false,
};

export const unresolvedConcernSchema = {
  type: "object" as const,
  properties: {
    file: { type: "string" as const, minLength: 1 },
    line: { type: "integer" as const, nullable: true },
    severity: { type: "string" as const, enum: ["must_fix", "should_fix", "suggestion"] as const },
    description: { type: "string" as const, minLength: 1 },
  },
  required: ["file", "severity", "description"] as const,
  additionalProperties: false,
};

export const nextTaskSchema = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const, minLength: 1 },
    assignTo: { type: "string" as const, minLength: 1 },
    dependencies: {
      type: "array" as const,
      items: { type: "string" as const },
      nullable: true,
    },
  },
  required: ["title", "assignTo"] as const,
  additionalProperties: false,
};

export const reviewResponsePayloadSchema: JSONSchemaType<ReviewResponsePayload> = {
  type: "object",
  properties: {
    taskId: { type: "string", minLength: 1 },
    verdict: { type: "string", enum: ["approved", "changes_requested", "escalated"] },
    branch: { type: "string", minLength: 1 },
    worktree: { type: "string", minLength: 1 },
    reviewerFixes: {
      type: "array",
      items: reviewerFixSchema as JSONSchemaType<ReviewResponsePayload["reviewerFixes"]>[number],
      nullable: true,
    } as JSONSchemaType<ReviewResponsePayload["reviewerFixes"]>,
    unresolvedConcerns: {
      type: "array",
      items: unresolvedConcernSchema as JSONSchemaType<
        ReviewResponsePayload["unresolvedConcerns"]
      >[number],
      nullable: true,
    } as JSONSchemaType<ReviewResponsePayload["unresolvedConcerns"]>,
    nextAction: {
      type: "string",
      enum: ["send_back_to_worker", "push_and_close", "escalate_to_senior"],
    },
    nextTasks: {
      type: "array",
      items: nextTaskSchema as JSONSchemaType<ReviewResponsePayload["nextTasks"]>[number],
      nullable: true,
    } as JSONSchemaType<ReviewResponsePayload["nextTasks"]>,
  },
  required: ["taskId", "verdict", "branch", "worktree", "nextAction"],
  additionalProperties: false,
};

export const statusUpdatePayloadSchema: JSONSchemaType<StatusUpdatePayload> = {
  type: "object",
  properties: {
    taskId: { type: "string", nullable: true },
    status: { type: "string", enum: ["in_progress", "blocked", "completed", "paused"] },
    progress: { type: "string", minLength: 1 },
    blockedBy: { type: "string", nullable: true },
    estimatedCompletion: { type: "string", nullable: true },
  },
  required: ["status", "progress"],
  additionalProperties: false,
};

export const knowledgeSharePayloadSchema: JSONSchemaType<KnowledgeSharePayload> = {
  type: "object",
  properties: {
    topic: { type: "string", minLength: 1 },
    discovery: { type: "string", minLength: 1 },
    relevantTo: {
      type: "array",
      items: { type: "string" },
      nullable: true,
    },
    source: { type: "string", minLength: 1 },
    actionable: { type: "boolean" },
    suggestedAction: { type: "string", nullable: true },
  },
  required: ["topic", "discovery", "source", "actionable"],
  additionalProperties: false,
};

export const broadcastPayloadSchema: JSONSchemaType<BroadcastPayload> = {
  type: "object",
  properties: {
    scope: { type: "string", enum: ["squad", "org", "c-suite"] },
    topic: { type: "string", minLength: 1 },
    message: { type: "string", minLength: 1 },
    urgency: { type: "string", enum: ["fyi", "attention_needed", "action_required"] },
  },
  required: ["scope", "topic", "message", "urgency"],
  additionalProperties: false,
};

/** Map from message type to its payload schema. */
export const payloadSchemas: Record<string, object> = {
  task_request: taskRequestPayloadSchema,
  task_response: taskResponsePayloadSchema,
  review_request: reviewRequestPayloadSchema,
  review_response: reviewResponsePayloadSchema,
  status_update: statusUpdatePayloadSchema,
  knowledge_share: knowledgeSharePayloadSchema,
  broadcast: broadcastPayloadSchema,
};
