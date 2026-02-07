import JSON5 from "json5";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CronStoreFile } from "./types.js";
import { CONFIG_DIR } from "../utils.js";

export const DEFAULT_CRON_DIR = path.join(CONFIG_DIR, "cron");
export const DEFAULT_CRON_STORE_PATH = path.join(DEFAULT_CRON_DIR, "jobs.json");

export function resolveCronStorePath(storePath?: string) {
  if (storePath?.trim()) {
    const raw = storePath.trim();
    if (raw.startsWith("~")) {
      return path.resolve(raw.replace("~", os.homedir()));
    }
    return path.resolve(raw);
  }
  return DEFAULT_CRON_STORE_PATH;
}

// FS error codes that indicate transient conditions worth retrying.
const TRANSIENT_FS_CODES = new Set([
  "EACCES",
  "EIO",
  "ENOMEM",
  "EMFILE",
  "ENFILE",
  "ENOSPC",
  "EBUSY",
]);

export function isTransientFsError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    return TRANSIENT_FS_CODES.has((err as { code: string }).code);
  }
  return false;
}

function isNotFoundError(err: unknown): boolean {
  if (err && typeof err === "object" && "code" in err) {
    const code = (err as { code: string }).code;
    return code === "ENOENT" || code === "ENOTDIR";
  }
  return false;
}

export type LoadCronStoreResult = {
  store: CronStoreFile;
  loadError?: string;
  fromBackup?: boolean;
};

type LoadCronStoreOpts = {
  log?: { warn: (obj: unknown, msg?: string) => void; error: (obj: unknown, msg?: string) => void };
};

function parseStoreRaw(raw: string): CronStoreFile {
  const parsed = JSON5.parse(raw);
  const jobs = Array.isArray(parsed?.jobs) ? (parsed?.jobs as never[]) : [];
  return {
    version: 1,
    jobs: jobs.filter(Boolean) as never as CronStoreFile["jobs"],
  };
}

export async function loadCronStore(
  storePath: string,
  opts?: LoadCronStoreOpts,
): Promise<LoadCronStoreResult> {
  let raw: string;
  try {
    raw = await fs.promises.readFile(storePath, "utf-8");
  } catch (err) {
    if (isNotFoundError(err)) {
      return { store: { version: 1, jobs: [] } };
    }
    if (isTransientFsError(err)) {
      // Let the caller retry
      throw err;
    }
    // Unknown read error — treat as not-found with a warning
    opts?.log?.error({ err: String(err), storePath }, "cron: unexpected error reading store file");
    return { store: { version: 1, jobs: [] }, loadError: String(err) };
  }

  // Attempt to parse the primary file
  try {
    return { store: parseStoreRaw(raw) };
  } catch (parseErr) {
    opts?.log?.error(
      { err: String(parseErr), contentPreview: raw.slice(0, 500), storePath },
      "cron: store file is corrupt; attempting .bak fallback",
    );
  }

  // Fallback to .bak
  const bakPath = `${storePath}.bak`;
  try {
    const bakRaw = await fs.promises.readFile(bakPath, "utf-8");
    const store = parseStoreRaw(bakRaw);
    opts?.log?.warn({ bakPath }, "cron: recovered store from .bak backup");
    return { store, fromBackup: true };
  } catch (bakErr) {
    opts?.log?.error(
      { err: String(bakErr), bakPath },
      "cron: .bak fallback also failed; returning empty store",
    );
    return {
      store: { version: 1, jobs: [] },
      loadError: `primary: parse error; backup: ${String(bakErr)}`,
    };
  }
}

export async function saveCronStore(storePath: string, store: CronStoreFile) {
  await fs.promises.mkdir(path.dirname(storePath), { recursive: true });
  const tmp = `${storePath}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  const json = JSON.stringify(store, null, 2);
  await fs.promises.writeFile(tmp, json, "utf-8");
  await fs.promises.rename(tmp, storePath);
  try {
    await fs.promises.copyFile(storePath, `${storePath}.bak`);
  } catch {
    // best-effort
  }
}
