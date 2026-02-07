import type { OpenClawConfig } from "openclaw/plugin-sdk";
import crypto from "node:crypto";
import path from "node:path";
import type { MeridiaExperienceRecord, MeridiaTraceEvent } from "../../src/meridia/types.js";
import { resolveMeridiaPluginConfig } from "../../src/meridia/config.js";
import { createBackend } from "../../src/meridia/db/index.js";
import {
  type HookEvent,
  asObject,
  resolveHookConfig,
  safeFileKey,
  nowIso,
  resolveSessionIdFromEntry,
  readPositiveNumber,
} from "../../src/meridia/event.js";
import { fanoutBatchToGraph } from "../../src/meridia/fanout.js";
import { resolveMeridiaDir, dateKeyUtc } from "../../src/meridia/paths.js";
import {
  appendJsonl,
  readJsonIfExists,
  resolveTraceJsonlPath,
  writeJson,
} from "../../src/meridia/storage.js";

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

const handler = async (event: HookEvent): Promise<void> => {
  if (event.type !== "command") {
    return;
  }
  if (event.action !== "new" && event.action !== "stop") {
    return;
  }

  const context = asObject(event.context) ?? {};
  const cfg = (context.cfg as OpenClawConfig | undefined) ?? undefined;
  const hookCfg = resolveHookConfig(cfg, "session-end");
  if (hookCfg?.enabled !== true) {
    return;
  }

  const sessionKey = typeof context.sessionKey === "string" ? context.sessionKey : event.sessionKey;
  const sessionId =
    (typeof context.sessionId === "string" && context.sessionId.trim()
      ? context.sessionId.trim()
      : undefined) ??
    resolveSessionIdFromEntry(context.previousSessionEntry) ??
    resolveSessionIdFromEntry(context.sessionEntry);
  const runId = typeof context.runId === "string" ? context.runId : undefined;

  const meridiaDir = resolveMeridiaDir(cfg, "session-end");
  const dateKey = dateKeyUtc(event.timestamp);
  const ts = nowIso();
  const tracePath = resolveTraceJsonlPath({ meridiaDir, date: event.timestamp });
  const writeTraceJsonl = resolveMeridiaPluginConfig(cfg).debug.writeTraceJsonl;

  const bufferKey = safeFileKey(sessionId ?? sessionKey ?? event.sessionKey ?? "unknown");
  const bufferPath = path.join(meridiaDir, "buffers", `${bufferKey}.json`);
  const buffer = await readJsonIfExists<BufferV1>(bufferPath);

  const summaryDir = path.join(meridiaDir, "sessions", dateKey);
  const summaryPath = path.join(
    summaryDir,
    `${ts.replaceAll(":", "-")}-${sessionId ?? "unknown"}.json`,
  );
  // ── Session summary construction ─────────────────────────────────────
  const toolCount = buffer?.toolResultsSeen ?? 0;
  const capturedCount = buffer?.captured ?? 0;
  const recentCaptures = buffer?.recentCaptures ?? [];
  const recentEvaluations = buffer?.recentEvaluations ?? [];
  const lastError = buffer?.lastError;

  // Naive session-level relevance scoring (0..1):
  // - More captures => more important
  // - Errors are important (debugging context)
  // - Lots of tool activity with no captures is usually low value
  const baseScore = Math.min(1, capturedCount / 5);
  const errorBoost = lastError ? 0.2 : 0;
  const activityBoost = Math.min(0.2, toolCount / 100);
  const sessionScore = Math.max(0, Math.min(1, baseScore + errorBoost + activityBoost));

  const minSessionThreshold = readPositiveNumber(
    hookCfg,
    ["min_session_significance_threshold", "minSessionSignificanceThreshold"],
    0.55,
  );

  const toolsUsed = Array.from(
    new Set(
      [
        ...recentEvaluations.map((e) => e.toolName),
        ...recentCaptures.map((c) => c.toolName),
        lastError?.toolName,
      ].filter(Boolean),
    ),
  ) as string[];

  const topCaptures = recentCaptures
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  const summaryTextLines: string[] = [];
  summaryTextLines.push(`Session ${event.action} summary`);
  if (sessionId) summaryTextLines.push(`- sessionId: ${sessionId}`);
  if (sessionKey) summaryTextLines.push(`- sessionKey: ${sessionKey}`);
  if (runId) summaryTextLines.push(`- runId: ${runId}`);
  summaryTextLines.push(`- toolResultsSeen: ${toolCount}`);
  summaryTextLines.push(`- captured: ${capturedCount}`);
  summaryTextLines.push(
    `- relevanceScore: ${sessionScore.toFixed(2)} (threshold ${minSessionThreshold})`,
  );
  if (toolsUsed.length) summaryTextLines.push(`- toolsUsed: ${toolsUsed.join(", ")}`);

  if (lastError) {
    summaryTextLines.push(`- lastError: ${lastError.toolName}: ${lastError.message}`);
  }

  if (topCaptures.length) {
    summaryTextLines.push("- topCaptures:");
    for (const c of topCaptures) {
      summaryTextLines.push(`  - ${c.toolName} score=${c.score.toFixed(2)} recordId=${c.recordId}`);
    }
  }

  const summaryText = summaryTextLines.join("\n");

  const summary = {
    ts,
    action: event.action,
    sessionId,
    sessionKey,
    runId,
    score: sessionScore,
    threshold: minSessionThreshold,
    toolsUsed,
    toolCount,
    capturedCount,
    lastError,
    topCaptures,
    buffer,
    summaryText,
  };
  await writeJson(summaryPath, summary);

  const recordId = crypto.randomUUID();
  const record: MeridiaExperienceRecord = {
    id: recordId,
    ts,
    kind: "session_end",
    session: { id: sessionId, key: sessionKey, runId },
    tool: {
      name: `command:${event.action}`,
      callId: `session-${event.action}-${recordId.slice(0, 8)}`,
      isError: false,
    },
    capture: {
      score: sessionScore,
      evaluation: {
        kind: "heuristic",
        score: sessionScore,
        reason: "session_end_summary",
      },
    },
    content: {
      summary: summaryText,
      tags: ["meridia", "session", "summary"],
      topic: sessionId ? `session:${sessionId}:summary` : "session:unknown:summary",
    },
    data: { summary },
  };

  const traceEvent: MeridiaTraceEvent = {
    id: crypto.randomUUID(),
    ts,
    kind: "session_end_summary",
    session: { id: sessionId, key: sessionKey, runId },
    paths: { summaryPath },
    decision: {
      decision: sessionScore >= minSessionThreshold ? "capture" : "skip",
      score: sessionScore,
      threshold: minSessionThreshold,
      recordId,
    },
  };

  try {
    const backend = createBackend({ cfg, hookKey: "session-end" });
    backend.insertExperienceRecord(record);
    backend.insertTraceEvent(traceEvent);
  } catch {
    // ignore
  }

  if (writeTraceJsonl) {
    await appendJsonl(tracePath, traceEvent);
  }

  // ── Graphiti integration (best-effort) ───────────────────────────────
  if (cfg && sessionId && sessionScore >= minSessionThreshold) {
    await fanoutBatchToGraph(
      [
        {
          id: `session:${sessionId}:summary`,
          text: summaryText,
          tags: ["meridia", "session", "summary"],
          ts,
          metadata: {
            kind: "meridia-session-summary",
            sessionId,
            sessionKey,
            runId,
            action: event.action,
            score: sessionScore,
            toolCount,
            capturedCount,
            toolsUsed,
            lastError,
          },
          timeRange:
            buffer?.createdAt && buffer?.updatedAt
              ? { from: buffer.createdAt, to: buffer.updatedAt }
              : undefined,
        },
      ],
      cfg,
      "meridia-sessions",
    );
  }
};

export default handler;
