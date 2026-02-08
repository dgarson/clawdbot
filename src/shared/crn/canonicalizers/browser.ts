import type { CrnParseMode } from "../types.js";

function extractExplicitPort(resourceId: string): string | null {
  const match = resourceId.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/?#]+)/);
  if (!match) {
    return null;
  }
  const authority = match[1] ?? "";
  const hostPort = authority.split("@").pop() ?? "";
  if (!hostPort) {
    return null;
  }
  if (hostPort.startsWith("[")) {
    const end = hostPort.indexOf("]");
    if (end === -1) {
      return null;
    }
    const rest = hostPort.slice(end + 1);
    if (!rest.startsWith(":")) {
      return null;
    }
    const port = rest.slice(1);
    return /^\d+$/.test(port) ? port : null;
  }
  const lastColon = hostPort.lastIndexOf(":");
  if (lastColon === -1) {
    return null;
  }
  const port = hostPort.slice(lastColon + 1);
  return /^\d+$/.test(port) ? port : null;
}

function normalizeUrl(resourceId: string): string {
  const url = new URL(resourceId);
  const protocol = url.protocol.toLowerCase();
  const hostname = url.hostname.toLowerCase();
  const explicitPort = extractExplicitPort(resourceId);
  const port = explicitPort ?? url.port;
  const auth =
    url.username || url.password ? `${url.username}${url.password ? `:${url.password}` : ""}@` : "";
  const portSuffix = port ? `:${port}` : "";
  return `${protocol}//${auth}${hostname}${portSuffix}${url.pathname}${url.search}${url.hash}`;
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
