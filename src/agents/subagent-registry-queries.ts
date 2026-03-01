import path from "node:path";
import { SessionManager } from "@mariozechner/pi-coding-agent";

type SessionEntry = { type: string; message?: { role?: string; content?: unknown } };
type ContentPart = { type?: string; text?: string };
import { resolveAgentIdFromSessionKey } from "../config/sessions.js";
import { resolveDefaultSessionStorePath } from "../config/sessions/paths.js";
import { resolveAndPersistSessionFile } from "../config/sessions/session-file.js";
import { loadSessionStore } from "../config/sessions/store.js";
import type { DeliveryContext } from "../utils/delivery-context.js";
import type { SubagentRunRecord } from "./subagent-registry.types.js";

export function findRunIdsByChildSessionKeyFromRuns(
  runs: Map<string, SubagentRunRecord>,
  childSessionKey: string,
): string[] {
  const key = childSessionKey.trim();
  if (!key) {
    return [];
  }
  const runIds: string[] = [];
  for (const [runId, entry] of runs.entries()) {
    if (entry.childSessionKey === key) {
      runIds.push(runId);
    }
  }
  return runIds;
}

export function listRunsForRequesterFromRuns(
  runs: Map<string, SubagentRunRecord>,
  requesterSessionKey: string,
): SubagentRunRecord[] {
  const key = requesterSessionKey.trim();
  if (!key) {
    return [];
  }
  return [...runs.values()].filter((entry) => entry.requesterSessionKey === key);
}

export function resolveRequesterForChildSessionFromRuns(
  runs: Map<string, SubagentRunRecord>,
  childSessionKey: string,
): {
  requesterSessionKey: string;
  requesterOrigin?: DeliveryContext;
} | null {
  const key = childSessionKey.trim();
  if (!key) {
    return null;
  }
  let best: SubagentRunRecord | undefined;
  for (const entry of runs.values()) {
    if (entry.childSessionKey !== key) {
      continue;
    }
    if (!best || entry.createdAt > best.createdAt) {
      best = entry;
    }
  }
  if (!best) {
    return null;
  }
  return {
    requesterSessionKey: best.requesterSessionKey,
    requesterOrigin: best.requesterOrigin,
  };
}

export function countActiveRunsForSessionFromRuns(
  runs: Map<string, SubagentRunRecord>,
  requesterSessionKey: string,
): number {
  const key = requesterSessionKey.trim();
  if (!key) {
    return 0;
  }
  let count = 0;
  for (const entry of runs.values()) {
    if (entry.requesterSessionKey !== key) {
      continue;
    }
    if (typeof entry.endedAt === "number") {
      continue;
    }
    count += 1;
  }
  return count;
}

export function countActiveDescendantRunsFromRuns(
  runs: Map<string, SubagentRunRecord>,
  rootSessionKey: string,
): number {
  const root = rootSessionKey.trim();
  if (!root) {
    return 0;
  }
  const pending = [root];
  const visited = new Set<string>([root]);
  let count = 0;
  while (pending.length > 0) {
    const requester = pending.shift();
    if (!requester) {
      continue;
    }
    for (const entry of runs.values()) {
      if (entry.requesterSessionKey !== requester) {
        continue;
      }
      if (typeof entry.endedAt !== "number") {
        count += 1;
      }
      const childKey = entry.childSessionKey.trim();
      if (!childKey || visited.has(childKey)) {
        continue;
      }
      visited.add(childKey);
      pending.push(childKey);
    }
  }
  return count;
}

export function listDescendantRunsForRequesterFromRuns(
  runs: Map<string, SubagentRunRecord>,
  rootSessionKey: string,
): SubagentRunRecord[] {
  const root = rootSessionKey.trim();
  if (!root) {
    return [];
  }
  const pending = [root];
  const visited = new Set<string>([root]);
  const descendants: SubagentRunRecord[] = [];
  while (pending.length > 0) {
    const requester = pending.shift();
    if (!requester) {
      continue;
    }
    for (const entry of runs.values()) {
      if (entry.requesterSessionKey !== requester) {
        continue;
      }
      descendants.push(entry);
      const childKey = entry.childSessionKey.trim();
      if (!childKey || visited.has(childKey)) {
        continue;
      }
      visited.add(childKey);
      pending.push(childKey);
    }
  }
  return descendants;
}

export async function readLastAssistantMessageFromSession(
  sessionKey: string,
): Promise<string | undefined> {
  const key = sessionKey.trim();
  if (!key) {
    return undefined;
  }

  const agentId = resolveAgentIdFromSessionKey(key);
  const storePath = resolveDefaultSessionStorePath(agentId);
  const store = loadSessionStore(storePath, { skipCache: true });
  const entry = store[key];
  if (!entry?.sessionId) {
    return undefined;
  }

  try {
    const { sessionFile } = await resolveAndPersistSessionFile({
      sessionId: entry.sessionId,
      sessionKey: key,
      sessionStore: store,
      storePath,
      sessionEntry: entry,
      agentId,
      sessionsDir: path.dirname(storePath),
    });
    const sm = SessionManager.open(sessionFile);
    const messages = (sm.getEntries() as SessionEntry[])
      .filter((e) => e.type === "message")
      .map((e) => e.message);
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.role === "assistant") {
        if (Array.isArray(msg.content)) {
          return (msg.content as ContentPart[])
            .map((c) => (c.type === "text" ? (c.text ?? "") : ""))
            .join("");
        }
        return typeof msg.content === "string" ? msg.content : undefined;
      }
    }
  } catch {
    // Ignore errors reading session file
  }
  return undefined;
}
