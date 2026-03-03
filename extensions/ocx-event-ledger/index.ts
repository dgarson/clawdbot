/**
 * Event Ledger plugin — canonical event capture and query system for
 * agent lifecycle events.
 *
 * Registers:
 *   - Hook listeners (via collector) for all lifecycle events
 *   - Gateway methods: event_ledger.query, event_ledger.run_summary
 *   - Background service: storage flush, run summarization, retention cleanup
 */

import type { GatewayRequestHandlerOptions, OpenClawPluginApi } from "openclaw/plugin-sdk";
import { onAgentEvent } from "openclaw/plugin-sdk";
import type { AgentEventPayload } from "openclaw/plugin-sdk";
import { registerCollector } from "./src/collector.js";
import { parseConfig } from "./src/config.js";
import { queryEvents, getRunSummary } from "./src/query.js";
import { RetentionService } from "./src/retention.js";
import { EventStorage } from "./src/storage.js";
import { RunSummarizer } from "./src/summarizer.js";
import type { EventEnvelope, EventFamily, EventQueryFilter } from "./src/types.js";

// ---------------------------------------------------------------------------
// Config schema (parsed at registration time)
// ---------------------------------------------------------------------------

const configSchema = {
  parse(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as Record<string, unknown>;
  },
  jsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      flushIntervalMs: { type: "number" },
      maxBufferSize: { type: "number" },
      hotRetentionHours: { type: "number" },
      warmRetentionDays: { type: "number" },
      coldRetentionDays: { type: "number" },
      families: { type: "array", items: { type: "string" } },
      excludeFamilies: { type: "array", items: { type: "string" } },
      maxPayloadSize: { type: "number" },
    },
  },
};

// ---------------------------------------------------------------------------
// Plugin definition
// ---------------------------------------------------------------------------

