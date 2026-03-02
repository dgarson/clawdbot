import path from "node:path";
import { normalizeToolName } from "../../../../src/agents/tool-policy.js";
import { ORCHESTRATION_ONLY_TOOLS, ROLE_BLOCKED_TOOLS, type AgentRole } from "../types.js";

export type BlockResult = { block: true; reason: string } | null;

const ORCHESTRATOR_TOOL_ALIASES: Record<string, string> = {
  write_file: "write",
  edit_file: "edit",
  execute_command: "exec",
  read_file: "read",
};

export function normalizeOrchestratorToolName(toolName: string): string {
  const normalized = normalizeToolName(toolName);
  return ORCHESTRATOR_TOOL_ALIASES[normalized] ?? normalized;
}

export function shouldBlockTool(role: AgentRole | undefined, toolName: string): BlockResult {
  if (!role) return null;
  const normalizedToolName = normalizeOrchestratorToolName(toolName);

  // Check role-specific blocked tools
  const blocked = ROLE_BLOCKED_TOOLS[role];
  if (blocked?.includes(normalizedToolName)) {
    return {
      block: true,
      reason: `[orchestrator] ${role} agents cannot use ${normalizedToolName}`,
    };
  }

  // Check orchestration-only tools
  if (
    ORCHESTRATION_ONLY_TOOLS.includes(normalizedToolName) &&
    role !== "orchestrator" &&
    role !== "lead"
  ) {
    return {
      block: true,
      reason: `[orchestrator] ${role} agents cannot use ${normalizedToolName} (orchestration-only)`,
    };
  }

  return null;
}

/**
 * Check if a file path is within the agent's assigned file scope.
 * Only applies to builder role with fileScope set.
 * Returns null if allowed, BlockResult if blocked.
 */
export function checkFileScope(
  fileScope: string[] | undefined,
  filePath: string | undefined,
): BlockResult {
  // No scope means unrestricted
  if (!fileScope || fileScope.length === 0) return null;
  // No path to check
  if (!filePath) return null;

  const normalizedPath = normalizeRelativePath(filePath);
  if (normalizedPath === null) {
    return {
      block: true,
      reason: `[orchestrator] file path "${filePath}" must be a relative path within the assigned scope`,
    };
  }

  for (const scope of fileScope) {
    const normalizedScope = normalizeRelativePath(scope);
    if (normalizedScope === null) continue;
    if (normalizedScope === "") return null;

    // Exact match
    if (normalizedPath === normalizedScope) return null;
    // Directory scope: path starts with scope/
    if (normalizedPath.startsWith(normalizedScope + "/")) return null;
  }

  return {
    block: true,
    reason: `[orchestrator] file "${filePath}" is outside assigned scope [${fileScope.join(", ")}]`,
  };
}

function normalizeRelativePath(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Normalize to POSIX separators first so prefix checks are consistent.
  const posixLike = trimmed.replace(/\\/g, "/");

  // Absolute paths are never allowed for scoped checks.
  if (path.posix.isAbsolute(posixLike) || /^[A-Za-z]:\//.test(posixLike)) {
    return null;
  }

  const normalized = path.posix.normalize(posixLike.replace(/^\.\//, ""));
  if (normalized === ".." || normalized.startsWith("../")) {
    return null;
  }
  if (normalized === ".") {
    return "";
  }
  return normalized.replace(/\/+$/, "");
}

/**
 * Full tool access check: role boundaries + file scope.
 * Used by the before_tool_call hook.
 */
export function checkToolAccess(
  role: AgentRole | undefined,
  toolName: string,
  fileScope: string[] | undefined,
  params: Record<string, unknown>,
): BlockResult {
  const normalizedToolName = normalizeOrchestratorToolName(toolName);

  // 1. Role-based blocking
  const roleBlock = shouldBlockTool(role, normalizedToolName);
  if (roleBlock) return roleBlock;

  // 2. File scope checking (only for file-modifying tools)
  const FILE_TOOLS = new Set(["write", "edit"]);
  if (FILE_TOOLS.has(normalizedToolName) && fileScope && fileScope.length > 0) {
    const filePath =
      typeof params.file_path === "string"
        ? params.file_path
        : typeof params.path === "string"
          ? params.path
          : undefined;
    const scopeBlock = checkFileScope(fileScope, filePath);
    if (scopeBlock) return scopeBlock;
  }

  // 3. Block execute_command for scoped builders.
  // Shell commands can write files outside the assigned scope (e.g. redirection, mv, cp).
  // We cannot inspect the command string for path violations, so block it entirely when
  // a fileScope is in effect.
  if (normalizedToolName === "exec" && fileScope && fileScope.length > 0) {
    return {
      block: true,
      reason: `[orchestrator] exec is blocked when a file scope is set (scope: [${fileScope.join(", ")}]). Use write/edit within your assigned scope instead.`,
    };
  }

  return null;
}
