import type { CrnParseMode } from "../types.js";

export function canonicalizeFileResourceId(resourceType: string, resourceId: string): string {
  if (resourceType !== "path") {
    return resourceId;
  }
  return resourceId.replace(/\\/g, "/");
}

export function canonicalizeFileResourceIdPattern(
  resourceType: string,
  resourceId: string,
  mode: CrnParseMode,
): string {
  if (mode === "pattern" && resourceId === "*") {
    return resourceId;
  }
  const hasWildcard = mode === "pattern" && resourceId.endsWith("*");
  const base = hasWildcard ? resourceId.slice(0, -1) : resourceId;
  const normalized = canonicalizeFileResourceId(resourceType, base);
  return hasWildcard ? `${normalized}*` : normalized;
}
