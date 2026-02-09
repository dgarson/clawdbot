"use client";

import type {
  WorktreeAdapter,
  WorktreeAdapterContext,
  WorktreeEntry,
  WorktreeListOptions,
  WorktreeListResult,
} from "./types";

type TreeNode =
  | { kind: "dir"; path: string; children: TreeNode[] }
  | { kind: "file"; path: string; content: string };

function splitPath(path: string): string[] {
  return path
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parentPath(path: string): string {
  if (path === "/" || path === "") {return "/";}
  const parts = splitPath(path);
  if (parts.length <= 1) {return "/";}
  return `/${parts.slice(0, -1).join("/")}`;
}

function nameOf(path: string): string {
  if (path === "/" || path === "") {return "/";}
  const parts = splitPath(path);
  return parts[parts.length - 1] ?? "/";
}

function getDir(tree: TreeNode, path: string): Extract<TreeNode, { kind: "dir" }> | null {
  if (tree.kind !== "dir") {return null;}
  const parts = splitPath(path);
  if (parts.length === 0) {return tree;}

  let current: Extract<TreeNode, { kind: "dir" }> = tree;
  for (const part of parts) {
    const next = current.children.find((c) => c.kind === "dir" && nameOf(c.path) === part);
    if (!next || next.kind !== "dir") {return null;}
    current = next;
  }
  return current;
}

function sleep(ms: number, ctx: WorktreeAdapterContext): Promise<void> {
  return new Promise((resolve, reject) => {
    const id = window.setTimeout(resolve, ms);
    ctx.signal.addEventListener("abort", () => {
      window.clearTimeout(id);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
}

const demoTree: TreeNode = {
  kind: "dir",
  path: "/",
  children: [
    {
      kind: "dir",
      path: "/sessions",
      children: [
        {
          kind: "dir",
          path: "/sessions/session-123",
          children: [
            { kind: "file", path: "/sessions/session-123/README.md", content: "# Session 123\n\nNotes...\n" },
            { kind: "file", path: "/sessions/session-123/plan.json", content: "{ \"step\": \"prototype\" }\n" },
          ],
        },
      ],
    },
    {
      kind: "dir",
      path: "/src",
      children: [
        { kind: "file", path: "/src/main.ts", content: "console.log('hello');\n" },
        { kind: "file", path: "/src/agent.ts", content: "export const agent = { id: 'a1' };\n" },
      ],
    },
    {
      kind: "dir",
      path: "/logs",
      children: [{ kind: "file", path: "/logs/latest.log", content: "[info] boot\n" }],
    },
  ],
};

export function createMockWorktreeAdapter(tree: TreeNode = demoTree): WorktreeAdapter {
  return {
    list: async (
      _agentId: string,
      path: string,
      ctx: WorktreeAdapterContext,
      _options?: WorktreeListOptions
    ): Promise<WorktreeListResult> => {
      await sleep(120, ctx);
      const dir = getDir(tree, path);
      if (!dir) {
        return { path, entries: [] };
      }

      const entries: WorktreeEntry[] = dir.children.map((child) => ({
        path: child.path,
        name: nameOf(child.path),
        kind: child.kind,
      }));

      entries.sort((a, b) => {
        if (a.kind !== b.kind) {return a.kind === "dir" ? -1 : 1;}
        return a.name.localeCompare(b.name);
      });

      return { path: dir.path, entries };
    },

    readFile: async (_agentId: string, path: string, ctx: WorktreeAdapterContext) => {
      await sleep(120, ctx);
      const dir = getDir(tree, parentPath(path));
      const file = dir?.children.find((c) => c.kind === "file" && c.path === path);
      if (!file || file.kind !== "file") {throw new Error("File not found");}
      return { path, content: file.content };
    },
  };
}
