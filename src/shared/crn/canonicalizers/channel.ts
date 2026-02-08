import type { CrnParseMode } from "../types.js";
import { CrnError } from "../errors.js";

function normalizeProvider(provider: string): string {
  return provider.trim().toLowerCase();
}

export function canonicalizeChannelResourceId(resourceId: string, mode: CrnParseMode): string {
  if (mode === "pattern" && resourceId === "*") {
    return resourceId;
  }
  const hasWildcard = mode === "pattern" && resourceId.endsWith("*");
  const base = hasWildcard ? resourceId.slice(0, -1) : resourceId;
  const trimmed = base.trim();
  if (!trimmed) {
    throw new CrnError("invalid_resource_id", "channel resource-id requires provider prefix", {
      resourceId,
    });
  }
  const segments = trimmed.split("/");
  const provider = normalizeProvider(segments[0] ?? "");
  if (!provider) {
    throw new CrnError("invalid_resource_id", "channel resource-id requires provider prefix", {
      resourceId,
    });
  }
  const remainder = segments.slice(1).join("/");
  const normalized = remainder ? `${provider}/${remainder}` : `${provider}/`;
  return hasWildcard ? `${normalized}*` : normalized;
}
