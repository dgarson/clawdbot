/**
 * Cron Jobs API.
 *
 * Provides access to the gateway's cron job management functionality.
 */

import { getGatewayClient } from "./gateway-client";

export type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string };

export type CronPayload =
  | { kind: "systemEvent"; text: string }
  | {
      kind: "agentTurn";
      message: string;
      model?: string;
      thinking?: string;
      timeoutSeconds?: number;
    };

export interface CronJobState {
  nextRunAtMs?: number;
  runningAtMs?: number;
  lastRunAtMs?: number;
  lastStatus?: "ok" | "error" | "skipped";
  lastError?: string;
  lastDurationMs?: number;
}

export interface CronJob {
  id: string;
  agentId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  deleteAfterRun?: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: CronSchedule;
  sessionTarget: "main" | "isolated";
  wakeMode: "next-heartbeat" | "now";
  payload: CronPayload;
  delivery?: {
    mode: "none" | "announce";
    channel?: string;
    to?: string;
    bestEffort?: boolean;
  };
  state: CronJobState;
}

export interface CronJobCreateParams {
  name: string;
  agentId?: string | null;
  description?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  schedule: CronSchedule;
  sessionTarget: "main" | "isolated";
  wakeMode: "next-heartbeat" | "now";
  payload: CronPayload;
  delivery?: {
    mode: "none" | "announce";
    channel?: string;
    to?: string;
    bestEffort?: boolean;
  };
}

export interface CronJobPatch {
  name?: string;
  agentId?: string | null;
  description?: string;
  enabled?: boolean;
  deleteAfterRun?: boolean;
  schedule?: CronSchedule;
  sessionTarget?: "main" | "isolated";
  wakeMode?: "next-heartbeat" | "now";
  payload?: CronPayload;
  delivery?: {
    mode?: "none" | "announce";
    channel?: string;
    to?: string;
    bestEffort?: boolean;
  };
}

export interface CronJobUpdateParams {
  id: string;
  patch: CronJobPatch;
}

export interface CronJobListResult {
  jobs: CronJob[];
  total: number;
}

export interface CronJobRunResult {
  ok: boolean;
  ran: boolean;
  reason?: string;
}

export type CronRunLogStatus = "ok" | "error" | "skipped";

export interface CronRunTimelineEntry {
  jobId: string;
  startAtMs: number;
  finishAtMs?: number;
  status?: CronRunLogStatus;
  summary?: string;
}

export interface CronRunLogResult {
  entries: CronRunTimelineEntry[];
}

export interface CronRunEntry {
  ts: number;
  jobId: string;
  action: "finished";
  status?: CronRunLogStatus;
  error?: string;
  summary?: string;
  runAtMs?: number;
  durationMs?: number;
  nextRunAtMs?: number;
}

export interface CronRunsResult {
  entries: CronRunEntry[];
}

function resolveCronScheduleLabel(schedule: CronSchedule): string {
  switch (schedule.kind) {
    case "cron":
      return schedule.expr;
    case "every": {
      const minutes = schedule.everyMs / 60000;
      if (Number.isInteger(minutes)) {
        return `Every ${minutes} minutes`;
      }
      const seconds = schedule.everyMs / 1000;
      if (Number.isInteger(seconds)) {
        return `Every ${seconds} seconds`;
      }
      return `Every ${schedule.everyMs} ms`;
    }
    case "at":
      return `At ${schedule.at}`;
  }
}

export function formatCronSchedule(schedule: CronSchedule): string {
  return resolveCronScheduleLabel(schedule);
}

export function getCronPayloadMessage(payload: CronPayload): string {
  if (payload.kind === "systemEvent") {
    return payload.text;
  }
  return payload.message;
}

function normalizeListParams(params?: { enabled?: boolean; agentId?: string }) {
  return {
    enabled: params?.enabled,
    agentId: params?.agentId?.trim() || undefined,
  };
}

function filterJobs(jobs: CronJob[], params?: { enabled?: boolean; agentId?: string }) {
  const normalized = normalizeListParams(params);
  return jobs.filter((job) => {
    if (typeof normalized.enabled === "boolean" && job.enabled !== normalized.enabled) {
      return false;
    }
    if (normalized.agentId && job.agentId !== normalized.agentId) {
      return false;
    }
    return true;
  });
}

/**
 * List all cron jobs
 */
export async function listCronJobs(params?: {
  enabled?: boolean;
  agentId?: string;
}): Promise<CronJobListResult> {
  const client = getGatewayClient();
  const result = await client.request<{ jobs: CronJob[] }>("cron.list", {
    includeDisabled: true,
  });
  const jobs = filterJobs(result.jobs ?? [], params);
  return {
    jobs,
    total: jobs.length,
  };
}

/**
 * Get a specific cron job
 */
export async function getCronJob(id: string): Promise<CronJob> {
  const { jobs } = await listCronJobs();
  const job = jobs.find((entry) => entry.id === id);
  if (!job) {
    throw new Error(`Cron job not found: ${id}`);
  }
  return job;
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
 * Run a cron job immediately
 * @param id - Job ID
 * @param mode - "due" runs only if due, "force" runs immediately
 */
export async function runCronJob(
  id: string,
  mode: "due" | "force" = "due"
): Promise<CronJobRunResult> {
  const client = getGatewayClient();
  return client.request<CronJobRunResult>("cron.run", { id, mode });
}

export async function getCronRuns(params: {
  id: string;
  limit?: number;
}): Promise<CronRunsResult> {
  const client = getGatewayClient();
  return client.request<CronRunsResult>("cron.runs", params);
}

export async function getCronRunLog(params: {
  sessionKey: string;
  limit?: number;
}): Promise<CronRunLogResult> {
  const client = getGatewayClient();
  return client.request<CronRunLogResult>("cron.runLog", params);
}
