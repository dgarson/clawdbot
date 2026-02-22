/**
 * Telemetry Hooks — captures lifecycle events and emits telemetry.
 *
 * Hooks into:
 *   - session_start: agent session begins
 *   - session_end: agent session completes
 *   - agent_end: agent run finishes (includes success/failure + duration)
 *   - model.usage: token consumption per model call (via diagnostic events)
 */

import { randomUUID } from "node:crypto";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { onDiagnosticEvent } from "openclaw/plugin-sdk";
import type { DiagnosticEventPayload } from "openclaw/plugin-sdk";
import type { TelemetrySink } from "./sink.js";
import type { TelemetryEvent } from "./types.js";

/** Infer session kind from the session key format */
function inferSessionKind(sessionKey?: string): TelemetryEvent["sessionKind"] {
  if (!sessionKey) return "unknown";
  if (sessionKey.includes(":cron:")) return "cron";
  if (sessionKey.includes(":subagent:")) return "subagent";
  if (sessionKey.includes(":heartbeat:")) return "heartbeat";
  if (sessionKey.includes(":direct:")) return "direct";
  return "unknown";
}

/** Extract agent ID from a session key like "agent:xavier:cron:..." */
function extractAgentId(sessionKey?: string): string {
  if (!sessionKey) return "unknown";
  const parts = sessionKey.split(":");
  // Format: agent:<agentId>:<kind>:<id>
  return parts[1] ?? "unknown";
}

function buildBaseEvent(
  eventType: TelemetryEvent["eventType"],
  agentId: string,
  sessionKey: string,
): TelemetryEvent {
  return {
    eventId: randomUUID(),
    timestamp: new Date().toISOString(),
    agentId,
    sessionKey,
    sessionKind: inferSessionKind(sessionKey),
    eventType,
  };
}

export function registerHooks(api: OpenClawPluginApi, sink: TelemetrySink): () => void {
  const logger = { error: (msg: string) => console.error(`[telemetry] ${msg}`) };

  // ── session_start hook ─────────────────────────────────────────────
  api.on("session_start", (event, ctx) => {
    const telEvent = buildBaseEvent("session_start", ctx.agentId ?? "unknown", ctx.sessionId ?? "");
    sink.write(telEvent).catch((err) => {
      logger.error(`session_start write failed: ${err}`);
    });
  });

  // ── session_end hook ───────────────────────────────────────────────
  api.on("session_end", (event, ctx) => {
    const telEvent = buildBaseEvent("session_end", ctx.agentId ?? "unknown", ctx.sessionId ?? "");
    telEvent.durationMs = event.durationMs;
    telEvent.messageCount = event.messageCount;
    sink.write(telEvent).catch((err) => {
      logger.error(`session_end write failed: ${err}`);
    });
  });

  // ── agent_end hook ─────────────────────────────────────────────────
  api.on("agent_end", (event, ctx) => {
    const telEvent = buildBaseEvent(
      "agent_end",
      ctx.agentId ?? "unknown",
      ctx.sessionKey ?? ctx.sessionId ?? "",
    );
    telEvent.status = event.success ? "success" : "error";
    telEvent.durationMs = event.durationMs;
    telEvent.errorMessage = event.error;
    sink.write(telEvent).catch((err) => {
      logger.error(`agent_end write failed: ${err}`);
    });
  });

  // ── model.usage via diagnostic events ──────────────────────────────
  const unsubDiag = onDiagnosticEvent((evt: DiagnosticEventPayload) => {
    if (evt.type !== "model.usage") return;

    const telEvent = buildBaseEvent(
      "model_usage",
      extractAgentId(evt.sessionKey),
      evt.sessionKey ?? "",
    );
    telEvent.model = evt.model;
    telEvent.provider = evt.provider;
    telEvent.channel = evt.channel;
    telEvent.inputTokens = evt.usage.input;
    telEvent.outputTokens = evt.usage.output;
    telEvent.cacheReadTokens = evt.usage.cacheRead;
    telEvent.cacheWriteTokens = evt.usage.cacheWrite;
    telEvent.totalTokens = evt.usage.total;
    telEvent.estimatedCostUsd = evt.costUsd;
    telEvent.durationMs = evt.durationMs;

    sink.write(telEvent).catch((err) => {
      logger.error(`model_usage write failed: ${err}`);
    });
  });

  return () => {
    unsubDiag();
  };
}
