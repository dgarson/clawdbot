/**
 * Worktree API functions for interacting with agent workspaces via the gateway.
 *
 * These functions provide a typed interface for:
 * - Listing files and directories in an agent's workspace
 * - Reading file contents
 * - Writing files
 * - File operations (move, delete, mkdir)
 *
 * NOTE: These gateway RPC methods need to be implemented on the backend.
 * Currently, the gateway does not have worktree.* methods registered.
 */

import { getGatewayClient } from "./gateway-client";

// Worktree types

export interface WorktreeEntry {
  path: string; // relative path within workspace (e.g., "README.md" or "src/index.ts")
  name: string; // filename or directory name
  kind: "file" | "dir";
  sizeBytes?: number;
  modifiedAt?: string; // ISO8601 timestamp
}

export interface WorktreeListParams {
  agentId: string;
  path?: string; // directory path to list (default: "/")
}

export interface WorktreeListResult {
  path: string;
  entries: WorktreeEntry[];
}

export interface WorktreeReadParams {
  agentId: string;
  path: string; // file path to read
}

export interface WorktreeReadResult {
  path: string;
  content: string;
}

export interface WorktreeWriteParams {
  agentId: string;
  path: string;
  content: string;
}

export interface WorktreeWriteResult {
  path: string;
  modifiedAt?: string;
}

export interface WorktreeMoveParams {
  agentId: string;
  fromPath: string;
  toPath: string;
}

export interface WorktreeDeleteParams {
  agentId: string;
  path: string;
}

export interface WorktreeMkdirParams {
  agentId: string;
  path: string;
}

// Worktree API functions

/**
 * List files and directories in an agent's workspace
 * Gateway RPC method: worktree.list
 */
export async function listWorktreeFiles(params: WorktreeListParams): Promise<WorktreeListResult> {
  const client = getGatewayClient();
  return client.request<WorktreeListResult>("worktree.list", {
    agentId: params.agentId,
    path: params.path || "/",
  });
}

/**
 * Read a file from an agent's workspace
 * Gateway RPC method: worktree.read
 */
export async function readWorktreeFile(params: WorktreeReadParams): Promise<WorktreeReadResult> {
  const client = getGatewayClient();
  return client.request<WorktreeReadResult>("worktree.read", {
    agentId: params.agentId,
    path: params.path,
  });
}

/**
 * Write a file to an agent's workspace
 * Gateway RPC method: worktree.write
 */
export async function writeWorktreeFile(params: WorktreeWriteParams): Promise<WorktreeWriteResult> {
  const client = getGatewayClient();
  return client.request<WorktreeWriteResult>("worktree.write", {
    agentId: params.agentId,
    path: params.path,
    content: params.content,
  });
}

/**
 * Move a file or directory in an agent's workspace
 * Gateway RPC method: worktree.move
 */
export async function moveWorktreeFile(params: WorktreeMoveParams): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request("worktree.move", {
    agentId: params.agentId,
    fromPath: params.fromPath,
    toPath: params.toPath,
  });
}

/**
 * Delete a file or directory in an agent's workspace
 * Gateway RPC method: worktree.delete
 */
export async function deleteWorktreeFile(params: WorktreeDeleteParams): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request("worktree.delete", {
    agentId: params.agentId,
    path: params.path,
  });
}

/**
 * Create a directory in an agent's workspace
 * Gateway RPC method: worktree.mkdir
 */
export async function createWorktreeDir(params: WorktreeMkdirParams): Promise<{ ok: boolean }> {
  const client = getGatewayClient();
  return client.request("worktree.mkdir", {
    agentId: params.agentId,
    path: params.path,
  });
}
