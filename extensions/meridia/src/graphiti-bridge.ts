import type { OpenClawConfig } from "openclaw/plugin-sdk";
import crypto from "node:crypto";
import type { MemoryContentObject } from "../../../src/memory/types.js";
import type { MeridiaExperienceRecord } from "./meridia/types.js";

export type GraphitiBridgeConfig = {
  enabled: boolean;
  batchSize: number;
  batchIntervalMs: number;
  groupId?: string;
};

export function resolveGraphitiBridgeConfig(
  _cfg: OpenClawConfig | undefined,
  hookCfg?: Record<string, unknown>,
): GraphitiBridgeConfig {
  const readBoolean = (
    obj: Record<string, unknown> | undefined,
    path: string[],
    fallback: boolean,
  ) => {
    let cur: unknown = obj;
    for (const key of path) {
      if (!cur || typeof cur !== "object") return fallback;
      cur = (cur as Record<string, unknown>)[key];
    }
    return typeof cur === "boolean" ? cur : fallback;
  };

  const readNumber = (
    obj: Record<string, unknown> | undefined,
    path: string[],
    fallback: number,
  ): number => {
    let cur: unknown = obj;
    for (const key of path) {
      if (!cur || typeof cur !== "object") return fallback;
      cur = (cur as Record<string, unknown>)[key];
    }
    return typeof cur === "number" && Number.isFinite(cur) ? cur : fallback;
  };

  const readString = (
    obj: Record<string, unknown> | undefined,
    path: string[],
  ): string | undefined => {
    let cur: unknown = obj;
    for (const key of path) {
      if (!cur || typeof cur !== "object") return undefined;
      cur = (cur as Record<string, unknown>)[key];
    }
    return typeof cur === "string" && cur.trim() ? cur.trim() : undefined;
  };

  const enabled = readBoolean(hookCfg, ["graphiti", "mcp", "enabled"], false);
  const batchSize = Math.max(1, Math.floor(readNumber(hookCfg, ["graphiti", "batch", "size"], 10)));
  const batchIntervalMs = Math.max(
    250,
    Math.floor(readNumber(hookCfg, ["graphiti", "batch", "intervalMs"], 5_000)),
  );

  const groupId = readString(hookCfg, ["graphiti", "groupId"]);

  return { enabled, batchSize, batchIntervalMs, groupId };
}

export function experienceToEpisode(
  record: MeridiaExperienceRecord,
  opts?: { source?: string; groupId?: string },
): MemoryContentObject {
  const topic = record.content?.topic;
  const summary = record.content?.summary;
  const context = record.content?.context;

  const text = [topic, summary, context].filter(Boolean).join("\n\n");

  return {
    id: record.id,
    kind: "event",
    text,
    tags: record.content?.tags,
    provenance: {
      source: opts?.source ?? `meridia.${record.kind}`,
      sessionKey: record.session?.key,
      runId: record.session?.runId,
      temporal: {
        observedAt: record.ts,
        updatedAt: record.ts,
      },
      ...(opts?.groupId ? { citations: [opts.groupId] } : {}),
    },
    metadata: {
      meridiaKind: record.kind,
      toolName: record.tool?.name,
      toolCallId: record.tool?.callId,
      score: record.capture?.score,
      ...(opts?.groupId ? { groupId: opts.groupId } : {}),
    },
  };
}

export async function addToGraphMemory(args: {
  cfg: OpenClawConfig | undefined;
  records: MeridiaExperienceRecord[];
  traceId?: string;
  groupId?: string;
  source?: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!args.cfg?.memory?.graphiti?.enabled) {
    return { ok: false, error: "Graphiti REST backend not enabled" };
  }

  try {
    const { GraphitiClient } = await import("../../../src/memory/graphiti/client.js");

    const client = new GraphitiClient({
      serverHost: args.cfg.memory.graphiti.serverHost,
      servicePort: args.cfg.memory.graphiti.servicePort,
      apiKey: args.cfg.memory.graphiti.apiKey,
      timeoutMs: args.cfg.memory.graphiti.timeoutMs ?? 30_000,
    });

    const episodes = args.records.map((r) =>
      experienceToEpisode(r, { source: args.source, groupId: args.groupId }),
    );

    const res = await client.ingestEpisodes({
      episodes,
      traceId: args.traceId ?? `meridia-graphiti-${crypto.randomUUID().slice(0, 8)}`,
    });

    return res.ok ? { ok: true } : { ok: false, error: res.error ?? "Unknown Graphiti error" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function createGraphitiBatcher(args: {
  flush: (records: MeridiaExperienceRecord[]) => Promise<void>;
  batchSize: number;
  batchIntervalMs: number;
}) {
  let queue: MeridiaExperienceRecord[] = [];
  let timer: NodeJS.Timeout | undefined;
  let flushing = false;

  const schedule = () => {
    if (timer) return;
    timer = setTimeout(() => {
      timer = undefined;
      void maybeFlush();
    }, args.batchIntervalMs);
  };

  const maybeFlush = async () => {
    if (flushing) return;
    if (queue.length === 0) return;

    flushing = true;
    try {
      const batch = queue.slice(0, args.batchSize);
      queue = queue.slice(batch.length);
      await args.flush(batch);
    } finally {
      flushing = false;
      if (queue.length > 0) schedule();
    }
  };

  return {
    push(record: MeridiaExperienceRecord) {
      queue.push(record);
      if (queue.length >= args.batchSize) {
        void maybeFlush();
        return;
      }
      schedule();
    },
    async flushNow() {
      while (queue.length > 0) {
        await maybeFlush();
      }
    },
  };
}
