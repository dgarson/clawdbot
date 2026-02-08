import type { CrnParseMode } from "../types.js";

function normalizeUrl(resourceId: string): string {
  const url = new URL(resourceId);
  const normalized = new URL(resourceId);
  normalized.protocol = url.protocol.toLowerCase();
  normalized.hostname = url.hostname.toLowerCase();
  return normalized.toString();
}

export function canonicalizeBrowserResourceId(
  resourceType: string,
  resourceId: string,
  mode: CrnParseMode,
): string {
  if (resourceType !== "page") {
    return resourceId;
  }
  if (mode === "pattern" && resourceId === "*") {
    return resourceId;
  }
  const hasWildcard = mode === "pattern" && resourceId.endsWith("*");
  const base = hasWildcard ? resourceId.slice(0, -1) : resourceId;
  let normalized = base;
  try {
    normalized = normalizeUrl(base);
  } catch {
    normalized = base;
  }
  return hasWildcard ? `${normalized}*` : normalized;
}
