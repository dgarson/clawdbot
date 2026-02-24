
import type {
  WorktreeAdapter,
  WorktreeAdapterContext,
  WorktreeDeleteInput,
  WorktreeListResult,
  WorktreeMkdirInput,
  WorktreeMoveInput,
  WorktreeReadResult,
  WorktreeWriteInput,
  WorktreeWriteResult,
} from "./types";

export type WorktreeHttpEndpoints = {
  list: (agentId: string, path: string) => string;
  read: (agentId: string, path: string) => string;
  write: (agentId: string) => string;
  move: (agentId: string) => string;
  delete: (agentId: string) => string;
  mkdir: (agentId: string) => string;
};

export function createDefaultWorktreeEndpoints(): WorktreeHttpEndpoints {
  return {
    list: (agentId, path) =>
      `/api/agents/${encodeURIComponent(agentId)}/worktree/list?path=${encodeURIComponent(path)}`,
    read: (agentId, path) =>
      `/api/agents/${encodeURIComponent(agentId)}/worktree/read?path=${encodeURIComponent(path)}`,
    write: (agentId) => `/api/agents/${encodeURIComponent(agentId)}/worktree/write`,
    move: (agentId) => `/api/agents/${encodeURIComponent(agentId)}/worktree/move`,
    delete: (agentId) => `/api/agents/${encodeURIComponent(agentId)}/worktree/delete`,
    mkdir: (agentId) => `/api/agents/${encodeURIComponent(agentId)}/worktree/mkdir`,
  };
}

async function fetchJson<T>(url: string, init: RequestInit, ctx: WorktreeAdapterContext): Promise<T> {
  const res = await fetch(url, { ...init, signal: ctx.signal });
  if (!res.ok) {throw new Error(`Worktree API failed: ${res.status} ${res.statusText}`);}
  return (await res.json()) as T;
}

export function createWorktreeHttpAdapter(endpoints = createDefaultWorktreeEndpoints()): WorktreeAdapter {
  return {
    list: async (agentId: string, path: string, ctx: WorktreeAdapterContext): Promise<WorktreeListResult> => {
      return fetchJson<WorktreeListResult>(endpoints.list(agentId, path), { method: "GET" }, ctx);
    },

    readFile: async (agentId: string, path: string, ctx: WorktreeAdapterContext): Promise<WorktreeReadResult> => {
      return fetchJson<WorktreeReadResult>(endpoints.read(agentId, path), { method: "GET" }, ctx);
    },

    writeFile: async (
      agentId: string,
      input: WorktreeWriteInput,
      ctx: WorktreeAdapterContext
    ): Promise<WorktreeWriteResult> => {
      return fetchJson<WorktreeWriteResult>(
        endpoints.write(agentId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        ctx
      );
    },

    move: async (agentId: string, input: WorktreeMoveInput, ctx: WorktreeAdapterContext): Promise<void> => {
      await fetchJson<{ ok: true }>(
        endpoints.move(agentId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        ctx
      );
    },

    delete: async (agentId: string, input: WorktreeDeleteInput, ctx: WorktreeAdapterContext): Promise<void> => {
      await fetchJson<{ ok: true }>(
        endpoints.delete(agentId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        ctx
      );
    },

    mkdir: async (agentId: string, input: WorktreeMkdirInput, ctx: WorktreeAdapterContext): Promise<void> => {
      await fetchJson<{ ok: true }>(
        endpoints.mkdir(agentId),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        },
        ctx
      );
    },
  };
}
