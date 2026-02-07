import { Type, type Static } from "@sinclair/typebox";

// Common types
export const WorktreeFileKind = Type.Union([Type.Literal("file"), Type.Literal("dir")]);

export const WorktreeFileEntry = Type.Object({
  path: Type.String({ description: "Relative path from workspace root" }),
  name: Type.String({ description: "Filename or directory name" }),
  kind: WorktreeFileKind,
  sizeBytes: Type.Optional(Type.Number({ description: "File size (omitted for directories)" })),
  modifiedAt: Type.Optional(Type.String({ description: "ISO8601 timestamp" })),
  permissions: Type.Optional(Type.String({ description: "Unix permissions (e.g., 'rw-r--r--')" })),
});

export const WorktreeEncoding = Type.Union([Type.Literal("utf8"), Type.Literal("base64")]);

// worktree.list
export const WorktreeListParams = Type.Object({
  agentId: Type.String({ description: "Agent identifier" }),
  path: Type.Optional(Type.String({ description: "Directory path (default: '/')" })),
  recursive: Type.Optional(Type.Boolean({ description: "Recursive listing (default: false)" })),
  includeHidden: Type.Optional(Type.Boolean({ description: "Include dotfiles (default: false)" })),
});

export const WorktreeListResult = Type.Object({
  path: Type.String({ description: "Normalized path that was listed" }),
  entries: Type.Array(WorktreeFileEntry),
});

// worktree.read
export const WorktreeReadParams = Type.Object({
  agentId: Type.String({ description: "Agent identifier" }),
  path: Type.String({ description: "File path relative to workspace" }),
  encoding: Type.Optional(WorktreeEncoding),
  maxBytes: Type.Optional(Type.Number({ description: "Max file size to read (default: 10MB)" })),
  redact: Type.Optional(Type.Boolean({ description: "Apply secret redaction (default: true)" })),
});

export const WorktreeReadResult = Type.Object({
  path: Type.String({ description: "Normalized path that was read" }),
  content: Type.String({ description: "File contents (utf8 or base64)" }),
  encoding: WorktreeEncoding,
  sizeBytes: Type.Number({ description: "Actual file size" }),
  modifiedAt: Type.Optional(Type.String({ description: "ISO8601 timestamp" })),
  truncated: Type.Optional(
    Type.Boolean({ description: "True if file was truncated due to maxBytes" }),
  ),
  redacted: Type.Optional(Type.Boolean({ description: "True if redaction was applied" })),
});

// worktree.write
export const WorktreeWriteParams = Type.Object({
  agentId: Type.String({ description: "Agent identifier" }),
  path: Type.String({ description: "File path relative to workspace" }),
  content: Type.String({ description: "File contents" }),
  encoding: Type.Optional(WorktreeEncoding),
  createDirs: Type.Optional(
    Type.Boolean({ description: "Create parent directories (default: true)" }),
  ),
  overwrite: Type.Optional(
    Type.Boolean({ description: "Allow overwriting existing files (default: true)" }),
  ),
});

export const WorktreeWriteResult = Type.Object({
  path: Type.String({ description: "Normalized path that was written" }),
  sizeBytes: Type.Number({ description: "Bytes written" }),
  modifiedAt: Type.String({ description: "ISO8601 timestamp" }),
  created: Type.Boolean({ description: "True if file was created, false if overwritten" }),
});

// worktree.delete
export const WorktreeDeleteParams = Type.Object({
  agentId: Type.String({ description: "Agent identifier" }),
  path: Type.String({ description: "Path to delete" }),
  recursive: Type.Optional(
    Type.Boolean({ description: "Delete directories recursively (default: false)" }),
  ),
});

export const WorktreeDeleteResult = Type.Object({
  path: Type.String({ description: "Path that was deleted" }),
  kind: WorktreeFileKind,
  itemsDeleted: Type.Optional(
    Type.Number({ description: "Number of items deleted (for recursive dir deletes)" }),
  ),
});

// worktree.move
export const WorktreeMoveParams = Type.Object({
  agentId: Type.String({ description: "Agent identifier" }),
  fromPath: Type.String({ description: "Source path" }),
  toPath: Type.String({ description: "Destination path" }),
  overwrite: Type.Optional(
    Type.Boolean({ description: "Allow overwriting destination (default: false)" }),
  ),
});

export const WorktreeMoveResult = Type.Object({
  fromPath: Type.String({ description: "Normalized source path" }),
  toPath: Type.String({ description: "Normalized destination path" }),
  overwritten: Type.Boolean({ description: "True if destination was overwritten" }),
});

// worktree.mkdir
export const WorktreeMkdirParams = Type.Object({
  agentId: Type.String({ description: "Agent identifier" }),
  path: Type.String({ description: "Directory path to create" }),
  recursive: Type.Optional(
    Type.Boolean({ description: "Create parent directories (default: true)" }),
  ),
});

export const WorktreeMkdirResult = Type.Object({
  path: Type.String({ description: "Normalized path that was created" }),
  created: Type.Boolean({ description: "True if created, false if already existed" }),
});

// TypeScript types
export type WorktreeListParams = Static<typeof WorktreeListParams>;
export type WorktreeListResult = Static<typeof WorktreeListResult>;
export type WorktreeReadParams = Static<typeof WorktreeReadParams>;
export type WorktreeReadResult = Static<typeof WorktreeReadResult>;
export type WorktreeWriteParams = Static<typeof WorktreeWriteParams>;
export type WorktreeWriteResult = Static<typeof WorktreeWriteResult>;
export type WorktreeDeleteParams = Static<typeof WorktreeDeleteParams>;
export type WorktreeDeleteResult = Static<typeof WorktreeDeleteResult>;
export type WorktreeMoveParams = Static<typeof WorktreeMoveParams>;
export type WorktreeMoveResult = Static<typeof WorktreeMoveResult>;
export type WorktreeMkdirParams = Static<typeof WorktreeMkdirParams>;
export type WorktreeMkdirResult = Static<typeof WorktreeMkdirResult>;
export type WorktreeFileEntry = Static<typeof WorktreeFileEntry>;
