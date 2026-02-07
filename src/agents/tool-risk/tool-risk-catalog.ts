import type { RiskClass, ToolRiskProfile } from "./types.js";
import { maxRiskClass } from "./types.js";

// ---------------------------------------------------------------------------
// Core Tool Risk Catalog
//
// Maps known core tool names to their baseline ToolRiskProfile.
// Unknown tools are NOT in this catalog — the resolver handles the
// fail-closed fallback to R3.
// ---------------------------------------------------------------------------

const catalog = new Map<string, ToolRiskProfile>();

// ---------------------------------------------------------------------------
// Helper to register a tool profile.
// ---------------------------------------------------------------------------

function register(name: string, profile: ToolRiskProfile): void {
  catalog.set(normalizeName(name), profile);
}

/** Normalize a tool name for catalog lookup (lowercase, trim). */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// R0 — Informational / pure read tools
// ---------------------------------------------------------------------------

register("ripgrep", {
  riskClass: "R0",
  sideEffects: ["filesystem_read"],
  description: "Search file contents with ripgrep",
});

register("tree", {
  riskClass: "R0",
  sideEffects: ["filesystem_read"],
  description: "List directory tree",
});

register("agents_list", {
  riskClass: "R0",
  sideEffects: ["none"],
  description: "List configured agents",
});

register("session_status", {
  riskClass: "R0",
  sideEffects: ["none"],
  description: "Show current session status",
});

register("sessions_list", {
  riskClass: "R0",
  sideEffects: ["none"],
  description: "List agent sessions",
});

register("sessions_history", {
  riskClass: "R0",
  sideEffects: ["none"],
  description: "View session history",
});

register("sessions_tags", {
  riskClass: "R0",
  sideEffects: ["none"],
  description: "List session tags",
});

register("memory_search", {
  riskClass: "R0",
  sideEffects: ["none"],
  description: "Search indexed memory",
});

register("memory_query", {
  riskClass: "R0",
  sideEffects: ["none"],
  description: "Query memory store",
});

register("memory_get", {
  riskClass: "R0",
  sideEffects: ["none"],
  description: "Retrieve memory entry by key",
});

register("memory_recall", {
  riskClass: "R0",
  sideEffects: ["none"],
  description: "Recall relevant memories",
});

register("memory_index_status", {
  riskClass: "R0",
  sideEffects: ["none"],
  description: "Check memory index status",
});

register("memory_audit", {
  riskClass: "R0",
  sideEffects: ["none"],
  description: "Audit memory store entries",
});

register("work_queue", {
  riskClass: "R0",
  sideEffects: ["none"],
  description: "View work queue items",
});

// ---------------------------------------------------------------------------
// R1 — Low-risk side effects
// ---------------------------------------------------------------------------

register("web_search", {
  riskClass: "R1",
  sideEffects: ["network_egress"],
  description: "Search the web",
});

register("web_fetch", {
  riskClass: "R1",
  sideEffects: ["network_egress"],
  description: "Fetch a URL",
});

register("image", {
  riskClass: "R1",
  sideEffects: ["filesystem_read", "network_egress"],
  description: "View/process an image",
});

register("tts", {
  riskClass: "R1",
  sideEffects: ["network_egress"],
  description: "Text-to-speech conversion",
});

register("memory_store", {
  riskClass: "R1",
  sideEffects: ["memory_write"],
  description: "Store a memory entry",
});

register("memory_ingest", {
  riskClass: "R1",
  sideEffects: ["memory_write"],
  description: "Ingest content into memory",
});

register("memory_context_pack", {
  riskClass: "R1",
  sideEffects: ["none"],
  description: "Pack memory context for agent",
});

register("canvas", {
  riskClass: "R1",
  sideEffects: ["none"],
  description: "Render canvas content",
});

register("work_item", {
  riskClass: "R1",
  sideEffects: ["none"],
  description: "Update work queue item",
});

// ---------------------------------------------------------------------------
// R2 — Moderate side effects
// ---------------------------------------------------------------------------

register("browser", {
  riskClass: "R2",
  sideEffects: ["browser_navigation", "network_egress"],
  description: "Control headless browser",
});

register("image_generate", {
  riskClass: "R2",
  sideEffects: ["network_egress", "filesystem_write"],
  description: "Generate image via AI model",
});

register("cron", {
  riskClass: "R2",
  sideEffects: ["config_mutation"],
  description: "Manage scheduled tasks",
});

register("nodes", {
  riskClass: "R2",
  sideEffects: ["network_egress"],
  description: "Invoke remote node operations",
});

register("sessions_spawn", {
  riskClass: "R2",
  sideEffects: ["process_spawn"],
  description: "Spawn a new agent session",
});

register("coding_task", {
  riskClass: "R2",
  sideEffects: ["process_spawn"],
  description: "Delegate a coding sub-task",
});

// ---------------------------------------------------------------------------
// R3 — High-risk, approval recommended
// ---------------------------------------------------------------------------

register("exec", {
  riskClass: "R3",
  sideEffects: ["process_spawn", "filesystem_write", "network_egress"],
  description: "Execute shell command",
  parameterBump: (params: Record<string, unknown>): RiskClass | null => {
    const command = typeof params.command === "string" ? params.command : "";
    // Bump to R4 for obviously destructive commands
    if (/\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--force|-[a-zA-Z]*f[a-zA-Z]*r)\b/.test(command)) {
      return "R4";
    }
    if (/\b(mkfs|dd\s+if=|fdisk|parted)\b/.test(command)) {
      return "R4";
    }
    if (/\bsudo\b/.test(command)) {
      return maxRiskClass("R3", "R3"); // stays R3, but could be bumped by other rules
    }
    return null;
  },
});

register("process", {
  riskClass: "R3",
  sideEffects: ["process_spawn"],
  description: "Run a background process",
});

register("message", {
  riskClass: "R3",
  sideEffects: ["message_send", "network_egress"],
  description: "Send message to external channel",
});

register("sessions_send", {
  riskClass: "R3",
  sideEffects: ["message_send"],
  description: "Send message to an agent session",
});

register("gateway", {
  riskClass: "R3",
  sideEffects: ["config_mutation", "system_state"],
  description: "Mutate gateway configuration at runtime",
});

// ---------------------------------------------------------------------------
// Catalog access
// ---------------------------------------------------------------------------

/**
 * Look up a tool's risk profile from the core catalog.
 * Returns undefined for unknown tools (caller decides fallback).
 */
export function getCoreToolRiskProfile(toolName: string): ToolRiskProfile | undefined {
  return catalog.get(normalizeName(toolName));
}

/**
 * Return a snapshot of all registered core tool profiles.
 */
export function listCoreToolRiskProfiles(): ReadonlyMap<string, ToolRiskProfile> {
  return catalog;
}
