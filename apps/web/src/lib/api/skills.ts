/**
 * Skills API.
 *
 * Provides access to the gateway's skill management functionality.
 */

import { getGatewayClient } from "./gateway-client";

export interface Skill {
  name: string;
  displayName: string;
  description?: string;
  version: string;
  enabled: boolean;
  installed: boolean;
  builtIn: boolean;
  source?: string;
  config?: Record<string, unknown>;
  updatedAt?: string;
}

export interface SkillsStatusReport {
  skills: Skill[];
  total: number;
  enabled: number;
  disabled: number;
  builtIn: number;
  custom: number;
}

export interface SkillUpdateParams {
  name: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface SkillInstallParams {
  source: string; // URL or path to skill package
  name?: string; // Optional name override
  config?: Record<string, unknown>;
}

export interface SkillInstallResult {
  skill: Skill;
  installed: boolean;
  message?: string;
}

/**
 * Get the status of all skills
 */
export async function getSkillsStatus(): Promise<SkillsStatusReport> {
  const client = getGatewayClient();
  return client.request<SkillsStatusReport>("skills.status");
}

/**
 * Get a specific skill by name
 */
export async function getSkill(name: string): Promise<Skill> {
  const client = getGatewayClient();
  return client.request<Skill>("skills.get", { name });
}

/**
 * Update a skill's configuration or enabled state
 */
export async function updateSkill(params: SkillUpdateParams): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("skills.update", params);
}

/**
 * Enable a skill
 */
export async function enableSkill(name: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("skills.enable", { name });
}

/**
 * Disable a skill
 */
export async function disableSkill(name: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("skills.disable", { name });
}

/**
 * Install a new skill
 * Note: This operation can take up to 120 seconds for remote skills
 */
export async function installSkill(params: SkillInstallParams): Promise<SkillInstallResult> {
  const client = getGatewayClient();
  return client.request<SkillInstallResult>("skills.install", params, { timeout: 120000 });
}

/**
 * Uninstall a skill (only works on custom/installed skills, not built-in)
 */
export async function uninstallSkill(name: string): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean }>("skills.uninstall", { name });
}

/**
 * Reload all skills (useful after manual file changes)
 */
export async function reloadSkills(): Promise<{ ok: boolean; count: number }> {
  const client = getGatewayClient();
  return client.request<{ ok: boolean; count: number }>("skills.reload");
}
