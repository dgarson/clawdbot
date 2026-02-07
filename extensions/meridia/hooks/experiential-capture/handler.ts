import type { OpenClawConfig } from "openclaw/plugin-sdk";
import crypto from "node:crypto";
import path from "node:path";
import type {
  MeridiaExperienceRecord,
  MeridiaToolResultContext,
  MeridiaTraceEvent,
} from "../../src/meridia/types.js";
import { createBackend } from "../../src/meridia/db/index.js";
import { evaluateHeuristic, evaluateWithLlm } from "../../src/meridia/evaluate.js";
import { resolveMeridiaDir } from "../../src/meridia/paths.js";
import { resolveMeridiaPluginConfig } from "../../src/meridia/config.js";
import {
  appendJsonl,
  resolveTraceJsonlPath,
  writeJson,
  readJsonIfExists,
} from "../../src/meridia/storage.js";

type HookEvent = {
  type: string;
  action: string;
  timestamp: Date;
  sessionKey?: string;
  context?: unknown;
};

type LimitedInfo = { reason: "min_interval" | "max_per_hour"; detail?: string };

type BufferV1 = {
  version: 1;
  sessionId?: string;
  sessionKey?: string;
  createdAt: string;
  updatedAt: string;
  toolResultsSeen: number;
  captured: number;
  lastSeenAt?: string;
  lastCapturedAt?: string;
  recentCaptures: Array<{ ts: string; toolName: string; score: number; recordId: string }>;
  recentEvaluations: Array<{
    ts: string;
    toolName: string;
    score: number;
    recommendation: "capture" | "skip";
    reason?: string;
  }>;
  lastError?: { ts: string; toolName: string; message: string };
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function readNumber(
  cfg: Record<string, unknown> | undefined,
  keys: string[],
  fallback: number,
): number {
  for (const key of keys) {
    const value = cfg?.[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }
  for (const key of keys) {
    const value = cfg?.[key];
    if (typeof value === "string") {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return fallback;
}

function readString(cfg: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  for (const key of keys) {
    const raw = cfg?.[key];
    if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return undefined;
}

function safeFileKey(raw: string): string {
  return raw.trim().replace(/[^a-zA-Z0-9._-]+/g, "_");
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureBuffer(seed: Partial<BufferV1>): BufferV1 {
  const now = nowIso();
  return {
    version: 1,
    sessionId: seed.sessionId,
    sessionKey: seed.sessionKey,
    createdAt: seed.createdAt ?? now,
    updatedAt: now,
    toolResultsSeen: seed.toolResultsSeen ?? 0,
    captured: seed.captured ?? 0,
    lastSeenAt: seed.lastSeenAt,
    lastCapturedAt: seed.lastCapturedAt,
    recentCaptures: seed.recentCaptures ?? [],
    recentEvaluations: seed.recentEvaluations ?? [],
    lastError: seed.lastError,
  };
}

function pruneOld(buffer: BufferV1, nowMs: number): BufferV1 {
  const hourAgo = nowMs - 60 * 60 * 1000;
  const recentCaptures = buffer.recentCaptures.filter((c) => Date.parse(c.ts) >= hourAgo);
  const recentEvaluations = buffer.recentEvaluations.slice(-50);
  return { ...buffer, recentCaptures, recentEvaluations };
}

function resolveHookConfig(
  cfg: OpenClawConfig | undefined,
  hookKey: string,
): Record<string, unknown> | undefined {
  const entry = cfg?.hooks?.internal?.entries?.[hookKey] as Record<string, unknown> | undefined;
  return entry && typeof entry === "object" ? entry : undefined;
}

function resolveSessionContext(event: HookEvent, context: Record<string, unknown>) {
  const sessionId = typeof context.sessionId === "string" ? context.sessionId : undefined;
  const sessionKey = typeof context.sessionKey === "string" ? context.sessionKey : event.sessionKey;
  const runId = typeof context.runId === "string" ? context.runId : undefined;
  return { sessionId, sessionKey, runId };
}

function resolveBufferPath(
  meridiaDir: string,
  sessionId?: string,
  sessionKey?: string,
  eventSessionKey?: string,
) {
  const bufferKey = safeFileKey(sessionId ?? sessionKey ?? eventSessionKey ?? "unknown");
  return path.join(meridiaDir, "buffers", `${bufferKey}.json`);
}

async function loadBuffer(
  bufferPath: string,
  sessionId?: string,
  sessionKey?: string,
): Promise<BufferV1> {
  const existing = await readJsonIfExists<BufferV1>(bufferPath);
  return ensureBuffer(existing ?? { sessionId, sessionKey });
}

const handler = async (event: HookEvent): Promise<void> => {
  if (event.type !== "agent" || event.action !== "tool:result") {
    return;
  }

  const context = asObject(event.context) ?? {};
  const cfg = (context.cfg as OpenClawConfig | undefined) ?? undefined;
  const hookCfg = resolveHookConfig(cfg, "experiential-capture");
  if (hookCfg?.enabled !== true) {
    return;
  }

  const toolName = typeof context.toolName === "string" ? context.toolName : "";
  const toolCallId = typeof context.toolCallId === "string" ? context.toolCallId : "";
  if (!toolName || !toolCallId) {
    return;
  }

  const { sessionId, sessionKey, runId } = resolveSessionContext(event, context);
  const meta = typeof context.meta === "string" ? context.meta : undefined;
  const isError = Boolean(context.isError);
  const args = context.args;
  const result = context.result;

  const meridiaDir = resolveMeridiaDir(cfg, "experiential-capture");
  const tracePath = resolveTraceJsonlPath({ meridiaDir, date: event.timestamp });
  const bufferPath = resolveBufferPath(meridiaDir, sessionId, sessionKey, event.sessionKey);
  const now = nowIso();
  const nowMs = Date.now();
  const writeTraceJsonl = resolveMeridiaPluginConfig(cfg).debug.writeTraceJsonl;

  const minThreshold = readNumber(
    hookCfg,
    ["min_significance_threshold", "minSignificanceThreshold", "threshold"],
    0.6,
  );
  const maxPerHour = readNumber(hookCfg, ["max_captures_per_hour", "maxCapturesPerHour"], 10);
  const minIntervalMs = readNumber(hookCfg, ["min_interval_ms", "minIntervalMs"], 5 * 60 * 1000);
  const evaluationTimeoutMs = readNumber(
    hookCfg,
    ["evaluation_timeout_ms", "evaluationTimeoutMs"],
    3500,
  );
  const evaluationModel =
    readString(hookCfg, ["evaluation_model", "evaluationModel", "model"]) ?? "";

  const ctx: MeridiaToolResultContext = {
    session: { id: sessionId, key: sessionKey, runId },
    tool: { name: toolName, callId: toolCallId, meta, isError },
    args,
    result,
  };

  let buffer = await loadBuffer(bufferPath, sessionId, sessionKey);
  buffer = pruneOld(buffer, nowMs);
  buffer.toolResultsSeen += 1;
  buffer.lastSeenAt = now;
  buffer.updatedAt = now;

  const limited: LimitedInfo | undefined = (() => {
    if (buffer.lastCapturedAt) {
      const last = Date.parse(buffer.lastCapturedAt);
      if (Number.isFinite(last) && nowMs - last < minIntervalMs) {
        return { reason: "min_interval" };
      }
    }
    if (buffer.recentCaptures.length >= maxPerHour) {
      return { reason: "max_per_hour", detail: `${buffer.recentCaptures.length}/${maxPerHour}` };
    }
    return undefined;
  })();

  let evaluation = evaluateHeuristic(ctx);
  if (cfg && evaluationModel) {
    try {
      evaluation = await evaluateWithLlm({
        cfg,
        ctx,
        modelRef: evaluationModel,
        timeoutMs: evaluationTimeoutMs,
      });
    } catch (err) {
      evaluation = {
        ...evaluation,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const shouldCapture = !limited && evaluation.score >= minThreshold;

  buffer.recentEvaluations.push({
    ts: now,
    toolName,
    score: evaluation.score,
    recommendation: shouldCapture ? "capture" : "skip",
    reason: evaluation.reason,
  });
  if (buffer.recentEvaluations.length > 50) {
    buffer.recentEvaluations.splice(0, buffer.recentEvaluations.length - 50);
  }

  let recordId: string | undefined;
  if (shouldCapture) {
    recordId = crypto.randomUUID();
    const record: MeridiaExperienceRecord = {
      id: recordId,
      ts: now,
      kind: "tool_result",
      session: { id: sessionId, key: sessionKey, runId },
      tool: { name: toolName, callId: toolCallId, meta, isError },
      capture: {
        score: evaluation.score,
        threshold: minThreshold,
        evaluation,
      },
      content: {
        summary: evaluation.reason,
      },
      data: { args, result },
    };

    try {
      const backend = createBackend({ cfg, hookKey: "experiential-capture" });
      backend.insertExperienceRecord(record);
    } catch {
      // ignore
    }

    buffer.captured += 1;
    buffer.lastCapturedAt = now;
    buffer.recentCaptures.push({ ts: now, toolName, score: evaluation.score, recordId });
    buffer = pruneOld(buffer, nowMs);
  }

  const traceEvent: MeridiaTraceEvent = {
    id: crypto.randomUUID(),
    ts: now,
    kind: "tool_result_eval",
    session: { id: sessionId, key: sessionKey, runId },
    tool: { name: toolName, callId: toolCallId, meta, isError },
    decision: {
      decision: shouldCapture ? "capture" : limited ? "skip" : evaluation.error ? "error" : "skip",
      score: evaluation.score,
      threshold: minThreshold,
      limited,
      evaluation,
      recordId,
      error: evaluation.error,
    },
  };
  try {
    const backend = createBackend({ cfg, hookKey: "experiential-capture" });
    backend.insertTraceEvent(traceEvent);
  } catch {
    // ignore
  }
  if (writeTraceJsonl) {
    await appendJsonl(tracePath, traceEvent);
  }
  await writeJson(bufferPath, buffer);
};

export default handler;
