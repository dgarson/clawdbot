/**
 * Nodes, Devices, and Exec Approvals API functions.
 *
 * Maps to gateway RPC methods:
 *   - node.list
 *   - device.pair.list / approve / reject
 *   - device.token.rotate / revoke
 *   - exec.approvals.get / set
 */

import { getGatewayClient } from "./gateway-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A connected (or recently seen) node. */
export interface NodeEntry {
  nodeId: string;
  displayName?: string;
  platform?: string;
  version?: string;
  coreVersion?: string;
  deviceFamily?: string;
  modelIdentifier?: string;
  remoteIp?: string;
  caps: string[];
  commands: string[];
  paired: boolean;
  connected: boolean;
  connectedAtMs?: number;
}

export interface NodeListResult {
  nodes: NodeEntry[];
}

// -- Devices ----------------------------------------------------------------

export interface DeviceTokenSummary {
  role: string;
  scopes?: string[];
  createdAtMs?: number;
  rotatedAtMs?: number;
  revokedAtMs?: number;
  lastUsedAtMs?: number;
  active?: boolean;
}

export interface PairedDevice {
  deviceId: string;
  displayName?: string;
  roles?: string[];
  scopes?: string[];
  remoteIp?: string;
  tokens?: DeviceTokenSummary[];
  createdAtMs?: number;
  approvedAtMs?: number;
}

export interface PendingDevice {
  requestId: string;
  deviceId: string;
  displayName?: string;
  role?: string;
  remoteIp?: string;
  isRepair?: boolean;
  ts?: number;
}

export interface DevicePairingList {
  pending: PendingDevice[];
  paired: PairedDevice[];
}

// -- Exec Approvals ---------------------------------------------------------

export interface ExecApprovalsAllowlistEntry {
  id?: string;
  pattern: string;
  lastUsedAt?: number;
  lastUsedCommand?: string;
  lastResolvedPath?: string;
}

export interface ExecApprovalsDefaults {
  security?: string;
  ask?: string;
  askFallback?: string;
  autoAllowSkills?: boolean;
}

export interface ExecApprovalsAgent extends ExecApprovalsDefaults {
  allowlist?: ExecApprovalsAllowlistEntry[];
}

export interface ExecApprovalsFile {
  version?: number;
  socket?: { path?: string; token?: string };
  defaults?: ExecApprovalsDefaults;
  agents?: Record<string, ExecApprovalsAgent>;
}

export interface ExecApprovalsSnapshot {
  path: string;
  exists: boolean;
  hash: string;
  file: ExecApprovalsFile;
}

// -- Node Bindings (from config) -------------------------------------------

export interface NodeBindings {
  defaultBinding: string | null;
  agentBindings: Record<string, string | null>;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

export async function listNodes(): Promise<NodeListResult> {
  const client = getGatewayClient();
  return client.request<NodeListResult>("node.list", {});
}

export async function listDevices(): Promise<DevicePairingList> {
  const client = getGatewayClient();
  return client.request<DevicePairingList>("device.pair.list", {});
}

export async function approveDevice(requestId: string): Promise<void> {
  const client = getGatewayClient();
  await client.request("device.pair.approve", { requestId });
}

export async function rejectDevice(requestId: string): Promise<void> {
  const client = getGatewayClient();
  await client.request("device.pair.reject", { requestId });
}

export async function rotateDeviceToken(
  deviceId: string,
  role: string,
  scopes?: string[],
): Promise<void> {
  const client = getGatewayClient();
  await client.request("device.token.rotate", { deviceId, role, scopes });
}

export async function revokeDeviceToken(
  deviceId: string,
  role: string,
): Promise<void> {
  const client = getGatewayClient();
  await client.request("device.token.revoke", { deviceId, role });
}

export async function getExecApprovals(
  target: "gateway" | "node" = "gateway",
  nodeId?: string,
): Promise<ExecApprovalsSnapshot> {
  const client = getGatewayClient();
  if (target === "node" && nodeId) {
    return client.request<ExecApprovalsSnapshot>("exec.approvals.node.get", {
      nodeId,
    });
  }
  return client.request<ExecApprovalsSnapshot>("exec.approvals.get", {});
}

export async function setExecApprovals(
  file: ExecApprovalsFile,
  hash: string,
  target: "gateway" | "node" = "gateway",
  nodeId?: string,
): Promise<{ ok: boolean; hash: string }> {
  const client = getGatewayClient();
  if (target === "node" && nodeId) {
    return client.request("exec.approvals.node.set", {
      nodeId,
      file,
      hash,
    });
  }
  return client.request("exec.approvals.set", { file, hash });
}
