import type { OpenClawConfig } from "openclaw/plugin-sdk";
import os from "node:os";
import path from "node:path";

export function resolveUserPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed === "~") {
    return os.homedir();
  }
  if (trimmed.startsWith("~/")) {
    return path.join(os.homedir(), trimmed.slice(2));
  }
  return trimmed;
}

export function resolveOpenClawStateDir(): string {
  const stateDir = process.env.OPENCLAW_STATE_DIR?.trim();
  if (stateDir) {
    return path.resolve(resolveUserPath(stateDir));
  }
  return path.join(os.homedir(), ".openclaw");
}

function readHookDirOverride(cfg: OpenClawConfig | undefined, hookKey: string): string | undefined {
  const entry = cfg?.hooks?.internal?.entries?.[hookKey] as Record<string, unknown> | undefined;
  const raw = (entry?.dir as unknown) ?? (entry?.path as unknown);
  const value = typeof raw === "string" ? raw.trim() : "";
  return value ? path.resolve(resolveUserPath(value)) : undefined;
}

export function resolveMeridiaDir(cfg?: OpenClawConfig, hookKey?: string): string {
  if (cfg) {
    if (hookKey) {
      const override = readHookDirOverride(cfg, hookKey);
      if (override) {
        return override;
      }
    } else {
      const keys = ["experiential-capture", "compaction", "session-end", "meridia-reconstitution"];
      for (const key of keys) {
        const override = readHookDirOverride(cfg, key);
        if (override) {
          return override;
        }
      }
    }
  }
  return path.join(resolveOpenClawStateDir(), "meridia");
}

export function isDefaultMeridiaDir(dir: string): boolean {
  const resolved = path.resolve(dir);
  const expected = path.resolve(path.join(resolveOpenClawStateDir(), "meridia"));
  return resolved === expected;
}

export function dateKeyUtc(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
