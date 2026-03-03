import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";

const CHANGE_AUDIT_FILENAME = "change-audit.jsonl";

type ChangeAuditActor = {
  actor?: string;
  deviceId?: string;
  clientIp?: string;
  connId?: string;
};

export type ChangeAuditRecord = {
  ts?: string;
  source: string;
  eventType: string;
  op: string;
  targetPath?: string;
  beforeHash?: string | null;
  afterHash?: string | null;
  beforeBytes?: number | null;
  afterBytes?: number | null;
  changedPaths?: string[];
  agentId?: string;
  sessionId?: string;
  sessionKey?: string;
  runId?: string;
  sessionLogPath?: string;
  actor?: ChangeAuditActor;
  result: "ok" | "error";
  error?: string;
  details?: Record<string, unknown>;
};

export function resolveChangeAuditLogPath(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  return path.join(resolveStateDir(env, homedir), "logs", CHANGE_AUDIT_FILENAME);
}

export async function appendChangeAuditRecord(
  record: ChangeAuditRecord,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const payload = {
    ...record,
    ts: record.ts ?? new Date().toISOString(),
  };
  try {
    const auditPath = resolveChangeAuditLogPath(env);
    await fs.mkdir(path.dirname(auditPath), { recursive: true, mode: 0o700 });
    await fs.appendFile(auditPath, `${JSON.stringify(payload)}\n`, {
      encoding: "utf-8",
      mode: 0o600,
    });
  } catch {
    // best-effort audit sink
  }
}

export function hashAuditContent(content: string | null): string {
  return crypto
    .createHash("sha256")
    .update(content ?? "")
    .digest("hex");
}

export async function readFileAuditSnapshot(filePath: string): Promise<{
  exists: boolean;
  bytes: number | null;
  hash: string | null;
}> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return {
      exists: true,
      bytes: Buffer.byteLength(content, "utf-8"),
      hash: hashAuditContent(content),
    };
  } catch {
    return {
      exists: false,
      bytes: null,
      hash: null,
    };
  }
}
