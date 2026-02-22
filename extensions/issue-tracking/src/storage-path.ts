import { createHash } from "node:crypto";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";

function sanitizeSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-");
  return normalized.replace(/^-+|-+$/g, "").slice(0, 80);
}

function hashSuffix(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 10);
}

function resolveWorkstreamKey(api: OpenClawPluginApi): string {
  const configured = api.pluginConfig?.workstreamId;
  if (typeof configured === "string" && configured.trim()) {
    return configured.trim();
  }

  const owner = api.pluginConfig?.githubOwner;
  const repo = api.pluginConfig?.githubRepo;
  if (typeof owner === "string" && typeof repo === "string" && owner.trim() && repo.trim()) {
    return `${owner.trim()}/${repo.trim()}`;
  }

  return api.id;
}

export function resolveSharedIssueTrackingDir(api: OpenClawPluginApi): string {
  const stateDir = api.runtime.state.resolveStateDir();
  const key = resolveWorkstreamKey(api);
  const stableSegment = sanitizeSegment(key) || "workstream";
  const uniqueSegment = `${stableSegment}-${hashSuffix(key)}`;
  return path.join(stateDir, "issue-tracking", uniqueSegment);
}
