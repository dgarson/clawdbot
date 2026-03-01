/**
 * Mailbox storage — one rewritten JSONL file per agent mailbox.
 *
 * Message state machine:
 *   unread → processing → read
 *
 * "processing" is a lease: the agent claimed the message and must ack it within
 * processing_ttl_ms or it resets to "unread" on the next inbox call.
 *
 * Concurrency model: Node.js is single-threaded; multiple agent sessions run
 * in separate processes. We use atomic write (write tmp → rename) so a reader
 * never sees a half-written file. The rename is atomic on POSIX; on Windows we
 * fall back to direct overwrite (acceptable given low-frequency mail ops).
 *
 * All writes hold an in-process async mutex per mailbox path to prevent
 * interleaving within a single gateway process. Cross-process safety is
 * provided by the atomic rename — the worst case is the last writer wins,
 * which is correct for these status transitions.
 */

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { resolvePreferredOpenClawTmpDir } from "openclaw/plugin-sdk";
import type { MailUrgency } from "./config.js";

// ============================================================================
// Types
// ============================================================================

export type MessageStatus = "unread" | "processing" | "read" | "deleted";

export type ForwardHop = {
  from: string;
  to: string;
  notes: string;
  forwarded_at: number;
};

export type MailMessage = {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  urgency: MailUrgency;
  tags: string[];
  status: MessageStatus;
  created_at: number;
  read_at: number | null;
  deleted_at: number | null;
  /**
   * Timestamp when this message was last claimed (processing started).
   * Null unless currently in "processing" state.
   */
  processing_at: number | null;
  /**
   * Timestamp after which this processing lease expires and the message
   * resets to "unread". Null unless status === "processing".
   */
  processing_expires_at: number | null;
  /** Direct parent message id; null for original messages. */
  forwarded_from: string | null;
  /** Full ancestor chain, oldest first. Empty for originals. */
  lineage: string[];
};

// ============================================================================
// Paths
// ============================================================================

export function mailboxDir(stateDir: string): string {
  return path.join(stateDir, "inter-agent-mail");
}

export function mailboxPath(stateDir: string, agentId: string): string {
  const safe = agentId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(mailboxDir(stateDir), `${safe}.jsonl`);
}

// ============================================================================
// In-process mutex (prevents concurrent writes within one gateway process)
// ============================================================================

const writeLocks = new Map<string, Promise<void>>();

async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = writeLocks.get(key) ?? Promise.resolve();
  let resolve!: () => void;
  const next = new Promise<void>((r) => {
    resolve = r;
  });
  writeLocks.set(key, next);
  await prev;
  try {
    return await fn();
  } finally {
    resolve();
    // Clean up if nothing else is waiting
    if (writeLocks.get(key) === next) {
      writeLocks.delete(key);
    }
  }
}

// ============================================================================
// Read
// ============================================================================

export async function readMailbox(filePath: string): Promise<MailMessage[]> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw err;
  }
  const messages: MailMessage[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      messages.push(JSON.parse(trimmed) as MailMessage);
    } catch {
      // Skip malformed lines — rare but possible if a process was killed mid-append
    }
  }
  return messages;
}

// ============================================================================
// Atomic full rewrite (for all status mutations)
// ============================================================================

async function atomicWrite(filePath: string, messages: MailMessage[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const lines = messages.map((m) => JSON.stringify(m)).join("\n");
  const content = lines ? `${lines}\n` : "";

  const tmpPath = path.join(
    resolvePreferredOpenClawTmpDir(),
    `inter-agent-mail-${crypto.randomBytes(6).toString("hex")}.jsonl.tmp`,
  );
  await fs.writeFile(tmpPath, content, { mode: 0o600, encoding: "utf-8" });
  try {
    await fs.rename(tmpPath, filePath);
  } catch {
    // Windows fallback: rename can fail across drives
    await fs.writeFile(filePath, content, { mode: 0o600, encoding: "utf-8" });
    await fs.unlink(tmpPath).catch(() => undefined);
  }
}

// ============================================================================
// Append a new message (fast path — no rewrite needed)
// ============================================================================

export async function appendMessage(filePath: string, message: MailMessage): Promise<void> {
  return withLock(filePath, async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const line = `${JSON.stringify(message)}\n`;
    await fs.appendFile(filePath, line, { mode: 0o600, encoding: "utf-8" });
  });
}

// ============================================================================
// TTL recovery — expired processing → unread (no lock, caller must hold lock)
// ============================================================================

function recoverExpiredLocked(
  messages: MailMessage[],
  now: number,
): { messages: MailMessage[]; recovered: number } {
  let recovered = 0;
  const next = messages.map((m) => {
    if (
      m.status === "processing" &&
      m.processing_expires_at !== null &&
      m.processing_expires_at <= now
    ) {
      recovered++;
      return {
        ...m,
        status: "unread" as MessageStatus,
        processing_at: null,
        processing_expires_at: null,
      };
    }
    return m;
  });
  return { messages: next, recovered };
}

// ============================================================================
// Claim messages — unread → processing (the only way an agent sees content)
// ============================================================================

export type ClaimResult = {
  messages: MailMessage[];
  claimed: number;
  recovered: number;
};

