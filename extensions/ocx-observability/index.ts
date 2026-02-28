/**
 * Observability Plugin
 *
 * OTEL bridge, agent health monitoring, anomaly detection, and reaper policies.
 * Consumes the agent event system and event ledger (not diagnostics events).
 */

import type {
  AgentEventPayload,
  GatewayRequestHandlerOptions,
  OpenClawPluginApi,
} from "openclaw/plugin-sdk";
import { onAgentEvent } from "openclaw/plugin-sdk";
import { resolveConfig } from "./src/config.js";
import { DEFAULT_SUPPRESSION_RULES } from "./src/config.js";
import {
  getAllCurrentHealth,
  getHealthHistory,
  getOrCreateStats,
  resetHealthState,
  startHealthMonitor,
  stopHealthMonitor,
} from "./src/monitor/health-evaluator.js";
import { createSuppressionEngine } from "./src/monitor/suppression.js";
import { type ExporterState, createExporter, shutdownExporter } from "./src/otel/exporter.js";
import { createLogEmitter } from "./src/otel/log-emitter.js";
import { createMetricEmitter } from "./src/otel/metric-emitter.js";
import { createSpanBuilder } from "./src/otel/span-builder.js";
import {
  clearAllTraceContexts,
  generateSpanId,
  generateTraceId,
  setRunTraceContext,
} from "./src/otel/trace-context.js";
import {
  clearAllRestrictions,
  createReaperActionExecutor,
  getThrottleDelay,
  isPaused,
} from "./src/reaper/actions.js";
import { createPolicyEngine } from "./src/reaper/policy-engine.js";

// =============================================================================
// Plugin Definition
//
// NOTE: This plugin uses the object pattern ({ id, name, configSchema, register })
// rather than `export default function register(api)`. Both patterns are valid
// and handled by the plugin loader. The object pattern is intentional here to
// expose configSchema and id/name metadata (same approach as event-ledger).
// =============================================================================

