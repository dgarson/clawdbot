export type TaskReassignmentReason =
  | "agent_stalled"
  | "agent_error"
  | "timeout"
  | "rate_limited"
  | "invalid_model_response"
  | "unknown";

export type TaskReassignmentSeverity = "warning" | "error" | "critical";

export type StructuredErrorSnapshot = {
  name?: string;
  message: string;
  code?: string;
  status?: number;
  stack?: string;
};

export type TaskReassignmentMetadataValue = string | number | boolean | null;

export type TaskReassignmentEvent = {
  type: "agent.task-reassignment.requested";
  eventId: string;
  createdAt: string;
  taskId: string;
  sessionKey: string;
  reason: TaskReassignmentReason;
  severity: TaskReassignmentSeverity;
  retryable: boolean;
  agentId?: string;
  attempt?: number;
  maxAttempts?: number;
  model?: {
    provider: string;
    model: string;
  };
  lastError?: StructuredErrorSnapshot;
  metadata: Record<string, TaskReassignmentMetadataValue>;
};

export type CreateTaskReassignmentEventParams = {
  taskId: string;
  sessionKey: string;
  reason: TaskReassignmentReason;
  severity?: TaskReassignmentSeverity;
  retryable?: boolean;
  agentId?: string;
  attempt?: number;
  maxAttempts?: number;
  model?: {
    provider: string;
    model: string;
  };
  error?: unknown;
  metadata?: Record<string, TaskReassignmentMetadataValue>;
  now?: Date;
  eventId?: string;
};

function pickErrorStringField(error: unknown, key: string): string | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function pickErrorNumberField(error: unknown, key: string): number | undefined {
  if (!error || typeof error !== "object") {
    return undefined;
  }
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function toStructuredErrorSnapshot(error: unknown): StructuredErrorSnapshot | undefined {
  if (error === undefined || error === null) {
    return undefined;
  }

  if (error instanceof Error) {
    const status =
      pickErrorNumberField(error, "status") ?? pickErrorNumberField(error, "statusCode");
    const code = pickErrorStringField(error, "code");
    return {
      name: error.name || undefined,
      message: error.message || String(error),
      code,
      status,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
    };
  }

  if (typeof error === "object") {
    const message = pickErrorStringField(error, "message") ?? "Unknown error object";
    const status =
      pickErrorNumberField(error, "status") ?? pickErrorNumberField(error, "statusCode");
    return {
      name: pickErrorStringField(error, "name"),
      message,
      code: pickErrorStringField(error, "code"),
      status,
      stack: pickErrorStringField(error, "stack"),
    };
  }

  if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") {
    return {
      message: `${error}`,
    };
  }

  if (typeof error === "symbol") {
    return {
      message: error.description ? `Symbol(${error.description})` : "Symbol(unknown)",
    };
  }

  return {
    message: "Unknown error",
  };
}

function generateEventId(now: Date): string {
  const timestamp = now.getTime().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `reassign-${timestamp}-${random}`;
}

export function createTaskReassignmentEvent(
  params: CreateTaskReassignmentEventParams,
): TaskReassignmentEvent {
  const now = params.now ?? new Date();

  return {
    type: "agent.task-reassignment.requested",
    eventId: params.eventId ?? generateEventId(now),
    createdAt: now.toISOString(),
    taskId: params.taskId,
    sessionKey: params.sessionKey,
    reason: params.reason,
    severity: params.severity ?? "error",
    retryable: params.retryable ?? true,
    agentId: params.agentId,
    attempt: params.attempt,
    maxAttempts: params.maxAttempts,
    model: params.model,
    lastError: toStructuredErrorSnapshot(params.error),
    metadata: { ...params.metadata },
  };
}

export function isTaskReassignmentEvent(value: unknown): value is TaskReassignmentEvent {
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return record.type === "agent.task-reassignment.requested";
}
