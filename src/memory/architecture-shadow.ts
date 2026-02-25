import type { OpenClawConfig } from "../config/config.js";
import { onSessionTranscriptUpdate } from "../sessions/transcript-events.js";
import {
  createMemoryService,
  type IMemoryService,
  type MemoryMetadata,
  type MemoryServiceOptions,
} from "./architecture.js";

let started = false;
let detach: (() => void) | undefined;

function extractMessageText(content: unknown): string | undefined {
  if (typeof content === "string") {
    return content.trim() || undefined;
  }

  if (!Array.isArray(content)) {
    return undefined;
  }

  const chunks: string[] = [];
  for (const block of content) {
    if (!block || typeof block !== "object") {
      continue;
    }
    const candidate = block as { type?: unknown; text?: unknown };
    if (candidate.type !== "text") {
      continue;
    }
    if (typeof candidate.text === "string") {
      chunks.push(candidate.text);
    }
  }

  const merged = chunks.join("\n").trim();
  return merged || undefined;
}

function buildService(cfg?: OpenClawConfig): IMemoryService {
  const architecture = cfg?.memory?.architecture;
  return createMemoryService({
    enabled: architecture?.enabled,
    shadowWrite: architecture?.shadowWrite,
    vectorDb: architecture?.vectorDb,
    embedding: architecture?.embedding,
    retrieval: architecture?.retrieval,
    retention: architecture?.retention,
    governance: architecture?.governance,
  } as MemoryServiceOptions);
}

export function startMemoryShadowWrite(cfg?: OpenClawConfig): void {
  if (started) {
    return;
  }

  const architecture = cfg?.memory?.architecture;
  if (!architecture?.enabled || !architecture.shadowWrite?.enabled) {
    return;
  }

  const service = buildService(cfg);

  detach = onSessionTranscriptUpdate((update) => {
    const role = update.message?.role;
    if (role !== "user" && role !== "assistant") {
      return;
    }

    const content = extractMessageText(update.message?.content);
    if (!content) {
      return;
    }

    const metadata: Omit<MemoryMetadata, "confidenceScore"> = {
      domain: "session_summary",
      sourceId: update.sessionFile,
      agentId: update.agentId,
      userId: update.sessionKey,
      tags: ["shadow", "session", role],
      scope: update.sessionKey ? { session: update.sessionKey } : undefined,
      access: update.sessionKey
        ? {
            read: {
              userIds: [update.sessionKey],
            },
          }
        : undefined,
      provenance: {
        source: update.sessionFile,
        timestamp: Date.now(),
        confidence: role === "user" ? 1 : 0.8,
      },
    };

    void service.store(content, metadata).catch(() => {
      // shadow-write failures should not block runtime transcript persistence.
    });
  });

  started = true;
}

export function stopMemoryShadowWrite(): void {
  if (detach) {
    detach();
    detach = undefined;
  }
  started = false;
}

export function isMemoryShadowWriteStarted(): boolean {
  return started;
}