const observabilityPlugin = {
  id: "ocx-observability",
  name: "Observability",
  description: "OTEL bridge, agent health monitoring, anomaly detection, and reaper policies.",
  configSchema: {
    parse(value: unknown) {
      const raw =
        value && typeof value === "object" && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {};
      return resolveConfig(raw);
    },
  },

  register(api: OpenClawPluginApi) {
    const config = resolveConfig((api.pluginConfig as Record<string, unknown>) ?? {});

    let exporterState: ExporterState | undefined;
    let spanBuilder: ReturnType<typeof createSpanBuilder> | undefined;
    let metricEmitter: ReturnType<typeof createMetricEmitter> | undefined;
    let logEmitter: ReturnType<typeof createLogEmitter> | undefined;

    // Suppression engine
    const suppression = createSuppressionEngine(DEFAULT_SUPPRESSION_RULES);

    // Broadcast wrapper (used by reaper actions)
    // The gateway broadcast is only available at runtime via gateway methods,
    // so we use a deferred approach: queue broadcasts until gateway is available.
    let broadcastFn: ((event: string, payload: unknown) => void) | undefined;
    const deferredBroadcast = (event: string, payload: unknown) => {
      if (broadcastFn) {
        broadcastFn(event, payload);
      } else {
        api.logger.warn(`observability: broadcast not available yet for ${event}`);
      }
    };

    // Reaper
    const actionExecutor = createReaperActionExecutor({
      broadcast: deferredBroadcast,
      logger: api.logger,
    });
    const policyEngine = createPolicyEngine(actionExecutor, api.logger);

    // =========================================================================
    // Event Hooks — Bridge agent events to OTEL + health stats
    // =========================================================================

    api.on("before_agent_run", async (_event, ctx) => {
      const agentId = ctx.agentId ?? "unknown";
      if (isPaused(agentId)) {
        return {
          reject: true,
          rejectReason: `Agent ${agentId} is paused by observability reaper policy.`,
          rejectUserMessage: "This agent is temporarily paused by an operator policy.",
        };
      }

      const throttleDelay = getThrottleDelay(agentId);
      if (throttleDelay && throttleDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, throttleDelay));
      }
    });

    // Track run starts for trace context and spans
    api.on("before_agent_start", (event, ctx) => {
      const agentId = ctx.agentId ?? "unknown";
      const runId = ctx.runId ?? ctx.sessionKey ?? agentId;

      // Generate and store trace context
      const traceId = generateTraceId(ctx.sessionId);
      const spanId = generateSpanId();
      setRunTraceContext(runId, { traceId, spanId });

      // Start agent_run span
      spanBuilder?.startAgentRun(runId, {
        "agent.id": agentId,
        "agent.session.key": ctx.sessionKey ?? "",
      });

      // Update stats
      const stats = getOrCreateStats(agentId);
      stats.lastEventAt = Date.now();
      stats.totalRunsInWindow += 1;
    });

    // Track LLM invocations
    api.on("llm_input", (event, ctx) => {
      const agentId = ctx.agentId ?? "unknown";
      const runId = event.runId;

      spanBuilder?.startChildSpan(runId, "llm_call", event.runId, {
        "llm.provider": event.provider,
        "llm.model": event.model,
      });

      // Track model usage for anomaly detection
      const stats = getOrCreateStats(agentId);
      stats.lastEventAt = Date.now();
      stats.modelsUsed.add(event.model);
    });

    // Track LLM output (tokens, cost)
    api.on("llm_output", (event, ctx) => {
      const agentId = ctx.agentId ?? "unknown";
      const runId = event.runId;
      const inputTokens = event.inputTokens ?? event.usage?.input ?? 0;
      const outputTokens = event.outputTokens ?? event.usage?.output ?? 0;

      spanBuilder?.endChildSpan(runId, "llm_call", event.runId, true, {
        "llm.tokens.input": inputTokens,
        "llm.tokens.output": outputTokens,
        ...(event.estimatedCostUsd ? { "llm.cost_usd": event.estimatedCostUsd } : {}),
      });

      metricEmitter?.recordTokens(agentId, inputTokens, outputTokens);
      if (event.estimatedCostUsd) {
        metricEmitter?.recordCost(agentId, event.estimatedCostUsd);
      }

      // Update stats for health evaluation
      const stats = getOrCreateStats(agentId);
      stats.lastEventAt = Date.now();
      stats.totalTokensWindow += inputTokens + outputTokens;
      if (event.estimatedCostUsd) {
        stats.costWindow += event.estimatedCostUsd;
      }
    });

    // Track tool calls
    api.on("before_tool_call", async (event, ctx) => {
      const agentId = ctx.agentId ?? "unknown";
      const runId = ctx.runId ?? ctx.sessionKey ?? agentId;

      if (isPaused(agentId)) {
        return {
          block: true,
          blockReason: `Agent ${agentId} is paused by observability reaper policy.`,
        };
      }

      const throttleDelay = getThrottleDelay(agentId);
      if (throttleDelay && throttleDelay > 0) {
        await new Promise((resolve) => setTimeout(resolve, throttleDelay));
      }

      spanBuilder?.startChildSpan(runId, "tool_call", ctx.toolName, {
        "tool.name": event.toolName,
      });

      metricEmitter?.recordToolCall(agentId, event.toolName);

      const stats = getOrCreateStats(agentId);
      stats.lastEventAt = Date.now();
      const currentCount = stats.toolCallsWindow.get(event.toolName) ?? 0;
      stats.toolCallsWindow.set(event.toolName, currentCount + 1);
    });

    // Track tool results
    api.on("after_tool_call", (event, ctx) => {
      const agentId = ctx.agentId ?? "unknown";
      const runId = ctx.runId ?? ctx.sessionKey ?? agentId;
      const success = !event.error;

      spanBuilder?.endChildSpan(
        runId,
        "tool_call",
        ctx.toolName,
        success,
        event.durationMs ? { "tool.duration_ms": event.durationMs } : undefined,
        event.error,
      );

      if (event.durationMs) {
        metricEmitter?.recordToolDuration(agentId, event.toolName, event.durationMs);
      }

      if (!success) {
        metricEmitter?.recordToolFailure(agentId, event.toolName);

        const stats = getOrCreateStats(agentId);
        stats.consecutiveToolFailures += 1;
        stats.lastEventAt = Date.now();

        logEmitter?.emit({
          eventType: "tool.error",
          agentId,
          message: `Tool "${event.toolName}" failed: ${event.error ?? "unknown"}`,
          attributes: { "tool.name": event.toolName },
        });
      } else {
        const stats = getOrCreateStats(agentId);
        stats.consecutiveToolFailures = 0;
        stats.lastEventAt = Date.now();
      }
    });

    // Track agent run end
    api.on("agent_end", (event, ctx) => {
      const agentId = ctx.agentId ?? "unknown";
      const runId = event.runId ?? ctx.runId ?? ctx.sessionKey ?? agentId;

      spanBuilder?.endAgentRun(runId, event.success, event.durationMs, event.error);

      if (event.durationMs) {
        metricEmitter?.recordRunDuration(agentId, event.durationMs);
      }

      if (!event.success) {
        const stats = getOrCreateStats(agentId);
        stats.errorsInWindow += 1;
        stats.lastEventAt = Date.now();

        logEmitter?.emit({
          eventType: "system.error",
          agentId,
          message: `Agent run failed: ${event.error ?? "unknown"}`,
        });
      }
    });

    // Track messages
    api.on("message_received", (event, ctx) => {
      const agentId = "unknown";
      metricEmitter?.recordMessageReceived(agentId, ctx.channelId);

      logEmitter?.emit({
        eventType: "message.received",
        agentId,
        message: `Message received from ${event.from}`,
        attributes: { "message.channel": ctx.channelId },
      });
    });

    api.on("message_sent", (event, ctx) => {
      const agentId = "unknown";
      metricEmitter?.recordMessageSent(agentId, ctx.channelId);
    });

    // Track sessions
    api.on("session_start", (event, ctx) => {
      const agentId = ctx.agentId ?? "unknown";
      const stats = getOrCreateStats(agentId);
      stats.activeSessions += 1;
      stats.lastEventAt = Date.now();
      stats.lastHeartbeatAt = Date.now();
    });

    api.on("session_end", (event, ctx) => {
      const agentId = ctx.agentId ?? "unknown";
      const stats = getOrCreateStats(agentId);
      stats.activeSessions = Math.max(0, stats.activeSessions - 1);
      stats.lastEventAt = Date.now();
    });

    // Track subagent events
    api.on("subagent_spawned", (event, ctx) => {
      const parentRunId = ctx.requesterSessionKey ?? "unknown";
      spanBuilder?.startChildSpan(parentRunId, "subagent_run", event.runId, {
        "subagent.id": event.agentId,
        "subagent.session.key": event.childSessionKey,
        "subagent.mode": event.mode,
      });
    });

    api.on("subagent_ended", (event, ctx) => {
      const parentRunId = ctx.requesterSessionKey ?? "unknown";
      const runId = ctx.runId ?? event.targetSessionKey;
      const success = event.outcome === "ok";
      spanBuilder?.endChildSpan(
        parentRunId,
        "subagent_run",
        runId,
        success,
        undefined,
        event.error,
      );

      if (!success) {
        logEmitter?.emit({
          eventType: "subagent.ended.failed",
          agentId: event.targetSessionKey,
          message: `Subagent ${event.targetSessionKey} failed: ${event.outcome ?? "unknown"}`,
        });
      }
    });

    // Track model resolution (point-in-time span)
    api.on("before_model_resolve", (event, ctx) => {
      const agentId = ctx.agentId ?? "unknown";
      const runId = ctx.runId ?? ctx.sessionKey ?? agentId;
      const spanId = `model_resolve:${Date.now()}`;

      spanBuilder?.startChildSpan(runId, "model_resolve", spanId, {
        "agent.id": agentId,
      });
      spanBuilder?.endChildSpan(runId, "model_resolve", spanId, true);
    });

    // Track prompt composition (point-in-time span)
    api.on("before_prompt_build", (event, ctx) => {
      const agentId = ctx.agentId ?? "unknown";
      const runId = ctx.runId ?? ctx.sessionKey ?? agentId;
      const spanId = `prompt_compose:${Date.now()}`;

      spanBuilder?.startChildSpan(runId, "prompt_compose", spanId, {
        "agent.id": agentId,
      });
      spanBuilder?.endChildSpan(runId, "prompt_compose", spanId, true);
    });

    // Track session compaction
    api.on("before_compaction", (event, ctx) => {
      const agentId = ctx.agentId ?? "unknown";

      logEmitter?.emit({
        eventType: "session.compaction",
        agentId,
        message: `Session compaction started (${event.messageCount} messages)`,
        attributes: {
          "compaction.message_count": event.messageCount,
          ...(event.tokenCount ? { "compaction.token_count": event.tokenCount } : {}),
        },
      });
    });

    // =========================================================================
    // Cross-Plugin Event Bus — metrics + log records from other plugins
    // =========================================================================

    onAgentEvent((evt: AgentEventPayload) => {
      const { data } = evt;
      const family = typeof data.family === "string" ? data.family : undefined;
      const type = typeof data.type === "string" ? data.type : undefined;
      if (!family || !type) return;

      const agentId =
        (typeof data.agentId === "string" ? data.agentId : undefined) ??
        evt.sessionKey ??
        "unknown";

      // Escalation metric
      if (family === "orchestration" && type === "escalation.raised") {
        metricEmitter?.recordEscalation(agentId);
      }

      // Budget utilization metric
      if (family === "budget" && type === "budget.usage") {
        const utilizationPct =
          typeof data.utilizationPct === "number" ? data.utilizationPct : undefined;
        if (utilizationPct !== undefined) {
          metricEmitter?.updateBudgetUtilization(agentId, utilizationPct);
        }
      }

      // Budget admission blocked -> WARN log record
      if (family === "budget" && type === "budget.admission" && data.decision === "block") {
        logEmitter?.emit({
          eventType: "budget.admission.blocked",
          agentId,
          message: `Budget exhausted for ${typeof data.scope === "string" ? data.scope : agentId}`,
          attributes: {
            "budget.scope": typeof data.scope === "string" ? data.scope : "unknown",
          },
        });
      }

      // Model fallback -> INFO log record
      if (family === "model" && type === "model.fallback") {
        const from = typeof data.from === "string" ? data.from : "unknown";
        const to = typeof data.to === "string" ? data.to : "unknown";
        logEmitter?.emit({
          eventType: "model.fallback",
          agentId,
          message: `Provider fallback: ${from} -> ${to}`,
          attributes: {
            "model.fallback.from": from,
            "model.fallback.to": to,
          },
        });
      }
    });

    // =========================================================================
    // Gateway Methods
    // =========================================================================

    api.registerGatewayMethod(
      "observability.health",
      async ({ respond, context }: GatewayRequestHandlerOptions) => {
        // Capture broadcast function for reaper
        if (!broadcastFn) {
          broadcastFn = context.broadcast;
        }

        const health = getAllCurrentHealth();
        respond(true, { agents: health });
      },
    );

    api.registerGatewayMethod(
      "observability.health.history",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        const agentId = typeof params.agentId === "string" ? params.agentId : undefined;
        const limit = typeof params.limit === "number" ? params.limit : 100;
        const history = getHealthHistory(agentId, limit);
        respond(true, { history });
      },
    );

    api.registerGatewayMethod(
      "observability.anomalies",
      async ({ respond }: GatewayRequestHandlerOptions) => {
        // Return current health signals (anomalies) for all agents
        const health = getAllCurrentHealth();
        const anomalies = health.flatMap((h) =>
          h.signals.map((s) => ({ agentId: h.agentId, ...s })),
        );
        respond(true, { anomalies });
      },
    );

    api.registerGatewayMethod(
      "observability.reaper.policies",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        // If a policy update is provided, apply it
        if (
          params.triggerState &&
          typeof params.triggerState === "string" &&
          params.policy &&
          typeof params.policy === "object"
        ) {
          policyEngine.updatePolicy(
            params.triggerState,
            params.policy as Parameters<typeof policyEngine.updatePolicy>[1],
          );
          respond(true, { updated: true, policies: policyEngine.getPolicies() });
          return;
        }

        respond(true, { policies: policyEngine.getPolicies() });
      },
    );

    api.registerGatewayMethod(
      "observability.reaper.confirm",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        const confirmationId =
          typeof params.confirmationId === "string" ? params.confirmationId : undefined;
        if (!confirmationId) {
          respond(false, { error: "confirmationId required" });
          return;
        }

        const success = await policyEngine.confirmAction(confirmationId);
        respond(success, {
          confirmed: success,
          ...(success ? {} : { error: "confirmation not found or expired" }),
        });
      },
    );

    api.registerGatewayMethod(
      "observability.reaper.history",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        const agentId = typeof params.agentId === "string" ? params.agentId : undefined;
        const limit = typeof params.limit === "number" ? params.limit : 100;
        const history = policyEngine.getHistory(agentId, limit);
        const pending = policyEngine.getPendingConfirmations();
        respond(true, { history, pending });
      },
    );

    // =========================================================================
    // Service Registration
    // =========================================================================

    api.registerService({
      id: "observability-bridge",
      async start() {
        // Start OTEL exporter
        try {
          exporterState = createExporter(config, api.logger);
          spanBuilder = createSpanBuilder(exporterState.tracer, api.logger);
          metricEmitter = createMetricEmitter(exporterState.meter);
          logEmitter = createLogEmitter(exporterState.otelLogger, api.logger);
        } catch (err) {
          api.logger.error(`observability: OTEL exporter failed to start: ${String(err)}`);
          // Continue without OTEL - health monitoring still works
        }

        // Start health monitor
        startHealthMonitor(
          config,
          {
            onStateChange(evaluation) {
              api.logger.info(
                `observability: agent ${evaluation.agentId} health: ${evaluation.previousState ?? "none"} -> ${evaluation.state}`,
              );

              // Emit log record for state change
              logEmitter?.emit({
                eventType: `health.${evaluation.state}`,
                agentId: evaluation.agentId,
                message: `Health state changed to ${evaluation.state}`,
                attributes: {
                  "health.previous": evaluation.previousState ?? "none",
                  "health.signals": evaluation.signals.length,
                },
              });

              // Check suppression before reaper
              const dominated = evaluation.signals.find(
                (s) => s.severity === "critical" || s.severity === "warning",
              );
              if (dominated && !suppression.shouldSuppress(evaluation.agentId, dominated.kind)) {
                suppression.recordAlert(evaluation.agentId, dominated.kind);

                // Run reaper if enabled
                if (config.reaperEnabled) {
                  policyEngine.evaluateAndExecute(evaluation).catch((err) => {
                    api.logger.error(`observability: reaper evaluation failed: ${String(err)}`);
                  });
                }
              }
            },
          },
          api.logger,
        );

        api.logger.info("observability: bridge service started");
      },

      async stop() {
        // Stop health monitor
        stopHealthMonitor();

        // Shutdown spans
        spanBuilder?.shutdown();

        // Flush and stop exporter
        if (exporterState) {
          await shutdownExporter(exporterState, api.logger);
          exporterState = undefined;
        }

        // Clear state
        clearAllTraceContexts();
        clearAllRestrictions();
        suppression.reset();
        policyEngine.reset();
        resetHealthState();

        spanBuilder = undefined;
        metricEmitter = undefined;
        logEmitter = undefined;
        broadcastFn = undefined;

        api.logger.info("observability: bridge service stopped");
      },
    });
  },
};

export default observabilityPlugin;
