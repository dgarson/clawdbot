/**
 * Cron Jobs API.
 *
 * Provides access to the gateway's cron job management functionality.
 */

import { getGatewayClient } from "./gateway-client";

export interface CronJob {
  id: string;
  name: string;
  description?: string;
  schedule: string; // cron expression
  agentId: string;
  message: string;
  enabled: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  lastResult?: {
    success: boolean;
    runId?: string;
    error?: string;
    duration?: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CronJobCreateParams {
  name: string;
  description?: string;
  schedule: string;
  agentId: string;
  message: string;
  enabled?: boolean;
}

export interface CronJobUpdateParams {
  id: string;
  name?: string;
  description?: string;
  schedule?: string;
  agentId?: string;
  message?: string;
  enabled?: boolean;
}

export interface CronJobListResult {
  jobs: CronJob[];
  total: number;
}

export interface CronJobRunResult {
  runId: string;
  started: boolean;
}

/**
 * List all cron jobs
 */
export async function listCronJobs(params?: {
  enabled?: boolean;
  agentId?: string;
}): Promise<CronJobListResult> {
  const client = getGatewayClient();
  return client.request<CronJobListResult>("cron.list", params);
}

/**
 * Get a specific cron job
 */
export async function getCronJob(id: string): Promise<CronJob> {
  const client = getGatewayClient();
  return client.request<CronJob>("cron.get", { id });
}

/**
 * Add a new cron job
 */
export async function addCronJob(params: CronJobCreateParams): Promise<CronJob> {
  const client = getGatewayClient();
  return client.request<CronJob>("cron.add", params);
}

/**
 * Update an existing cron job
 */
export async function updateCronJob(params: CronJobUpdateParams): Promise<CronJob> {
  const client = getGatewayClient();
  return client.request<CronJob>("cron.update", params);
}

/**
 * Remove a cron job
 */
export async function removeCronJob(id: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("cron.remove", { id });
}

/**
 * Enable a cron job
 */
export async function enableCronJob(id: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("cron.enable", { id });
}

/**
 * Disable a cron job
 */
export async function disableCronJob(id: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("cron.disable", { id });
}

/**
 * Run a cron job immediately
 * @param id - Job ID
 * @param mode - "sync" waits for completion, "async" returns immediately
 */
export async function runCronJob(
  id: string,
  mode: "sync" | "async" = "async"
): Promise<CronJobRunResult> {
  const client = getGatewayClient();
  return client.request<CronJobRunResult>("cron.run", { id, mode });
}
