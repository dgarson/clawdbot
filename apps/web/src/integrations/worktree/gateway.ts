"use client";

import type {
  WorktreeAdapter,
  WorktreeDeleteInput,
  WorktreeListResult,
  WorktreeMkdirInput,
  WorktreeMoveInput,
  WorktreeReadResult,
  WorktreeWriteInput,
  WorktreeWriteResult,
} from "./types";
import {
  listWorktreeFiles,
  readWorktreeFile,
  writeWorktreeFile,
  moveWorktreeFile,
  deleteWorktreeFile,
  createWorktreeDir,
} from "@/lib/api/worktree";

/**
 * Worktree adapter that uses the gateway WebSocket client.
 *
 * This is the preferred adapter for the web UI as it uses the same
 * connection as chat and other features.
 *
 * NOTE: Requires gateway backend to implement worktree.* RPC methods.
 */
export function createWorktreeGatewayAdapter(): WorktreeAdapter {
  return {
    list: async (agentId: string, path: string): Promise<WorktreeListResult> => {
      const result = await listWorktreeFiles({ agentId, path });
      return {
        path: result.path,
        entries: result.entries.map(entry => ({
          path: entry.path,
          name: entry.name,
          kind: entry.kind,
          sizeBytes: entry.sizeBytes,
          modifiedAt: entry.modifiedAt,
        })),
      };
    },

    readFile: async (agentId: string, path: string): Promise<WorktreeReadResult> => {
      const result = await readWorktreeFile({ agentId, path });
      return {
        path: result.path,
        content: result.content,
      };
    },

    writeFile: async (
      agentId: string,
      input: WorktreeWriteInput
    ): Promise<WorktreeWriteResult> => {
      const result = await writeWorktreeFile({
        agentId,
        path: input.path,
        content: input.content,
      });
      return {
        path: result.path,
        modifiedAt: result.modifiedAt,
      };
    },

    move: async (agentId: string, input: WorktreeMoveInput): Promise<void> => {
      await moveWorktreeFile({
        agentId,
        fromPath: input.fromPath,
        toPath: input.toPath,
      });
    },

    delete: async (agentId: string, input: WorktreeDeleteInput): Promise<void> => {
      await deleteWorktreeFile({
        agentId,
        path: input.path,
      });
    },

    mkdir: async (agentId: string, input: WorktreeMkdirInput): Promise<void> => {
      await createWorktreeDir({
        agentId,
        path: input.path,
      });
    },
  };
}
