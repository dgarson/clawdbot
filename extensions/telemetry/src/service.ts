import node_fs from "node:fs";
import node_os from "node:os";
import node_path from "node:path";
import type { OpenClawPluginApi, OpenClawPluginService, OpenClawPluginServiceContext } from "openclaw/plugin-sdk";
import type { TelemetryConfig } from "./types.js";
import type { Indexer } from "./indexer.js";
import { BlobWriter } from "./blob-writer.js";
import { registerCollector } from "./collector.js";
import { createIndexer } from "./indexer.js";
import { generateEventId } from "./helpers.js";
import { enforceRetention } from "./retention.js";
import { registerTelemetryCli } from "./cli.js";
import { registerTelemetryRoutes } from "./routes.js";
import { createJsonlWriter } from "./writer.js";

/**
 * Resolve the telemetry data directory.
 *
 * Priority:
 *  1. `dataDir` from plugin config (overrides everything; ~ is expanded)
 *  2. `<stateDir>/telemetry/`  (alongside ~/.openclaw config)
 */
function resolveTelemetryDir(
  ctx: OpenClawPluginServiceContext,
  cfg: TelemetryConfig,
): string {
  if (cfg.dataDir) {
    return cfg.dataDir.replace(/^~/, node_os.homedir());
  }
  return node_path.join(ctx.stateDir, "telemetry");
}

/**
 * Create the telemetry collector service.
 *
 * The service:
 *  1. On start — resolves the telemetry directory, opens the JSONL writer,
 *     creates the blob writer, opens the SQLite indexer, runs JSONL catch-up,
 *     runs retention, and registers all hook handlers, CLI commands, and HTTP routes.
 *  2. On stop — unsubscribes diagnostic events, closes the JSONL writer, and
 *     closes the SQLite database.
 */
export function createTelemetryService(api: OpenClawPluginApi): OpenClawPluginService {
  let unsubDiag: (() => void) | null = null;
  let writerClose: (() => Promise<void>) | null = null;
  let indexer: Indexer | null = null;

  // Register CLI and HTTP routes during plugin registration (before service starts).
  // The indexer reference is resolved at call time via a closure.
  registerTelemetryCli(api, () => indexer);
  registerTelemetryRoutes(api, () => indexer);

  return {
    id: "telemetry-collector",

    async start(ctx: OpenClawPluginServiceContext) {
      const cfg = (api.pluginConfig ?? {}) as TelemetryConfig;

      if (cfg.enabled === false) {
        return;
      }

      const telemetryDir = resolveTelemetryDir(ctx, cfg);

      // Ensure directories exist
      node_fs.mkdirSync(telemetryDir, { recursive: true });

      const jsonlPath = node_path.join(telemetryDir, "events.jsonl");
      const dbPath = node_path.join(telemetryDir, "telemetry.db");

      // Open JSONL writer
      const { write: writeJsonl, close } = createJsonlWriter(telemetryDir, cfg);
      writerClose = close;

      // Open blob writer
      const blobWriter = new BlobWriter(telemetryDir);
      blobWriter.ensureDir();

      // Enforce retention policy on start (best-effort, non-blocking)
      try {
        enforceRetention(telemetryDir, cfg);
      } catch {
        // Retention failures should not prevent the plugin from starting.
      }

      // Open SQLite indexer (best-effort — don't crash the plugin if unavailable)
      try {
        indexer = await createIndexer(dbPath, jsonlPath);
        // Catch up from JSONL on startup
        indexer.catchUp();
      } catch (err) {
        ctx.logger.warn(
          `telemetry: SQLite indexer unavailable (${String(err)}). ` +
            "JSONL capture will continue but query commands will not work.",
        );
        indexer = null;
      }

      // Dual-write: JSONL + SQLite index in real time
      const write = (partial: Parameters<typeof writeJsonl>[0]) => {
        writeJsonl(partial);
        // Index synchronously — better-sqlite3 is synchronous by design
        if (indexer) {
          // We need the full event as written by the JSONL writer.
          // Re-parse approach: the writer assigned id/ts/seq so we call write
          // and also capture. Simplest approach: build the event here too.
          // The JSONL writer does this internally; we duplicate the minimal
          // fields needed for indexEvent.
          // NOTE: This is a best-effort in-process index; catch-up on restart
          // handles any gaps from crashes.
          try {
            const event = {
              id: generateEventId(),
              ts: Date.now(),
              seq: 0,
              agentId: partial.agentId ?? "unknown",
              sessionKey: partial.sessionKey ?? "unknown",
              sessionId: partial.sessionId ?? "unknown",
              runId: partial.runId,
              kind: partial.kind,
              stream: partial.stream,
              data: partial.data ?? {},
              error: partial.error,
              source: partial.source ?? "hook",
              hookName: partial.hookName,
              blobRefs: partial.blobRefs,
            };
            indexer.indexEvent(event);
          } catch {
            // In-memory indexing failure is non-fatal; catch-up handles it.
          }
        }
      };

      // Register all hooks and diagnostic event subscribers
      unsubDiag = registerCollector(api, write, blobWriter);
    },

    async stop(_ctx: OpenClawPluginServiceContext) {
      unsubDiag?.();
      unsubDiag = null;

      if (writerClose) {
        await writerClose();
        writerClose = null;
      }

      if (indexer) {
        indexer.close();
        indexer = null;
      }
    },
  } satisfies OpenClawPluginService;
}