/**
 * Atomically:
 *  1. Resets any expired-processing messages back to "unread".
 *  2. Claims all currently-unread messages matching the filter as "processing".
 *
 * Also optionally returns still-live processing messages (include_stale=true)
 * so an agent that restarts before TTL can see what it was working on.
 */
export async function claimUnread(
  filePath: string,
  opts: {
    ttlMs: number;
    now?: number;
    filterUrgency?: MailUrgency[];
    filterTags?: string[];
    includeStale?: boolean;
  },
): Promise<ClaimResult> {
  return withLock(filePath, async () => {
    const now = opts.now ?? Date.now();
    const expiresAt = now + opts.ttlMs;

    let messages = await readMailbox(filePath);

    // Step 1: recover expired leases
    const { messages: recovered, recovered: recoveredCount } = recoverExpiredLocked(messages, now);
    messages = recovered;

    // Step 2: claim matching unread messages
    let claimed = 0;
    const claimedMessages: MailMessage[] = [];
    const staleMessages: MailMessage[] = [];

    const next = messages.map((m) => {
      if (m.status === "deleted") return m;

      // Match urgency filter
      if (opts.filterUrgency && opts.filterUrgency.length > 0) {
        if (!opts.filterUrgency.includes(m.urgency)) return m;
      }
      // Match tag filter
      if (opts.filterTags && opts.filterTags.length > 0) {
        const tagSet = new Set(m.tags);
        if (!opts.filterTags.some((t) => tagSet.has(t))) return m;
      }

      if (m.status === "unread") {
        claimed++;
        const updated: MailMessage = {
          ...m,
          status: "processing",
          processing_at: now,
          processing_expires_at: expiresAt,
        };
        claimedMessages.push(updated);
        return updated;
      }

      // Still-live processing messages (not yet expired)
      if (opts.includeStale && m.status === "processing") {
        staleMessages.push(m);
      }

      return m;
    });

    if (claimed > 0 || recoveredCount > 0) {
      await atomicWrite(filePath, next);
    }

    return {
      messages: [...claimedMessages, ...staleMessages],
      claimed,
      recovered: recoveredCount,
    };
  });
}

// ============================================================================
// Ack messages — processing → read (explicit agent completion)
// ============================================================================

export async function ackMessages(
  filePath: string,
  messageIds: Set<string>,
  now: number,
): Promise<{ updated: number }> {
  return withLock(filePath, async () => {
    const messages = await readMailbox(filePath);
    let updated = 0;
    const next = messages.map((m) => {
      if (messageIds.has(m.id) && (m.status === "processing" || m.status === "unread")) {
        updated++;
        return {
          ...m,
          status: "read" as MessageStatus,
          read_at: now,
          processing_at: null,
          processing_expires_at: null,
        };
      }
      return m;
    });
    if (updated > 0) {
      await atomicWrite(filePath, next);
    }
    return { updated };
  });
}

// ============================================================================
// Soft delete (CLI/operator only — messages become invisible to all tools)
// ============================================================================

export async function softDeleteMessages(
  filePath: string,
  messageIds: Set<string>,
  now: number,
): Promise<{ updated: number }> {
  return withLock(filePath, async () => {
    const messages = await readMailbox(filePath);
    let updated = 0;
    const next = messages.map((m) => {
      if (messageIds.has(m.id) && m.status !== "deleted") {
        updated++;
        return {
          ...m,
          status: "deleted" as MessageStatus,
          deleted_at: now,
          processing_at: null,
          processing_expires_at: null,
        };
      }
      return m;
    });
    if (updated > 0) {
      await atomicWrite(filePath, next);
    }
    return { updated };
  });
}

// ============================================================================
// Peek read (no status change — for delegate "peek" ACL level)
// ============================================================================

export type PeekFilter = {
  filterUrgency?: MailUrgency[];
  filterTags?: string[];
  includeRead?: boolean;
};

/** Returns matching non-deleted messages without changing any status. */
export function peekMessages(messages: MailMessage[], opts: PeekFilter): MailMessage[] {
  return messages.filter((m) => {
    if (m.status === "deleted") return false;
    if (!opts.includeRead && m.status === "read") return false;
    if (opts.filterUrgency && opts.filterUrgency.length > 0) {
      if (!opts.filterUrgency.includes(m.urgency)) return false;
    }
    if (opts.filterTags && opts.filterTags.length > 0) {
      const tagSet = new Set(m.tags);
      if (!opts.filterTags.some((t) => tagSet.has(t))) return false;
    }
    return true;
  });
}

// ============================================================================
// ID generation
// ============================================================================

export function newMessageId(): string {
  return `msg_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

// ============================================================================
// Unread count (used by the prompt hook — cheap scan, with TTL recovery)
// ============================================================================

export async function countUnread(
  filePath: string,
  now: number,
): Promise<{ total: number; urgent: number }> {
  const messages = await readMailbox(filePath);
  let total = 0;
  let urgent = 0;
  for (const m of messages) {
    // Treat expired-processing as unread for count purposes (they will be recovered
    // on the next inbox call, but we count them now so the hook fires)
    const effectivelyUnread =
      m.status === "unread" ||
      (m.status === "processing" &&
        m.processing_expires_at !== null &&
        m.processing_expires_at <= now);
    if (effectivelyUnread) {
      total++;
      if (m.urgency === "urgent") urgent++;
    }
  }
  return { total, urgent };
}
