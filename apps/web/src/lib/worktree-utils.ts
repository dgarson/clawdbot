"use client";

import type { WorktreeEntry } from "@/integrations/worktree";

export type WorktreeTreeNode = {
  name: string;
  path: string;
  type: "file" | "folder";
  sizeBytes?: number;
  modifiedAt?: string;
  children?: WorktreeTreeNode[];
};

type WorktreeErrorInfo = {
  title: string;
  message: string;
  code?: string;
};

type WorktreeErrorShape = {
  code?: string;
  message?: string;
};

function normalizePath(path: string): string {
  if (!path) {return "/";}
  return path.startsWith("/") ? path : `/${path}`;
}

function parentPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") {return "/";}
  const parts = normalized.split("/").filter(Boolean);
  if (parts.length <= 1) {return "/";}
  return `/${parts.slice(0, -1).join("/")}`;
}

function ensureNode(
  nodesByPath: Map<string, WorktreeTreeNode>,
  path: string,
  name: string
): WorktreeTreeNode {
  const normalized = normalizePath(path);
  const existing = nodesByPath.get(normalized);
  if (existing) {return existing;}
  const node: WorktreeTreeNode = {
    name,
    path: normalized,
    type: "folder",
    children: [],
  };
  nodesByPath.set(normalized, node);
  return node;
}

function nameFromPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === "/") {return "/";}
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "/";
}

function sortChildren(node: WorktreeTreeNode) {
  if (!node.children) {return;}
  node.children.sort((a, b) => {
    if (a.type !== b.type) {return a.type === "folder" ? -1 : 1;}
    return a.name.localeCompare(b.name);
  });
  for (const child of node.children) {
    sortChildren(child);
  }
}

export function buildWorktreeTree(entries: WorktreeEntry[]): WorktreeTreeNode[] {
  const root: WorktreeTreeNode = {
    name: "/",
    path: "/",
    type: "folder",
    children: [],
  };
  const nodesByPath = new Map<string, WorktreeTreeNode>([["/", root]]);

  for (const entry of entries) {
    const entryPath = normalizePath(entry.path);
    const entryName = entry.name;
    const entryParentPath = parentPath(entryPath);
    const parent = ensureNode(
      nodesByPath,
      entryParentPath,
      nameFromPath(entryParentPath)
    );
    const node: WorktreeTreeNode = {
      name: entryName,
      path: entryPath,
      type: entry.kind === "dir" ? "folder" : "file",
      sizeBytes: entry.sizeBytes,
      modifiedAt: entry.modifiedAt,
      children: entry.kind === "dir" ? [] : undefined,
    };
    nodesByPath.set(entryPath, node);
    parent.children ??= [];
    if (!parent.children.find((child) => child.path === entryPath)) {
      parent.children.push(node);
    }
  }

  sortChildren(root);
  return root.children ?? [];
}

export function mapWorktreeError(error: unknown): WorktreeErrorInfo {
  const err = error as WorktreeErrorShape;
  const code = err?.code;
  const message = err?.message ?? (error instanceof Error ? error.message : String(error));

  if (message.includes("Not connected to gateway")) {
    return {
      title: "Gateway disconnected",
      message: "Connect to the gateway to browse workspace files.",
    };
  }

  if (message.includes("Request timeout")) {
    return {
      title: "Gateway timeout",
      message: "The gateway took too long to respond. Try again.",
    };
  }

  switch (code) {
    case "PERMISSION_DENIED":
      return {
        title: "Permission denied",
        message: "You do not have access to this file. Check gateway permissions.",
        code,
      };
    case "FILE_NOT_FOUND":
    case "SOURCE_NOT_FOUND":
      return {
        title: "File not found",
        message: "The file no longer exists in the workspace.",
        code,
      };
    case "NOT_A_FILE":
      return {
        title: "Not a file",
        message: "The selected path points to a folder, not a file.",
        code,
      };
    case "NOT_A_DIRECTORY":
      return {
        title: "Not a directory",
        message: "The selected path is not a folder.",
        code,
      };
    case "FILE_TOO_LARGE":
      return {
        title: "File too large",
        message: "The file is too large to preview. Download it instead.",
        code,
      };
    case "INVALID_ENCODING":
      return {
        title: "Unsupported encoding",
        message: "The file contains invalid UTF-8 data. Download to inspect.",
        code,
      };
    case "WORKSPACE_NOT_FOUND":
    case "AGENT_NOT_FOUND":
      return {
        title: "Workspace unavailable",
        message: "The agent workspace could not be located.",
        code,
      };
    case "PATH_OUTSIDE_WORKSPACE":
      return {
        title: "Invalid path",
        message: "The requested path is outside the agent workspace.",
        code,
      };
    case "NOT_LINKED":
    case "NOT_PAIRED":
      return {
        title: "Gateway not paired",
        message: "Pair the gateway before accessing workspace files.",
        code,
      };
    case "UNAVAILABLE":
      return {
        title: "Gateway unavailable",
        message: "The gateway is unavailable. Try again shortly.",
        code,
      };
    default:
      return {
        title: "Unable to load file",
        message: message || "Something went wrong while loading the file.",
        code,
      };
  }
}
