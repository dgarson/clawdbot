/**
 * Overseer API for Goals.
 *
 * Provides access to the gateway's overseer functionality for managing
 * autonomous goals and their execution.
 */

import { getGatewayClient } from "./gateway-client";

export interface OverseerStatusResult {
  ts: number;
  goals: Array<{
    goalId: string;
    title: string;
    status: string;
    priority: string;
    updatedAt: number;
    tags: string[];
  }>;
  stalledAssignments: Array<{
    assignmentId: string;
    goalId: string;
    workNodeId: string;
    status: string;
    lastDispatchAt?: number;
    lastObservedActivityAt?: number;
    retryCount?: number;
  }>;
}

export interface OverseerGoal {
  id: string;
  title: string;
  description?: string;
  status: "pending" | "running" | "completed" | "failed" | "paused";
  progress: number;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface OverseerGoalCreateParams {
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface OverseerGoalCreateResult {
  goal: OverseerGoal;
}

export interface OverseerGoalStatusResult {
  goal?: OverseerGoal;
  logs?: Array<{
    timestamp: string;
    level: string;
    message: string;
  }>;
}

export interface OverseerGoalListResult {
  goals: OverseerGoal[];
  total: number;
}

type GatewayOverseerGoalListEntry = {
  goalId: string;
  title: string;
  status: string;
  priority: string;
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  tags: string[];
  problemStatement?: string;
};

type GatewayOverseerGoalListResult = {
  goals: GatewayOverseerGoalListEntry[];
  total: number;
};

type GatewayOverseerGoalDetail = GatewayOverseerGoalListEntry & {
  successCriteria?: string[];
  nonGoals?: string[];
  constraints?: string[];
  owner?: string;
  stakeholders?: string[];
  repoContextSnapshot?: string;
  assumptions?: string[];
};

type GatewayOverseerGoalStatusResult = {
  goal?: GatewayOverseerGoalDetail;
};

function toIsoTimestamp(value?: number): string {
  if (!Number.isFinite(value)) {
    return new Date(0).toISOString();
  }
  return new Date(value as number).toISOString();
}

function toOptionalIsoTimestamp(value?: number): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }
  return new Date(value as number).toISOString();
}

function normalizeGoalStatus(status?: string): OverseerGoal["status"] {
  switch (status) {
    case "active":
      return "running";
    case "paused":
      return "paused";
    case "completed":
      return "completed";
    case "cancelled":
    case "archived":
      return "failed";
    default:
      return "pending";
  }
}

function normalizeGatewayStatusFilter(status?: OverseerGoal["status"]): string | undefined {
  switch (status) {
    case "running":
    case "pending":
      return "active";
    case "paused":
      return "paused";
    case "completed":
      return "completed";
    case "failed":
      return "cancelled";
    default:
      return undefined;
  }
}

function mapGatewayGoalToOverseerGoal(goal: GatewayOverseerGoalListEntry): OverseerGoal {
  return {
    id: goal.goalId,
    title: goal.title,
    description: goal.problemStatement,
    status: normalizeGoalStatus(goal.status),
    progress: 0,
    createdAt: toIsoTimestamp(goal.createdAt),
    updatedAt: toIsoTimestamp(goal.updatedAt),
    startedAt: toOptionalIsoTimestamp(goal.startedAt),
    metadata: {
      tags: goal.tags,
      priority: goal.priority,
    },
  };
}

/**
 * Get the current status of the overseer
 */
export async function getOverseerStatus(): Promise<OverseerStatusResult> {
  const client = getGatewayClient();
  return client.request<OverseerStatusResult>("overseer.status");
}

/**
 * List all goals managed by the overseer
 */
export async function listOverseerGoals(params?: {
  status?: OverseerGoal["status"];
  limit?: number;
  offset?: number;
}): Promise<OverseerGoalListResult> {
  const client = getGatewayClient();
  const requestParams = params
    ? {
        ...params,
        status: normalizeGatewayStatusFilter(params.status),
      }
    : undefined;
  const result = await client.request<GatewayOverseerGoalListResult>(
    "overseer.goal.list",
    requestParams,
  );
  return {
    goals: result.goals.map((goal) => mapGatewayGoalToOverseerGoal(goal)),
    total: result.total,
  };
}

/**
 * Create a new goal for the overseer to work on
 */
export async function createGoal(params: OverseerGoalCreateParams): Promise<OverseerGoalCreateResult> {
  const client = getGatewayClient();
  return client.request<OverseerGoalCreateResult>("overseer.goal.create", params);
}

/**
 * Get the status of a specific goal
 */
export async function getGoalStatus(goalId: string): Promise<OverseerGoalStatusResult> {
  const client = getGatewayClient();
  const result = await client.request<GatewayOverseerGoalStatusResult>("overseer.goal.status", {
    goalId,
  });
  return {
    goal: result.goal ? mapGatewayGoalToOverseerGoal(result.goal) : undefined,
  };
}

/**
 * Pause a running goal
 */
export async function pauseGoal(goalId: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("overseer.goal.pause", { goalId });
}

/**
 * Resume a paused goal
 */
export async function resumeGoal(goalId: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("overseer.goal.resume", { goalId });
}

/**
 * Cancel a goal
 */
export async function cancelGoal(goalId: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("overseer.goal.cancel", { goalId });
}

/**
 * Delete a goal (only works on completed/failed/cancelled goals)
 */
export async function deleteGoal(goalId: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("overseer.goal.cancel", { goalId });
}
