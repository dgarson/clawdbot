import { loadSessionEntry } from "../../gateway/session-utils.js";
import { enqueueSystemEvent } from "../../infra/system-events.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";

const log = createSubsystemLogger("agents/message-parent-fallback");

const MESSAGE_CONTENT_FIELDS = ["message", "text", "content", "caption"] as const;

/**
 * Extract the deliverable text from message tool params.
 * Checks fields in priority order; returns null if there's nothing to forward.
 */
export function extractMessageContent(params: Record<string, unknown>): string | null {
  for (const field of MESSAGE_CONTENT_FIELDS) {
    const val = typeof params[field] === "string" ? (params[field] as string).trim() : "";
    if (val) return val;
  }
  return null;
}

/**
 * Look up the parent (spawner) session key from this session's spawnedBy metadata.
 * Returns null if the session is not a sub-agent or has no recorded parent.
 */
export function resolveParentSessionKey(sessionKey: string): string | null {
  try {
    const { entry } = loadSessionEntry(sessionKey);
    const spawnedBy = typeof entry?.spawnedBy === "string" ? entry.spawnedBy.trim() : "";
    return spawnedBy || null;
  } catch {
    return null;
  }
}

/**
 * Forward message content to the parent session as a system event.
 *
 * Used as a fallback when a sub-agent calls `message` with no delivery target.
 * The parent session's next agent turn will receive the content as a [System Message]
 * and can choose to deliver or relay it.
 *
 * Returns true if the event was enqueued successfully.
 */
export function deliverMessageToParentSession(params: {
  parentSessionKey: string;
  childSessionKey: string;
  messageContent: string;
  action: string;
}): boolean {
  const { parentSessionKey, childSessionKey, messageContent, action } = params;
  if (!messageContent.trim()) return false;

  const text = [
    `[System Message] Sub-agent (session: ${childSessionKey}) called \`message\` (action: ${action}) with no delivery target.`,
    `The message content has been forwarded here. Deliver it or act on it as appropriate:`,
    "",
    messageContent,
  ].join("\n");

  try {
    enqueueSystemEvent(text, { sessionKey: parentSessionKey });
    log.info?.(
      `[${childSessionKey}] forwarded targetless message to parent session ${parentSessionKey}`,
    );
    return true;
  } catch (err) {
    log.warn?.(
      `[${childSessionKey}] failed to forward targetless message to parent session ${parentSessionKey}: ${String(err)}`,
    );
    return false;
  }
}
