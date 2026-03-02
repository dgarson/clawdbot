import type { AgentRole } from "../types.js";

// Model overrides per role (cost optimization)
// Scouts and reviewers are read-only — cheaper model is fine
// Builders need the best model for code generation
export const ROLE_MODEL_OVERRIDES: Partial<Record<AgentRole, string>> = {
  scout: "claude-haiku-4-5",
  reviewer: "claude-haiku-4-5",
  // builder: uses default model (no override)
  // orchestrator: uses default model
  // lead: uses default model
};
