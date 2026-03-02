import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { OpenClawPluginConfigSchema } from "openclaw/plugin-sdk";
import { createTelemetryService } from "./src/service.js";

/**
 * JSON schema for the telemetry plugin config.
 * Mirrors the shape defined in openclaw.plugin.json.
 */
function makeTelemetryConfigSchema(): OpenClawPluginConfigSchema {
  return {
    jsonSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        enabled: { type: "boolean" },
        captureToolResults: { type: "string", enum: ["none", "summary", "full"] },
        captureToolInputs: { type: "string", enum: ["none", "summary", "full"] },
        captureLlmPayloads: { type: "boolean" },
        rotationPolicy: { type: "string", enum: ["daily", "weekly", "none"] },
        retentionDays: { type: "number" },
        blobThresholdBytes: { type: "number" },
        dataDir: { type: "string" },
      },
    },
  };
}

const plugin = {
  id: "telemetry",
  name: "OpenClaw Telemetry",
  description:
    "Session replay, tool audit, channel linkage, and per-call usage tracking via JSONL event capture.",
  configSchema: makeTelemetryConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerService(createTelemetryService(api));
  },
};

export default plugin;
