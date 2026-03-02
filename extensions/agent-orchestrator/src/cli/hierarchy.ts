/**
 * Hierarchy visualization CLI commands:
 *   orchestrator tree — ASCII tree of agent hierarchy
 */

import type { Command } from "commander";
import type { OpenClawPluginCliContext } from "../../../../src/plugins/types.js";
import type { OrchestratorSessionState } from "../types.js";
import { readAllSessions, resolveStateDir, truncate } from "./shared.js";

type TreeNode = {
  sessionKey: string;
  state: OrchestratorSessionState;
  children: TreeNode[];
};

type JsonTreeNode = {
  sessionKey: string;
  role: string;
  status: string;
  depth: number | undefined;
  taskDescription: string | undefined;
  children: JsonTreeNode[];
};

export function registerHierarchyCommands(parent: Command, ctx: OpenClawPluginCliContext): void {
  parent
    .command("tree")
    .description("Show the agent hierarchy as an ASCII tree.")
    .option("--json", "Output raw JSON tree structure.")
    .action((opts: { json?: boolean }) => {
      const stateDir = resolveStateDir(ctx);
      const sessions = readAllSessions(stateDir);

      const roots = buildTree(sessions);

      if (opts.json) {
        const jsonRoots = roots.map(toJsonTree);
        process.stdout.write(`${JSON.stringify(jsonRoots, null, 2)}\n`);
        return;
      }

      if (roots.length === 0) {
        process.stdout.write("No agent sessions found.\n");
        return;
      }

      for (const root of roots) {
        printTree(root, "", true);
      }
    });
}

/**
 * Build a forest of tree nodes from the flat session map.
 * Sessions whose parent is not found become roots (orphans).
 */
export function buildTree(sessions: Map<string, OrchestratorSessionState>): TreeNode[] {
  const nodes = new Map<string, TreeNode>();

  // Create all nodes
  for (const [key, state] of sessions) {
    nodes.set(key, { sessionKey: key, state, children: [] });
  }

  const roots: TreeNode[] = [];

  // Link children to parents
  for (const [, node] of nodes) {
    const parentKey = node.state.parentSessionKey;
    if (parentKey && nodes.has(parentKey)) {
      nodes.get(parentKey)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function printTree(node: TreeNode, prefix: string, isLast: boolean): void {
  const connector = prefix === "" ? "" : isLast ? "  └─ " : "  ├─ ";
  const role = node.state.role ?? "unknown";
  const status = node.state.status ?? "unknown";
  const task = node.state.taskDescription ? ` — "${truncate(node.state.taskDescription, 50)}"` : "";

  process.stdout.write(`${prefix}${connector}${role} (${node.sessionKey}) [${status}]${task}\n`);

  const childPrefix = prefix === "" ? "" : prefix + (isLast ? "     " : "  │  ");
  for (let i = 0; i < node.children.length; i++) {
    const isChildLast = i === node.children.length - 1;
    printTree(node.children[i]!, childPrefix, isChildLast);
  }
}

function toJsonTree(node: TreeNode): JsonTreeNode {
  return {
    sessionKey: node.sessionKey,
    role: node.state.role ?? "unknown",
    status: node.state.status ?? "unknown",
    depth: node.state.depth,
    taskDescription: node.state.taskDescription,
    children: node.children.map(toJsonTree),
  };
}
