import type { AnyAgentTool } from "../tools/common.js";
import type { ToolRiskAssessment, ToolRiskProfile } from "./types.js";
import { getCoreToolRiskProfile, normalizeName } from "./tool-risk-catalog.js";
import { evaluateToolRisk } from "./tool-risk-static.js";

// ---------------------------------------------------------------------------
// Plugin risk profile lookup
//
// The plugin tools module attaches metadata (including optional riskProfile)
// to each plugin tool via a WeakMap. We import the accessor function here.
// ---------------------------------------------------------------------------

let getPluginToolMeta:
  | ((tool: AnyAgentTool) => { riskProfile?: ToolRiskProfile } | undefined)
  | null = null;

/**
 * Lazily import the plugin tools module to avoid circular deps.
 * The module path is always available at runtime.
 */
function resolvePluginMeta(tool: AnyAgentTool): ToolRiskProfile | undefined {
  if (!getPluginToolMeta) {
    try {
      // Dynamic require/import avoided — rely on registration-time injection instead.
      return undefined;
    } catch {
      return undefined;
    }
  }
  return getPluginToolMeta(tool)?.riskProfile;
}

/**
 * Allow the plugin tools module to inject its accessor at startup.
 * Called once from the plugin tools module during initialization.
 */
export function setPluginToolMetaAccessor(
  accessor: (tool: AnyAgentTool) => { riskProfile?: ToolRiskProfile } | undefined,
): void {
  getPluginToolMeta = accessor;
}

// ---------------------------------------------------------------------------
// Resolution Order
//
// 1. Plugin-declared profile (if the tool came from a plugin with riskProfile)
// 2. Core catalog profile (if the tool name is known)
// 3. Unknown fallback — R3, fail-closed
// ---------------------------------------------------------------------------

export type ResolvedToolRisk = {
  profile: ToolRiskProfile | null;
  source: ToolRiskAssessment["source"];
};

/**
 * Resolve the risk profile for a tool by name, optionally checking plugin metadata.
 */
export function resolveToolRiskProfile(
  toolName: string,
  tool?: AnyAgentTool | null,
): ResolvedToolRisk {
  // 1. Plugin-declared profile
  if (tool) {
    const pluginProfile = resolvePluginMeta(tool);
    if (pluginProfile) {
      return { profile: pluginProfile, source: "plugin" };
    }
  }

  // 2. Core catalog
  const coreProfile = getCoreToolRiskProfile(toolName);
  if (coreProfile) {
    return { profile: coreProfile, source: "core_catalog" };
  }

  // 3. Unknown fallback
  return { profile: null, source: "unknown_fallback" };
}

/**
 * Full assessment: resolve profile + evaluate risk for a tool invocation.
 *
 * This is the primary entry point for the orchestrator seam.
 */
export function assessToolRisk(
  toolName: string,
  params: Record<string, unknown>,
  tool?: AnyAgentTool | null,
): ToolRiskAssessment {
  const normalized = normalizeName(toolName);
  const { profile, source } = resolveToolRiskProfile(normalized, tool);
  return evaluateToolRisk(normalized, profile, params, source);
}
