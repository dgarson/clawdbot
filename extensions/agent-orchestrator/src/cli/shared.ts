/**
 * Shared helpers for orchestrator CLI commands.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { OpenClawPluginCliContext } from "../../../../src/plugins/types.js";
import type { OrchestratorSessionState } from "../types.js";

/** Resolve the state directory from env or config. */
export function resolveStateDir(ctx: OpenClawPluginCliContext): string {
  const env = process.env.OPENCLAW_STATE_DIR?.trim();
  if (env) return env;
  return ctx.config.agents?.defaults?.workspace ?? process.cwd();
}

/** Path to the orchestrator store directory within a state dir. */
export function orchestratorDir(stateDir: string): string {
  return path.join(stateDir, "agent-orchestrator");
}

/**
 * Read all persisted orchestrator session files from disk.
 * Returns a map of sessionKey -> state. Skips corrupt files silently.
 */
export function readAllSessions(stateDir: string): Map<string, OrchestratorSessionState> {
  const dir = orchestratorDir(stateDir);
  const sessions = new Map<string, OrchestratorSessionState>();
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = readFileSync(path.join(dir, file), "utf-8");
        const data = JSON.parse(raw) as OrchestratorSessionState;
        const key = file.replace(/\.json$/, "");
        sessions.set(key, data);
      } catch {
        // skip corrupt or unreadable files
      }
    }
  } catch {
    // directory doesn't exist yet — return empty
  }
  return sessions;
}

/** Write a single session state file to disk. */
export function writeSession(stateDir: string, key: string, state: OrchestratorSessionState): void {
  const dir = orchestratorDir(stateDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(path.join(dir, `${key}.json`), JSON.stringify(state, null, 2));
}

/** Remove all session files (optionally keeping completed ones). */
export function clearSessions(stateDir: string, keepCompleted: boolean): number {
  const dir = orchestratorDir(stateDir);
  let removed = 0;
  try {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      if (keepCompleted) {
        try {
          const raw = readFileSync(path.join(dir, file), "utf-8");
          const data = JSON.parse(raw) as OrchestratorSessionState;
          if (data.status === "completed") continue;
        } catch {
          // corrupt file — remove it
        }
      }
      rmSync(path.join(dir, file), { force: true });
      removed++;
    }
  } catch {
    // directory doesn't exist — nothing to clear
  }
  return removed;
}

/** Format a millisecond duration as a human-readable relative time string. */
export function formatRelativeTime(ms: number): string {
  if (ms < 1000) return "just now";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

/** Truncate a string to a max length, appending "..." if truncated. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
