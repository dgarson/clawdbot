import node_fs from "node:fs";
import node_os from "node:os";
import node_path from "node:path";
import type { OpenClawPluginApi, OpenClawPluginService, OpenClawPluginServiceContext } from "openclaw/plugin-sdk";
import type { TelemetryConfig } from "./types.js";
import { BlobWriter } from "./blob-writer.js";
import { registerCollector } from "./collector.js";
import { enforceRetention } from "./retention.js";
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
 *     creates the blob writer, runs retention, and registers all hook handlers
 *     and diagnostic event subscribers.
 *  2. On stop — unsubscribes diagnostic events and closes the JSONL writer.
 */
export function createTelemetryService(api: OpenClawPluginApi): OpenClawPluginService {
  let unsubDiag: (() => void) | null = null;
  let writerClose: (() => Promise<void>) | null = null;

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

      // Open JSONL writer
      const { write, close } = createJsonlWriter(telemetryDir, cfg);
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
    },
  } satisfies OpenClawPluginService;
}
