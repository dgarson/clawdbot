/**
 * Automations API.
 *
 * Provides access to the gateway's automations management functionality.
 */

import { getGatewayClient } from "./gateway-client";

export type AutomationStatus = "active" | "suspended" | "error";
export type AutomationType = "smart-sync-fork" | "custom-script" | "webhook";

export interface AutomationSchedule {
  type: "at" | "every" | "cron";
  atMs?: number;
  everyMs?: number;
  anchorMs?: number;
  expr?: string;
  tz?: string;
}

export interface Automation {
  id: string;
  name: string;
  description?: string;
  type: AutomationType;
  status: AutomationStatus;
  enabled: boolean;
  schedule: AutomationSchedule;
  nextRunAt?: number;
  lastRun?: {
    at: number;
    status: "success" | "failed" | "running";
    durationMs?: number;
    summary?: string;
  };
  config: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface AutomationRunMilestone {
  id: string;
  title: string;
  status: "completed" | "current" | "pending";
  timestamp?: string;
}

export interface AutomationArtifact {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string;
}

export interface AutomationConflict {
  type: string;
  description: string;
  resolution: string;
}

export interface AutomationRunRecord {
  id: string;
  automationId: string;
  automationName: string;
  startedAt: number;
  completedAt?: number;
  status: "success" | "failed" | "running" | "cancelled";
  summary?: string;
  error?: string;
  durationMs?: number;
  timeline: AutomationRunMilestone[];
  artifacts: AutomationArtifact[];
  conflicts: AutomationConflict[];
  aiModel?: {
    name: string;
    version: string;
    tokensUsed: number;
    cost: string;
  };
}

export interface AutomationsListResult {
  automations: Automation[];
}

export interface AutomationCreateParams {
  name: string;
  description?: string;
  type: AutomationType;
  schedule: AutomationSchedule;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface AutomationUpdateParams {
  id: string;
  enabled: boolean;
}

export interface AutomationDeleteResult {
  ok: boolean;
  deleted: boolean;
}

export interface AutomationRunResult {
  runId: string;
}

export interface AutomationCancelResult {
  ok: boolean;
  cancelled: boolean;
}

export interface AutomationHistoryResult {
  records: AutomationRunRecord[];
}

export interface AutomationArtifactDownloadResult {
  url: string;
  expiresAt?: number;
}

/**
 * List all automations
 */
export async function listAutomations(): Promise<AutomationsListResult> {
  const client = getGatewayClient();
  return client.request<AutomationsListResult>("automations.list", {});
}

/**
 * Create a new automation
 */
export async function createAutomation(params: AutomationCreateParams): Promise<Automation> {
  const client = getGatewayClient();
  return client.request<Automation>("automations.create", params);
}

/**
 * Update an automation (enable/disable)
 */
export async function updateAutomation(params: AutomationUpdateParams): Promise<Automation> {
  const client = getGatewayClient();
  return client.request<Automation>("automations.update", params);
}

/**
 * Delete an automation
 */
export async function deleteAutomation(id: string): Promise<AutomationDeleteResult> {
  const client = getGatewayClient();
  return client.request<AutomationDeleteResult>("automations.delete", { id });
}

/**
 * Run an automation immediately
 */
export async function runAutomation(id: string): Promise<AutomationRunResult> {
  const client = getGatewayClient();
  return client.request<AutomationRunResult>("automations.run", { id });
}

/**
 * Cancel a running automation
 */
export async function cancelAutomation(runId: string): Promise<AutomationCancelResult> {
  const client = getGatewayClient();
  return client.request<AutomationCancelResult>("automations.cancel", { id: runId });
}

/**
 * Load run history for an automation
 */
export async function getAutomationHistory(
  id: string,
  limit = 50
): Promise<AutomationHistoryResult> {
  const client = getGatewayClient();
  return client.request<AutomationHistoryResult>("automations.history", { id, limit });
}

/**
 * Request a signed download URL for an automation artifact.
 */
export async function downloadAutomationArtifact(
  artifactId: string
): Promise<AutomationArtifactDownloadResult> {
  const client = getGatewayClient();
  return client.request<AutomationArtifactDownloadResult>("automations.artifact.download", {
    artifactId,
  });
}
