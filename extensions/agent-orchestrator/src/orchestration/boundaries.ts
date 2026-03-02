import { ROLE_BLOCKED_TOOLS, ORCHESTRATION_ONLY_TOOLS, type AgentRole } from "../types.js";

export type BlockResult = { block: true; reason: string } | null;

export function shouldBlockTool(role: AgentRole | undefined, toolName: string): BlockResult {
  if (!role) return null;

  // Check role-specific blocked tools
  const blocked = ROLE_BLOCKED_TOOLS[role];
  if (blocked?.includes(toolName)) {
    return {
      block: true,
      reason: `[orchestrator] ${role} agents cannot use ${toolName}`,
    };
  }

  // Check orchestration-only tools
  if (ORCHESTRATION_ONLY_TOOLS.includes(toolName) && role !== "orchestrator" && role !== "lead") {
    return {
      block: true,
      reason: `[orchestrator] ${role} agents cannot use ${toolName} (orchestration-only)`,
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

  const normalizedPath = normalizePath(filePath);

  for (const scope of fileScope) {
    const normalizedScope = normalizePath(scope);
    // Exact match
    if (normalizedPath === normalizedScope) return null;
    // Directory scope: path starts with scope/
    if (normalizedScope.endsWith("/") && normalizedPath.startsWith(normalizedScope)) return null;
    // Directory scope without trailing slash
    if (!normalizedScope.endsWith("/") && normalizedPath.startsWith(normalizedScope + "/"))
      return null;
  }

  return {
    block: true,
    reason: `[orchestrator] file "${filePath}" is outside assigned scope [${fileScope.join(", ")}]`,
  };
}

function normalizePath(p: string): string {
  // Remove leading ./ and normalize double slashes
  return p.replace(/^\.\//, "").replace(/\/+/g, "/");
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
  // 1. Role-based blocking
  const roleBlock = shouldBlockTool(role, toolName);
  if (roleBlock) return roleBlock;

  // 2. File scope checking (only for file-modifying tools)
  const FILE_TOOLS = ["write_file", "edit_file"];
  if (FILE_TOOLS.includes(toolName) && fileScope && fileScope.length > 0) {
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
  if (toolName === "execute_command" && fileScope && fileScope.length > 0) {
    return {
      block: true,
      reason: `[orchestrator] execute_command is blocked when a file scope is set (scope: [${fileScope.join(", ")}]). Use write_file or edit_file within your assigned scope instead.`,
    };
  }

  return null;
}
