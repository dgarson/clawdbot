/**
 * Agent files API.
 *
 * Provides access to core agent workspace markdown files via gateway RPC.
 */

import { getGatewayClient } from "./gateway-client";

export interface AgentFileEntry {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
}

export interface AgentsFilesListResult {
  agentId: string;
  workspace: string;
  files: AgentFileEntry[];
}

export interface AgentsFilesGetResult {
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
}

export interface AgentsFilesSetResult {
  ok: true;
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
}

export async function listAgentFiles(agentId: string): Promise<AgentsFilesListResult> {
  const client = getGatewayClient();
  return client.request<AgentsFilesListResult>("agents.files.list", { agentId });
}

export async function getAgentFile(agentId: string, name: string): Promise<AgentsFilesGetResult> {
  const client = getGatewayClient();
  return client.request<AgentsFilesGetResult>("agents.files.get", { agentId, name });
}

export async function setAgentFile(
  agentId: string,
  name: string,
  content: string
): Promise<AgentsFilesSetResult> {
  const client = getGatewayClient();
  return client.request<AgentsFilesSetResult>("agents.files.set", { agentId, name, content });
}
