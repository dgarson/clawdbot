import type { OpenClawPluginApi, PluginHookGatewayContext } from "../../src/plugins/types.js";

/**
 * Unified API Telemetry Plugin
 *
 * Demonstrates scaffolding a common pattern to track costs and limits
 * across ALL external API calls (LLMs, TTS, Skills, etc.) using OpenClaw hooks.
 */
export default function registerApiTelemetryProxy(api: OpenClawPluginApi) {
  const config = api.pluginConfig || {};
  const enforceBudgets = config.enforceBudgets ?? true;
  const proxyUrl = config.proxyUrl ?? "https://proxy.internal.local";

  api.logger.info("Initializing Unified API Telemetry tracking...");

  // 1. Hook into Tool Execution (Skills, Nano Banana, Web Search)
  api.registerHook(
    "before_tool_call",
    async (ctx: PluginHookGatewayContext) => {
      // In a real proxy architecture, OpenClaw would rewrite the base URL
      // of outgoing requests to hit `proxyUrl` and attach tracking headers.

      const { toolName, args } = ctx.event?.payload || {};
      api.logger.debug(`Intercepting tool call for telemetry: ${toolName}`);

      // If we are enforcing budgets in OpenClaw directly before the proxy:
      if (enforceBudgets) {
        // e.g., Check Redis or local cache if we exceeded the weekly limit
        const currentSpend = await checkWeeklySpend(toolName);
        if (currentSpend > config.weeklyLimitUsd) {
          throw new Error(
            `Budget Exceeded: Tool ${toolName} cannot be executed. Weekly limit of $${config.weeklyLimitUsd} reached.`,
          );
        }
      }
    },
    {
      name: "api-telemetry.before-tool",
      description: "Intercepts tool calls to enforce budgets and route through proxy",
      priority: 100, // High priority to run before actual execution
    },
  );

  // 2. Register an HTTP Webhook for the Proxy to report async costs back to OpenClaw
  api.registerHttpRoute({
    path: "/api/telemetry/proxy-webhook",
    handler: async (req, res) => {
      try {
        const body = req.body;
        // Body contains: { service: "tts-elevenlabs", costUsd: 0.05, latencyMs: 400, tokens: 0 }

        // Emit a standardized diagnostic event for the `apps/web-next` UI
        api.runtime.emitDiagnosticEvent({
          type: "api.usage.cost",
          service: body.service,
          costUsd: body.costUsd,
          latencyMs: body.latencyMs,
          timestamp: Date.now(),
          metadata: body.metadata,
        });

        res.status(200).json({ status: "recorded" });
      } catch (err) {
        api.logger.error("Failed to process proxy webhook: " + err);
        res.status(500).json({ error: "Internal Server Error" });
      }
    },
  });

  // 3. Register a Gateway Method so the Frontend UI can fetch the aggregated usage
  api.registerGatewayMethod("telemetry.usage.get", async (req) => {
    // Fetch aggregated data from DB/Redis or internal memory
    const usageData = await fetchAggregatedUsage(req.timeRange);
    return { success: true, data: usageData };
  });
}

// Mock helper functions
async function checkWeeklySpend(serviceName: string): Promise<number> {
  return 45.0; // Mock current spend
}

async function fetchAggregatedUsage(timeRange: string) {
  return [
    { service: "llm-core", costUsd: 145.2, limitUsd: 500 },
    { service: "tts-elevenlabs", costUsd: 85.5, limitUsd: 100 },
    { service: "nano-banana", costUsd: 12.4, limitUsd: 50 },
  ];
}
