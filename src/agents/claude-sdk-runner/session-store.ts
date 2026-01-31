/**
 * SDK session ID storage: maps OpenClaw session IDs to SDK session IDs.
 *
 * The Claude Agent SDK uses its own session_id for conversation context.
 * This module stores the mapping so we can resume sessions across turns.
 *
 * Storage strategy:
 * - In-memory cache for fast access within the process
 * - File persistence (.sdk-session-id) alongside the session file for durability
 */

import fs from "node:fs";
import path from "node:path";

import { log } from "./logger.js";

/** In-memory cache: OpenClaw sessionId -> SDK sessionId */
const SDK_SESSION_CACHE = new Map<string, string>();

/**
 * Get the SDK session ID for an OpenClaw session.
 *
 * Checks in-memory cache first, then falls back to file storage.
 */
export function getSdkSessionId(params: {
  sessionId: string;
  sessionFile?: string;
}): string | undefined {
  const { sessionId, sessionFile } = params;

  // Check in-memory cache first
  const cached = SDK_SESSION_CACHE.get(sessionId);
  if (cached) {
    log.debug(`SDK session ID from cache: ${sessionId} -> ${cached}`);
    return cached;
  }

  // Try to load from file
  if (sessionFile) {
    const sdkSessionFile = getSdkSessionFilePath(sessionFile);
    try {
      if (fs.existsSync(sdkSessionFile)) {
        const sdkSessionId = fs.readFileSync(sdkSessionFile, "utf-8").trim();
        if (sdkSessionId) {
          // Populate cache
          SDK_SESSION_CACHE.set(sessionId, sdkSessionId);
          log.debug(`SDK session ID from file: ${sessionId} -> ${sdkSessionId}`);
          return sdkSessionId;
        }
      }
    } catch (err) {
      log.debug(`Failed to read SDK session file: ${err}`);
    }
  }

  return undefined;
}

/**
 * Store the SDK session ID for an OpenClaw session.
 *
 * Writes to both in-memory cache and file storage.
 */
export function setSdkSessionId(params: {
  sessionId: string;
  sdkSessionId: string;
  sessionFile?: string;
}): void {
  const { sessionId, sdkSessionId, sessionFile } = params;

  if (!sdkSessionId.trim()) {
    return;
  }

  // Update in-memory cache
  SDK_SESSION_CACHE.set(sessionId, sdkSessionId);

  // Persist to file
  if (sessionFile) {
    const sdkSessionFile = getSdkSessionFilePath(sessionFile);
    try {
      fs.mkdirSync(path.dirname(sdkSessionFile), { recursive: true });
      fs.writeFileSync(sdkSessionFile, sdkSessionId, "utf-8");
      log.debug(`SDK session ID stored: ${sessionId} -> ${sdkSessionId}`);
    } catch (err) {
      log.debug(`Failed to write SDK session file: ${err}`);
    }
  }
}

/**
 * Get the path to the SDK session ID file for a session.
 */
function getSdkSessionFilePath(sessionFile: string): string {
  const dir = path.dirname(sessionFile);
  const base = path.basename(sessionFile, path.extname(sessionFile));
  return path.join(dir, `${base}.sdk-session-id`);
}
