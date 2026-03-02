import fs from "node:fs";
import path from "node:path";
import type { AgentRole } from "../types.js";
import type { SkillRoleInstructions } from "./priming.js";

/** Role section header markers in the skill file. */
const ROLE_HEADERS: Record<string, AgentRole> = {
  "## orchestrator role": "orchestrator",
  "## lead role": "lead",
  "## scout role": "scout",
  "## builder role": "builder",
  "## reviewer role": "reviewer",
};

/**
 * Parse the orchestrate skill file and extract role-specific sections.
 * Each section starts at its `## <Role> Role` header and ends at the next `## ` header.
 */
export function parseSkillRoleInstructions(content: string): SkillRoleInstructions {
  const lines = content.split("\n");
  const result: SkillRoleInstructions = {};
  let currentRole: AgentRole | undefined;
  let currentLines: string[] = [];

  function flush() {
    if (currentRole && currentLines.length > 0) {
      result[currentRole] = currentLines.join("\n").trim();
    }
    currentRole = undefined;
    currentLines = [];
  }

  for (const line of lines) {
    const lower = line.toLowerCase().trim();

    // Check if this line starts a new role section
    const matchedRole = ROLE_HEADERS[lower];
    if (matchedRole) {
      flush();
      currentRole = matchedRole;
      continue;
    }

    // Check if this line starts a different top-level section (ends current role)
    if (currentRole && /^## /.test(line)) {
      flush();
      continue;
    }

    if (currentRole) {
      currentLines.push(line);
    }
  }
  flush();

  return result;
}

/**
 * Try to load the orchestrate skill file from the workspace's .agents/skills directory.
 * Returns parsed role instructions, or undefined if the skill file isn't found.
 */
export function loadOrchestrateSkill(workspaceDir: string): SkillRoleInstructions | undefined {
  const skillPath = path.join(workspaceDir, ".agents", "skills", "orchestrate", "SKILL.md");
  try {
    const content = fs.readFileSync(skillPath, "utf-8");
    const parsed = parseSkillRoleInstructions(content);
    return Object.keys(parsed).length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}
