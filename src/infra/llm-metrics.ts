import type { Model } from "@mariozechner/pi-ai";
import { emitDiagnosticEvent } from "./diagnostic-events.js";
import { ExecutionContextStore } from "./execution-context.js";

type ModelUsage = { promptTokens?: number; completionTokens?: number; totalTokens?: number };

/**
 * Helper to intercept out-of-band/synthetic LLM usage (like TTS summarizeText)
 * and pipe the usage records directly to the OpenClaw telemetry subsystem.
 */
export async function instrumentModelCall<R extends { usage?: ModelUsage }>(
  modelOrRef: string | Model<string>,
  execute: () => Promise<R>,
): Promise<R> {
  const modelStr =
    typeof modelOrRef === "string" ? modelOrRef : `${modelOrRef.provider}/${modelOrRef.id}`;

  const [provider, modelId] = modelStr.split("/");

  const result = await execute();

  if (result && typeof result === "object" && result.usage) {
    const ctx = ExecutionContextStore.get();
    if (ctx?.runId) {
      emitDiagnosticEvent({
        type: "model.call",
        sessionKey: ctx.sessionKey,
        sessionId: ctx.agentId,
        runId: ctx.runId,
        provider: provider || "unknown",
        model: modelId || modelStr,
        usage: {
          input: result.usage.promptTokens,
          output: result.usage.completionTokens,
          total: result.usage.totalTokens,
        },
      });
    }
  }

  return result;
}