const plugin = {
  id: "event-ledger",
  name: "Event Ledger",
  description: "Canonical event capture and query system for agent lifecycle events.",
  configSchema,

  register(api: OpenClawPluginApi) {
    const rawConfig = configSchema.parse(api.pluginConfig);
    const config = parseConfig(rawConfig);

    // Shared mutable references — populated when the service starts
    let storage: EventStorage | null = null;
    let summarizer: RunSummarizer | null = null;
    let retention: RetentionService | null = null;

    // ------------------------------------------------------------------
    // Gateway method: event_ledger.query
    // ------------------------------------------------------------------
    api.registerGatewayMethod(
      "event_ledger.query",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        if (!storage) {
          respond(false, { error: "Event ledger service not started" });
          return;
        }
        try {
          const filter: EventQueryFilter = {
            family: typeof params.family === "string" ? (params.family as EventFamily) : undefined,
            type: typeof params.type === "string" ? params.type : undefined,
            runId: typeof params.runId === "string" ? params.runId : undefined,
            sessionKey: typeof params.sessionKey === "string" ? params.sessionKey : undefined,
            agentId: typeof params.agentId === "string" ? params.agentId : undefined,
            from: typeof params.from === "string" ? params.from : undefined,
            to: typeof params.to === "string" ? params.to : undefined,
            limit: typeof params.limit === "number" ? params.limit : undefined,
            cursor: typeof params.cursor === "string" ? params.cursor : undefined,
          };
          const result = await queryEvents(storage, filter);
          respond(true, result);
        } catch (err) {
          respond(false, { error: err instanceof Error ? err.message : String(err) });
        }
      },
    );

    // ------------------------------------------------------------------
    // Gateway method: event_ledger.run_summary
    // ------------------------------------------------------------------
    api.registerGatewayMethod(
      "event_ledger.run_summary",
      async ({ params, respond }: GatewayRequestHandlerOptions) => {
        if (!storage) {
          respond(false, { error: "Event ledger service not started" });
          return;
        }
        try {
          const runId = typeof params.runId === "string" ? params.runId : "";
          if (!runId) {
            respond(false, { error: "runId is required" });
            return;
          }
          const summary = await getRunSummary(storage, runId);
          if (!summary) {
            respond(true, { found: false });
            return;
          }
          respond(true, { found: true, summary });
        } catch (err) {
          respond(false, { error: err instanceof Error ? err.message : String(err) });
        }
      },
    );

    // ------------------------------------------------------------------
    // Register hook listeners via the collector
    // ------------------------------------------------------------------
    // The collector calls storage.appendEvent() which buffers writes.
    // We create a "lazy" storage wrapper so the collector can register hooks
    // immediately (hook registration must happen during register()), but
    // actual I/O only starts once the service is started and stateDir is known.
    const pendingStorage = createLazyStorageProxy(api);

    registerCollector(api, pendingStorage.proxy, config);

    // ------------------------------------------------------------------
    // Cross-plugin event bus subscription
    //
    // Other plugins (budget, evaluation, orchestration, etc.) emit events
    // via emitAgentEvent(). We subscribe to the global event bus and
    // convert matching payloads into EventEnvelope records.
    // ------------------------------------------------------------------
    onAgentEvent((evt: AgentEventPayload) => {
      const { data } = evt;
      const family = typeof data.family === "string" ? data.family : undefined;
      const type = typeof data.type === "string" ? data.type : undefined;
      if (!family || !type) return;

      // Validate that the family is a known EventFamily value
      const knownFamilies: ReadonlySet<string> = new Set([
        "model",
        "tool",
        "session",
        "message",
        "subagent",
        "prompt",
        "budget",
        "orchestration",
        "evaluation",
        "system",
      ]);
      if (!knownFamilies.has(family)) return;

      // Apply family include/exclude filtering
      const castFamily = family as EventFamily;
      if (config.excludeFamilies.length > 0 && config.excludeFamilies.includes(castFamily)) return;
      if (config.families.length > 0 && !config.families.includes(castFamily)) return;

      const envelope: EventEnvelope = {
        eventId: `${Date.now()}-bus-${evt.seq}`,
        ts: new Date(evt.ts).toISOString(),
        version: 1,
        family: castFamily,
        type,
        runId: evt.runId,
        ...(evt.lineageId ? { lineageId: evt.lineageId } : {}),
        ...(evt.sessionKey ? { sessionKey: evt.sessionKey } : {}),
        ...(evt.traceId ? { traceId: evt.traceId } : {}),
        ...(evt.spanId ? { spanId: evt.spanId } : {}),
        data: { ...data, family: undefined, type: undefined },
      };

      pendingStorage.proxy.appendEvent(envelope);
    });

    // ------------------------------------------------------------------
    // Background service
    // ------------------------------------------------------------------
    api.registerService({
      id: "event-ledger",
      start(ctx) {
        storage = new EventStorage(ctx.stateDir, config, ctx.logger);
        storage.start();

        // Wire up the lazy proxy so collector events reach the real storage
        pendingStorage.bind(storage);

        summarizer = new RunSummarizer(storage, ctx.logger);
        summarizer.start();

        retention = new RetentionService(storage, config, ctx.logger);
        retention.start();

        ctx.logger.info("[event-ledger] Service started");
      },
      stop(ctx) {
        retention?.stop();
        summarizer?.stop();
        storage?.close();
        storage = null;
        ctx.logger.info("[event-ledger] Service stopped");
      },
    });
  },
};

export default plugin;

// ---------------------------------------------------------------------------
// Lazy storage proxy
//
// Hook handlers are registered during register(), but the EventStorage
// instance isn't available until the service starts (when stateDir is known).
// This proxy buffers appendEvent calls and replays them once bound.
// ---------------------------------------------------------------------------

type LazyStorageHandle = {
  proxy: EventStorage;
  bind: (real: EventStorage) => void;
};

function createLazyStorageProxy(api: OpenClawPluginApi): LazyStorageHandle {
  let real: EventStorage | null = null;
  const pending: Parameters<EventStorage["appendEvent"]>[] = [];

  // Minimal duck-typed object that satisfies the collector's usage.
  // The collector only calls appendEvent() on the storage.
  const proxy = {
    appendEvent(...args: Parameters<EventStorage["appendEvent"]>): void {
      if (real) {
        real.appendEvent(...args);
      } else {
        pending.push(args);
      }
    },
  } as EventStorage;

  return {
    proxy,
    bind(target: EventStorage) {
      real = target;
      // Replay any events captured before the service started
      for (const args of pending) {
        real.appendEvent(...args);
      }
      pending.length = 0;
      if (pending.length === 0 && api.logger.debug) {
        api.logger.debug("[event-ledger] Lazy proxy bound; pending events replayed");
      }
    },
  };
}
