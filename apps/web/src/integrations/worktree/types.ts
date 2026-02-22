export type WorktreeEntryKind = "file" | "dir";

export type WorktreeEntry = {
  path: string; // absolute-ish path within the agent worktree, e.g. "/" or "/src/index.ts"
  name: string;
  kind: WorktreeEntryKind;
  sizeBytes?: number;
  modifiedAt?: string; // ISO8601
};

export type WorktreeListResult = {
  path: string;
  entries: WorktreeEntry[];
};

export type WorktreeReadResult = {
  path: string;
  content: string;
};

export type WorktreeWriteInput = {
  path: string;
  content: string;
};

export type WorktreeWriteResult = {
  path: string;
  modifiedAt?: string;
};

export type WorktreeMoveInput = {
  fromPath: string;
  toPath: string;
};

export type WorktreeDeleteInput = {
  path: string;
};

export type WorktreeMkdirInput = {
  path: string;
};

export type WorktreeAdapterContext = {
  signal: AbortSignal;
};

export type WorktreeAdapter = {
  list: (agentId: string, path: string, ctx: WorktreeAdapterContext) => Promise<WorktreeListResult>;

  readFile?: (agentId: string, path: string, ctx: WorktreeAdapterContext) => Promise<WorktreeReadResult>;
  writeFile?: (agentId: string, input: WorktreeWriteInput, ctx: WorktreeAdapterContext) => Promise<WorktreeWriteResult>;
  move?: (agentId: string, input: WorktreeMoveInput, ctx: WorktreeAdapterContext) => Promise<void>;
  delete?: (agentId: string, input: WorktreeDeleteInput, ctx: WorktreeAdapterContext) => Promise<void>;
  mkdir?: (agentId: string, input: WorktreeMkdirInput, ctx: WorktreeAdapterContext) => Promise<void>;
};

