import type { CrnParseMode } from "../types.js";

/**
 * Known external coding-platform services and their base URLs.
 *
 * Resource IDs are the platform-specific task/conversation identifiers.
 * The canonicalizer trims surrounding whitespace while preserving case,
 * so case-sensitive task IDs remain lossless.
 */
const PLATFORM_BASE_URLS: Record<string, string> = {
  "codex-web": "https://chatgpt.com/codex/tasks",
  // claude-web URL is built by claudeTaskUrl() since it needs session_ prefix
};

/**
 * Given an external-platform service name and task ID, return the full URL.
 *
 * Returns `undefined` for unrecognised services.
 */
export function externalTaskUrl(service: string, taskId: string): string | undefined {
  const baseUrl = PLATFORM_BASE_URLS[service];
  if (!baseUrl) {
    return undefined;
  }
  return `${baseUrl}/${taskId}`;
}

/**
 * Canonicalize the resource-id for external coding-platform CRNs.
 *
 * For task resource types the ID is trimmed while preserving original case.
 * Pattern-mode wildcards are preserved.
 */
export function canonicalizeExternalResourceId(
  resourceType: string,
  resourceId: string,
  mode: CrnParseMode,
): string {
  if (resourceType !== "task") {
    return resourceId;
  }
  const trimmed = resourceId.trim();
  if (mode === "pattern" && trimmed === "*") {
    return trimmed;
  }
  const hasWildcard = mode === "pattern" && trimmed.endsWith("*");
  const base = hasWildcard ? trimmed.slice(0, -1).trimEnd() : trimmed;
  return hasWildcard ? `${base}*` : base;
}
