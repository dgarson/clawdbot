import fs from "node:fs";
import path from "node:path";
import type { AgentInstructions } from "../config/types.agents.js";

export type ResolvedAgentInstructions = {
  /** Merged instruction text ready for system prompt injection. */
  text: string;
  role?: string;
  constraints?: string[];
  outputFormat?: string;
};

/**
 * Resolve agent instructions from config, optionally loading a file.
 * Returns undefined if no meaningful instructions are configured.
 */
export function resolveAgentInstructions(
  instructions: AgentInstructions | undefined,
  agentDir: string | undefined,
): ResolvedAgentInstructions | undefined {
  if (!instructions) {
    return undefined;
  }

  const parts: string[] = [];

  // Load file-based instructions if specified.
  if (instructions.file && agentDir) {
    const filePath = path.resolve(agentDir, instructions.file);
    try {
      const content = fs.readFileSync(filePath, "utf-8").trim();
      if (content) {
        parts.push(content);
      }
    } catch {
      // File not found or unreadable — skip silently.
    }
  }

  // Append inline text instructions.
  if (instructions.text?.trim()) {
    parts.push(instructions.text.trim());
  }

  const hasContent = parts.length > 0;
  const hasRole = !!instructions.role?.trim();
  const hasConstraints = (instructions.constraints ?? []).filter((c) => c.trim()).length > 0;
  const hasOutputFormat = !!instructions.outputFormat?.trim();

  if (!hasContent && !hasRole && !hasConstraints && !hasOutputFormat) {
    return undefined;
  }

  return {
    text: parts.join("\n\n"),
    role: instructions.role?.trim() || undefined,
    constraints: (instructions.constraints ?? []).filter((c) => c.trim()),
    outputFormat: instructions.outputFormat?.trim() || undefined,
  };
}

/**
 * Build the instructions section for system prompt injection.
 */
export function buildAgentInstructionsSection(resolved: ResolvedAgentInstructions): string {
  const lines: string[] = ["## Instructions"];

  if (resolved.role) {
    lines.push(`**Role:** ${resolved.role}`);
    lines.push("");
  }

  if (resolved.text) {
    lines.push(resolved.text);
    lines.push("");
  }

  if (resolved.constraints && resolved.constraints.length > 0) {
    lines.push("**Constraints:**");
    for (const constraint of resolved.constraints) {
      lines.push(`- ${constraint}`);
    }
    lines.push("");
  }

  if (resolved.outputFormat) {
    lines.push(`**Output Format:** ${resolved.outputFormat}`);
    lines.push("");
  }

  return lines.join("\n");
}
