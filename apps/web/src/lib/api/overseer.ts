/**
 * Overseer API for Goals.
 *
 * Provides access to the gateway's overseer functionality for managing
 * autonomous goals and their execution.
 */

import { getGatewayClient } from "./gateway-client";

export interface OverseerStatusResult {
  running: boolean;
  currentGoalId?: string;
  pendingGoals: number;
  completedGoals: number;
  failedGoals: number;
  lastRunAt?: string;
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
  goal: OverseerGoal;
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
  return client.request<OverseerGoalListResult>("overseer.goals.list", params);
}

/**
 * Create a new goal for the overseer to work on
 */
export async function createGoal(params: OverseerGoalCreateParams): Promise<OverseerGoalCreateResult> {
  const client = getGatewayClient();
  return client.request<OverseerGoalCreateResult>("overseer.goals.create", params);
}

/**
 * Get the status of a specific goal
 */
export async function getGoalStatus(goalId: string): Promise<OverseerGoalStatusResult> {
  const client = getGatewayClient();
  return client.request<OverseerGoalStatusResult>("overseer.goals.status", { goalId });
}

/**
 * Pause a running goal
 */
export async function pauseGoal(goalId: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("overseer.goals.pause", { goalId });
}

/**
 * Resume a paused goal
 */
export async function resumeGoal(goalId: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("overseer.goals.resume", { goalId });
}

/**
 * Cancel a goal
 */
export async function cancelGoal(goalId: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("overseer.goals.cancel", { goalId });
}

/**
 * Delete a goal (only works on completed/failed/cancelled goals)
 */
export async function deleteGoal(goalId: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("overseer.goals.delete", { goalId });
}
