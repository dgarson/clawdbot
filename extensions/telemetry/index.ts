/**
 * OpenClaw Telemetry Extension — Phase 1
 *
 * Captures structured telemetry events (session lifecycle + model usage)
 * and writes them to a configurable sink (file and/or stdout).
 *
 * Zero changes to core src/ — extension-only, additive.
 */

import { homedir } from "node:os";
import { join } from "node:path";
import type { OpenClawPluginApi, OpenClawPluginService } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { registerHooks } from "./src/hooks.js";
import { TelemetrySink } from "./src/sink.js";

const DEFAULT_TELEMETRY_FILE = join(homedir(), ".openclaw", "telemetry", "events.jsonl");

function createTelemetryService(api: OpenClawPluginApi): OpenClawPluginService {
  let cleanup: (() => void) | null = null;

  return {
    id: "telemetry",
    async start(ctx) {
      // Read config from the OpenClaw config: diagnostics.telemetry
      const diagnostics = ctx.config.diagnostics as Record<string, unknown> | undefined;
      const telConfig = diagnostics?.telemetry as Record<string, unknown> | undefined;

      // Telemetry is enabled by default if diagnostics is enabled,
      // but can be explicitly disabled via diagnostics.telemetry.enabled = false
      const diagnosticsEnabled = diagnostics?.enabled !== false;
      const telemetryEnabled = telConfig?.enabled !== false;

      if (!diagnosticsEnabled || !telemetryEnabled) {
        return;
      }

      const sinkConfig = {
        file: (telConfig?.file as string) ?? DEFAULT_TELEMETRY_FILE,
        stdout: (telConfig?.stdout as boolean) ?? false,
      };

      const sink = new TelemetrySink(sinkConfig);
      cleanup = registerHooks(api, sink);

      ctx.logger.info(
        `telemetry: started — sink: ${sinkConfig.file}${sinkConfig.stdout ? " + stdout" : ""}`,
      );
    },
    async stop() {
      if (cleanup) {
        cleanup();
        cleanup = null;
      }
    },
  };
}

const plugin = {
  id: "telemetry",
  name: "Telemetry",
  description:
    "Structured telemetry event capture for agent sessions, model usage, and cost attribution",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerService(createTelemetryService(api));
  },
};

export default plugin;
